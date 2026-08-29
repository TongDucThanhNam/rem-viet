import { createCmsVisualOutline } from "@agency/cms-visual-editor";
import {
  isRemVietStandardBlockType,
  remVietStandardBlockLabels,
  toRemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { remVietStandardVisualComponentRegistry } from "@agency/cms-template-rem-viet/visual-authoring";
import type { IdentifiedStandardPageBlock } from "@rem-viet/cms";

const standardPageAuthoringGrants = Object.freeze([
  "content.compose.insert",
  "content.component.edit",
  "content.field.edit",
  "content.compose.move",
  "content.compose.duplicate",
  "content.compose.remove",
]);

/** Bridges the flattened Rèm page shape to the shared permission-aware outline. */
export function createStandardPageVisualOutline(input: {
  blocks: readonly IdentifiedStandardPageBlock[];
  selectedBlockId: string | null;
  version: number;
  canWrite: boolean;
}) {
  const nodes = input.blocks.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success) {
      throw new Error("Existing standard-page block is invalid.");
    }
    return parsed.data;
  });
  return createCmsVisualOutline({
    document: {
      id: "standard-page-outline",
      siteId: "rem-viet",
      schemaVersion: 1,
      version: input.version,
      nodes,
    },
    registry: remVietStandardVisualComponentRegistry,
    grants: new Set(input.canWrite ? standardPageAuthoringGrants : []),
    selection: { nodeId: input.selectedBlockId },
    label: (node) =>
      isRemVietStandardBlockType(node.type)
        ? remVietStandardBlockLabels[node.type]
        : node.type,
  });
}
