import { defaultHomeBlocks, homeBlockSchema } from "@rem-viet/cms";
import { describe, expect, test } from "bun:test";

import {
  canDuplicateHomeBlock,
  canRemoveHomeBlock,
  duplicateHomeVisualBlock,
  getInsertableHomeBlockTypes,
  insertHomeVisualBlock,
  moveHomeVisualBlock,
  removeHomeVisualBlock,
} from "./home-visual-order";

const blocks = () => homeBlockSchema.array().parse(defaultHomeBlocks);

describe("homepage visual ordering", () => {
  test("moves a bounded section before or after another section immutably", () => {
    const original = blocks();
    const benefits = original.find((block) => block.type === "benefits")!;
    const craft = original.find((block) => block.type === "craftProcess")!;
    const moved = moveHomeVisualBlock(original, {
      blockId: benefits.id,
      targetBlockId: craft.id,
      placement: "after",
    });

    expect(moved).not.toBeNull();
    expect(moved?.findIndex((block) => block.id === benefits.id)).toBe(
      moved!.findIndex((block) => block.id === craft.id) + 1,
    );
    expect(
      original.findIndex((block) => block.id === benefits.id),
    ).toBeLessThan(original.findIndex((block) => block.id === craft.id));
  });

  test("rejects pinned, missing, and self-referential move intents", () => {
    const original = blocks();
    const hero = original.find((block) => block.type === "hero")!;
    const benefits = original.find((block) => block.type === "benefits")!;
    const footer = original.find((block) => block.type === "footerCta")!;

    expect(
      moveHomeVisualBlock(original, {
        blockId: hero.id,
        targetBlockId: benefits.id,
        placement: "after",
      }),
    ).toBeNull();
    expect(
      moveHomeVisualBlock(original, {
        blockId: benefits.id,
        targetBlockId: footer.id,
        placement: "before",
      }),
    ).toBeNull();
    expect(
      moveHomeVisualBlock(original, {
        blockId: benefits.id,
        targetBlockId: benefits.id,
        placement: "before",
      }),
    ).toBeNull();
    expect(
      moveHomeVisualBlock(original, {
        blockId: "missing",
        targetBlockId: benefits.id,
        placement: "before",
      }),
    ).toBeNull();
  });

  test("adds only template-approved sections between pinned regions", () => {
    const original = blocks();
    const benefits = original.find((block) => block.type === "benefits")!;
    expect(getInsertableHomeBlockTypes(original)).toEqual([
      "marquee",
      "benefits",
    ]);

    const inserted = insertHomeVisualBlock(original, {
      blockType: "benefits",
      targetBlockId: benefits.id,
      placement: "after",
    });
    expect(inserted?.blocks).toHaveLength(original.length + 1);
    expect(inserted?.blocks[0]?.type).toBe("hero");
    expect(inserted?.blocks.at(-1)?.type).toBe("footerCta");
    expect(inserted?.selectedBlockId).not.toBe(benefits.id);
    expect(homeBlockSchema.array().safeParse(inserted?.blocks).success).toBe(
      true,
    );

    const hero = original[0]!;
    expect(
      insertHomeVisualBlock(original, {
        blockType: "benefits",
        targetBlockId: hero.id,
        placement: "before",
      }),
    ).toBeNull();
  });

  test("duplicates with fresh stable IDs and enforces template cardinality", () => {
    const original = blocks();
    const benefits = original.find((block) => block.type === "benefits")!;
    expect(canDuplicateHomeBlock(original, benefits)).toBe(true);
    const first = duplicateHomeVisualBlock(original, benefits.id)!;
    const duplicate = first.blocks.find(
      (block) => block.id === first.selectedBlockId,
    )!;
    expect(duplicate.type).toBe("benefits");
    if (duplicate.type !== "benefits" || benefits.type !== "benefits") return;
    expect(duplicate.items.map((item) => item.id)).not.toEqual(
      benefits.items.map((item) => item.id),
    );

    const second = duplicateHomeVisualBlock(first.blocks, benefits.id)!;
    expect(duplicateHomeVisualBlock(second.blocks, benefits.id)).toBeNull();
  });

  test("removes optional sections but preserves required pinned regions", () => {
    const original = blocks();
    const craft = original.find((block) => block.type === "craftProcess")!;
    const hero = original.find((block) => block.type === "hero")!;
    expect(canRemoveHomeBlock(original, craft)).toBe(true);
    const removed = removeHomeVisualBlock(original, craft.id)!;
    expect(removed.blocks.some((block) => block.id === craft.id)).toBe(false);
    expect(removeHomeVisualBlock(original, hero.id)).toBeNull();
    expect(canRemoveHomeBlock(original, hero)).toBe(false);

    const restored = insertHomeVisualBlock(removed.blocks, {
      blockType: "craftProcess",
      targetBlockId: removed.selectedBlockId,
      placement: "before",
    });
    expect(
      restored?.blocks.some((block) => block.type === "craftProcess"),
    ).toBe(true);
  });
});
