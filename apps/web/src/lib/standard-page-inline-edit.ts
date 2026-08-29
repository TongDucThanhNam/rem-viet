import { applyCmsVisualInlineTextUpdate } from "@agency/cms-visual-editor";
import {
  remVietStandardBlockSchema,
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { remVietStandardVisualComponentRegistry } from "@agency/cms-template-rem-viet/visual-authoring";
import {
  ensureStandardPageBlockIds,
  type IdentifiedStandardPageBlock,
} from "@rem-viet/cms";

export type StandardPageInlineTextResult = Readonly<{
  blocks: readonly IdentifiedStandardPageBlock[];
  version: number;
}>;

export function applyStandardPageInlineText(input: {
  blocks: readonly IdentifiedStandardPageBlock[];
  blockId: string;
  fieldPath: string;
  value: string;
  version: number;
  canEdit: boolean;
}): StandardPageInlineTextResult {
  const canonicalBlocks = input.blocks.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success)
      throw new Error("Existing standard-page block is invalid.");
    return parsed.data;
  });
  const updated = applyCmsVisualInlineTextUpdate({
    document: {
      id: "standard-page-inline-edit",
      siteId: "rem-viet",
      schemaVersion: 1,
      version: input.version,
      nodes: canonicalBlocks,
    },
    registry: remVietStandardVisualComponentRegistry,
    nodeId: input.blockId,
    fieldPath: input.fieldPath,
    value: input.value,
    grants: new Set(
      input.canEdit ? ["content.component.edit", "content.field.edit"] : [],
    ),
  });
  return {
    blocks: ensureStandardPageBlockIds(
      updated.nodes.map((node) =>
        toLegacyRemVietStandardBlock(remVietStandardBlockSchema.parse(node)),
      ),
    ),
    version: updated.version,
  };
}
