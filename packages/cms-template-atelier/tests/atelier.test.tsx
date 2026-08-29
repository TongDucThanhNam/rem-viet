import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applyCmsVisualClipboardPaste,
  applyCmsVisualInlineTextUpdate,
  applyCmsVisualPattern,
  createCmsVisualClipboardPayload,
  getCmsVisualInlineTextTargets,
} from "@agency/cms-visual-editor";

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

  test("ships reusable, permission-checked editorial patterns", () => {
    const document = createAtelierDefaultDocument("atelier-demo");
    let serial = 0;
    const patterned = applyCmsVisualPattern({
      document,
      registry: atelierTemplateFactory.registry,
      patterns: atelierTemplateFactory.patterns,
      patternId: "editorial-feature",
      location: { parentId: null, index: 3 },
      createId: (type) => `${type}-pattern-${++serial}`,
      grants: new Set(["content.compose.insert"]),
    });
    expect(atelierTemplateFactory.patterns.patterns).toHaveLength(2);
    expect(patterned.version).toBe(1);
    expect(patterned.nodes).toHaveLength(5);
    expect(patterned.nodes[3]?.type).toBe("columnLayout");
    expect(patterned.nodes[3]?.slots?.primary).toHaveLength(2);
    expect(patterned.nodes.at(-1)?.type).toBe("siteFooter");
  });

  test("declares permission-filtered inline titles across nested content", () => {
    const document = createAtelierDefaultDocument("atelier-demo");
    expect(
      getCmsVisualInlineTextTargets({
        nodes: document.nodes,
        registry: atelierTemplateFactory.registry,
        grants: new Set(),
      }),
    ).toEqual([]);

    const targets = getCmsVisualInlineTextTargets({
      nodes: document.nodes,
      registry: atelierTemplateFactory.registry,
      grants: new Set(["content.component.edit"]),
    });
    expect(targets).toEqual([
      {
        blockId: "home-story",
        fieldPath: "title",
        label: "Title",
        maxLength: 160,
        multiline: false,
      },
      {
        blockId: "home-masthead",
        fieldPath: "title",
        label: "Title",
        maxLength: 160,
        multiline: false,
      },
    ]);

    const updated = applyCmsVisualInlineTextUpdate({
      document,
      registry: atelierTemplateFactory.registry,
      nodeId: "home-story",
      fieldPath: "title",
      value: "  A durable public room  ",
      grants: new Set(["content.component.edit"]),
    });
    expect(updated.version).toBe(1);
    expect(updated.nodes[1]?.slots?.primary[0]?.data).toMatchObject({
      title: "A durable public room",
    });
  });

  test("copies and pastes nested editorial content through the shared clipboard", () => {
    const document = createAtelierDefaultDocument("atelier-demo");
    const payload = createCmsVisualClipboardPayload({
      document,
      registry: atelierTemplateFactory.registry,
      nodeIds: ["home-story"],
    });
    const pasted = applyCmsVisualClipboardPaste({
      document,
      registry: atelierTemplateFactory.registry,
      payload,
      location: { parentId: "home-columns", slot: "primary", index: 1 },
      createId: ({ id }) => `clipboard-${id}`,
      grants: new Set(["content.compose.insert"]),
    });
    expect(pasted.rootNodeIds).toEqual(["clipboard-home-story"]);
    expect(pasted.document.version).toBe(1);
    expect(pasted.document.nodes[1]?.slots?.primary).toHaveLength(4);
    expect(pasted.document.nodes[1]?.slots?.primary[1]).toMatchObject({
      id: "clipboard-home-story",
      type: "storyCard",
      data: { title: "The useful edge" },
    });
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
