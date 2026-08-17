import { z } from "zod";
import { cmsCapabilitySchema, type CmsCapability } from "@agency/cms-core";

import {
  bentoDetailsBlockSchema,
  benefitsBlockSchema,
  craftProcessBlockSchema,
  faqBlockSchema,
  footerCtaBlockSchema,
  heroBlockSchema,
  horizontalGalleryBlockSchema,
  marqueeBlockSchema,
  measurementGuideBlockSchema,
  threatNarrativeBlockSchema,
} from "./landing";
import { safePublicLinkSchema } from "./url";

export * from "./landing";
export * from "./deployment";
export * from "./incidents";
export * from "./operations";
export * from "./rich-text";
export * from "./site-manifest";
export * from "./url";
export * from "./vitals";
export {
  CmsError,
  cmsBlockBaseSchema,
  cmsDocumentStatusSchema,
  cmsErrorCodeSchema,
  cmsErrorContractSchema,
  cmsProviderCapabilitiesSchema,
  createCmsBlockSchema,
  createCmsDocumentSchema,
  migrateBlockData,
  schemaVersionSchema,
  type CmsBlock,
  type CmsBlockMigration,
  type CmsDocument,
  type CmsDocumentStatus,
  type CmsErrorCode,
  type CmsErrorContract,
  type CmsProviderCapabilities,
} from "@agency/cms-core";
export { cmsCapabilitySchema };
export type { CmsCapability };

export const postStatusSchema = z.enum(["draft", "published"]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const homeBlockSchema = z.union([
  heroBlockSchema,
  threatNarrativeBlockSchema,
  marqueeBlockSchema,
  benefitsBlockSchema,
  craftProcessBlockSchema,
  bentoDetailsBlockSchema,
  horizontalGalleryBlockSchema,
  measurementGuideBlockSchema,
  faqBlockSchema,
  footerCtaBlockSchema,
]);
export type HomeBlock = z.infer<typeof homeBlockSchema>;

export const standardPageBlockSchema = z.union([
  z.object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.literal("richText"),
    content: z.string().default(""),
  }),
  z.object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.literal("productGrid"),
    categoryId: z.string().optional(),
    limit: z.coerce.number().int().positive().max(24).optional(),
  }),
  z.object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.literal("cta"),
    title: z.string().min(1),
    href: safePublicLinkSchema,
  }),
]);
export type StandardPageBlock = z.infer<typeof standardPageBlockSchema>;
export type IdentifiedStandardPageBlock = StandardPageBlock & { id: string };

export const pageBlockSchema = z.union([
  homeBlockSchema,
  standardPageBlockSchema,
]);
export type PageBlock = z.infer<typeof pageBlockSchema>;

export const pageBlockListSchema = z.array(pageBlockSchema);
export const pageBlocksSchema = pageBlockListSchema.default([]);

export function createStandardPageBlockId(
  type: StandardPageBlock["type"],
  existingIds: Iterable<string>,
  entropy = crypto.randomUUID(),
) {
  const claimed = new Set(existingIds);
  const safeEntropy =
    entropy
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "block";
  const base = `standard-${type}-${safeEntropy}`.slice(0, 128);
  let candidate = base;
  let suffix = 2;
  while (claimed.has(candidate)) {
    const marker = `-${suffix++}`;
    candidate = `${base.slice(0, 128 - marker.length)}${marker}`;
  }
  return candidate;
}

/**
 * Upgrades flattened v0 standard blocks to stable visual identities without
 * changing their public rendering shape. Existing unique IDs are preserved;
 * missing or duplicated IDs receive a deterministic legacy-safe identity so a
 * reorder can be saved without retargeting the canvas selection.
 */
export function ensureStandardPageBlockIds(
  blocks: readonly StandardPageBlock[],
): IdentifiedStandardPageBlock[] {
  const claimed = new Set<string>();
  return blocks.map((block, index) => {
    const existing = block.id?.trim();
    let id = existing && !claimed.has(existing) ? existing : "";
    if (!id) {
      const base = `standard-${index}-${block.type}`;
      id = base;
      let suffix = 2;
      while (claimed.has(id)) id = `${base}-${suffix++}`;
    }
    claimed.add(id);
    return block.id === id
      ? (block as IdentifiedStandardPageBlock)
      : { ...block, id };
  });
}

/**
 * Immutable payload written to `page_revisions` when a working page is
 * published. Public renderers must validate this payload and never fall back to
 * mutable fields from `pages` when it is invalid.
 */
export const pageRevisionSnapshotSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  template: z.enum(["landing", "standard"]).default("standard"),
  blocks: pageBlocksSchema,
  seoTitle: z.string().default(""),
  seoDescription: z.string().default(""),
  canonicalUrl: z.string().default(""),
  ogImage: z.string().default(""),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
});
export type PageRevisionSnapshot = z.infer<typeof pageRevisionSnapshotSchema>;

/** Published post payload. Timestamps and the stable document id remain on the
 * parent `posts` row; all user-visible content is snapshotted here. */
export const postRevisionSnapshotSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  coverImage: z.string().default(""),
  tags: z.array(z.string()).default([]),
  content: z.string().default(""),
  publishDate: z.string().default(""),
  seoTitle: z.string().default(""),
  seoDescription: z.string().default(""),
  canonicalUrl: z.string().default(""),
  ogImage: z.string().default(""),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
  url: z.string().default(""),
  tableOfContents: z
    .lazy((): z.ZodType<JsonValue> => jsonValueSchema)
    .nullable()
    .default(null),
});
export type PostRevisionSnapshot = z.infer<typeof postRevisionSnapshotSchema>;

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const staffRoleSchema = z.enum(["owner", "admin", "editor"]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const roleCapabilities = {
  owner: cmsCapabilitySchema.options,
  admin: cmsCapabilitySchema.options.filter(
    (capability) => capability !== "staff.manage",
  ),
  editor: [
    "content.readDraft",
    "content.write",
    "content.review.request",
    "media.manage",
  ],
} satisfies Record<StaffRole, readonly CmsCapability[]>;

export function roleHasCapability(
  role: StaffRole | null | undefined,
  capability: CmsCapability,
) {
  const capabilities: readonly CmsCapability[] | undefined = role
    ? roleCapabilities[role]
    : undefined;

  return capabilities?.includes(capability) ?? false;
}

export const revisionNoteSchema = z.string().trim().max(240).default("");

export const menuItemSchema: z.ZodType<{
  label: string;
  href: string;
  order?: number;
  children?: Array<{
    label: string;
    href: string;
    order?: number;
  }>;
}> = z.object({
  label: z.string().min(1),
  href: safePublicLinkSchema,
  order: z.coerce.number().int().optional(),
  children: z
    .array(
      z.object({
        label: z.string().min(1),
        href: safePublicLinkSchema,
        order: z.coerce.number().int().optional(),
      }),
    )
    .optional(),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuLocationSchema = z.enum(["header", "footer"]);
export type MenuLocation = z.infer<typeof menuLocationSchema>;

export const defaultSocials = {
  facebook: "",
  instagram: "",
  shopee: "",
  youtube: "",
  tiktok: "",
  zalo: "",
} satisfies Record<string, string>;

const socialLinkSchema = z.literal("").or(safePublicLinkSchema);

export const socialsSchema = z
  .object({
    facebook: socialLinkSchema.default(""),
    instagram: socialLinkSchema.default(""),
    shopee: socialLinkSchema.default(""),
    youtube: socialLinkSchema.default(""),
    tiktok: socialLinkSchema.default(""),
    zalo: socialLinkSchema.default(""),
  })
  .catchall(socialLinkSchema)
  .default(defaultSocials);
export type SiteSocials = z.infer<typeof socialsSchema>;

export const homepageSectionSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().default(true),
  title: z.string().optional(),
});
export type HomepageSection = z.infer<typeof homepageSectionSchema>;

export const allowedMediaTypes = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const allowedMediaTypeSchema = z.enum(allowedMediaTypes);
export type AllowedMediaType = z.infer<typeof allowedMediaTypeSchema>;

export const extensionByMediaType: Record<AllowedMediaType, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const maxMediaFiles = 12;
export const maxMediaBytes = 5 * 1024 * 1024;
export const maxMediaBatchBytes = 30 * 1024 * 1024;
export const mediaKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$/i;

export function slugifyContent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
