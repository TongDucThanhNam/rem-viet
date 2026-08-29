import { createCmsVisualOutline } from "@agency/cms-visual-editor";
import {
  remVietTemplateBlockLabels,
  toRemVietTemplateBlock,
} from "@agency/cms-template-rem-viet";
import {
  remVietVisualComponentRegistry,
  toRemVietVisualDocument,
} from "@agency/cms-template-rem-viet/visual-authoring";
import type { HomeBlock } from "@rem-viet/cms";

const homeAuthoringGrants = Object.freeze([
  "content.compose.insert",
  "content.component.edit",
  "content.field.edit",
  "content.compose.move",
  "content.compose.duplicate",
  "content.compose.remove",
]);

/** Bridges the legacy homepage block shape to the shared visual outline. */
export function createHomeVisualOutline(input: {
  blocks: readonly HomeBlock[];
  selectedBlockId: string | null;
  version: number;
  canWrite: boolean;
}) {
  const canonicalBlocks = input.blocks.map((block) => {
    const parsed = toRemVietTemplateBlock(block);
    if (!parsed.success) {
      throw new Error("Existing homepage block is invalid.");
    }
    return parsed.data;
  });
  const document = toRemVietVisualDocument({
    id: "home",
    siteId: "rem-viet",
    version: input.version,
    blocks: canonicalBlocks,
  });
  return createCmsVisualOutline({
    document,
    registry: remVietVisualComponentRegistry,
    grants: new Set(input.canWrite ? homeAuthoringGrants : []),
    selection: { nodeId: input.selectedBlockId },
    label: (node) =>
      remVietTemplateBlockLabels[
        node.type as keyof typeof remVietTemplateBlockLabels
      ] ?? node.type,
  });
}
