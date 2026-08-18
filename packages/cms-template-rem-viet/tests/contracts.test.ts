import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCmsExtensionRegistry } from "@agency/cms-core";

import faqFixture from "./fixtures/faq-v1.json";
import heroFixture from "./fixtures/hero-v1.json";
import {
  defaultFaqBlock,
  defaultHeroBlock,
  defaultRemVietTemplateBlocks,
  encodeRemVietSanityPageContent,
  faqBlockSchema,
  heroBlockSchema,
  legacyFaqBlockSchema,
  legacyDefaultFaqBlock,
  legacyHeroBlockSchema,
  remVietTemplateAuthoringByType,
  remVietTemplateAuthoringCatalog,
  remVietTemplateBlockLabels,
  remVietTemplateBlockTypes,
  remVietTemplateBlockSchema,
  remVietTemplateComposition,
  remVietStandardBlockAuthoringByType,
  remVietStandardBlockAuthoringCatalog,
  remVietStandardBlockLabels,
  remVietStandardPagesCollection,
  remVietStandardPagesModule,
  remVietRichTextAuthoringByType,
  remVietRichTextAuthoringCatalog,
  remVietRichTextBlockLabels,
  remVietRichTextBlockTypes,
  toLegacyRemVietTemplateBlock,
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
  fromRemVietStandardPageCollectionData,
  toRemVietStandardPageCollectionData,
} from "../src";

describe("Rem Viet flagship template contracts", () => {
  test("defines and round-trips the versioned standard-pages collection", () => {
    const content = {
      title: "About Rèm Việt",
      slug: "about-rem-viet",
      template: "standard" as const,
      blocks: [
        {
          id: "intro",
          type: "richText" as const,
          schemaVersion: 1,
          enabled: true,
          data: { content: "Our story" },
        },
      ],
      seo: {
        title: "About Rèm Việt",
        description: "Made-to-measure curtains",
        canonicalUrl: "",
        ogImage: "",
        robotsIndex: true,
        robotsFollow: true,
      },
    };

    expect(remVietStandardPagesCollection.schemaVersion).toBe(1);
    expect(remVietStandardPagesCollection.lifecycle).toEqual({
      drafts: true,
      revisions: true,
      scheduling: true,
    });
    const extensions = createCmsExtensionRegistry({
      modules: [remVietStandardPagesModule],
    });
    expect(
      extensions.collections.get(remVietStandardPagesCollection.slug),
    ).toBe(remVietStandardPagesCollection);
    expect(extensions.hooks.map(({ id }) => id)).toEqual([
      "rem-viet-standard-pages/validate-template",
    ]);
    expect(
      fromRemVietStandardPageCollectionData(
        toRemVietStandardPageCollectionData(content),
      ),
    ).toEqual(content);
  });

  test("round-trips the canonical Hero golden fixture", () => {
    const parsed = heroBlockSchema.parse(heroFixture);
    expect(parsed).toEqual(defaultHeroBlock);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(heroFixture);
  });

  test("round-trips the canonical FAQ golden fixture", () => {
    const parsed = faqBlockSchema.parse(faqFixture);
    expect(parsed).toEqual(defaultFaqBlock);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(faqFixture);
  });

  test("rejects an unsupported future block schema version", () => {
    expect(
      heroBlockSchema.safeParse({ ...heroFixture, schemaVersion: 2 }).success,
    ).toBe(false);
    expect(
      faqBlockSchema.safeParse({ ...faqFixture, schemaVersion: 2 }).success,
    ).toBe(false);
  });

  test("keeps legacy flattened records readable for the compatibility facade", () => {
    const hero = legacyHeroBlockSchema.parse({
      type: "hero",
      title: "Legacy title",
      subtitle: "Legacy description",
      image: "/legacy.webp",
    });
    expect(hero.title).toEqual({ prefix: "Legacy title", accent: "" });
    expect(hero.description).toBe("Legacy description");
    expect(hero.background.src).toBe("/legacy.webp");

    expect(
      legacyFaqBlockSchema.parse(legacyDefaultFaqBlock).items,
    ).toHaveLength(4);
  });

  test("round-trips every legacy block from the established homepage seed", () => {
    const seed = readFileSync(
      resolve(import.meta.dir, "../../db/seeds/home.sql"),
      "utf8",
    );
    const match = seed.match(/\n  '(\[\{.*\}\])',\r?\n  'published'/s);
    expect(match?.[1]).toBeTruthy();
    const legacyBlocks = JSON.parse(match![1]!) as unknown[];
    expect(legacyBlocks).toHaveLength(10);

    const canonical = legacyBlocks.map((block) =>
      remVietTemplateBlockSchema.parse(block),
    );
    expect(canonical).toEqual(defaultRemVietTemplateBlocks);
    expect(canonical.map(toLegacyRemVietTemplateBlock)).toEqual(legacyBlocks);
  });

  test("encodes the exact Hero + FAQ Studio slice with stable Sanity identities", () => {
    const encoded = encodeRemVietSanityPageContent({
      title: "Home",
      blocks: [defaultHeroBlock, defaultFaqBlock],
    }) as {
      blocks: Array<{
        _key: string;
        _type: string;
        data: {
          features?: Array<{ _key: string; _type: string }>;
          items?: Array<{ _key: string; _type: string }>;
        };
      }>;
    };
    expect(encoded.blocks.map(({ _key, _type }) => ({ _key, _type }))).toEqual([
      { _key: defaultHeroBlock.id, _type: "agencyHeroBlock" },
      { _key: defaultFaqBlock.id, _type: "agencyFaqBlock" },
    ]);
    expect(encoded.blocks[0]?.data.features?.[0]).toMatchObject({
      _key: defaultHeroBlock.data.features[0]!.id,
      _type: "agencyHeroFeature",
    });
    expect(encoded.blocks[1]?.data.items?.[0]).toMatchObject({
      _key: defaultFaqBlock.data.items[0]!.id,
      _type: "agencyFaqItem",
    });
    expect(() =>
      encodeRemVietSanityPageContent({
        blocks: [defaultRemVietTemplateBlocks[1]],
      }),
    ).toThrow(/does not support block type/i);
  });

  test("rejects schema version drift for every template block", () => {
    for (const block of defaultRemVietTemplateBlocks) {
      expect(
        remVietTemplateBlockSchema.safeParse({
          ...block,
          schemaVersion: block.schemaVersion + 1,
        }).success,
      ).toBe(false);
    }
  });

  test("publishes bounded composition rules for every flagship block", () => {
    expect(remVietTemplateBlockTypes).toEqual(
      defaultRemVietTemplateBlocks.map((block) => block.type),
    );
    expect(remVietTemplateComposition.hero).toEqual({
      minInstances: 1,
      maxInstances: 1,
      pinned: "start",
    });
    expect(remVietTemplateComposition.footerCta.pinned).toBe("end");
    expect(remVietTemplateComposition.benefits.maxInstances).toBeGreaterThan(1);
    for (const rule of Object.values(remVietTemplateComposition)) {
      expect(rule.minInstances).toBeGreaterThanOrEqual(0);
      expect(rule.maxInstances).toBeGreaterThanOrEqual(rule.minInstances);
    }
  });

  test("publishes exhaustive immutable authoring metadata", () => {
    expect(remVietTemplateAuthoringCatalog.map(({ type }) => type)).toEqual(
      remVietTemplateBlockTypes,
    );
    expect(
      new Set(remVietTemplateAuthoringCatalog.map(({ type }) => type)).size,
    ).toBe(remVietTemplateBlockTypes.length);

    for (const definition of remVietTemplateAuthoringCatalog) {
      expect(definition.label.trim()).not.toBe("");
      expect(definition.description.trim()).not.toBe("");
      expect(definition.category.trim()).not.toBe("");
      expect(definition.keywords.length).toBeGreaterThan(0);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.keywords)).toBe(true);
      expect(remVietTemplateAuthoringByType[definition.type]).toBe(definition);
      expect(remVietTemplateBlockLabels[definition.type]).toBe(
        definition.label,
      );
    }
  });

  test("adapts the three standard page blocks to versioned envelopes", () => {
    const legacy = [
      { type: "richText", content: '{"type":"doc","content":[]}' },
      { type: "productGrid", categoryId: "curtains", limit: 8 },
      { type: "cta", title: "Contact", href: "/lien-he" },
    ];
    const canonical = legacy.map((block, index) => {
      const result = toRemVietStandardBlock(block, index);
      if (!result.success) throw result.error;
      return result.data;
    });

    expect(canonical.map(({ id }) => id)).toEqual([
      "standard-0-richText",
      "standard-1-productGrid",
      "standard-2-cta",
    ]);
    expect(canonical.map(toLegacyRemVietStandardBlock)).toEqual([
      {
        id: "standard-0-richText",
        type: "richText",
        content: '{"type":"doc","content":[]}',
      },
      {
        id: "standard-1-productGrid",
        type: "productGrid",
        categoryId: "curtains",
        limit: 8,
      },
      {
        id: "standard-2-cta",
        type: "cta",
        title: "Contact",
        href: "/lien-he",
      },
    ]);

    const persisted = toRemVietStandardBlock(
      {
        id: "standard-richText-persisted",
        type: "richText",
        content: "Stable",
      },
      99,
    );
    expect(persisted.success && persisted.data.id).toBe(
      "standard-richText-persisted",
    );
  });

  test("publishes exhaustive immutable discovery metadata for standard pages", () => {
    expect(
      remVietStandardBlockAuthoringCatalog.map(({ type }) => type),
    ).toEqual(["richText", "productGrid", "cta"]);
    for (const definition of remVietStandardBlockAuthoringCatalog) {
      expect(definition.label.trim()).not.toBe("");
      expect(definition.description.trim()).not.toBe("");
      expect(definition.category.trim()).not.toBe("");
      expect(definition.keywords.length).toBeGreaterThan(0);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.keywords)).toBe(true);
      expect(remVietStandardBlockAuthoringByType[definition.type]).toBe(
        definition,
      );
      expect(remVietStandardBlockLabels[definition.type]).toBe(
        definition.label,
      );
    }
  });

  test("publishes exhaustive immutable discovery metadata for rich text", () => {
    expect(remVietRichTextBlockTypes).toEqual([
      "paragraph",
      "heading",
      "list",
      "quote",
      "image",
      "video",
      "code",
    ]);
    expect(remVietRichTextAuthoringCatalog.map(({ type }) => type)).toEqual(
      remVietRichTextBlockTypes,
    );
    for (const definition of remVietRichTextAuthoringCatalog) {
      expect(definition.label.trim()).not.toBe("");
      expect(definition.description.trim()).not.toBe("");
      expect(definition.category.trim()).not.toBe("");
      expect(definition.keywords.length).toBeGreaterThan(0);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.keywords)).toBe(true);
      expect(remVietRichTextAuthoringByType[definition.type]).toBe(definition);
      expect(remVietRichTextBlockLabels[definition.type]).toBe(
        definition.label,
      );
    }
  });
});
