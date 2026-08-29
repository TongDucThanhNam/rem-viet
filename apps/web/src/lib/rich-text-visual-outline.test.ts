import { describe, expect, test } from "bun:test";
import {
  MAX_RICH_TEXT_BLOCKS,
  richTextDocumentSchema,
} from "@rem-viet/cms";

import { createRichTextVisualOutline } from "./rich-text-visual-outline";

const document = richTextDocumentSchema.parse({
  version: 1,
  blocks: [
    { id: "post-heading", type: "heading", level: 2, children: [{ text: "A" }] },
    { id: "post-paragraph", type: "paragraph", children: [{ text: "B" }] },
    { id: "post-quote", type: "quote", children: [{ text: "C" }] },
  ],
});

describe("rich-text visual outline adapter", () => {
  test("maps stable block IDs, Vietnamese labels, selection, and grants", () => {
    const outline = createRichTextVisualOutline({
      document,
      selectedBlockIndex: 1,
      version: 5,
      canWrite: true,
    });
    expect(outline.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "post-heading", label: "Tiêu đề" },
      { id: "post-paragraph", label: "Đoạn văn" },
      { id: "post-quote", label: "Trích dẫn" },
    ]);
    expect(outline[1]).toMatchObject({
      selected: true,
      actions: {
        insert: true,
        edit: true,
        move: true,
        duplicate: true,
        remove: true,
      },
    });
  });

  test("fails closed without write authority", () => {
    const outline = createRichTextVisualOutline({
      document,
      selectedBlockIndex: 0,
      version: 5,
      canWrite: false,
    });
    expect(
      outline.every(({ actions }) =>
        Object.values(actions).every((allowed) => !allowed),
      ),
    ).toBe(true);
  });

  test("stops advertising insertion and duplication at the document limit", () => {
    const fullDocument = richTextDocumentSchema.parse({
      version: 1,
      blocks: Array.from({ length: MAX_RICH_TEXT_BLOCKS }, (_, index) => ({
        id: `paragraph-${index}`,
        type: "paragraph" as const,
        children: [{ text: String(index) }],
      })),
    });
    const outline = createRichTextVisualOutline({
      document: fullDocument,
      selectedBlockIndex: 0,
      version: 5,
      canWrite: true,
    });
    expect(outline[0]?.actions).toMatchObject({
      insert: false,
      duplicate: false,
    });
  });
});
