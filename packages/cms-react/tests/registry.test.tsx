import { describe, expect, test } from "bun:test";
import { createCmsBlockSchema, type CmsBlock } from "@agency/cms-core";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";

import { CmsBlockRenderer, createBlockRegistry } from "../src";

type TextBlock = CmsBlock<"text", { text: string }>;

describe("typed block registry", () => {
  test("validates and renders a registered block without a type switch", () => {
    const schema = createCmsBlockSchema("text", z.object({ text: z.string() }));
    const block: TextBlock = {
      id: "intro",
      type: "text",
      schemaVersion: 1,
      enabled: true,
      data: { text: "Registry works" },
    };
    const registry = createBlockRegistry<TextBlock, { prefix: string }>({
      text: {
        schema,
        defaults: block,
        Renderer: ({ block: value, context }) => (
          <p>{`${context.prefix}${value.data.text}`}</p>
        ),
      },
    });

    expect(
      renderToStaticMarkup(
        <CmsBlockRenderer
          block={block}
          context={{ prefix: "CMS: " }}
          registry={registry}
        />,
      ),
    ).toBe("<p>CMS: Registry works</p>");
  });
});
