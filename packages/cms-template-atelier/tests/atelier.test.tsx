import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AtelierDocument } from "../src";
import { createAtelierBootstrapPlan } from "../src/bootstrap";
import {
  atelierTemplateFactory,
  createAtelierDefaultDocument,
} from "../src/visual-authoring";

describe("Atelier second template", () => {
  test("uses nine factory blocks and bounded nested column slots", () => {
    const document = createAtelierDefaultDocument("atelier-demo");
    expect(atelierTemplateFactory.blocks).toHaveLength(9);
    expect(document.nodes.map((node) => node.type)).toEqual([
      "masthead",
      "columnLayout",
      "scheduleGrid",
      "siteFooter",
    ]);
    expect(document.nodes[1]?.slots?.primary).toHaveLength(3);
    expect(document.nodes[1]?.slots?.sidebar).toHaveLength(2);
    expect(() =>
      atelierTemplateFactory.parseDocument({
        ...document,
        nodes: document.nodes.map((node) =>
          node.type === "columnLayout"
            ? { ...node, slots: { ...node.slots, sidebar: [] } }
            : node,
        ),
      }),
    ).toThrow("requires 1-4 children");
  });

  test("renders a distinct editorial information architecture", () => {
    const document = createAtelierDefaultDocument("atelier-demo");
    const html = renderToStaticMarkup(
      <AtelierDocument nodes={document.nodes as never} />,
    );
    expect(html).toContain("Atelier Index");
    expect(html).toContain("In this issue");
    expect(html).toContain("Assembly calendar");
    expect(html).toContain("atelier-columns--wide");
    expect(html).not.toMatch(/Rèm|lưới chống muỗi|hero-new/);
  });

  test("generates manifest, theme, assets, seed and handover from package APIs", () => {
    const plan = createAtelierBootstrapPlan({
      siteId: "atelier-demo",
      name: "Atelier Demo",
      siteUrl: "https://atelier.example",
      preset: "editorial",
      provider: "cloudflare",
      defaultLocale: "en-US",
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      "site.manifest.json",
      "theme.tokens.json",
      "assets.contract.json",
      "content.seed.json",
      ".env.example",
      "HANDOVER.md",
      "public/assets/atelier-demo-atelier-mark.svg",
      "public/assets/atelier-demo-editorial.svg",
    ]);
    expect(plan.manifest.kit.template).toBe("@agency/cms-template-atelier");
  });

  test("rejects provider drift before generating files", () => {
    expect(() =>
      createAtelierBootstrapPlan({
        siteId: "atelier-demo",
        name: "Atelier Demo",
        siteUrl: "https://atelier.example",
        preset: "editorial",
        provider: "unknown",
        defaultLocale: "en-US",
      }),
    ).toThrow("cloudflare only");
  });
});
