import { describe, expect, test } from "bun:test";
import type { RichTextDocument } from "@rem-viet/cms";

import {
  applyPostRichTextComposition,
  isPostRichTextCompositionCommand,
} from "./post-rich-text-composition";

const document: RichTextDocument = {
  version: 1,
  blocks: [
    { id: "rich-alpha", type: "paragraph", children: [{ text: "Alpha" }] },
    {
      id: "rich-bravo",
      type: "heading",
      level: 2,
      children: [{ text: "Bravo" }],
    },
    { id: "rich-charlie", type: "quote", children: [{ text: "Charlie" }] },
  ],
};

describe("post rich-text composition", () => {
  test("moves blocks before and after without mutating the source", () => {
    const movedAfter = applyPostRichTextComposition(document, {
      type: "move",
      sourceId: "rich-alpha",
      sourceIndex: 0,
      targetId: "rich-charlie",
      targetIndex: 2,
      placement: "after",
    });
    expect(movedAfter.blocks.map((block) => block.type)).toEqual([
      "heading",
      "quote",
      "paragraph",
    ]);
    const movedBefore = applyPostRichTextComposition(document, {
      type: "move",
      sourceId: "rich-charlie",
      sourceIndex: 2,
      targetId: "rich-alpha",
      targetIndex: 0,
      placement: "before",
    });
    expect(movedBefore.blocks.map((block) => block.type)).toEqual([
      "quote",
      "paragraph",
      "heading",
    ]);
    expect(document.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "quote",
    ]);
  });

  test("inserts, duplicates and removes within the document bounds", () => {
    const inserted = applyPostRichTextComposition(document, {
      type: "insert-paragraph",
      targetId: "rich-alpha",
      targetIndex: 0,
      placement: "after",
    });
    expect(inserted.blocks).toHaveLength(4);
    expect(inserted.blocks[1]).toMatchObject({
      type: "paragraph",
      children: [{ text: "" }],
    });
    expect(inserted.blocks[1]?.id).not.toBe("rich-alpha");

    const duplicated = applyPostRichTextComposition(document, {
      type: "duplicate",
      targetId: "rich-bravo",
      targetIndex: 1,
    });
    expect(duplicated.blocks[2]).toEqual({
      ...document.blocks[1],
      id: expect.any(String),
    });
    expect(duplicated.blocks[2]?.id).not.toBe(document.blocks[1]?.id);
    expect(duplicated.blocks[2]).not.toBe(document.blocks[1]);

    const removed = applyPostRichTextComposition(document, {
      type: "remove",
      targetId: "rich-bravo",
      targetIndex: 1,
    });
    expect(removed.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "quote",
    ]);
    expect(
      applyPostRichTextComposition(
        { version: 1, blocks: [document.blocks[0]] },
        { type: "remove", targetId: "rich-alpha", targetIndex: 0 },
      ),
    ).toEqual({ version: 1, blocks: [document.blocks[0]] });
  });

  test("rejects malformed or out-of-range commands", () => {
    expect(
      isPostRichTextCompositionCommand({
        type: "move",
        sourceId: "rich-alpha",
        sourceIndex: 0,
        targetId: "rich-bravo",
        targetIndex: 1,
        placement: "after",
      }),
    ).toBe(true);
    expect(
      isPostRichTextCompositionCommand({
        type: "move",
        sourceId: "rich-alpha",
        sourceIndex: -1,
        targetId: "rich-bravo",
        targetIndex: 1,
        placement: "after",
      }),
    ).toBe(false);
    expect(
      isPostRichTextCompositionCommand({
        type: "duplicate",
        targetId: "rich-bravo",
        targetIndex: 500,
      }),
    ).toBe(false);
    expect(
      applyPostRichTextComposition(document, {
        type: "remove",
        targetId: "rich-missing",
        targetIndex: 99,
      }),
    ).toBe(document);
    expect(
      applyPostRichTextComposition(document, {
        type: "remove",
        targetId: "rich-missing",
        targetIndex: 1,
      }),
    ).toBe(document);
  });
});
