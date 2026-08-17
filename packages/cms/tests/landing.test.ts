import { describe, expect, test } from "bun:test";

import {
  benefitsBlockSchema,
  bentoDetailsBlockSchema,
  craftProcessBlockSchema,
  defaultBenefitsBlock,
  defaultBentoDetailsBlock,
  defaultCraftProcessBlock,
  defaultFaqBlock,
  defaultFooterCtaBlock,
  defaultHomeBlocks,
  defaultHorizontalGalleryBlock,
  defaultHeroBlock,
  defaultMarqueeBlock,
  defaultMeasurementGuideBlock,
  defaultThreatNarrativeBlock,
  faqBlockSchema,
  footerCtaBlockSchema,
  heroBlockContentSchema,
  heroBlockSchema,
  horizontalGalleryBlockSchema,
  marqueeBlockSchema,
  measurementGuideBlockSchema,
  pageBlockListSchema,
  threatNarrativeBlockSchema,
} from "../src";

const landingBlockContracts = [
  {
    type: "hero",
    schema: heroBlockContentSchema,
    valid: defaultHeroBlock,
    invalid: { ...defaultHeroBlock, features: [] },
  },
  {
    type: "threatNarrative",
    schema: threatNarrativeBlockSchema,
    valid: defaultThreatNarrativeBlock,
    invalid: { ...defaultThreatNarrativeBlock, steps: [] },
  },
  {
    type: "marquee",
    schema: marqueeBlockSchema,
    valid: defaultMarqueeBlock,
    invalid: { ...defaultMarqueeBlock, text: "" },
  },
  {
    type: "benefits",
    schema: benefitsBlockSchema,
    valid: defaultBenefitsBlock,
    invalid: { ...defaultBenefitsBlock, items: [] },
  },
  {
    type: "craftProcess",
    schema: craftProcessBlockSchema,
    valid: defaultCraftProcessBlock,
    invalid: { ...defaultCraftProcessBlock, steps: [] },
  },
  {
    type: "bentoDetails",
    schema: bentoDetailsBlockSchema,
    valid: defaultBentoDetailsBlock,
    invalid: { ...defaultBentoDetailsBlock, stats: [] },
  },
  {
    type: "horizontalGallery",
    schema: horizontalGalleryBlockSchema,
    valid: defaultHorizontalGalleryBlock,
    invalid: { ...defaultHorizontalGalleryBlock, items: [] },
  },
  {
    type: "measurementGuide",
    schema: measurementGuideBlockSchema,
    valid: defaultMeasurementGuideBlock,
    invalid: { ...defaultMeasurementGuideBlock, steps: [] },
  },
  {
    type: "faq",
    schema: faqBlockSchema,
    valid: defaultFaqBlock,
    invalid: { ...defaultFaqBlock, items: [] },
  },
  {
    type: "footerCta",
    schema: footerCtaBlockSchema,
    valid: defaultFooterCtaBlock,
    invalid: { ...defaultFooterCtaBlock, email: "not-an-email" },
  },
] as const;

describe("typed landing Hero contract", () => {
  test("ships a valid migration default with exactly four stable features", () => {
    const result = heroBlockContentSchema.safeParse(defaultHeroBlock);

    expect(result.success).toBe(true);
    expect(result.data?.features).toHaveLength(4);
    expect(
      new Set(result.data?.features.map((feature) => feature.id)).size,
    ).toBe(4);
  });

  test("normalizes the legacy generic Hero shape at the schema boundary", () => {
    const result = heroBlockSchema.parse({
      type: "hero",
      title: "Legacy title",
      subtitle: "Legacy description",
      image: "/legacy.webp",
    });

    expect(result.title).toEqual({ prefix: "Legacy title", accent: "" });
    expect(result.description).toBe("Legacy description");
    expect(result.background.src).toBe("/legacy.webp");
  });

  test("rejects an editor payload that changes the fixed feature count", () => {
    const result = heroBlockContentSchema.safeParse({
      ...defaultHeroBlock,
      features: defaultHeroBlock.features.slice(0, 3),
    });

    expect(result.success).toBe(false);
  });
});

describe("typed flagship homepage contract", () => {
  for (const contract of landingBlockContracts) {
    test(`${contract.type} accepts its default and rejects an invalid payload`, () => {
      expect(contract.schema.safeParse(contract.valid).success).toBe(true);
      expect(contract.schema.safeParse(contract.invalid).success).toBe(false);
    });
  }

  test("ships one valid block for every editable landing section", () => {
    const result = pageBlockListSchema.safeParse(defaultHomeBlocks);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(10);
    expect(new Set(result.data?.map((block) => block.type)).size).toBe(10);
  });

  test("keeps the canonical render order stable", () => {
    expect(defaultHomeBlocks.map((block) => block.type)).toEqual([
      "hero",
      "threatNarrative",
      "marquee",
      "benefits",
      "craftProcess",
      "bentoDetails",
      "horizontalGallery",
      "measurementGuide",
      "faq",
      "footerCta",
    ]);
  });

  test("rejects missing alt text on public content images", () => {
    const invalid = JSON.parse(JSON.stringify(defaultHomeBlocks));
    invalid[6].items[0].image.alt = "";

    const result = pageBlockListSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Alt ảnh là bắt buộc.");
  });
});
