import { defaultHomeBlocks, homeBlockSchema } from "@rem-viet/cms";
import { describe, expect, test } from "bun:test";

import {
  getHomeVisualFieldTarget,
  getHomeVisualFieldTargets,
} from "./home-visual-editing";

const blocks = homeBlockSchema.array().parse(defaultHomeBlocks);

describe("homepage visual field registry", () => {
  test("provides unique, focusable targets for every flagship block", () => {
    for (const block of blocks) {
      const targets = getHomeVisualFieldTargets(block);
      expect(targets.length).toBeGreaterThan(0);
      expect(new Set(targets.map((target) => target.path)).size).toBe(
        targets.length,
      );
      expect(new Set(targets.map((target) => target.controlId)).size).toBe(
        targets.length,
      );
      for (const target of targets) {
        expect(target.path.trim()).toBe(target.path);
        expect(target.controlId.length).toBeGreaterThan(0);
        expect(target.selector.length).toBeGreaterThan(0);
      }
    }
  });

  test("resolves stable scalar and repeated-item field paths", () => {
    const hero = blocks.find((block) => block.type === "hero")!;
    expect(getHomeVisualFieldTarget(hero, "title.prefix")?.controlId).toBe(
      "hero-title-prefix",
    );

    const faq = blocks.find((block) => block.type === "faq")!;
    const firstItem = faq.items[0]!;
    expect(
      getHomeVisualFieldTarget(faq, `items.${firstItem.id}.question`)
        ?.controlId,
    ).toBe(`faq-${firstItem.id}-question`);
    expect(getHomeVisualFieldTarget(faq, "items.missing.question")).toBe(
      undefined,
    );
  });
});
