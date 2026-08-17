import {
  remVietTemplateBlockTypes,
  remVietTemplateComposition,
  type RemVietTemplateBlockType,
} from "@agency/cms-template-rem-viet";
import {
  defaultHomeBlocks,
  homeBlockSchema,
  type HomeBlock,
} from "@rem-viet/cms";

export type HomeVisualMove = Readonly<{
  blockId: string;
  targetBlockId: string;
  placement: "before" | "after";
}>;

export type HomeVisualInsert = Readonly<{
  blockType: RemVietTemplateBlockType;
  targetBlockId: string;
  placement: "before" | "after";
}>;

export type HomeCompositionResult = Readonly<{
  blocks: HomeBlock[];
  selectedBlockId: string;
}>;

export function isPinnedHomeBlock(block: HomeBlock) {
  return remVietTemplateComposition[block.type].pinned !== null;
}

export function isHomeBlockType(
  value: string,
): value is RemVietTemplateBlockType {
  return remVietTemplateBlockTypes.some((type) => type === value);
}

function countHomeBlockType(
  blocks: readonly HomeBlock[],
  type: RemVietTemplateBlockType,
) {
  return blocks.reduce(
    (count, block) => count + Number(block.type === type),
    0,
  );
}

export function getInsertableHomeBlockTypes(
  blocks: readonly HomeBlock[],
): RemVietTemplateBlockType[] {
  return remVietTemplateBlockTypes.filter(
    (type) =>
      countHomeBlockType(blocks, type) <
      remVietTemplateComposition[type].maxInstances,
  );
}

export function canDuplicateHomeBlock(
  blocks: readonly HomeBlock[],
  block: HomeBlock,
) {
  const rule = remVietTemplateComposition[block.type];
  return (
    rule.pinned === null &&
    countHomeBlockType(blocks, block.type) < rule.maxInstances
  );
}

export function canRemoveHomeBlock(
  blocks: readonly HomeBlock[],
  block: HomeBlock,
) {
  const rule = remVietTemplateComposition[block.type];
  return (
    rule.pinned === null &&
    countHomeBlockType(blocks, block.type) > rule.minInstances
  );
}

function createUniqueBlockId(
  blocks: readonly HomeBlock[],
  stem: string,
): string {
  const ids = new Set(blocks.map((block) => block.id));
  const base = stem.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 54);
  if (!ids.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, 63 - String(suffix).length)}-${suffix}`;
    if (!ids.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a unique homepage block ID.");
}

function rekeyNestedItems(block: HomeBlock, blockId: string): HomeBlock {
  let itemSequence = 0;
  const visit = (value: unknown, root = false): unknown => {
    if (Array.isArray(value)) return value.map((entry) => visit(entry));
    if (!value || typeof value !== "object") return value;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "id") {
        result[key] = root
          ? blockId
          : `${blockId.slice(0, 50)}-item-${++itemSequence}`;
      } else {
        result[key] = visit(entry);
      }
    }
    return result;
  };
  return homeBlockSchema.parse(visit(block, true));
}

function createHomeBlock(
  blocks: readonly HomeBlock[],
  type: RemVietTemplateBlockType,
  stem = `home-${type}`,
) {
  const template = defaultHomeBlocks.find((block) => block.type === type);
  if (!template) return null;
  const id = createUniqueBlockId(blocks, stem);
  return rekeyNestedItems(homeBlockSchema.parse(template), id);
}

export function insertHomeVisualBlock(
  blocks: readonly HomeBlock[],
  intent: HomeVisualInsert,
): HomeCompositionResult | null {
  const targetIndex = blocks.findIndex(
    (block) => block.id === intent.targetBlockId,
  );
  const rule = remVietTemplateComposition[intent.blockType];
  if (
    targetIndex < 0 ||
    !rule ||
    countHomeBlockType(blocks, intent.blockType) >= rule.maxInstances
  ) {
    return null;
  }
  const insertionIndex = targetIndex + (intent.placement === "after" ? 1 : 0);
  if (insertionIndex < 1 || insertionIndex > blocks.length - 1) return null;
  const block = createHomeBlock(blocks, intent.blockType);
  if (!block) return null;
  const next = [...blocks];
  next.splice(insertionIndex, 0, block);
  return { blocks: next, selectedBlockId: block.id };
}

export function duplicateHomeVisualBlock(
  blocks: readonly HomeBlock[],
  blockId: string,
): HomeCompositionResult | null {
  const sourceIndex = blocks.findIndex((block) => block.id === blockId);
  const source = blocks[sourceIndex];
  if (!source || !canDuplicateHomeBlock(blocks, source)) return null;
  const duplicate = rekeyNestedItems(
    homeBlockSchema.parse(source),
    createUniqueBlockId(blocks, `${source.id}-copy`),
  );
  const next = [...blocks];
  next.splice(sourceIndex + 1, 0, duplicate);
  return { blocks: next, selectedBlockId: duplicate.id };
}

export function removeHomeVisualBlock(
  blocks: readonly HomeBlock[],
  blockId: string,
): HomeCompositionResult | null {
  const sourceIndex = blocks.findIndex((block) => block.id === blockId);
  const source = blocks[sourceIndex];
  if (!source || !canRemoveHomeBlock(blocks, source)) return null;
  const next = blocks.filter((block) => block.id !== blockId);
  const selected = next[Math.min(sourceIndex, next.length - 1)];
  return selected ? { blocks: next, selectedBlockId: selected.id } : null;
}

export function moveHomeVisualBlock(
  blocks: readonly HomeBlock[],
  move: HomeVisualMove,
): HomeBlock[] | null {
  if (move.blockId === move.targetBlockId) return null;
  const source = blocks.find((block) => block.id === move.blockId);
  const target = blocks.find((block) => block.id === move.targetBlockId);
  if (
    !source ||
    !target ||
    isPinnedHomeBlock(source) ||
    isPinnedHomeBlock(target)
  ) {
    return null;
  }

  const next = blocks.filter((block) => block.id !== move.blockId);
  const targetIndex = next.findIndex(
    (block) => block.id === move.targetBlockId,
  );
  if (targetIndex < 0) return null;
  next.splice(targetIndex + (move.placement === "after" ? 1 : 0), 0, source);
  return next;
}
