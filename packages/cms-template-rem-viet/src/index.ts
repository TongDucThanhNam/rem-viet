import {
  createCmsBlockSchema,
  safeMediaSourceSchema,
  safePublicLinkSchema,
  type CmsBlock,
  type CmsBlockMigration,
} from "@agency/cms-core";
import type { CmsBlockAuthoringDefinition } from "@agency/cms-admin";
import {
  createBlockRegistry,
  type BlockRendererProps,
} from "@agency/cms-react";
import type { ComponentType } from "react";
import { z } from "zod";

import {
  benefitsBlockSchema,
  bentoDetailsBlockSchema,
  craftProcessBlockSchema,
  defaultBenefitsBlock,
  defaultBentoDetailsBlock,
  defaultCraftProcessBlock,
  defaultFooterCtaBlock,
  defaultHorizontalGalleryBlock,
  defaultMarqueeBlock,
  defaultMeasurementGuideBlock,
  defaultThreatNarrativeBlock,
  footerCtaBlockSchema,
  horizontalGalleryBlockSchema,
  marqueeBlockSchema,
  measurementGuideBlockSchema,
  threatNarrativeBlockSchema,
  type BenefitsBlock,
  type BentoDetailsBlock,
  type CraftProcessBlock,
  type FooterCtaBlock,
  type HorizontalGalleryBlock,
  type MarqueeBlock,
  type MeasurementGuideBlock,
  type ThreatNarrativeBlock,
} from "./blocks";
import { REM_VIET_BLOCK_SCHEMA_VERSION } from "./version";

export * from "./blocks";
export * from "./rich-text-authoring";
export * from "./standard-blocks";
export { REM_VIET_BLOCK_SCHEMA_VERSION } from "./version";

export const heroFeatureIconKeySchema = z.enum([
  "shield",
  "ruler",
  "wind",
  "sparkles",
]);
export type HeroFeatureIconKey = z.infer<typeof heroFeatureIconKeySchema>;

export const heroBackgroundPositionSchema = z.enum([
  "center",
  "left",
  "right",
  "top",
  "bottom",
]);
export type HeroBackgroundPosition = z.infer<
  typeof heroBackgroundPositionSchema
>;

export const heroCtaSchema = z.object({
  label: z.string().trim().min(1).max(48),
  href: safePublicLinkSchema,
  cursorLabel: z.string().trim().min(1).max(24),
});

export const heroFeatureSchema = z.object({
  id: z.string().trim().min(1).max(64),
  iconKey: heroFeatureIconKeySchema,
  label: z.string().trim().min(1).max(32),
  value: z.string().trim().min(1).max(64),
});

export const heroBlockDataSchema = z.object({
  kicker: z.string().trim().min(1).max(80),
  title: z.object({
    prefix: z.string().trim().min(1).max(48),
    accent: z.string().trim().max(48),
  }),
  description: z.string().trim().min(1).max(360),
  background: z.object({
    mediaId: z.string().trim().min(1).max(128).optional(),
    src: safeMediaSourceSchema,
    alt: z.string().trim().max(180),
    position: heroBackgroundPositionSchema,
  }),
  primaryCta: heroCtaSchema,
  secondaryCta: heroCtaSchema,
  features: z.array(heroFeatureSchema).length(4),
  scrollLabel: z.string().trim().min(1).max(24),
});
export type HeroBlockData = z.infer<typeof heroBlockDataSchema>;

const defaultHeroData = {
  kicker: "(01) Lưới chống muỗi may đo",
  title: { prefix: "Rèm", accent: "Vina" },
  description:
    "Giải pháp lưới chống muỗi cao cấp cho cửa sổ và cửa đi. May đo theo từng khung, giữ không gian thoáng sáng mà vẫn bảo vệ gia đình mỗi ngày.",
  background: {
    src: "/assets/rem-vina-hero.webp",
    alt: "",
    position: "center",
  },
  primaryCta: {
    label: "Tư vấn kích thước",
    href: "#order",
    cursorLabel: "Đặt may",
  },
  secondaryCta: {
    label: "Mua hàng",
    href: "https://shopee.vn/remvina.vn",
    cursorLabel: "Mua",
  },
  features: [
    {
      id: "protection",
      iconKey: "shield",
      label: "Bảo vệ vô hình",
      value: "99.9% chống muỗi",
    },
    {
      id: "tailored",
      iconKey: "ruler",
      label: "May đo",
      value: "Vừa khít từng mm",
    },
    {
      id: "airflow",
      iconKey: "wind",
      label: "Thông thoáng",
      value: "Giữ ánh sáng tự nhiên",
    },
    {
      id: "aesthetic",
      iconKey: "sparkles",
      label: "Thẩm mỹ",
      value: "Hợp kiến trúc hiện đại",
    },
  ],
  scrollLabel: "Cuộn",
} satisfies HeroBlockData;

export const defaultHeroBlock = {
  id: "home-hero",
  enabled: true,
  type: "hero",
  schemaVersion: 1 as const,
  data: defaultHeroData,
} satisfies CmsBlock<"hero", HeroBlockData>;

const canonicalHeroBlockSchema = createCmsBlockSchema(
  "hero",
  heroBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });

export const heroBlockMigrations =
  [] satisfies readonly CmsBlockMigration<HeroBlockData>[];

function normalizeHeroEnvelope(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const candidate = input as Record<string, unknown>;
  if (candidate.type !== "hero" || "data" in candidate) return input;

  const normalized =
    typeof candidate.title === "string"
      ? {
          ...candidate,
          title: { prefix: candidate.title, accent: "" },
          description:
            typeof candidate.subtitle === "string" && candidate.subtitle.trim()
              ? candidate.subtitle
              : defaultHeroData.description,
          background: {
            ...defaultHeroData.background,
            src:
              typeof candidate.image === "string" && candidate.image.trim()
                ? candidate.image
                : defaultHeroData.background.src,
          },
        }
      : candidate;
  const { id, enabled, type, schemaVersion, ...data } = normalized;
  return {
    id: id ?? defaultHeroBlock.id,
    enabled: enabled ?? true,
    type,
    schemaVersion: schemaVersion ?? REM_VIET_BLOCK_SCHEMA_VERSION,
    data: { ...defaultHeroData, ...data },
  };
}

export const heroBlockSchema = z.preprocess(
  normalizeHeroEnvelope,
  canonicalHeroBlockSchema,
);
export type HeroBlock = z.infer<typeof heroBlockSchema>;

const stableIdSchema = z.string().trim().min(1).max(64);
const shortTextSchema = z.string().trim().min(1).max(120);
const bodyTextSchema = z.string().trim().min(1).max(600);

export const faqBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  backdropLabel: shortTextSchema,
  title: shortTextSchema,
  intro: bodyTextSchema,
  cta: heroCtaSchema,
  items: z
    .array(
      z.object({
        id: stableIdSchema,
        question: z.string().trim().min(1).max(180),
        answer: bodyTextSchema,
      }),
    )
    .min(1)
    .max(20),
});
export type FaqBlockData = z.infer<typeof faqBlockDataSchema>;

const defaultFaqData = {
  eyebrow: "(07) Câu hỏi thường gặp",
  backdropLabel: "HỎI",
  title: "Trước khi đặt may.",
  intro:
    "Những điều khách hàng thường hỏi trước khi gửi số đo và chọn kiểu viền phù hợp cho từng khung cửa.",
  cta: { label: "Cần tư vấn riêng", href: "#order", cursorLabel: "Liên hệ" },
  items: [
    {
      id: "included-border",
      question: "Kích thước có bao gồm phần viền không?",
      answer:
        "Có. Kích thước sản xuất là kích thước phủ bì, đã tính cả phần viền dán. Bạn chỉ cần đo mép ngoài cùng của khung cửa.",
    },
    {
      id: "inside-outside",
      question: "Nên đo bên trong hay bên ngoài khung?",
      answer:
        "Hãy đo cạnh ngoài của khung để lưới che phủ toàn bộ mép cửa. Nếu khung có gờ hoặc tay nắm đặc biệt, gửi thêm ảnh để được tư vấn.",
    },
    {
      id: "natural-light",
      question: "Lưới có làm tối nhà không?",
      answer:
        "Không. Mắt lưới mảnh nên vẫn giữ ánh sáng tự nhiên và tầm nhìn thoáng khi nhìn từ khoảng cách sinh hoạt thông thường.",
    },
    {
      id: "large-opening",
      question: "Có nhận may kích thước cửa lớn không?",
      answer:
        "Có. Đội ngũ có thể tư vấn phương án chia tấm hoặc may khổ lớn tùy cấu trúc cửa để hạn chế nhăn, võng và hở mép.",
    },
  ],
} satisfies FaqBlockData;

export const defaultFaqBlock = {
  id: "home-faq",
  enabled: true,
  type: "faq",
  schemaVersion: 1 as const,
  data: defaultFaqData,
} satisfies CmsBlock<"faq", FaqBlockData>;

const canonicalFaqBlockSchema = createCmsBlockSchema(
  "faq",
  faqBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });

export const faqBlockMigrations =
  [] satisfies readonly CmsBlockMigration<FaqBlockData>[];

function normalizeFaqEnvelope(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const candidate = input as Record<string, unknown>;
  if (candidate.type !== "faq" || "data" in candidate) return input;
  const { id, enabled, type, schemaVersion, ...data } = candidate;
  return {
    id: id ?? defaultFaqBlock.id,
    enabled: enabled ?? true,
    type,
    schemaVersion: schemaVersion ?? REM_VIET_BLOCK_SCHEMA_VERSION,
    data,
  };
}

export const faqBlockSchema = z.preprocess(
  normalizeFaqEnvelope,
  canonicalFaqBlockSchema,
);
export type FaqBlock = z.infer<typeof faqBlockSchema>;

export const remVietTemplateBlockSchema = z.union([
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
export type RemVietTemplateBlock = z.infer<typeof remVietTemplateBlockSchema>;

export const defaultRemVietTemplateBlocks = [
  defaultHeroBlock,
  defaultThreatNarrativeBlock,
  defaultMarqueeBlock,
  defaultBenefitsBlock,
  defaultCraftProcessBlock,
  defaultBentoDetailsBlock,
  defaultHorizontalGalleryBlock,
  defaultMeasurementGuideBlock,
  defaultFaqBlock,
  defaultFooterCtaBlock,
] as const satisfies readonly RemVietTemplateBlock[];

export type RemVietTemplateBlockType = RemVietTemplateBlock["type"];

const remVietTemplateAuthoringCatalogSource = [
  {
    type: "hero",
    label: "Hero mở đầu",
    description: "Ảnh chủ đạo, thông điệp chính và hai lời kêu gọi hành động.",
    category: "Nền tảng",
    keywords: ["banner", "opening", "cta", "mở đầu"],
  },
  {
    type: "threatNarrative",
    label: "Câu chuyện mối đe dọa",
    description: "Narrative toàn màn hình giải thích vấn đề theo từng bước.",
    category: "Câu chuyện",
    keywords: ["problem", "story", "pinned", "nỗi đau"],
  },
  {
    type: "marquee",
    label: "Dòng chữ chuyển động",
    description: "Dải thông điệp ngắn tạo nhịp chuyển giữa các section.",
    category: "Nhịp điệu",
    keywords: ["ticker", "text", "transition", "chuyển động"],
  },
  {
    type: "benefits",
    label: "Lợi ích",
    description: "Nhóm thẻ nêu giá trị, ưu điểm và lý do nên lựa chọn.",
    category: "Bằng chứng",
    keywords: ["features", "cards", "value", "ưu điểm"],
  },
  {
    type: "craftProcess",
    label: "Quy trình may đo",
    description: "Các bước thực hiện kèm hình ảnh và nội dung chi tiết.",
    category: "Câu chuyện",
    keywords: ["process", "steps", "timeline", "quy trình"],
  },
  {
    type: "bentoDetails",
    label: "Chi tiết kỹ thuật",
    description: "Lưới bento kết hợp thông số, hình ảnh và điểm nổi bật.",
    category: "Bằng chứng",
    keywords: ["specs", "statistics", "grid", "bento", "thông số"],
  },
  {
    type: "horizontalGallery",
    label: "Gallery phong cách sống",
    description: "Bộ ảnh cuộn ngang để kể câu chuyện không gian sử dụng.",
    category: "Hình ảnh",
    keywords: ["gallery", "photos", "lifestyle", "showcase"],
  },
  {
    type: "measurementGuide",
    label: "Hướng dẫn cách đo",
    description: "Minh họa kích thước và hướng dẫn khách tự đo chính xác.",
    category: "Hướng dẫn",
    keywords: ["measure", "dimensions", "tutorial", "kích thước"],
  },
  {
    type: "faq",
    label: "Câu hỏi thường gặp",
    description: "Danh sách hỏi đáp dạng accordion giúp xử lý băn khoăn.",
    category: "Hướng dẫn",
    keywords: ["questions", "answers", "accordion", "support"],
  },
  {
    type: "footerCta",
    label: "CTA cuối trang",
    description: "Lời mời liên hệ cố định ở cuối hành trình nội dung.",
    category: "Chuyển đổi",
    keywords: ["contact", "conversion", "footer", "cta", "liên hệ"],
  },
] as const satisfies readonly CmsBlockAuthoringDefinition<RemVietTemplateBlockType>[];

/**
 * Template-owned discovery metadata for authoring surfaces. Consumers may
 * choose their own layout, while labels, descriptions, and search vocabulary
 * remain consistent across every provider and admin shell.
 */
export const remVietTemplateAuthoringCatalog = Object.freeze(
  remVietTemplateAuthoringCatalogSource.map((definition) =>
    Object.freeze({
      ...definition,
      keywords: Object.freeze([...definition.keywords]),
    }),
  ),
);

export const remVietTemplateAuthoringByType = Object.freeze(
  Object.fromEntries(
    remVietTemplateAuthoringCatalog.map((definition) => [
      definition.type,
      definition,
    ]),
  ) as Record<
    RemVietTemplateBlockType,
    (typeof remVietTemplateAuthoringCatalog)[number]
  >,
);

export const remVietTemplateBlockLabels = Object.freeze(
  Object.fromEntries(
    remVietTemplateAuthoringCatalog.map(({ type, label }) => [type, label]),
  ) as Record<RemVietTemplateBlockType, string>,
);

export type RemVietTemplateCompositionRule = Readonly<{
  minInstances: number;
  maxInstances: number;
  pinned: "start" | "end" | null;
}>;

/**
 * Template-owned composition limits. The admin may compose only inside this
 * bounded registry; it never infers layout freedom from the block union.
 */
export const remVietTemplateComposition = Object.freeze({
  hero: { minInstances: 1, maxInstances: 1, pinned: "start" },
  threatNarrative: { minInstances: 0, maxInstances: 1, pinned: null },
  marquee: { minInstances: 0, maxInstances: 3, pinned: null },
  benefits: { minInstances: 0, maxInstances: 3, pinned: null },
  craftProcess: { minInstances: 0, maxInstances: 1, pinned: null },
  bentoDetails: { minInstances: 0, maxInstances: 1, pinned: null },
  horizontalGallery: { minInstances: 0, maxInstances: 1, pinned: null },
  measurementGuide: { minInstances: 0, maxInstances: 1, pinned: null },
  faq: { minInstances: 0, maxInstances: 1, pinned: null },
  footerCta: { minInstances: 1, maxInstances: 1, pinned: "end" },
} satisfies Record<RemVietTemplateBlockType, RemVietTemplateCompositionRule>);

export const remVietTemplateBlockTypes = Object.freeze(
  Object.keys(remVietTemplateComposition) as RemVietTemplateBlockType[],
);

function flattenBlock<TType extends string, TData>(
  block: CmsBlock<TType, TData>,
) {
  return {
    id: block.id,
    enabled: block.enabled,
    type: block.type,
    ...block.data,
  };
}

export function toLegacyRemVietTemplateBlock(block: RemVietTemplateBlock) {
  return {
    id: block.id,
    enabled: block.enabled,
    type: block.type,
    ...block.data,
  };
}

/**
 * Adds the object discriminators and stable array keys required by the
 * optional Sanity Studio Hero + FAQ vertical slice. The generic provider
 * stays schema-neutral; consumers pass this function as its encodeContent.
 */
export function encodeRemVietSanityPageContent<
  TContent extends { blocks: RemVietTemplateBlock[] },
>(content: TContent): unknown {
  const blocks = content.blocks.map((block) => {
    if (block.type === "hero") {
      return {
        ...block,
        _type: "agencyHeroBlock",
        data: {
          ...block.data,
          features: block.data.features.map((feature) => ({
            ...feature,
            _type: "agencyHeroFeature",
          })),
        },
      };
    }
    if (block.type === "faq") {
      return {
        ...block,
        _type: "agencyFaqBlock",
        data: {
          ...block.data,
          items: block.data.items.map((item) => ({
            ...item,
            _type: "agencyFaqItem",
          })),
        },
      };
    }
    throw new Error(
      `Sanity visual slice does not support block type: ${block.type}.`,
    );
  });
  return addStableSanityKeys({ ...content, blocks });
}

function addStableSanityKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const encoded = addStableSanityKeys(entry);
      if (!encoded || typeof encoded !== "object" || Array.isArray(encoded)) {
        return encoded;
      }
      const record = encoded as Record<string, unknown>;
      const key =
        typeof record._key === "string" && record._key
          ? record._key
          : typeof record.id === "string" && record.id
            ? record.id
            : `item-${index}`;
      return { ...record, _key: key };
    });
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      addStableSanityKeys(entry),
    ]),
  );
}

export const legacyDefaultHeroBlock = flattenBlock(defaultHeroBlock);
export const legacyDefaultFaqBlock = flattenBlock(defaultFaqBlock);

export const legacyHeroBlockContentSchema = z.object({
  id: z.string().trim().min(1).max(64).default("home-hero"),
  enabled: z.boolean().default(true),
  type: z.literal("hero"),
  ...heroBlockDataSchema.shape,
});
export const legacyHeroBlockSchema = heroBlockSchema.transform(flattenBlock);
export type LegacyHeroBlock = z.infer<typeof legacyHeroBlockSchema>;

export const legacyFaqBlockSchema = z.object({
  id: stableIdSchema.default(defaultFaqBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("faq"),
  ...faqBlockDataSchema.shape,
});
export type LegacyFaqBlock = z.infer<typeof legacyFaqBlockSchema>;

export function toRemVietTemplateBlock(input: unknown) {
  return remVietTemplateBlockSchema.safeParse(input);
}

export type RemVietTemplateRenderers<TContext> = {
  hero: ComponentType<BlockRendererProps<HeroBlock, TContext>>;
  threatNarrative: ComponentType<
    BlockRendererProps<ThreatNarrativeBlock, TContext>
  >;
  marquee: ComponentType<BlockRendererProps<MarqueeBlock, TContext>>;
  benefits: ComponentType<BlockRendererProps<BenefitsBlock, TContext>>;
  craftProcess: ComponentType<BlockRendererProps<CraftProcessBlock, TContext>>;
  bentoDetails: ComponentType<BlockRendererProps<BentoDetailsBlock, TContext>>;
  horizontalGallery: ComponentType<
    BlockRendererProps<HorizontalGalleryBlock, TContext>
  >;
  measurementGuide: ComponentType<
    BlockRendererProps<MeasurementGuideBlock, TContext>
  >;
  faq: ComponentType<BlockRendererProps<FaqBlock, TContext>>;
  footerCta: ComponentType<BlockRendererProps<FooterCtaBlock, TContext>>;
};

export function createRemVietBlockRegistry<TContext>(
  renderers: RemVietTemplateRenderers<TContext>,
) {
  return createBlockRegistry<RemVietTemplateBlock, TContext>({
    hero: {
      schema: heroBlockSchema,
      defaults: defaultHeroBlock,
      Renderer: renderers.hero,
    },
    threatNarrative: {
      schema: threatNarrativeBlockSchema,
      defaults: defaultThreatNarrativeBlock,
      Renderer: renderers.threatNarrative,
    },
    marquee: {
      schema: marqueeBlockSchema,
      defaults: defaultMarqueeBlock,
      Renderer: renderers.marquee,
    },
    benefits: {
      schema: benefitsBlockSchema,
      defaults: defaultBenefitsBlock,
      Renderer: renderers.benefits,
    },
    craftProcess: {
      schema: craftProcessBlockSchema,
      defaults: defaultCraftProcessBlock,
      Renderer: renderers.craftProcess,
    },
    bentoDetails: {
      schema: bentoDetailsBlockSchema,
      defaults: defaultBentoDetailsBlock,
      Renderer: renderers.bentoDetails,
    },
    horizontalGallery: {
      schema: horizontalGalleryBlockSchema,
      defaults: defaultHorizontalGalleryBlock,
      Renderer: renderers.horizontalGallery,
    },
    measurementGuide: {
      schema: measurementGuideBlockSchema,
      defaults: defaultMeasurementGuideBlock,
      Renderer: renderers.measurementGuide,
    },
    faq: {
      schema: faqBlockSchema,
      defaults: defaultFaqBlock,
      Renderer: renderers.faq,
    },
    footerCta: {
      schema: footerCtaBlockSchema,
      defaults: defaultFooterCtaBlock,
      Renderer: renderers.footerCta,
    },
  });
}
