import { z } from "zod";

import {
  cmsCapabilitySchema,
  cmsLocaleSchema,
  CmsError,
  schemaVersionSchema,
  type CmsCapability,
} from "./primitives.js";

export const cmsCollectionSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/);

export const cmsFieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][A-Za-z0-9]*$/);

export const cmsFieldKindSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);

const cmsCollectionLabelsSchema = z
  .object({
    singular: z.string().trim().min(1).max(80),
    plural: z.string().trim().min(1).max(80),
  })
  .strict();

export type CmsCollectionLabels = z.infer<typeof cmsCollectionLabelsSchema>;

export const cmsCollectionLifecycleSchema = z
  .object({
    drafts: z.boolean(),
    revisions: z.boolean(),
    scheduling: z.boolean(),
  })
  .strict()
  .superRefine((lifecycle, context) => {
    if (lifecycle.scheduling && !lifecycle.drafts) {
      context.addIssue({
        code: "custom",
        path: ["scheduling"],
        message: "Scheduling requires draft support.",
      });
    }
    if (lifecycle.revisions && !lifecycle.drafts) {
      context.addIssue({
        code: "custom",
        path: ["revisions"],
        message: "Revisions require draft support.",
      });
    }
  });

export type CmsCollectionLifecycle = z.infer<
  typeof cmsCollectionLifecycleSchema
>;

export const cmsCollectionLocalizationSchema = z
  .object({
    locales: z.array(cmsLocaleSchema).min(1).max(50).readonly(),
    defaultLocale: cmsLocaleSchema,
  })
  .strict()
  .superRefine((localization, context) => {
    if (new Set(localization.locales).size !== localization.locales.length) {
      context.addIssue({
        code: "custom",
        path: ["locales"],
        message: "Collection locales must be unique.",
      });
    }
    if (!localization.locales.includes(localization.defaultLocale)) {
      context.addIssue({
        code: "custom",
        path: ["defaultLocale"],
        message: "Default locale must be included in collection locales.",
      });
    }
  });

export type CmsCollectionLocalization = z.infer<
  typeof cmsCollectionLocalizationSchema
>;

export const cmsCollectionAccessSchema = z
  .object({
    read: z.array(cmsCapabilitySchema).readonly(),
    create: z.array(cmsCapabilitySchema).readonly(),
    update: z.array(cmsCapabilitySchema).readonly(),
    delete: z.array(cmsCapabilitySchema).readonly(),
    publish: z.array(cmsCapabilitySchema).readonly(),
  })
  .strict();

export type CmsCollectionAccess = {
  readonly read: readonly CmsCapability[];
  readonly create: readonly CmsCapability[];
  readonly update: readonly CmsCapability[];
  readonly delete: readonly CmsCapability[];
  readonly publish: readonly CmsCapability[];
};

export type CmsFieldOperation = "read" | "create" | "update";

export type CmsFieldLifecycleContext = Readonly<{
  operation: CmsFieldOperation;
  collection: string;
  actorId?: string;
  documentId?: string;
  locale?: string | null;
  path: readonly (string | number)[];
  data: Readonly<Record<string, unknown>>;
  previousData: Readonly<Record<string, unknown>> | null;
}>;

export type CmsFieldAccess = Readonly<
  Partial<
    Record<
      CmsFieldOperation,
      (context: CmsFieldLifecycleContext) => boolean | Promise<boolean>
    >
  >
>;

type CmsFieldCallback<TArguments extends readonly unknown[], TResult> = {
  bivarianceHack(...arguments_: TArguments): TResult;
}["bivarianceHack"];

export type CmsFieldHooks<TValue = unknown> = Readonly<{
  beforeValidate?: CmsFieldCallback<
    [value: unknown, context: CmsFieldLifecycleContext],
    unknown | Promise<unknown>
  >;
  afterValidate?: CmsFieldCallback<
    [value: TValue, context: CmsFieldLifecycleContext],
    void | Promise<void>
  >;
}>;

export type CmsFieldAsyncValidator<TValue = unknown> = CmsFieldCallback<
  [value: TValue, context: CmsFieldLifecycleContext],
  | void
  | true
  | string
  | readonly string[]
  | Promise<void | true | string | readonly string[]>
>;

export type CmsFieldValueResolver<TValue = unknown> = CmsFieldCallback<
  [context: CmsFieldLifecycleContext],
  TValue | Promise<TValue>
>;

export type CmsFieldDefinition<
  TName extends string = string,
  TKind extends string = string,
  TValue = unknown,
  TRequired extends boolean = boolean,
> = {
  readonly name: TName;
  readonly kind: TKind;
  readonly label: string;
  readonly required: TRequired;
  readonly indexed?: boolean;
  readonly unique?: boolean;
  /** Localized fields vary per locale; omitted/false fields are shared. */
  readonly localized?: boolean;
  readonly admin?: {
    readonly description?: string;
    readonly readOnly?: boolean;
  };
  readonly visibleWhen?: CmsFieldVisibilityCondition;
  /** Runtime field authorization. Denied reads are omitted; denied writes fail. */
  readonly access?: CmsFieldAccess;
  /** Async, provider-neutral field lifecycle hooks. */
  readonly hooks?: CmsFieldHooks<TValue>;
  /** Async validation runs after built-in parsing and hook normalization. */
  readonly validateAsync?: CmsFieldAsyncValidator<TValue>;
  /** Type-only marker used by CmsCollectionData; never emitted at runtime. */
  readonly __cmsFieldValue?: TValue;
};

export type CmsFieldVisibilityCondition =
  | { readonly field: string; readonly equals: unknown }
  | { readonly field: string; readonly notEquals: unknown }
  | { readonly field: string; readonly in: readonly unknown[] };

export type CmsCollectionAdminLayoutGroup = Readonly<{
  id: string;
  type: "tab" | "row" | "collapsible";
  label: string;
  fields: readonly string[];
  collapsed?: boolean;
}>;

const cmsFieldVisibilityConditionSchema = z.union([
  z.object({ field: cmsFieldNameSchema, equals: z.unknown() }).strict(),
  z.object({ field: cmsFieldNameSchema, notEquals: z.unknown() }).strict(),
  z
    .object({ field: cmsFieldNameSchema, in: z.array(z.unknown()).min(1) })
    .strict(),
]);

export type CmsFieldValue<TField extends CmsFieldDefinition> =
  TField extends CmsFieldDefinition<string, string, infer TValue, boolean>
    ? TValue
    : never;

type RequiredCmsCollectionData<TFields extends readonly CmsFieldDefinition[]> =
  {
    [
      TField in TFields[number] as TField["required"] extends true
        ? TField["name"]
        : never
    ]: CmsFieldValue<TField>;
  };

type OptionalCmsCollectionData<TFields extends readonly CmsFieldDefinition[]> =
  {
    [
      TField in TFields[number] as TField["required"] extends true
        ? never
        : TField["name"]
    ]?: CmsFieldValue<TField>;
  };

export type CmsFieldData<TFields extends readonly CmsFieldDefinition[]> =
  RequiredCmsCollectionData<TFields> & OptionalCmsCollectionData<TFields>;

export type CmsCollectionData<TCollection extends CmsCollectionDefinition> =
  CmsFieldData<TCollection["fields"]>;

export type CmsCollectionMigration<TData = unknown> = {
  readonly from: number;
  readonly to: number;
  readonly migrate: (data: unknown) => TData;
};

export type CmsCollectionDefinition<
  TSlug extends string = string,
  TFields extends readonly CmsFieldDefinition[] = readonly CmsFieldDefinition[],
> = {
  readonly slug: TSlug;
  readonly labels: CmsCollectionLabels;
  readonly schemaVersion: number;
  readonly fields: TFields;
  readonly lifecycle: CmsCollectionLifecycle;
  readonly localization?: CmsCollectionLocalization;
  readonly access: CmsCollectionAccess;
  readonly admin?: {
    readonly useAsTitle: string;
    readonly defaultColumns: readonly string[];
    readonly layout?: readonly CmsCollectionAdminLayoutGroup[];
  };
  readonly migrations?: readonly CmsCollectionMigration[];
};

const collectionShapeSchema = z
  .object({
    slug: cmsCollectionSlugSchema,
    labels: cmsCollectionLabelsSchema,
    schemaVersion: schemaVersionSchema,
    fields: z.array(
      z
        .object({
          name: cmsFieldNameSchema,
          kind: cmsFieldKindSchema,
          label: z.string().trim().min(1).max(120),
          required: z.boolean(),
          indexed: z.boolean().optional(),
          unique: z.boolean().optional(),
          localized: z.boolean().optional(),
          admin: z
            .object({
              description: z.string().trim().min(1).max(240).optional(),
              readOnly: z.boolean().optional(),
            })
            .strict()
            .optional(),
          visibleWhen: cmsFieldVisibilityConditionSchema.optional(),
        })
        .passthrough(),
    ),
    lifecycle: cmsCollectionLifecycleSchema,
    localization: cmsCollectionLocalizationSchema.optional(),
    access: cmsCollectionAccessSchema,
    admin: z
      .object({
        useAsTitle: cmsFieldNameSchema,
        defaultColumns: z.array(cmsFieldNameSchema).min(1).max(8).readonly(),
        layout: z
          .array(
            z
              .object({
                id: cmsFieldNameSchema,
                type: z.enum(["tab", "row", "collapsible"]),
                label: z.string().trim().min(1).max(120),
                fields: z.array(cmsFieldNameSchema).min(1).readonly(),
                collapsed: z.boolean().optional(),
              })
              .strict(),
          )
          .max(30)
          .readonly()
          .optional(),
      })
      .strict()
      .optional(),
    migrations: z
      .array(
        z.object({
          from: schemaVersionSchema,
          to: schemaVersionSchema,
          migrate: z.function(),
        }),
      )
      .optional(),
  })
  .strict();

function assertUnique(values: readonly string[], subject: string) {
  const duplicate = values.find(
    (value, index) => values.indexOf(value) !== index,
  );
  if (duplicate) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Duplicate ${subject} \"${duplicate}\".`,
      retryable: false,
      details: { duplicate, subject },
    });
  }
}

function assertMigrationChain(
  schemaVersion: number,
  migrations: readonly CmsCollectionMigration[],
) {
  const byFrom = new Map<number, CmsCollectionMigration>();
  for (const migration of migrations) {
    if (
      migration.from >= schemaVersion ||
      migration.to !== migration.from + 1 ||
      byFrom.has(migration.from)
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message:
          "Collection migrations must be unique, contiguous one-version steps below the current schema version.",
        retryable: false,
      });
    }
    byFrom.set(migration.from, migration);
  }

  if (schemaVersion > 1) {
    for (let version = 1; version < schemaVersion; version += 1) {
      if (!byFrom.has(version)) {
        throw new CmsError({
          code: "MIGRATION_FAILED",
          message: `Missing collection migration from schema version ${version}.`,
          retryable: false,
        });
      }
    }
  }
}

function assertFieldLifecycleDefinitions(
  fields: readonly CmsFieldDefinition[],
  path: readonly string[] = [],
) {
  for (const field of fields) {
    const fieldPath = [...path, field.name];
    for (const [operation, resolver] of Object.entries(field.access ?? {})) {
      if (
        !["read", "create", "update"].includes(operation) ||
        typeof resolver !== "function"
      ) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: `Field "${fieldPath.join(".")}" has invalid access control.`,
          retryable: false,
        });
      }
    }
    if (
      (field.hooks?.beforeValidate !== undefined &&
        typeof field.hooks.beforeValidate !== "function") ||
      (field.hooks?.afterValidate !== undefined &&
        typeof field.hooks.afterValidate !== "function") ||
      (field.validateAsync !== undefined &&
        typeof field.validateAsync !== "function")
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Field "${fieldPath.join(".")}" has invalid lifecycle callbacks.`,
        retryable: false,
      });
    }
    if (
      (field.kind === "computed" &&
        (!("compute" in field) || typeof field.compute !== "function")) ||
      ((field.kind === "virtual" || field.kind === "join") &&
        (!("resolve" in field) || typeof field.resolve !== "function"))
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Derived field "${fieldPath.join(".")}" requires a resolver.`,
        retryable: false,
      });
    }
    if (
      (field.kind === "group" || field.kind === "array") &&
      "fields" in field &&
      Array.isArray(field.fields)
    ) {
      assertFieldLifecycleDefinitions(
        field.fields as readonly CmsFieldDefinition[],
        fieldPath,
      );
    }
  }
}

export function defineCollection<
  const TSlug extends string,
  const TFields extends readonly CmsFieldDefinition[],
>(
  definition: CmsCollectionDefinition<TSlug, TFields>,
): CmsCollectionDefinition<TSlug, TFields> {
  const parsed = collectionShapeSchema.safeParse(definition);
  if (!parsed.success) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid collection definition for \"${definition.slug}\".`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }

  assertUnique(
    definition.fields.map((field) => field.name),
    "field name",
  );
  const fieldNames = new Set(definition.fields.map((field) => field.name));
  if (
    definition.admin &&
    (!fieldNames.has(definition.admin.useAsTitle) ||
      definition.admin.defaultColumns.some((name) => !fieldNames.has(name)))
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection \"${definition.slug}\" admin metadata references an unknown field.`,
      retryable: false,
    });
  }
  if (definition.admin?.layout) {
    assertUnique(
      definition.admin.layout.map((group) => group.id),
      "admin layout id",
    );
    const referencedFields = definition.admin.layout.flatMap(
      (group) => group.fields,
    );
    assertUnique(referencedFields, "admin layout field");
    const unknown = referencedFields.find((name) => !fieldNames.has(name));
    if (unknown) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Collection "${definition.slug}" admin layout references unknown field "${unknown}".`,
        retryable: false,
      });
    }
  }
  for (const field of definition.fields) {
    if (field.localized && !definition.localization) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Field \"${field.name}\" is localized but collection \"${definition.slug}\" has localization disabled.`,
        retryable: false,
      });
    }
    if (
      field.visibleWhen &&
      (!fieldNames.has(field.visibleWhen.field) ||
        field.visibleWhen.field === field.name)
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Field \"${field.name}\" has an invalid visibility dependency.`,
        retryable: false,
        details: { field: field.name, dependency: field.visibleWhen.field },
      });
    }
  }
  assertFieldLifecycleDefinitions(definition.fields);
  assertMigrationChain(definition.schemaVersion, definition.migrations ?? []);
  return Object.freeze(definition);
}

export function migrateCollectionData<TData>(
  definition: CmsCollectionDefinition,
  data: unknown,
  fromVersion: number,
): TData | unknown {
  if (fromVersion > definition.schemaVersion) {
    throw new CmsError({
      code: "MIGRATION_FAILED",
      message: `Cannot migrate future schema version ${fromVersion} to ${definition.schemaVersion}.`,
      retryable: false,
    });
  }

  let current = data;
  let version = fromVersion;
  while (version < definition.schemaVersion) {
    const migration = definition.migrations?.find(
      (candidate) => candidate.from === version,
    );
    if (!migration || migration.to !== version + 1) {
      throw new CmsError({
        code: "MIGRATION_FAILED",
        message: `Missing collection migration from schema version ${version}.`,
        retryable: false,
      });
    }
    current = migration.migrate(current);
    version = migration.to;
  }
  return current as TData | unknown;
}

export type CmsCollectionRegistry<
  TCollections extends readonly CmsCollectionDefinition[] =
    readonly CmsCollectionDefinition[],
> = {
  readonly collections: TCollections;
  get<TSlug extends TCollections[number]["slug"]>(
    slug: TSlug,
  ): Extract<TCollections[number], { slug: TSlug }>;
  has(slug: string): boolean;
};

function collectionFieldEntries(
  fields: readonly CmsFieldDefinition[],
  prefix = "",
): Array<{ field: CmsFieldDefinition; path: string }> {
  return fields.flatMap((field) => {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const entry = { field, path };
    if (
      (field.kind === "group" || field.kind === "array") &&
      "fields" in field &&
      Array.isArray(field.fields)
    ) {
      return [
        entry,
        ...collectionFieldEntries(
          field.fields as readonly CmsFieldDefinition[],
          path,
        ),
      ];
    }
    return [entry];
  });
}

export function createCollectionRegistry<
  const TCollections extends readonly CmsCollectionDefinition[],
>(collections: TCollections): CmsCollectionRegistry<TCollections> {
  assertUnique(
    collections.map((collection) => collection.slug),
    "collection slug",
  );
  const bySlug = new Map(
    collections.map((collection) => [collection.slug, collection] as const),
  );
  for (const collection of collections) {
    for (const { field, path } of collectionFieldEntries(collection.fields)) {
      if (
        field.kind !== "relationship" &&
        field.kind !== "polymorphic-relationship" &&
        field.kind !== "join"
      ) {
        continue;
      }
      const targets =
        "relationTo" in field
          ? Array.isArray(field.relationTo)
            ? field.relationTo
            : [field.relationTo]
          : [];
      const unknownTarget = targets.find(
        (target) => typeof target !== "string" || !bySlug.has(target),
      );
      if (!targets.length || unknownTarget !== undefined) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: `Relationship field \"${collection.slug}.${path}\" targets an unregistered collection.`,
          retryable: false,
          details: {
            collection: collection.slug,
            field: path,
            relationTo: unknownTarget ?? null,
          },
        });
      }
      if (field.kind === "join") {
        const relationTo =
          "relationTo" in field ? String(field.relationTo) : "";
        const foreignField =
          "foreignField" in field ? String(field.foreignField) : "";
        const target = bySlug.get(relationTo);
        const foreign = target?.fields.find(
          ({ name }) => name === foreignField,
        );
        const joinsSource =
          foreign?.kind === "relationship"
            ? "relationTo" in foreign && foreign.relationTo === collection.slug
            : foreign?.kind === "polymorphic-relationship"
              ? "relationTo" in foreign &&
                Array.isArray(foreign.relationTo) &&
                foreign.relationTo.includes(collection.slug)
              : false;
        if (!foreign || !joinsSource) {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: `Join field "${collection.slug}.${path}" requires relationship "${relationTo}.${foreignField}" to target "${collection.slug}".`,
            retryable: false,
          });
        }
        continue;
      }
      for (const targetSlug of targets) {
        const target = bySlug.get(String(targetSlug));
        const behavior =
          "localeBehavior" in field ? field.localeBehavior : undefined;
        if (target?.localization && !behavior) {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: `Relationship field \"${collection.slug}.${path}\" must declare locale behavior for localized target \"${target.slug}\".`,
            retryable: false,
          });
        }
        if (!target?.localization && behavior && behavior !== "any") {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: `Relationship field \"${collection.slug}.${path}\" cannot use \"${behavior}\" with a non-localized target.`,
            retryable: false,
          });
        }
        if (behavior === "same" && !collection.localization) {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: `Relationship field \"${collection.slug}.${path}\" requires a localized source for same-locale resolution.`,
            retryable: false,
          });
        }
      }
    }
  }

  return Object.freeze({
    collections: Object.freeze([...collections]) as unknown as TCollections,
    get<TSlug extends TCollections[number]["slug"]>(slug: TSlug) {
      const collection = bySlug.get(slug);
      if (!collection) {
        throw new CmsError({
          code: "NOT_FOUND",
          message: `Collection \"${slug}\" is not registered.`,
          retryable: false,
          details: { slug },
        });
      }
      return collection as Extract<TCollections[number], { slug: TSlug }>;
    },
    has(slug: string) {
      return bySlug.has(slug);
    },
  });
}
