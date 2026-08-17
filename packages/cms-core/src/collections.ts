import { z } from "zod";

import {
  cmsCapabilitySchema,
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
  /** Type-only marker used by CmsCollectionData; never emitted at runtime. */
  readonly __cmsFieldValue?: TValue;
};

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

export type CmsCollectionData<TCollection extends CmsCollectionDefinition> =
  RequiredCmsCollectionData<TCollection["fields"]> &
    OptionalCmsCollectionData<TCollection["fields"]>;

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
  readonly access: CmsCollectionAccess;
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
        })
        .passthrough(),
    ),
    lifecycle: cmsCollectionLifecycleSchema,
    access: cmsCollectionAccessSchema,
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
