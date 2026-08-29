import { describe, expect, test } from "bun:test";

import { applyStandardPagePattern } from "./standard-page-patterns";

const existingBlocks = [
  {
    id: "standard-richText-existing",
    type: "richText" as const,
    content: JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "existing-copy",
          type: "paragraph",
          children: [{ text: "Existing copy" }],
        },
      ],
    }),
  },
];

describe("standard-page visual patterns", () => {
  test("appends a validated multi-block preset as one visual document version", () => {
    const result = applyStandardPagePattern({
      blocks: existingBlocks,
      patternId: "catalog-section",
      version: 7,
      canInsert: true,
    });

    expect(result.firstInsertedIndex).toBe(1);
    expect(result.version).toBe(8);
    expect(result.blocks.map(({ type }) => type)).toEqual([
      "richText",
      "richText",
      "productGrid",
      "cta",
    ]);
    expect(new Set(result.blocks.map(({ id }) => id)).size).toBe(4);
    expect(result.blocks[0]).toEqual(existingBlocks[0]);
  });

  test("rejects pattern insertion without the content-write capability", () => {
    expect(() =>
      applyStandardPagePattern({
        blocks: existingBlocks,
        patternId: "content-and-cta",
        version: 2,
        canInsert: false,
      }),
    ).toThrow("permission denied");
  });

  test("does not accept an unregistered pattern id", () => {
    expect(() =>
      applyStandardPagePattern({
        blocks: existingBlocks,
        patternId: "unknown-pattern",
        version: 2,
        canInsert: true,
      }),
    ).toThrow("Unknown visual pattern");
  });
});
