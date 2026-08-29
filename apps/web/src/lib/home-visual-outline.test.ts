import { describe, expect, test } from "bun:test";
import { defaultHomeBlocks, homeBlockSchema } from "@rem-viet/cms";

import { createHomeVisualOutline } from "./home-visual-outline";

const blocks = homeBlockSchema.array().parse(defaultHomeBlocks);

describe("homepage visual outline adapter", () => {
  test("maps labels, selection, and canonical composition constraints", () => {
    const outline = createHomeVisualOutline({
      blocks,
      selectedBlockId: "home-benefits",
      version: 8,
      canWrite: true,
    });
    expect(outline[0]).toMatchObject({
      id: "home-hero",
      label: "Hero mở đầu",
      actions: {
        insert: false,
        edit: true,
        move: false,
        duplicate: false,
        remove: false,
      },
    });
    expect(outline.find(({ id }) => id === "home-benefits")).toMatchObject({
      label: "Lợi ích",
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

  test("fails closed when the app session cannot write", () => {
    const outline = createHomeVisualOutline({
      blocks,
      selectedBlockId: blocks[0]!.id,
      version: 8,
      canWrite: false,
    });
    expect(
      outline.every(({ actions }) =>
        Object.values(actions).every((allowed) => !allowed),
      ),
    ).toBe(true);
  });
});
