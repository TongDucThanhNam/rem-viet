import { applyCmsVisualPattern } from "@agency/cms-visual-editor";
import {
  isRemVietStandardBlockType,
  remVietStandardBlockSchema,
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import {
  remVietStandardVisualComponentRegistry,
  remVietStandardVisualPatternRegistry,
} from "@agency/cms-template-rem-viet/visual-authoring";
import {
  createStandardPageBlockId,
  ensureStandardPageBlockIds,
  type IdentifiedStandardPageBlock,
} from "@rem-viet/cms";

export type StandardPagePatternResult = Readonly<{
  blocks: readonly IdentifiedStandardPageBlock[];
  firstInsertedIndex: number;
  version: number;
}>;

/**
 * Bridges the reusable visual-editor pattern contract to the public flattened
 * standard-page block shape. Validation and capability enforcement happen
 * before any caller-owned state is changed.
 */
export function applyStandardPagePattern(input: {
  blocks: readonly IdentifiedStandardPageBlock[];
  patternId: string;
  version: number;
  canInsert: boolean;
}): StandardPagePatternResult {
  const canonicalBlocks = input.blocks.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success)
      throw new Error("Existing standard-page block is invalid.");
    return parsed.data;
  });
  const claimed = new Set(input.blocks.map(({ id }) => id));
  const patterned = applyCmsVisualPattern({
    document: {
      id: "standard-page-pattern",
      siteId: "rem-viet",
      schemaVersion: 1,
      version: input.version,
      nodes: canonicalBlocks,
    },
    registry: remVietStandardVisualComponentRegistry,
    patterns: remVietStandardVisualPatternRegistry,
    patternId: input.patternId,
    location: { parentId: null, index: input.blocks.length },
    createId: (type) => {
      if (!isRemVietStandardBlockType(type)) {
        throw new Error(`Unsupported standard-page pattern block: ${type}.`);
      }
      const id = createStandardPageBlockId(type, claimed);
      claimed.add(id);
      return id;
    },
    grants: new Set(input.canInsert ? ["content.compose.insert"] : []),
  });
  const legacyBlocks = patterned.nodes.map((node) =>
    toLegacyRemVietStandardBlock(remVietStandardBlockSchema.parse(node)),
  );

  return {
    blocks: ensureStandardPageBlockIds(legacyBlocks),
    firstInsertedIndex: input.blocks.length,
    version: patterned.version,
  };
}
