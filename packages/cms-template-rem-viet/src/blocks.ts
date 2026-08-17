import {
  createCmsBlockSchema,
  safeMediaSourceSchema,
  type CmsBlock,
  type CmsBlockMigration,
} from "@agency/cms-core";
import { z } from "zod";

import { REM_VIET_BLOCK_SCHEMA_VERSION } from "./version";

const stableIdSchema = z.string().trim().min(1).max(64);
const shortTextSchema = z.string().trim().min(1).max(120);
const bodyTextSchema = z.string().trim().min(1).max(600);

export const templateImageSchema = z.object({
  mediaId: z.string().trim().min(1).max(128).optional(),
  src: safeMediaSourceSchema,
  alt: z.string().trim().min(1, "Alt ảnh là bắt buộc.").max(180),
});

export const horizontalGalleryBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  cursorLabel: z.string().trim().min(1).max(24),
  titleLines: z.array(shortTextSchema).min(1).max(3),
  items: z
    .array(
      z.object({
        id: stableIdSchema,
        title: shortTextSchema,
        meta: shortTextSchema,
        image: templateImageSchema,
      }),
    )
    .min(3)
    .max(8),
});
export type HorizontalGalleryBlockData = z.infer<
  typeof horizontalGalleryBlockDataSchema
>;

export const benefitIconKeySchema = z.enum([
  "waves",
  "ruler",
  "shield",
  "home",
]);
export type BenefitIconKey = z.infer<typeof benefitIconKeySchema>;

export const benefitsBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  intro: bodyTextSchema,
  title: z.string().trim().min(1).max(180),
  cardKicker: shortTextSchema,
  cursorLabel: z.string().trim().min(1).max(24),
  items: z
    .array(
      z.object({
        id: stableIdSchema,
        title: shortTextSchema,
        description: bodyTextSchema,
        image: templateImageSchema,
        iconKey: benefitIconKeySchema,
      }),
    )
    .min(2)
    .max(6),
});
export type BenefitsBlockData = z.infer<typeof benefitsBlockDataSchema>;

export const craftProcessBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  title: z.string().trim().min(1).max(180),
  intro: bodyTextSchema,
  steps: z
    .array(
      z.object({
        id: stableIdSchema,
        eyebrow: shortTextSchema,
        title: z.string().trim().min(1).max(180),
        description: bodyTextSchema,
        image: templateImageSchema,
      }),
    )
    .min(2)
    .max(5),
});
export type CraftProcessBlockData = z.infer<typeof craftProcessBlockDataSchema>;

export const threatNarrativeBlockDataSchema = z.object({
  scrollLabel: shortTextSchema,
  steps: z
    .array(
      z.object({
        id: stableIdSchema,
        eyebrow: shortTextSchema,
        title: z.string().trim().min(1).max(180),
        description: bodyTextSchema,
        image: templateImageSchema.extend({
          position: z.string().trim().min(1).max(48),
          mobilePosition: z.string().trim().min(1).max(48),
          tone: z.enum(["danger", "solution", "result"]),
        }),
      }),
    )
    .length(3),
});
export type ThreatNarrativeBlockData = z.infer<
  typeof threatNarrativeBlockDataSchema
>;

export const measurementGuideBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  title: z.string().trim().min(1).max(180),
  intro: bodyTextSchema,
  image: templateImageSchema,
  figureEyebrow: shortTextSchema,
  idleLabel: shortTextSchema,
  contentEyebrow: shortTextSchema,
  contentTitle: z.string().trim().min(1).max(180),
  contentDescription: bodyTextSchema,
  steps: z
    .array(
      z.object({
        id: stableIdSchema,
        code: z.string().trim().min(1).max(12),
        shortLabel: shortTextSchema,
        title: shortTextSchema,
        description: bodyTextSchema,
        overlayLabel: shortTextSchema,
      }),
    )
    .length(3),
});
export type MeasurementGuideBlockData = z.infer<
  typeof measurementGuideBlockDataSchema
>;

const bentoCopySchema = z.object({
  title: shortTextSchema,
  description: z.string().trim().max(360),
});

export const bentoDetailsBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  title: z.string().trim().min(1).max(180),
  material: bentoCopySchema.extend({ image: templateImageSchema }),
  stats: z
    .array(
      z.object({
        id: stableIdSchema,
        value: z.number().finite().nullable(),
        decimals: z.number().int().min(0).max(2),
        suffix: z.string().max(8),
        fallback: z.string().max(12),
        label: shortTextSchema,
      }),
    )
    .length(4),
  features: z.array(bentoCopySchema.extend({ id: stableIdSchema })).length(2),
  standards: bentoCopySchema.extend({ image: templateImageSchema }),
});
export type BentoDetailsBlockData = z.infer<typeof bentoDetailsBlockDataSchema>;

export const marqueeBlockDataSchema = z.object({
  text: z.string().trim().min(1).max(360),
  ariaLabel: z.string().trim().max(180),
});
export type MarqueeBlockData = z.infer<typeof marqueeBlockDataSchema>;

export const footerCtaBlockDataSchema = z.object({
  eyebrow: shortTextSchema,
  kicker: shortTextSchema,
  title: z.object({
    prefix: shortTextSchema,
    accent: z.string().trim().min(1).max(180),
  }),
  email: z.email(),
  emailLabel: shortTextSchema,
  cursorLabel: z.string().trim().min(1).max(24),
  copyright: z.string().trim().min(1).max(180),
  backToTopLabel: shortTextSchema,
  backToTopCursorLabel: z.string().trim().min(1).max(24),
  socialCursorLabel: z.string().trim().min(1).max(24),
  socialLabels: z.object({
    facebook: shortTextSchema,
    shopee: shortTextSchema,
  }),
});
export type FooterCtaBlockData = z.infer<typeof footerCtaBlockDataSchema>;

function normalizeEnvelope(input: unknown, type: string, defaultId: string) {
  if (!input || typeof input !== "object") return input;
  const candidate = input as Record<string, unknown>;
  if (candidate.type !== type || "data" in candidate) return input;
  const { id, enabled, schemaVersion, ...dataWithType } = candidate;
  const { type: blockType, ...data } = dataWithType;
  return {
    id: id ?? defaultId,
    enabled: enabled ?? true,
    type: blockType,
    schemaVersion: schemaVersion ?? REM_VIET_BLOCK_SCHEMA_VERSION,
    data,
  };
}

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

const defaultHorizontalGalleryData = {
  eyebrow: "(05) Lối sống",
  cursorLabel: "Xem",
  titleLines: ["Không Gian", "Tuyệt Đỉnh"],
  items: [
    {
      id: "living",
      title: "Phòng khách mở sáng",
      meta: "Cửa sổ lớn",
      image: { src: "/assets/gallery_1.webp", alt: "Phòng khách mở sáng" },
    },
    {
      id: "rest",
      title: "Góc nghỉ yên tĩnh",
      meta: "Lưới gần như vô hình",
      image: { src: "/assets/gallery_2.webp", alt: "Góc nghỉ yên tĩnh" },
    },
    {
      id: "kitchen",
      title: "Không gian bếp sạch",
      meta: "Hạn chế côn trùng",
      image: { src: "/assets/gallery_3.webp", alt: "Không gian bếp sạch" },
    },
    {
      id: "breeze",
      title: "Đón gió tự nhiên",
      meta: "Không che tầm nhìn",
      image: { src: "/assets/lifestyle_breeze.webp", alt: "Đón gió tự nhiên" },
    },
  ],
} satisfies HorizontalGalleryBlockData;

export const defaultHorizontalGalleryBlock = {
  id: "home-horizontal-gallery",
  enabled: true,
  type: "horizontalGallery",
  schemaVersion: 1 as const,
  data: defaultHorizontalGalleryData,
} satisfies CmsBlock<"horizontalGallery", HorizontalGalleryBlockData>;

const defaultBenefitsData = {
  eyebrow: "(02) Lợi ích cốt lõi",
  intro:
    "Bốn cam kết làm nên trải nghiệm Rèm Vina — từ vật liệu, độ vừa khít đến dịch vụ lắp đặt trọn gói.",
  title: "Giữ nhà thoáng, sạch và yên tĩnh.",
  cardKicker: "Cam kết Rèm Vina",
  cursorLabel: "Khám phá",
  items: [
    {
      id: "fiberglass",
      title: "Sợi thủy tinh cao cấp",
      description:
        "Sợi thủy tinh bọc PVC chuyên dụng, bền bỉ khi uốn gập và giữ form tốt trong điều kiện khí hậu nóng ẩm.",
      image: {
        src: "/assets/fiberglass-mesh.webp",
        alt: "Sợi thủy tinh bọc PVC",
      },
      iconKey: "waves",
    },
    {
      id: "tailored",
      title: "May đo vừa khít",
      description:
        "Từng bộ lưới được cắt may theo kích thước thực tế của khung, hạn chế hở mép và giữ tổng thể gọn gàng.",
      image: {
        src: "/assets/process-measure.webp",
        alt: "Đo khung cửa để may lưới",
      },
      iconKey: "ruler",
    },
    {
      id: "protection",
      title: "Bảo vệ vô hình",
      description:
        "Mắt lưới mảnh giúp chống muỗi, giảm côn trùng bay vào nhà mà vẫn giữ tầm nhìn và ánh sáng tự nhiên.",
      image: {
        src: "/assets/threat-mesh.webp",
        alt: "Lưới chống muỗi gần như vô hình",
      },
      iconKey: "shield",
    },
    {
      id: "installation",
      title: "Lắp đặt tận nơi",
      description:
        "Đội ngũ kỹ thuật đo, tư vấn, lắp và nghiệm thu tại nhà để sản phẩm sẵn sàng sử dụng ngay.",
      image: {
        src: "/assets/process-install.webp",
        alt: "Lắp đặt lưới chống muỗi tại nhà",
      },
      iconKey: "home",
    },
  ],
} satisfies BenefitsBlockData;

export const defaultBenefitsBlock = {
  id: "home-benefits",
  enabled: true,
  type: "benefits",
  schemaVersion: 1 as const,
  data: defaultBenefitsData,
} satisfies CmsBlock<"benefits", BenefitsBlockData>;

const defaultCraftProcessData = {
  eyebrow: "(03) Quy trình may đo",
  title: "Từ số đo thật đến lớp bảo vệ gần như vô hình.",
  intro:
    "Một quy trình liền mạch để từng tấm lưới vừa khít khung cửa, dễ sử dụng và giữ nguyên cảm giác thoáng sáng của ngôi nhà.",
  steps: [
    {
      id: "measure",
      eyebrow: "Khảo sát",
      title: "Đo đúng từ khung cửa thật.",
      description:
        "Chiều rộng, chiều cao và những gờ nổi đều được ghi lại để lớp lưới phủ kín mép cửa mà không vướng tay nắm hay ray trượt.",
      image: {
        src: "/assets/process-measure.webp",
        alt: "Kỹ thuật viên đo khung cửa nhôm trước khi may lưới chống muỗi",
      },
    },
    {
      id: "craft",
      eyebrow: "Chế tác",
      title: "May viền theo từng milimét.",
      description:
        "Mỗi bộ lưới được cắt, may và kiểm tra thủ công để đường viền ôm sát bề mặt dán, giữ tấm lưới phẳng và gọn nhẹ.",
      image: {
        src: "/assets/process-craft.webp",
        alt: "Cận cảnh thao tác may viền lưới chống muỗi thủ công",
      },
    },
    {
      id: "finish",
      eyebrow: "Hoàn thiện",
      title: "Lắp gọn, giữ trọn ánh sáng.",
      description:
        "Kỹ thuật viên hoàn thiện tại nhà, kiểm tra độ kín và hướng dẫn tháo vệ sinh để không gian luôn thoáng sáng sau khi bàn giao.",
      image: {
        src: "/assets/process-install.webp",
        alt: "Lưới chống muỗi hoàn thiện trên cửa đi mở ra ban công xanh",
      },
    },
  ],
} satisfies CraftProcessBlockData;

export const defaultCraftProcessBlock = {
  id: "home-craft-process",
  enabled: true,
  type: "craftProcess",
  schemaVersion: 1 as const,
  data: defaultCraftProcessData,
} satisfies CmsBlock<"craftProcess", CraftProcessBlockData>;

const defaultThreatNarrativeData = {
  scrollLabel: "Cuộn để khám phá",
  steps: [
    {
      id: "threat",
      eyebrow: "Mối đe dọa",
      title: "Muỗi len vào từ những khe nhỏ nhất.",
      description:
        "Một khe hở 3mm đã đủ cho côn trùng xâm nhập. Cửa sổ hở, cửa lưới lỗi, viền nới lỏng — đều là lối vào.",
      image: {
        src: "/assets/threat-gap.webp",
        alt: "Khe hở nhỏ trên khung cửa nơi muỗi có thể xâm nhập",
        position: "50% 50%",
        mobilePosition: "68% 50%",
        tone: "danger",
      },
    },
    {
      id: "solution",
      eyebrow: "Giải pháp",
      title: "Một lớp chắn gần như vô hình.",
      description:
        "Lưới may đo từng khung, bám sát từng milimet — chắn côn trùng mà vẫn giữ ánh sáng và gió tự nhiên.",
      image: {
        src: "/assets/threat-mesh.webp",
        alt: "Cận cảnh lưới chống muỗi và đường viền được may đo sát khung",
        position: "50% 50%",
        mobilePosition: "70% 50%",
        tone: "solution",
      },
    },
    {
      id: "result",
      eyebrow: "Kết quả",
      title: "Nhà thoáng, sạch và yên tĩnh.",
      description:
        "Bảo vệ gia đình mỗi ngày mà không phải hy sinh cảm giác rộng mở của căn phòng bạn thương.",
      image: {
        src: "/assets/threat-home.webp",
        alt: "Không gian sống thoáng sáng với lưới chống muỗi gần như vô hình",
        position: "50% 50%",
        mobilePosition: "68% 50%",
        tone: "result",
      },
    },
  ],
} satisfies ThreatNarrativeBlockData;

export const defaultThreatNarrativeBlock = {
  id: "home-threat-narrative",
  enabled: true,
  type: "threatNarrative",
  schemaVersion: 1 as const,
  data: defaultThreatNarrativeData,
} satisfies CmsBlock<"threatNarrative", ThreatNarrativeBlockData>;

const defaultMeasurementGuideData = {
  eyebrow: "(06) Cách đo",
  title: "Chuẩn xác từ số đo đầu tiên.",
  intro:
    "Chỉ ba bước ngắn để đội ngũ có đủ thông tin may đúng ngay từ lần đầu tiên.",
  image: {
    src: "/assets/window-mosquito-net-hero.webp",
    alt: "Khung cửa sổ dùng để minh họa cách đo lưới chống muỗi",
  },
  figureEyebrow: "Bản đo trực quan",
  idleLabel: "Chọn một bước đo",
  contentEyebrow: "Đo phủ bì / đơn vị milimét",
  contentTitle: "Một đường đo liền mạch, không trừ hao.",
  contentDescription:
    "Đo mép ngoài của khung giúp lớp lưới che kín toàn bộ điểm tiếp giáp, giữ bề mặt phẳng và không để lại khe hở nhỏ.",
  steps: [
    {
      id: "width",
      code: "R",
      shortLabel: "Chiều rộng phủ bì",
      title: "01. Đo chiều rộng",
      description:
        "Đo từ mép ngoài cùng bên trái sang mép ngoài cùng bên phải của khung cửa. Ghi số đo theo milimet để thợ may căn chính xác.",
      overlayLabel: "Rộng (R)",
    },
    {
      id: "height",
      code: "C",
      shortLabel: "Chiều cao phủ bì",
      title: "02. Đo chiều cao",
      description:
        "Đo từ mép ngoài phía trên xuống mép ngoài phía dưới. Nên đo ở hai vị trí nếu khung cửa cũ hoặc không đều.",
      overlayLabel: "Cao (C)",
    },
    {
      id: "photo",
      code: "Ảnh",
      shortLabel: "Gửi toàn cảnh khung",
      title: "03. Gửi hình khung cửa",
      description:
        "Gửi kèm ảnh tổng thể và ảnh cận mép khung để đội ngũ tư vấn chọn kiểu viền phù hợp trước khi sản xuất.",
      overlayLabel: "Chụp trọn khung cửa",
    },
  ],
} satisfies MeasurementGuideBlockData;

export const defaultMeasurementGuideBlock = {
  id: "home-measurement-guide",
  enabled: true,
  type: "measurementGuide",
  schemaVersion: 1 as const,
  data: defaultMeasurementGuideData,
} satisfies CmsBlock<"measurementGuide", MeasurementGuideBlockData>;

const defaultBentoDetailsData = {
  eyebrow: "(04) Chi tiết kỹ thuật",
  title: "Kỹ thuật may đo cho khung cửa Việt.",
  material: {
    title: "Sợi thủy tinh siêu mảnh",
    description:
      "Lưới được dệt từ sợi thủy tinh bọc PVC chuyên dụng, đàn hồi tốt và giữ bề mặt ổn định sau thời gian dài sử dụng.",
    image: {
      src: "/assets/fiberglass-mesh.webp",
      alt: "Cận cảnh sợi thủy tinh bọc PVC",
    },
  },
  stats: [
    {
      id: "toxic",
      value: 0,
      decimals: 0,
      suffix: "%",
      fallback: "",
      label: "Chất độc hại",
    },
    {
      id: "protection",
      value: 99.9,
      decimals: 1,
      suffix: "%",
      fallback: "",
      label: "Chống muỗi",
    },
    {
      id: "durability",
      value: 10,
      decimals: 0,
      suffix: "+",
      fallback: "",
      label: "Năm độ bền",
    },
    {
      id: "airflow",
      value: null,
      decimals: 0,
      suffix: "",
      fallback: "∞",
      label: "Luồng gió",
    },
  ],
  features: [
    {
      id: "border",
      title: "Viền dán gọn",
      description: "Đường viền mảnh, ôm khung và dễ tháo vệ sinh khi cần.",
    },
    {
      id: "same-day",
      title: "Lắp trong ngày",
      description:
        "Kỹ thuật viên đo, tư vấn và hoàn thiện theo lịch hẹn tại nhà.",
    },
  ],
  standards: {
    title: "Đạt chuẩn cho không gian sống hiện đại",
    description:
      "Vật liệu chống tia UV, hạn chế rách và an toàn cho gia đình có trẻ nhỏ hoặc thú cưng.",
    image: {
      src: "/assets/window-mosquito-net-hero.webp",
      alt: "Lưới chống muỗi lắp trên cửa sổ hiện đại",
    },
  },
} satisfies BentoDetailsBlockData;

export const defaultBentoDetailsBlock = {
  id: "home-bento-details",
  enabled: true,
  type: "bentoDetails",
  schemaVersion: 1 as const,
  data: defaultBentoDetailsData,
} satisfies CmsBlock<"bentoDetails", BentoDetailsBlockData>;

const defaultMarqueeData = {
  text: "SỢI THỦY TINH CAO CẤP • MAY ĐO VỪA KHÍT • BẢO VỆ VÔ HÌNH • SẠCH BÓNG CÔN TRÙNG •",
  ariaLabel: "Cam kết chất lượng Rèm Vina",
} satisfies MarqueeBlockData;

export const defaultMarqueeBlock = {
  id: "home-marquee",
  enabled: true,
  type: "marquee",
  schemaVersion: 1 as const,
  data: defaultMarqueeData,
} satisfies CmsBlock<"marquee", MarqueeBlockData>;

const defaultFooterCtaData = {
  eyebrow: "(08) Điểm chạm cuối",
  kicker: "May đo cho chính khung cửa của bạn",
  title: { prefix: "Bắt đầu một", accent: "không gian thoáng hơn." },
  email: "tuvan@remvina.vn",
  emailLabel: "tuvan@remvina.vn",
  cursorLabel: "Đặt may",
  copyright: "© 2026 Rèm Vina. Bản quyền đã được bảo hộ.",
  backToTopLabel: "Lên đầu trang",
  backToTopCursorLabel: "Lên đầu",
  socialCursorLabel: "Mở",
  socialLabels: { facebook: "Facebook", shopee: "Shopee" },
} satisfies FooterCtaBlockData;

export const defaultFooterCtaBlock = {
  id: "home-footer-cta",
  enabled: true,
  type: "footerCta",
  schemaVersion: 1 as const,
  data: defaultFooterCtaData,
} satisfies CmsBlock<"footerCta", FooterCtaBlockData>;

const horizontalGalleryCanonicalSchema = createCmsBlockSchema(
  "horizontalGallery",
  horizontalGalleryBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const horizontalGalleryBlockSchema = z.preprocess(
  (input) =>
    normalizeEnvelope(
      input,
      "horizontalGallery",
      defaultHorizontalGalleryBlock.id,
    ),
  horizontalGalleryCanonicalSchema,
);
export type HorizontalGalleryBlock = z.infer<
  typeof horizontalGalleryBlockSchema
>;

const benefitsCanonicalSchema = createCmsBlockSchema(
  "benefits",
  benefitsBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const benefitsBlockSchema = z.preprocess(
  (input) => normalizeEnvelope(input, "benefits", defaultBenefitsBlock.id),
  benefitsCanonicalSchema,
);
export type BenefitsBlock = z.infer<typeof benefitsBlockSchema>;

const craftProcessCanonicalSchema = createCmsBlockSchema(
  "craftProcess",
  craftProcessBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const craftProcessBlockSchema = z.preprocess(
  (input) =>
    normalizeEnvelope(input, "craftProcess", defaultCraftProcessBlock.id),
  craftProcessCanonicalSchema,
);
export type CraftProcessBlock = z.infer<typeof craftProcessBlockSchema>;

const threatNarrativeCanonicalSchema = createCmsBlockSchema(
  "threatNarrative",
  threatNarrativeBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const threatNarrativeBlockSchema = z.preprocess(
  (input) =>
    normalizeEnvelope(input, "threatNarrative", defaultThreatNarrativeBlock.id),
  threatNarrativeCanonicalSchema,
);
export type ThreatNarrativeBlock = z.infer<typeof threatNarrativeBlockSchema>;

const measurementGuideCanonicalSchema = createCmsBlockSchema(
  "measurementGuide",
  measurementGuideBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const measurementGuideBlockSchema = z.preprocess(
  (input) =>
    normalizeEnvelope(
      input,
      "measurementGuide",
      defaultMeasurementGuideBlock.id,
    ),
  measurementGuideCanonicalSchema,
);
export type MeasurementGuideBlock = z.infer<typeof measurementGuideBlockSchema>;

const bentoDetailsCanonicalSchema = createCmsBlockSchema(
  "bentoDetails",
  bentoDetailsBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const bentoDetailsBlockSchema = z.preprocess(
  (input) =>
    normalizeEnvelope(input, "bentoDetails", defaultBentoDetailsBlock.id),
  bentoDetailsCanonicalSchema,
);
export type BentoDetailsBlock = z.infer<typeof bentoDetailsBlockSchema>;

const marqueeCanonicalSchema = createCmsBlockSchema(
  "marquee",
  marqueeBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const marqueeBlockSchema = z.preprocess(
  (input) => normalizeEnvelope(input, "marquee", defaultMarqueeBlock.id),
  marqueeCanonicalSchema,
);
export type MarqueeBlock = z.infer<typeof marqueeBlockSchema>;

const footerCtaCanonicalSchema = createCmsBlockSchema(
  "footerCta",
  footerCtaBlockDataSchema,
).extend({ schemaVersion: z.literal(REM_VIET_BLOCK_SCHEMA_VERSION) });
export const footerCtaBlockSchema = z.preprocess(
  (input) => normalizeEnvelope(input, "footerCta", defaultFooterCtaBlock.id),
  footerCtaCanonicalSchema,
);
export type FooterCtaBlock = z.infer<typeof footerCtaBlockSchema>;

export const horizontalGalleryBlockMigrations =
  [] satisfies readonly CmsBlockMigration<HorizontalGalleryBlockData>[];
export const benefitsBlockMigrations =
  [] satisfies readonly CmsBlockMigration<BenefitsBlockData>[];
export const craftProcessBlockMigrations =
  [] satisfies readonly CmsBlockMigration<CraftProcessBlockData>[];
export const threatNarrativeBlockMigrations =
  [] satisfies readonly CmsBlockMigration<ThreatNarrativeBlockData>[];
export const measurementGuideBlockMigrations =
  [] satisfies readonly CmsBlockMigration<MeasurementGuideBlockData>[];
export const bentoDetailsBlockMigrations =
  [] satisfies readonly CmsBlockMigration<BentoDetailsBlockData>[];
export const marqueeBlockMigrations =
  [] satisfies readonly CmsBlockMigration<MarqueeBlockData>[];
export const footerCtaBlockMigrations =
  [] satisfies readonly CmsBlockMigration<FooterCtaBlockData>[];

export const legacyDefaultHorizontalGalleryBlock = flattenBlock(
  defaultHorizontalGalleryBlock,
);
export const legacyDefaultBenefitsBlock = flattenBlock(defaultBenefitsBlock);
export const legacyDefaultCraftProcessBlock = flattenBlock(
  defaultCraftProcessBlock,
);
export const legacyDefaultThreatNarrativeBlock = flattenBlock(
  defaultThreatNarrativeBlock,
);
export const legacyDefaultMeasurementGuideBlock = flattenBlock(
  defaultMeasurementGuideBlock,
);
export const legacyDefaultBentoDetailsBlock = flattenBlock(
  defaultBentoDetailsBlock,
);
export const legacyDefaultMarqueeBlock = flattenBlock(defaultMarqueeBlock);
export const legacyDefaultFooterCtaBlock = flattenBlock(defaultFooterCtaBlock);

export const legacyHorizontalGalleryBlockSchema = z.object({
  id: stableIdSchema.default(defaultHorizontalGalleryBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("horizontalGallery"),
  ...horizontalGalleryBlockDataSchema.shape,
});
export type LegacyHorizontalGalleryBlock = z.infer<
  typeof legacyHorizontalGalleryBlockSchema
>;
export const legacyBenefitsBlockSchema = z.object({
  id: stableIdSchema.default(defaultBenefitsBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("benefits"),
  ...benefitsBlockDataSchema.shape,
});
export type LegacyBenefitsBlock = z.infer<typeof legacyBenefitsBlockSchema>;
export const legacyCraftProcessBlockSchema = z.object({
  id: stableIdSchema.default(defaultCraftProcessBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("craftProcess"),
  ...craftProcessBlockDataSchema.shape,
});
export type LegacyCraftProcessBlock = z.infer<
  typeof legacyCraftProcessBlockSchema
>;
export const legacyThreatNarrativeBlockSchema = z.object({
  id: stableIdSchema.default(defaultThreatNarrativeBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("threatNarrative"),
  ...threatNarrativeBlockDataSchema.shape,
});
export type LegacyThreatNarrativeBlock = z.infer<
  typeof legacyThreatNarrativeBlockSchema
>;
export const legacyMeasurementGuideBlockSchema = z.object({
  id: stableIdSchema.default(defaultMeasurementGuideBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("measurementGuide"),
  ...measurementGuideBlockDataSchema.shape,
});
export type LegacyMeasurementGuideBlock = z.infer<
  typeof legacyMeasurementGuideBlockSchema
>;
export const legacyBentoDetailsBlockSchema = z.object({
  id: stableIdSchema.default(defaultBentoDetailsBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("bentoDetails"),
  ...bentoDetailsBlockDataSchema.shape,
});
export type LegacyBentoDetailsBlock = z.infer<
  typeof legacyBentoDetailsBlockSchema
>;
export const legacyMarqueeBlockSchema = z.object({
  id: stableIdSchema.default(defaultMarqueeBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("marquee"),
  ...marqueeBlockDataSchema.shape,
});
export type LegacyMarqueeBlock = z.infer<typeof legacyMarqueeBlockSchema>;
export const legacyFooterCtaBlockSchema = z.object({
  id: stableIdSchema.default(defaultFooterCtaBlock.id),
  enabled: z.boolean().default(true),
  type: z.literal("footerCta"),
  ...footerCtaBlockDataSchema.shape,
});
export type LegacyFooterCtaBlock = z.infer<typeof legacyFooterCtaBlockSchema>;
