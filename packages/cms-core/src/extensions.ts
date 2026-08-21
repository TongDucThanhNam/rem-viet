import { z } from "zod";

import {
  createCollectionRegistry,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
} from "./collections.js";
import {
  cmsCapabilitySchema,
  CmsError,
  type CmsCapability,
} from "./primitives.js";

export const cmsLifecycleOperationSchema = z.enum([
  "create",
  "update",
  "publish",
  "unpublish",
  "restore",
  "delete",
]);
export type CmsLifecycleOperation = z.infer<typeof cmsLifecycleOperationSchema>;

export const cmsLifecycleHookEventSchema = z.enum([
  "validate",
  ...cmsLifecycleOperationSchema.options,
]);
export type CmsLifecycleHookEvent = z.infer<typeof cmsLifecycleHookEventSchema>;

export type CmsLifecycleHookContext<TData = Record<string, unknown>> = {
  readonly event: CmsLifecycleHookEvent;
  readonly operation: CmsLifecycleOperation;
  readonly collection: CmsCollectionDefinition;
  readonly actorId: string;
  readonly documentId: string;
  readonly locale: string | null;
  readonly data: Readonly<TData> | null;
  readonly previousData: Readonly<TData> | null;
};

export type CmsLifecycleHookResult<TData = Record<string, unknown>> = void | {
  readonly data: TData;
};

export type CmsLifecycleHook<TData = Record<string, unknown>> = {
  readonly id: string;
  readonly event: CmsLifecycleHookEvent;
  readonly collection?: string;
  readonly order?: number;
  readonly run: (
    context: CmsLifecycleHookContext<TData>,
  ) => CmsLifecycleHookResult<TData> | Promise<CmsLifecycleHookResult<TData>>;
};

export type CmsFeaturePermission = {
  readonly id: string;
  readonly capability: CmsCapability;
  readonly collection?: string;
  readonly operations: readonly CmsLifecycleOperation[];
  readonly description?: string;
};

export type CmsFeatureMigration = {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly migrate: (state: unknown) => unknown | Promise<unknown>;
};

export type CmsAdminContribution = {
  readonly id: string;
  readonly collection?: string;
  readonly placement:
    "navigation" | "list" | "form" | "dashboard" | "root" | "document";
  readonly label: string;
};

export type CmsFeatureModuleManifest = Readonly<{
  schemaVersion: 1;
  packageName: string;
  version: string;
  cmsCompatibility: Readonly<{
    minimum: string;
    maximumExclusive?: string;
  }>;
  uninstall: Readonly<{
    dataPolicy: "retain" | "delete" | "export-then-delete";
    description: string;
  }>;
}>;

export type CmsFeatureModule = {
  readonly id: string;
  readonly manifest?: CmsFeatureModuleManifest;
  readonly dependsOn?: readonly string[];
  readonly collections?: readonly CmsCollectionDefinition[];
  readonly hooks?: readonly CmsLifecycleHook[];
  readonly permissions?: readonly CmsFeaturePermission[];
  readonly migrations?: readonly CmsFeatureMigration[];
  readonly admin?: readonly CmsAdminContribution[];
};

const extensionIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(96)
  .regex(/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/);

const exactSemverSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);

const packageNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(214)
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/);

function semverParts(value: string) {
  const [core] = value.split("-");
  return core!.split(".").map(Number) as [number, number, number];
}

function compareSemver(left: string, right: string) {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference) return difference;
  }
  return 0;
}

export function defineCmsFeatureModuleManifest(
  manifest: CmsFeatureModuleManifest,
): CmsFeatureModuleManifest {
  const parsed = z
    .object({
      schemaVersion: z.literal(1),
      packageName: packageNameSchema,
      version: exactSemverSchema,
      cmsCompatibility: z
        .object({
          minimum: exactSemverSchema,
          maximumExclusive: exactSemverSchema.optional(),
        })
        .strict(),
      uninstall: z
        .object({
          dataPolicy: z.enum(["retain", "delete", "export-then-delete"]),
          description: z.string().trim().min(1).max(500),
        })
        .strict(),
    })
    .strict()
    .safeParse(manifest);
  if (!parsed.success) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid feature module manifest for "${manifest.packageName}".`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }
  if (
    manifest.cmsCompatibility.maximumExclusive &&
    compareSemver(
      manifest.cmsCompatibility.minimum,
      manifest.cmsCompatibility.maximumExclusive,
    ) >= 0
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Feature compatibility maximum must exceed its minimum.",
      retryable: false,
    });
  }
  return Object.freeze(manifest);
}

export function assertCmsFeatureModuleCompatibility(
  module: Pick<CmsFeatureModule, "id" | "manifest">,
  cmsVersion: string,
) {
  exactSemverSchema.parse(cmsVersion);
  if (!module.manifest) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Feature module "${module.id}" has no compatibility manifest.`,
      retryable: false,
    });
  }
  const { minimum, maximumExclusive } = module.manifest.cmsCompatibility;
  if (
    compareSemver(cmsVersion, minimum) < 0 ||
    (maximumExclusive && compareSemver(cmsVersion, maximumExclusive) >= 0)
  ) {
    throw new CmsError({
      code: "CAPABILITY_UNAVAILABLE",
      message: `Feature module "${module.id}" is incompatible with CMS ${cmsVersion}.`,
      retryable: false,
      details: { minimum, maximumExclusive: maximumExclusive ?? null },
    });
  }
  return true;
}

function duplicate(values: readonly string[]) {
  return values.find((value, index) => values.indexOf(value) !== index);
}

function assertNoDuplicateIds(values: readonly string[], subject: string) {
  const id = duplicate(values);
  if (!id) return;
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message: `Duplicate ${subject} \"${id}\".`,
    retryable: false,
    details: { id, subject },
  });
}

export function defineCmsLifecycleHook<TData = Record<string, unknown>>(
  hook: CmsLifecycleHook<TData>,
): CmsLifecycleHook<TData> {
  const parsed = z
    .object({
      id: extensionIdSchema,
      event: cmsLifecycleHookEventSchema,
      collection: z.string().optional(),
      order: z.number().int().safe().optional(),
      run: z.function(),
    })
    .strict()
    .safeParse(hook);
  if (!parsed.success) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid lifecycle hook \"${hook.id}\".`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }
  return Object.freeze(hook);
}

export function defineFeatureModule<TModule extends CmsFeatureModule>(
  module: TModule,
): TModule {
  const parsed = z
    .object({
      id: extensionIdSchema,
      manifest: z.unknown().optional(),
      dependsOn: z.array(extensionIdSchema).optional(),
      collections: z.array(z.unknown()).optional(),
      hooks: z.array(z.unknown()).optional(),
      permissions: z.array(z.unknown()).optional(),
      migrations: z.array(z.unknown()).optional(),
      admin: z.array(z.unknown()).optional(),
    })
    .strict()
    .safeParse(module);
  if (!parsed.success) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid feature module \"${module.id}\".`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }
  if (module.dependsOn?.includes(module.id)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Feature module \"${module.id}\" cannot depend on itself.`,
      retryable: false,
    });
  }
  if (module.manifest) defineCmsFeatureModuleManifest(module.manifest);
  assertNoDuplicateIds(module.dependsOn ?? [], "module dependency");
  for (const hook of module.hooks ?? []) defineCmsLifecycleHook(hook);
  for (const permission of module.permissions ?? []) {
    if (
      !extensionIdSchema.safeParse(permission.id).success ||
      !cmsCapabilitySchema.safeParse(permission.capability).success ||
      !permission.operations.length ||
      permission.operations.some(
        (operation) =>
          !cmsLifecycleOperationSchema.safeParse(operation).success,
      )
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Invalid feature permission \"${permission.id}\".`,
        retryable: false,
      });
    }
  }
  for (const migration of module.migrations ?? []) {
    if (
      !extensionIdSchema.safeParse(migration.id).success ||
      !Number.isInteger(migration.from) ||
      migration.from < 0 ||
      migration.to !== migration.from + 1 ||
      typeof migration.migrate !== "function"
    ) {
      throw new CmsError({
        code: "MIGRATION_FAILED",
        message: `Invalid feature migration \"${migration.id}\".`,
        retryable: false,
      });
    }
  }
  for (const contribution of module.admin ?? []) {
    if (
      !extensionIdSchema.safeParse(contribution.id).success ||
      !["navigation", "list", "form", "dashboard", "root", "document"].includes(
        contribution.placement,
      ) ||
      !contribution.label.trim()
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Invalid admin contribution \"${contribution.id}\".`,
        retryable: false,
      });
    }
  }
  return Object.freeze(module);
}

type RegisteredHook = CmsLifecycleHook & {
  readonly moduleId: string;
  readonly moduleOrder: number;
};

export type CmsExtensionRegistry = Readonly<{
  collections: CmsCollectionRegistry;
  modules: readonly CmsFeatureModule[];
  hooks: readonly RegisteredHook[];
  permissions: readonly (CmsFeaturePermission & {
    readonly moduleId: string;
  })[];
  migrations: readonly (CmsFeatureMigration & { readonly moduleId: string })[];
  admin: readonly (CmsAdminContribution & { readonly moduleId: string })[];
  runHooks<TData extends Record<string, unknown> = Record<string, unknown>>(
    event: CmsLifecycleHookEvent,
    context: Omit<CmsLifecycleHookContext<TData>, "event">,
  ): Promise<TData | null>;
}>;

function orderModules(modules: readonly CmsFeatureModule[]) {
  const byId = new Map(modules.map((module) => [module.id, module] as const));
  for (const module of modules) {
    for (const dependency of module.dependsOn ?? []) {
      if (!byId.has(dependency)) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: `Feature module \"${module.id}\" depends on missing module \"${dependency}\".`,
          retryable: false,
          details: { module: module.id, dependency },
        });
      }
    }
  }

  const ordered: CmsFeatureModule[] = [];
  const remaining = new Map(byId);
  while (remaining.size) {
    const ready = [...remaining.values()]
      .filter((module) =>
        (module.dependsOn ?? []).every((dependency) =>
          ordered.some(({ id }) => id === dependency),
        ),
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    if (!ready.length) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "Feature module dependency graph contains a cycle.",
        retryable: false,
        details: { modules: [...remaining.keys()].sort() },
      });
    }
    for (const module of ready) {
      ordered.push(module);
      remaining.delete(module.id);
    }
  }
  return ordered;
}

export function createCmsExtensionRegistry(input: {
  readonly collections?: readonly CmsCollectionDefinition[];
  readonly modules?: readonly CmsFeatureModule[];
}): CmsExtensionRegistry {
  const modules = (input.modules ?? []).map(defineFeatureModule);
  assertNoDuplicateIds(
    modules.map((module) => module.id),
    "feature module id",
  );
  const orderedModules = orderModules(modules);
  const collections = createCollectionRegistry([
    ...(input.collections ?? []),
    ...orderedModules.flatMap((module) => module.collections ?? []),
  ]);
  const registeredHooks = orderedModules.flatMap((module, moduleOrder) =>
    (module.hooks ?? []).map((hook) => ({
      ...hook,
      moduleId: module.id,
      moduleOrder,
    })),
  );
  const permissions = orderedModules.flatMap((module) =>
    (module.permissions ?? []).map((permission) => ({
      ...permission,
      moduleId: module.id,
    })),
  );
  const migrations = orderedModules.flatMap((module) =>
    (module.migrations ?? []).map((migration) => ({
      ...migration,
      moduleId: module.id,
    })),
  );
  const admin = orderedModules.flatMap((module) =>
    (module.admin ?? []).map((contribution) => ({
      ...contribution,
      moduleId: module.id,
    })),
  );
  assertNoDuplicateIds(
    registeredHooks.map(({ id }) => id),
    "lifecycle hook id",
  );
  assertNoDuplicateIds(
    permissions.map(({ id }) => id),
    "feature permission id",
  );
  assertNoDuplicateIds(
    migrations.map(({ id }) => id),
    "feature migration id",
  );
  assertNoDuplicateIds(
    admin.map(({ id }) => id),
    "admin contribution id",
  );

  const knownCollections = new Set(
    collections.collections.map((collection) => collection.slug),
  );
  for (const contribution of [...registeredHooks, ...permissions, ...admin]) {
    if (
      contribution.collection &&
      !knownCollections.has(contribution.collection)
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Extension contribution \"${contribution.id}\" targets unregistered collection \"${contribution.collection}\".`,
        retryable: false,
      });
    }
  }

  const hooks = Object.freeze(
    [...registeredHooks].sort(
      (left, right) =>
        left.moduleOrder - right.moduleOrder ||
        (left.order ?? 0) - (right.order ?? 0) ||
        left.id.localeCompare(right.id),
    ),
  );

  return Object.freeze({
    collections,
    modules: Object.freeze([...orderedModules]),
    hooks,
    permissions: Object.freeze(permissions),
    migrations: Object.freeze(migrations),
    admin: Object.freeze(admin),
    async runHooks<TData extends Record<string, unknown>>(
      event: CmsLifecycleHookEvent,
      context: Omit<CmsLifecycleHookContext<TData>, "event">,
    ) {
      let data = context.data as TData | null;
      for (const hook of hooks) {
        if (
          hook.event !== event ||
          (hook.collection && hook.collection !== context.collection.slug)
        ) {
          continue;
        }
        const result = await hook.run({ ...context, event, data });
        if (result && "data" in result) data = result.data as TData;
      }
      return data;
    },
  });
}
