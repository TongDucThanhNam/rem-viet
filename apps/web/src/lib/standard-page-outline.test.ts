import { describe, expect, test } from "bun:test";

import { createStandardPageVisualOutline } from "./standard-page-outline";

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

describe("standard-page visual outline adapter", () => {
  test("maps labels, selection, and granted actions through the shared kernel", () => {
    const outline = createStandardPageVisualOutline({
      blocks,
      selectedBlockId: "standard-cta-contact",
      version: 4,
      canWrite: true,
    });
    expect(outline.map(({ label }) => label)).toEqual([
      "Văn bản",
      "Kêu gọi hành động",
    ]);
    expect(outline[1]).toMatchObject({
      id: "standard-cta-contact",
      selected: true,
      depth: 0,
      actions: {
        insert: true,
        edit: true,
        move: true,
        duplicate: true,
        remove: true,
      },
    });
  });

  test("fails closed when the app session cannot write", () => {
    const outline = createStandardPageVisualOutline({
      blocks,
      selectedBlockId: "missing",
      version: 4,
      canWrite: false,
    });
    expect(outline.every(({ selected }) => !selected)).toBe(true);
    expect(outline[0]?.actions).toEqual({
      insert: false,
      edit: false,
      move: false,
      duplicate: false,
      remove: false,
    });
  });
});
