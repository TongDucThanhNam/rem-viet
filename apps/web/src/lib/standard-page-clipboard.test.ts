import { describe, expect, test } from "bun:test";

import {
  copyStandardPageBlock,
  pasteStandardPageBlocks,
} from "./standard-page-clipboard";

const blocks = [
  {
    id: "standard-richText-intro",
    type: "richText" as const,
    content: JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "intro-paragraph",
          type: "paragraph",
          children: [{ text: "Introduction" }],
        },
      ],
    }),
  },
  {
    id: "standard-cta-contact",
    type: "cta" as const,
    title: "Contact us",
    href: "/lien-he",
  },
];

describe("standard-page visual clipboard adapter", () => {
  test("copies and pastes a canonical block with a fresh stable ID", () => {
    const clipboardText = copyStandardPageBlock({
      blocks,
      blockId: "standard-cta-contact",
      version: 4,
    });
    const result = pasteStandardPageBlocks({
      blocks,
      clipboardText,
      targetIndex: 0,
      placement: "after",
      version: 4,
      canInsert: true,
    });

    expect(result.version).toBe(5);
    expect(result.firstInsertedIndex).toBe(1);
    expect(result.blocks.map(({ type }) => type)).toEqual([
      "richText",
      "cta",
      "cta",
    ]);
    expect(result.blocks[1]).toMatchObject({
      type: "cta",
      title: "Contact us",
      href: "/lien-he",
    });
    expect(result.blocks[1]?.id).not.toBe("standard-cta-contact");
    expect(result.rootBlockIds).toEqual([result.blocks[1]?.id]);
  });

  test("rejects missing grants, foreign blocks, and unknown copy targets", () => {
    const clipboardText = copyStandardPageBlock({
      blocks,
      blockId: "standard-cta-contact",
      version: 4,
    });
    expect(() =>
      pasteStandardPageBlocks({
        blocks,
        clipboardText,
        targetIndex: 0,
        placement: "after",
        version: 4,
        canInsert: false,
      }),
    ).toThrow("permission denied");

    const foreign = JSON.parse(clipboardText) as {
      nodes: Array<{ type: string }>;
    };
    foreign.nodes[0]!.type = "masthead";
    expect(() =>
      pasteStandardPageBlocks({
        blocks,
        clipboardText: JSON.stringify(foreign),
        targetIndex: 0,
        placement: "after",
        version: 4,
        canInsert: true,
      }),
    ).toThrow("Unsupported standard-page clipboard block");
    expect(() =>
      copyStandardPageBlock({
        blocks,
        blockId: "missing",
        version: 4,
      }),
    ).toThrow("Unknown visual node");
  });
});
