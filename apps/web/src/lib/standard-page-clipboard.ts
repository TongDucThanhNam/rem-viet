import {
  applyCmsVisualClipboardPaste,
  createCmsVisualClipboardPayload,
  parseCmsVisualClipboardText,
  serializeCmsVisualClipboardPayload,
} from "@agency/cms-visual-editor";
import {
  isRemVietStandardBlockType,
  remVietStandardBlockSchema,
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { remVietStandardVisualComponentRegistry } from "@agency/cms-template-rem-viet/visual-authoring";
import {
  createStandardPageBlockId,
  ensureStandardPageBlockIds,
  type IdentifiedStandardPageBlock,
} from "@rem-viet/cms";

function toCanonicalBlocks(blocks: readonly IdentifiedStandardPageBlock[]) {
  return blocks.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success) {
      throw new Error("Existing standard-page block is invalid.");
    }
    return parsed.data;
  });
}

function toDocument(
  blocks: readonly IdentifiedStandardPageBlock[],
  version: number,
) {
  return {
    id: "standard-page-clipboard",
    siteId: "rem-viet",
    schemaVersion: 1,
    version,
    nodes: toCanonicalBlocks(blocks),
  } as const;
}

export function copyStandardPageBlock(input: {
  blocks: readonly IdentifiedStandardPageBlock[];
  blockId: string;
  version: number;
}): string {
  const payload = createCmsVisualClipboardPayload({
    document: toDocument(input.blocks, input.version),
    registry: remVietStandardVisualComponentRegistry,
    nodeIds: [input.blockId],
  });
  return serializeCmsVisualClipboardPayload(payload);
}

export type StandardPageClipboardPasteResult = Readonly<{
  blocks: readonly IdentifiedStandardPageBlock[];
  firstInsertedIndex: number;
  rootBlockIds: readonly string[];
  version: number;
}>;

export function pasteStandardPageBlocks(input: {
  blocks: readonly IdentifiedStandardPageBlock[];
  clipboardText: string;
  targetIndex: number;
  placement: "before" | "after";
  version: number;
  canInsert: boolean;
}): StandardPageClipboardPasteResult {
  if (
    !Number.isSafeInteger(input.targetIndex) ||
    input.targetIndex < 0 ||
    input.targetIndex >= input.blocks.length
  ) {
    throw new Error("Standard-page clipboard target is invalid.");
  }
  const claimed = new Set(input.blocks.map(({ id }) => id));
  const insertionIndex =
    input.placement === "before" ? input.targetIndex : input.targetIndex + 1;
  const pasted = applyCmsVisualClipboardPaste({
    document: toDocument(input.blocks, input.version),
    registry: remVietStandardVisualComponentRegistry,
    payload: parseCmsVisualClipboardText(input.clipboardText),
    location: { parentId: null, index: insertionIndex },
    createId: ({ type }) => {
      if (!isRemVietStandardBlockType(type)) {
        throw new Error(`Unsupported standard-page clipboard block: ${type}.`);
      }
      const id = createStandardPageBlockId(type, claimed);
      claimed.add(id);
      return id;
    },
    grants: new Set(input.canInsert ? ["content.compose.insert"] : []),
  });
  const legacyBlocks = pasted.document.nodes.map((node) =>
    toLegacyRemVietStandardBlock(remVietStandardBlockSchema.parse(node)),
  );
  return Object.freeze({
    blocks: ensureStandardPageBlockIds(legacyBlocks),
    firstInsertedIndex: insertionIndex,
    rootBlockIds: pasted.rootNodeIds,
    version: pasted.document.version,
  });
}
