import { describe, expect, test } from "bun:test";

import { applyStandardPageInlineText } from "./standard-page-inline-edit";

const blocks = [
  {
    id: "standard-cta-contact",
    type: "cta" as const,
    title: "Contact us",
    href: "/lien-he",
  },
];

describe("standard-page inline text adapter", () => {
  test("updates a template-declared inline field as one canonical version", () => {
    const result = applyStandardPageInlineText({
      blocks,
      blockId: "standard-cta-contact",
      fieldPath: "title",
      value: "  Request a consultation  ",
      version: 4,
      canEdit: true,
    });

    expect(result.version).toBe(5);
    expect(result.blocks).toEqual([
      {
        ...blocks[0],
        title: "Request a consultation",
      },
    ]);
  });

  test("rejects non-inline fields and missing edit grants", () => {
    expect(() =>
      applyStandardPageInlineText({
        blocks,
        blockId: "standard-cta-contact",
        fieldPath: "href",
        value: "/new-target",
        version: 4,
        canEdit: true,
      }),
    ).toThrow("does not allow inline text editing");
    expect(() =>
      applyStandardPageInlineText({
        blocks,
        blockId: "standard-cta-contact",
        fieldPath: "title",
        value: "Denied",
        version: 4,
        canEdit: false,
      }),
    ).toThrow("permission denied");
  });
});
