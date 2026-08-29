export const CMS_VISUAL_EDITOR_CHANNEL = "@agency/cms-visual-editor/v1";

export type CmsVisualEditorReadyMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "ready";
}>;
export type CmsVisualEditorSelectionMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "select";
  blockId: string;
  fieldPath?: string;
}>;
export type CmsVisualEditorMoveMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "move";
  blockId: string;
  targetBlockId: string;
  placement: "before" | "after";
}>;
export type CmsVisualEditorInsertMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "insert";
  blockType: string;
  targetBlockId: string;
  placement: "before" | "after";
}>;
export type CmsVisualEditorDuplicateMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "duplicate";
  blockId: string;
}>;
export type CmsVisualEditorRemoveMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "remove";
  blockId: string;
}>;
export type CmsVisualEditorCopyMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "copy";
  blockId: string;
}>;
export type CmsVisualEditorPasteMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "paste";
  targetBlockId: string;
  placement: "before" | "after";
}>;
export type CmsVisualEditorInlineTextMessage = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "inline-text";
  blockId: string;
  fieldPath: string;
  value: string;
}>;
export type CmsVisualEditorInlineTextTarget = Readonly<{
  blockId: string;
  fieldPath: string;
  label: string;
  maxLength: number;
  multiline: boolean;
}>;
export type CmsVisualEditorStateMessage<TBlock> = Readonly<{
  channel: typeof CMS_VISUAL_EDITOR_CHANNEL;
  type: "state";
  blocks: readonly TBlock[];
  selectedBlockId: string | null;
  selectedFieldPath: string | null;
  selectionRevision: number;
  revision: number;
  inlineTextTargets?: readonly CmsVisualEditorInlineTextTarget[];
}>;
export type CmsVisualEditorMessage<TBlock = unknown> =
  | CmsVisualEditorReadyMessage
  | CmsVisualEditorSelectionMessage
  | CmsVisualEditorMoveMessage
  | CmsVisualEditorInsertMessage
  | CmsVisualEditorDuplicateMessage
  | CmsVisualEditorRemoveMessage
  | CmsVisualEditorCopyMessage
  | CmsVisualEditorPasteMessage
  | CmsVisualEditorInlineTextMessage
  | CmsVisualEditorStateMessage<TBlock>;

const isValidFieldPath = (value: string) => {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 256 &&
    !/[\u0000-\u001f]/.test(value)
  );
};
const isValidBlockId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 128 &&
  !/[\u0000-\u001f]/.test(value);
const isValidBlockType = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][A-Za-z0-9]{0,63}$/.test(value);
const isValidInlineText = (value: unknown): value is string =>
  typeof value === "string" &&
  [...value].length <= 10_000 &&
  !value.includes("\u0000");

function isValidInlineTextTarget(
  value: unknown,
): value is CmsVisualEditorInlineTextTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  return (
    isValidBlockId(target.blockId) &&
    typeof target.fieldPath === "string" &&
    isValidFieldPath(target.fieldPath) &&
    typeof target.label === "string" &&
    target.label.trim().length > 0 &&
    target.label.length <= 120 &&
    Number.isSafeInteger(target.maxLength) &&
    Number(target.maxLength) >= 1 &&
    Number(target.maxLength) <= 10_000 &&
    typeof target.multiline === "boolean"
  );
}

export function createCmsVisualEditorReadyMessage(): CmsVisualEditorReadyMessage {
  return Object.freeze({ channel: CMS_VISUAL_EDITOR_CHANNEL, type: "ready" });
}

export function createCmsVisualEditorSelectionMessage(
  blockId: string,
  fieldPath?: string,
): CmsVisualEditorSelectionMessage {
  if (!isValidBlockId(blockId))
    throw new Error("Visual editor block ID is required.");
  if (fieldPath !== undefined && !isValidFieldPath(fieldPath)) {
    throw new Error("Visual editor field path is invalid.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "select",
    blockId,
    ...(fieldPath === undefined ? {} : { fieldPath }),
  });
}

export function createCmsVisualEditorMoveMessage(
  blockId: string,
  targetBlockId: string,
  placement: CmsVisualEditorMoveMessage["placement"],
): CmsVisualEditorMoveMessage {
  if (!isValidBlockId(blockId) || !isValidBlockId(targetBlockId)) {
    throw new Error("Visual editor move requires valid block IDs.");
  }
  if (blockId === targetBlockId)
    throw new Error("Visual editor cannot move a block relative to itself.");
  if (placement !== "before" && placement !== "after") {
    throw new Error("Visual editor move placement is invalid.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "move",
    blockId,
    targetBlockId,
    placement,
  });
}

export function createCmsVisualEditorInsertMessage(
  blockType: string,
  targetBlockId: string,
  placement: CmsVisualEditorInsertMessage["placement"],
): CmsVisualEditorInsertMessage {
  if (!isValidBlockType(blockType))
    throw new Error("Visual editor insert requires a valid block type.");
  if (!isValidBlockId(targetBlockId))
    throw new Error("Visual editor insert requires a valid target block ID.");
  if (placement !== "before" && placement !== "after") {
    throw new Error("Visual editor insert placement is invalid.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "insert",
    blockType,
    targetBlockId,
    placement,
  });
}

export function createCmsVisualEditorDuplicateMessage(
  blockId: string,
): CmsVisualEditorDuplicateMessage {
  if (!isValidBlockId(blockId))
    throw new Error("Visual editor duplicate requires a valid block ID.");
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "duplicate",
    blockId,
  });
}

export function createCmsVisualEditorRemoveMessage(
  blockId: string,
): CmsVisualEditorRemoveMessage {
  if (!isValidBlockId(blockId))
    throw new Error("Visual editor remove requires a valid block ID.");
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "remove",
    blockId,
  });
}

export function createCmsVisualEditorCopyMessage(
  blockId: string,
): CmsVisualEditorCopyMessage {
  if (!isValidBlockId(blockId)) {
    throw new Error("Visual editor copy requires a valid block ID.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "copy",
    blockId,
  });
}

export function createCmsVisualEditorPasteMessage(
  targetBlockId: string,
  placement: CmsVisualEditorPasteMessage["placement"],
): CmsVisualEditorPasteMessage {
  if (!isValidBlockId(targetBlockId)) {
    throw new Error("Visual editor paste requires a valid target block ID.");
  }
  if (placement !== "before" && placement !== "after") {
    throw new Error("Visual editor paste placement is invalid.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "paste",
    targetBlockId,
    placement,
  });
}

export function createCmsVisualEditorInlineTextMessage(input: {
  blockId: string;
  fieldPath: string;
  value: string;
}): CmsVisualEditorInlineTextMessage {
  if (!isValidBlockId(input.blockId)) {
    throw new Error("Visual editor inline text requires a valid block ID.");
  }
  if (!isValidFieldPath(input.fieldPath)) {
    throw new Error("Visual editor inline text field path is invalid.");
  }
  if (!isValidInlineText(input.value)) {
    throw new Error("Visual editor inline text value is invalid or too large.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "inline-text",
    blockId: input.blockId,
    fieldPath: input.fieldPath,
    value: input.value,
  });
}

export function createCmsVisualEditorStateMessage<TBlock>(input: {
  blocks: readonly TBlock[];
  selectedBlockId: string | null;
  selectedFieldPath: string | null;
  selectionRevision: number;
  revision: number;
  inlineTextTargets?: readonly CmsVisualEditorInlineTextTarget[];
}): CmsVisualEditorStateMessage<TBlock> {
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    !Number.isSafeInteger(input.selectionRevision) ||
    input.selectionRevision < 0
  ) {
    throw new Error("Visual editor revisions must be non-negative integers.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_EDITOR_CHANNEL,
    type: "state",
    blocks: Object.freeze([...input.blocks]),
    selectedBlockId: input.selectedBlockId,
    selectedFieldPath: input.selectedFieldPath,
    selectionRevision: input.selectionRevision,
    revision: input.revision,
    inlineTextTargets: Object.freeze(
      (input.inlineTextTargets ?? []).map((target) => {
        if (!isValidInlineTextTarget(target)) {
          throw new Error("Visual editor inline text target is invalid.");
        }
        return Object.freeze({ ...target });
      }),
    ),
  });
}

export function isCmsVisualEditorMessage(
  value: unknown,
): value is CmsVisualEditorMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.channel !== CMS_VISUAL_EDITOR_CHANNEL) return false;
  if (candidate.type === "ready") return true;
  if (candidate.type === "select") {
    return (
      isValidBlockId(candidate.blockId) &&
      (candidate.fieldPath === undefined ||
        (typeof candidate.fieldPath === "string" &&
          isValidFieldPath(candidate.fieldPath)))
    );
  }
  if (candidate.type === "move") {
    return (
      isValidBlockId(candidate.blockId) &&
      isValidBlockId(candidate.targetBlockId) &&
      candidate.blockId !== candidate.targetBlockId &&
      (candidate.placement === "before" || candidate.placement === "after")
    );
  }
  if (candidate.type === "insert") {
    return (
      isValidBlockType(candidate.blockType) &&
      isValidBlockId(candidate.targetBlockId) &&
      (candidate.placement === "before" || candidate.placement === "after")
    );
  }
  if (
    candidate.type === "duplicate" ||
    candidate.type === "remove" ||
    candidate.type === "copy"
  ) {
    return isValidBlockId(candidate.blockId);
  }
  if (candidate.type === "paste") {
    return (
      isValidBlockId(candidate.targetBlockId) &&
      (candidate.placement === "before" || candidate.placement === "after")
    );
  }
  if (candidate.type === "inline-text") {
    return (
      isValidBlockId(candidate.blockId) &&
      typeof candidate.fieldPath === "string" &&
      isValidFieldPath(candidate.fieldPath) &&
      isValidInlineText(candidate.value)
    );
  }
  return (
    candidate.type === "state" &&
    Array.isArray(candidate.blocks) &&
    (candidate.selectedBlockId === null ||
      isValidBlockId(candidate.selectedBlockId)) &&
    (candidate.selectedFieldPath === null ||
      (typeof candidate.selectedFieldPath === "string" &&
        isValidFieldPath(candidate.selectedFieldPath))) &&
    Number.isSafeInteger(candidate.selectionRevision) &&
    Number(candidate.selectionRevision) >= 0 &&
    Number.isSafeInteger(candidate.revision) &&
    Number(candidate.revision) >= 0 &&
    (candidate.inlineTextTargets === undefined ||
      (Array.isArray(candidate.inlineTextTargets) &&
        candidate.inlineTextTargets.every(isValidInlineTextTarget)))
  );
}
