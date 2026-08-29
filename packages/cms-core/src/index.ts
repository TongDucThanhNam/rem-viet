import { z } from "zod";

export * from "./collections.js";
export * from "./artifacts.js";
export * from "./extensions.js";
export * from "./extension-lifecycle.js";
export * from "./fields.js";
export * from "./jobs.js";
export * from "./primitives.js";
export * from "./relationships.js";
export * from "./reusable-content.js";
import {
  cmsCapabilitySchema,
  cmsLocaleSchema,
  CmsError,
  schemaVersionSchema,
} from "./primitives.js";

export const cmsBlockBaseSchema = z.object({
  id: z.string().trim().min(1).max(128),
  type: z.string().trim().min(1).max(128),
  schemaVersion: schemaVersionSchema,
  enabled: z.boolean(),
});

export type CmsBlock<TType extends string = string, TData = unknown> = z.infer<
  typeof cmsBlockBaseSchema
> & {
  type: TType;
  data: TData;
};

export function createCmsBlockSchema<
  const TType extends string,
  TDataSchema extends z.ZodType,
>(type: TType, dataSchema: TDataSchema) {
  return cmsBlockBaseSchema.extend({
    type: z.literal(type),
    data: dataSchema,
  });
}

export const cmsDocumentStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);
export type CmsDocumentStatus = z.infer<typeof cmsDocumentStatusSchema>;

export function createCmsDocumentSchema<TBlockSchema extends z.ZodType>(
  blockSchema: TBlockSchema,
) {
  return z.object({
    id: z.string().trim().min(1).max(128),
    documentType: z.string().trim().min(1).max(128),
    schemaVersion: schemaVersionSchema,
    version: z.number().int().nonnegative(),
    status: cmsDocumentStatusSchema,
    blocks: z.array(blockSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  });
}

export type CmsDocument<TBlock extends CmsBlock = CmsBlock> = {
  id: string;
  documentType: string;
  schemaVersion: number;
  version: number;
  status: CmsDocumentStatus;
  blocks: TBlock[];
  createdAt: string;
  updatedAt: string;
};

export const cmsProviderCapabilitiesSchema = z.object({
  supported: z.array(cmsCapabilitySchema),
});
export type CmsProviderCapabilities = z.infer<
  typeof cmsProviderCapabilitiesSchema
>;

export const cmsEditorialReviewStatusSchema = z.enum([
  "none",
  "requested",
  "changes_requested",
  "approved",
]);
export type CmsEditorialReviewStatus = z.infer<
  typeof cmsEditorialReviewStatusSchema
>;

export const cmsEditorialReviewDecisionSchema = z.enum([
  "changes_requested",
  "approved",
]);
export type CmsEditorialReviewDecision = z.infer<
  typeof cmsEditorialReviewDecisionSchema
>;

export const cmsEditorialReviewNoteSchema = z.string().trim().max(500);

const cmsEditorialPrincipalIdSchema = z.string().trim().min(1).max(256);
const cmsEditorialPrincipalIdsSchema = z
  .array(cmsEditorialPrincipalIdSchema)
  .max(20)
  .transform((values) => [...new Set(values)].sort());

export const cmsEditorialReviewChecklistItemSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().trim().min(1).max(160),
  required: z.boolean().default(true),
});
export type CmsEditorialReviewChecklistItem = z.infer<
  typeof cmsEditorialReviewChecklistItemSchema
>;

const cmsEditorialReviewTaskShape = {
  assigneeIds: cmsEditorialPrincipalIdsSchema.default([]),
  assigneeRoles: z
    .array(z.string().trim().min(1).max(64))
    .max(10)
    .default([])
    .transform((values) => [...new Set(values)].sort()),
  mentionIds: cmsEditorialPrincipalIdsSchema.default([]),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  checklist: z.array(cmsEditorialReviewChecklistItemSchema).max(20).default([]),
  notify: z.boolean().default(true),
};

function validateEditorialReviewChecklistIds(
  value: { checklist: Array<{ id: string }> },
  context: z.RefinementCtx,
) {
  const checklistIds = value.checklist.map((item) => item.id);
  const duplicate = checklistIds.find(
    (id, index) => checklistIds.indexOf(id) !== index,
  );
  if (duplicate) {
    context.addIssue({
      code: "custom",
      message: `Duplicate checklist item: ${duplicate}`,
      path: ["checklist"],
    });
  }
}

/** Portable task metadata attached to the immutable review request event. */
export const cmsEditorialReviewTaskSchema = z
  .object(cmsEditorialReviewTaskShape)
  .superRefine(validateEditorialReviewChecklistIds);
export type CmsEditorialReviewTask = z.infer<
  typeof cmsEditorialReviewTaskSchema
>;

export const cmsEditorialReviewTargetSchema = z.object({
  documentType: z.string().trim().min(1).max(128),
  documentId: z.string().trim().min(1).max(128),
});
export type CmsEditorialReviewTarget = z.infer<
  typeof cmsEditorialReviewTargetSchema
>;

const cmsEditorialReviewCommandSchema = cmsEditorialReviewTargetSchema.extend({
  expectedVersion: z.number().int().nonnegative(),
  actorId: cmsEditorialPrincipalIdSchema,
  actorRole: z.string().trim().min(1).max(64).optional(),
  note: cmsEditorialReviewNoteSchema.default(""),
});

export const requestCmsEditorialReviewInputSchema =
  cmsEditorialReviewCommandSchema
    .extend(cmsEditorialReviewTaskShape)
    .superRefine(validateEditorialReviewChecklistIds);
export type RequestCmsEditorialReviewInput = z.input<
  typeof requestCmsEditorialReviewInputSchema
>;

export const decideCmsEditorialReviewInputSchema =
  cmsEditorialReviewCommandSchema
    .extend({
      decision: cmsEditorialReviewDecisionSchema,
      completedChecklistItemIds: cmsEditorialPrincipalIdsSchema.default([]),
    })
    .superRefine((value, context) => {
      if (value.decision === "changes_requested" && !value.note) {
        context.addIssue({
          code: "custom",
          message: "A note is required when requesting changes.",
          path: ["note"],
        });
      }
    });
export type DecideCmsEditorialReviewInput = z.input<
  typeof decideCmsEditorialReviewInputSchema
>;

/** Editorial experience capabilities stay separate from authorization grants. */
export const cmsVisualEditingCapabilitiesSchema = z.object({
  draftMode: z.boolean(),
  livePreview: z.boolean(),
  clickToEdit: z.boolean(),
  sectionReorder: z.boolean(),
  responsivePreview: z.boolean(),
  webhooks: z.boolean(),
  localization: z.boolean(),
});
export type CmsVisualEditingCapabilities = z.infer<
  typeof cmsVisualEditingCapabilitiesSchema
>;

function hasSafeProtocol(value: string, protocols: readonly string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const safePublicLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      (value.startsWith("#") && value.length > 1) ||
      hasSafeProtocol(value, ["http:", "https:", "mailto:", "tel:"]),
    {
      message:
        "Expected a safe public URL, path, anchor, email, or phone link.",
    },
  );

export const safeMediaSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      hasSafeProtocol(value, ["http:", "https:"]),
    { message: "Expected a local path or an HTTP(S) media URL." },
  );

export const cmsResourceNameSchema = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);

export const cmsSiteOriginSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}, "Site URL must be an HTTPS origin without credentials, path, query, or hash.");

const cmsPackageVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/,
    "Kit version must be an exact semantic version.",
  );
const cmsManifestIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[0-9A-Za-z@][0-9A-Za-z@/._-]*$/);
const cmsDisplayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Site name must not contain control characters.",
  );

/** Canonical provider-neutral manifest for independently provisioned sites. */
export const cmsSiteManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: cmsResourceNameSchema,
    name: cmsDisplayNameSchema,
    siteUrl: cmsSiteOriginSchema,
    kit: z
      .object({
        version: cmsPackageVersionSchema,
        template: cmsManifestIdentifierSchema,
        provider: cmsManifestIdentifierSchema,
        contentSchemaVersion: schemaVersionSchema,
      })
      .strict(),
    defaultLocale: cmsLocaleSchema,
    locales: z.array(cmsLocaleSchema).min(1),
    preset: cmsManifestIdentifierSchema,
    brand: z
      .object({
        logo: safeMediaSourceSchema,
        colors: z.record(z.string(), z.string().trim().min(1)),
        fonts: z.array(z.string().trim().min(1)).min(1),
      })
      .strict(),
    features: z.record(z.string(), z.boolean()),
    infrastructure: z
      .object({
        adapter: cmsManifestIdentifierSchema,
        alchemyApp: cmsResourceNameSchema,
        workerName: cmsResourceNameSchema,
        d1Name: cmsResourceNameSchema,
        r2BucketName: cmsResourceNameSchema,
        backupBucketName: cmsResourceNameSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((manifest, context) => {
    const locales = new Set(manifest.locales);
    if (locales.size !== manifest.locales.length) {
      context.addIssue({
        code: "custom",
        path: ["locales"],
        message: "Manifest locales must be unique.",
      });
    }
    if (!locales.has(manifest.defaultLocale)) {
      context.addIssue({
        code: "custom",
        path: ["defaultLocale"],
        message: "Default locale must be present in locales.",
      });
    }
  });
export type CmsSiteManifest = z.infer<typeof cmsSiteManifestSchema>;

export type CmsBlockMigration<TData> = {
  from: number;
  to: number;
  migrate: (data: unknown) => TData;
};

export function migrateBlockData<TData>(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: readonly CmsBlockMigration<TData>[],
): TData | unknown {
  let currentData = data;
  let currentVersion = fromVersion;

  while (currentVersion < toVersion) {
    const migration = migrations.find(
      (candidate) => candidate.from === currentVersion,
    );
    if (!migration || migration.to !== currentVersion + 1) {
      throw new CmsError({
        code: "MIGRATION_FAILED",
        message: `Missing migration from schema version ${currentVersion}.`,
        retryable: false,
      });
    }
    currentData = migration.migrate(currentData);
    currentVersion = migration.to;
  }

  return currentData;
}
