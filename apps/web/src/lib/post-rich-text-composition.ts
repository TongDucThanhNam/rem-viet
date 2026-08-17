import {
  createRichTextBlockId,
  MAX_RICH_TEXT_BLOCK_ID_LENGTH,
  MAX_RICH_TEXT_BLOCKS,
  type RichTextDocument,
} from "@rem-viet/cms";

export type PostRichTextCompositionCommand =
  | {
      type: "move";
      sourceId: string;
      sourceIndex: number;
      targetId: string;
      targetIndex: number;
      placement: "before" | "after";
    }
  | {
      type: "insert-paragraph";
      targetId: string;
      targetIndex: number;
      placement: "before" | "after";
    }
  | { type: "duplicate"; targetId: string; targetIndex: number }
  | { type: "remove"; targetId: string; targetIndex: number };

export type PostRichTextCompositionRequest = {
  id: number;
  command: PostRichTextCompositionCommand;
};

function isBlockIndex(value: unknown) {
  return (
    Number.isInteger(value) &&
    Number(value) >= 0 &&
    Number(value) < MAX_RICH_TEXT_BLOCKS
  );
}

function isBlockId(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= MAX_RICH_TEXT_BLOCK_ID_LENGTH
  );
}

export function isPostRichTextCompositionCommand(
  value: unknown,
): value is PostRichTextCompositionCommand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "move") {
    return (
      isBlockIndex(candidate.sourceIndex) &&
      isBlockId(candidate.sourceId) &&
      isBlockIndex(candidate.targetIndex) &&
      isBlockId(candidate.targetId) &&
      (candidate.placement === "before" || candidate.placement === "after")
    );
  }
  if (candidate.type === "insert-paragraph") {
    return (
      isBlockIndex(candidate.targetIndex) &&
      isBlockId(candidate.targetId) &&
      (candidate.placement === "before" || candidate.placement === "after")
    );
  }
  return (
    (candidate.type === "duplicate" || candidate.type === "remove") &&
    isBlockIndex(candidate.targetIndex) &&
    isBlockId(candidate.targetId)
  );
}

export function applyPostRichTextComposition(
  document: RichTextDocument,
  command: PostRichTextCompositionCommand,
): RichTextDocument {
  const blocks = document.blocks;
  if (command.type === "move") {
    const { sourceId, sourceIndex, targetId, targetIndex, placement } = command;
    if (
      sourceIndex >= blocks.length ||
      targetIndex >= blocks.length ||
      sourceIndex === targetIndex ||
      blocks[sourceIndex]?.id !== sourceId ||
      blocks[targetIndex]?.id !== targetId
    )
      return document;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(sourceIndex, 1);
    if (!moved) return document;
    const adjustedTarget = targetIndex - (sourceIndex < targetIndex ? 1 : 0);
    const insertionIndex = adjustedTarget + (placement === "after" ? 1 : 0);
    nextBlocks.splice(insertionIndex, 0, moved);
    if (nextBlocks.every((block, index) => block === blocks[index]))
      return document;
    return { ...document, blocks: nextBlocks };
  }

  if (
    command.targetIndex >= blocks.length ||
    blocks[command.targetIndex]?.id !== command.targetId
  )
    return document;
  if (command.type === "insert-paragraph") {
    if (blocks.length >= MAX_RICH_TEXT_BLOCKS) return document;
    const insertionIndex =
      command.targetIndex + (command.placement === "after" ? 1 : 0);
    const nextBlocks = [...blocks];
    nextBlocks.splice(insertionIndex, 0, {
      id: createRichTextBlockId(
        "paragraph",
        blocks.map((block) => block.id),
      ),
      type: "paragraph",
      children: [{ text: "" }],
    });
    return { ...document, blocks: nextBlocks };
  }
  if (command.type === "duplicate") {
    if (blocks.length >= MAX_RICH_TEXT_BLOCKS) return document;
    const nextBlocks = [...blocks];
    const duplicated = structuredClone(blocks[command.targetIndex]);
    if (!duplicated) return document;
    duplicated.id = createRichTextBlockId(
      duplicated.type,
      blocks.map((block) => block.id),
    );
    nextBlocks.splice(command.targetIndex + 1, 0, duplicated);
    return { ...document, blocks: nextBlocks };
  }
  if (blocks.length <= 1) return document;
  return {
    ...document,
    blocks: blocks.filter((_, index) => index !== command.targetIndex),
  };
}
