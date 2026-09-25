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

export type HomeVisualOutline = Readonly<{
  /** Permission-aware nested outline consumed by the legacy sidebar tree. */
  items: ReadonlyArray<import("@agency/cms-visual-editor").CmsVisualOutlineItem>;
  /** Canonical root nodes (with `slots` + `data.className`) consumed by the
   *  LayersPanel inspector. Mirrors `document.nodes` from the same build. */
  roots: ReadonlyArray<import("@agency/cms-visual-editor").CmsVisualNode>;
}>;

/** Bridges the legacy homepage block shape to the shared visual outline. */
export function createHomeVisualOutline(input: {
  blocks: readonly HomeBlock[];
  selectedBlockId: string | null;
  version: number;
  canWrite: boolean;
}): HomeVisualOutline {
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
  const items = createCmsVisualOutline({
    document,
    registry: remVietVisualComponentRegistry,
    grants: new Set(input.canWrite ? homeAuthoringGrants : []),
    selection: { nodeId: input.selectedBlockId },
    label: (node) =>
      remVietTemplateBlockLabels[
        node.type as keyof typeof remVietTemplateBlockLabels
      ] ?? node.type,
  });
  return { items, roots: document.nodes };
}
