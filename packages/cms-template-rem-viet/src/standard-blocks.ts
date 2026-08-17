import {
  createCmsBlockSchema,
  safePublicLinkSchema,
  type CmsBlockMigration,
} from "@agency/cms-core";
import {
  createBlockEditorRegistry,
  type CmsBlockAuthoringDefinition,
  type CmsBlockEditorProps,
} from "@agency/cms-admin";
import {
  createBlockRegistry,
  type BlockRendererProps,
} from "@agency/cms-react";
import type { ComponentType } from "react";
import { z } from "zod";

import { REM_VIET_BLOCK_SCHEMA_VERSION } from "./version";

export const richTextBlockDataSchema = z.object({
  content: z.string().default(""),
});
export const productGridBlockDataSchema = z.object({
  categoryId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(24).optional(),
});
export const standardCtaBlockDataSchema = z.object({
  title: z.string().min(1),
  href: safePublicLinkSchema,
});
export type RichTextBlockData = z.infer<typeof richTextBlockDataSchema>;
export type ProductGridBlockData = z.infer<typeof productGridBlockDataSchema>;
export type StandardCtaBlockData = z.infer<typeof standardCtaBlockDataSchema>;

export const richTextBlockSchema = createCmsBlockSchema(
  "richText",
  richTextBlockDataSchema,
);
export const productGridBlockSchema = createCmsBlockSchema(
  "productGrid",
  productGridBlockDataSchema,
);
export const standardCtaBlockSchema = createCmsBlockSchema(
  "cta",
  standardCtaBlockDataSchema,
);

export type RichTextBlock = z.infer<typeof richTextBlockSchema>;
export type ProductGridBlock = z.infer<typeof productGridBlockSchema>;
export type StandardCtaBlock = z.infer<typeof standardCtaBlockSchema>;

export const remVietStandardBlockSchema = z.union([
  richTextBlockSchema,
  productGridBlockSchema,
  standardCtaBlockSchema,
]);
export type RemVietStandardBlock = z.infer<typeof remVietStandardBlockSchema>;
export type RemVietStandardBlockType = RemVietStandardBlock["type"];

const remVietStandardBlockAuthoringCatalogSource = [
  {
    type: "richText",
    label: "Văn bản",
    description:
      "Nội dung dài có tiêu đề, danh sách, trích dẫn, ảnh, video và liên kết.",
    category: "Nội dung",
    keywords: ["text", "article", "body", "copy", "nội dung", "bài viết"],
  },
  {
    type: "productGrid",
    label: "Lưới sản phẩm",
    description:
      "Danh sách sản phẩm theo danh mục với số lượng hiển thị được giới hạn.",
    category: "Thương mại",
    keywords: ["products", "catalog", "shop", "grid", "sản phẩm", "danh mục"],
  },
  {
    type: "cta",
    label: "Kêu gọi hành động",
    description: "Tiêu đề chuyển đổi và liên kết tới bước tiếp theo của khách.",
    category: "Chuyển đổi",
    keywords: ["cta", "button", "contact", "conversion", "liên hệ", "nút"],
  },
] as const satisfies readonly CmsBlockAuthoringDefinition<RemVietStandardBlockType>[];

export const remVietStandardBlockAuthoringCatalog = Object.freeze(
  remVietStandardBlockAuthoringCatalogSource.map((definition) =>
    Object.freeze({
      ...definition,
      keywords: Object.freeze([...definition.keywords]),
    }),
  ),
);

export const remVietStandardBlockAuthoringByType = Object.freeze(
  Object.fromEntries(
    remVietStandardBlockAuthoringCatalog.map((definition) => [
      definition.type,
      definition,
    ]),
  ) as Record<
    RemVietStandardBlockType,
    (typeof remVietStandardBlockAuthoringCatalog)[number]
  >,
);

export const remVietStandardBlockLabels = Object.freeze(
  Object.fromEntries(
    remVietStandardBlockAuthoringCatalog.map(({ type, label }) => [
      type,
      label,
    ]),
  ) as Record<RemVietStandardBlockType, string>,
);

export function isRemVietStandardBlockType(
  value: unknown,
): value is RemVietStandardBlockType {
  return (
    typeof value === "string" &&
    Object.hasOwn(remVietStandardBlockAuthoringByType, value)
  );
}

export const defaultRichTextBlock: RichTextBlock = {
  id: "standard-rich-text",
  type: "richText",
  schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
  enabled: true,
  data: { content: "" },
};
export const defaultProductGridBlock: ProductGridBlock = {
  id: "standard-product-grid",
  type: "productGrid",
  schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
  enabled: true,
  data: { limit: 8 },
};
export const defaultStandardCtaBlock: StandardCtaBlock = {
  id: "standard-cta",
  type: "cta",
  schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
  enabled: true,
  data: { title: "Liên hệ với chúng tôi", href: "/lien-he" },
};

export const richTextBlockMigrations =
  [] as const satisfies readonly CmsBlockMigration<RichTextBlockData>[];
export const productGridBlockMigrations =
  [] as const satisfies readonly CmsBlockMigration<ProductGridBlockData>[];
export const standardCtaBlockMigrations =
  [] as const satisfies readonly CmsBlockMigration<StandardCtaBlockData>[];

export const legacyStandardBlockSchema = z.union([
  z.object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.literal("richText"),
    ...richTextBlockDataSchema.shape,
  }),
  z.object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.literal("productGrid"),
    ...productGridBlockDataSchema.shape,
  }),
  z.object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.literal("cta"),
    ...standardCtaBlockDataSchema.shape,
  }),
]);
export type LegacyStandardBlock = z.infer<typeof legacyStandardBlockSchema>;

export function toRemVietStandardBlock(input: unknown, index = 0) {
  const canonical = remVietStandardBlockSchema.safeParse(input);
  if (canonical.success) return canonical;
  const legacy = legacyStandardBlockSchema.safeParse(input);
  if (!legacy.success) return legacy;
  const value = legacy.data;
  return remVietStandardBlockSchema.safeParse({
    id: value.id ?? `standard-${index}-${value.type}`,
    type: value.type,
    schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
    enabled: true,
    data:
      value.type === "richText"
        ? { content: value.content }
        : value.type === "productGrid"
          ? { categoryId: value.categoryId, limit: value.limit }
          : { title: value.title, href: value.href },
  });
}

export function toLegacyRemVietStandardBlock(block: RemVietStandardBlock) {
  return {
    id: block.id,
    type: block.type,
    ...block.data,
  } as LegacyStandardBlock;
}

export type RemVietStandardRenderers<TContext> = {
  richText: ComponentType<BlockRendererProps<RichTextBlock, TContext>>;
  productGrid: ComponentType<BlockRendererProps<ProductGridBlock, TContext>>;
  cta: ComponentType<BlockRendererProps<StandardCtaBlock, TContext>>;
};

export function createRemVietStandardBlockRegistry<TContext>(
  renderers: RemVietStandardRenderers<TContext>,
) {
  return createBlockRegistry<RemVietStandardBlock, TContext>({
    richText: {
      schema: richTextBlockSchema,
      defaults: defaultRichTextBlock,
      Renderer: renderers.richText,
    },
    productGrid: {
      schema: productGridBlockSchema,
      defaults: defaultProductGridBlock,
      Renderer: renderers.productGrid,
    },
    cta: {
      schema: standardCtaBlockSchema,
      defaults: defaultStandardCtaBlock,
      Renderer: renderers.cta,
    },
  });
}

export type RemVietStandardEditors<TContext> = {
  richText: ComponentType<
    CmsBlockEditorProps<RichTextBlock> & { context: TContext }
  >;
  productGrid: ComponentType<
    CmsBlockEditorProps<ProductGridBlock> & { context: TContext }
  >;
  cta: ComponentType<
    CmsBlockEditorProps<StandardCtaBlock> & { context: TContext }
  >;
};

export function createRemVietStandardBlockEditorRegistry<TContext>(
  editors: RemVietStandardEditors<TContext>,
) {
  return createBlockEditorRegistry<RemVietStandardBlock, TContext>({
    richText: {
      label: "Rich text",
      Editor: editors.richText,
    },
    productGrid: {
      label: "Product grid",
      Editor: editors.productGrid,
    },
    cta: {
      label: "Call to action",
      Editor: editors.cta,
    },
  });
}
