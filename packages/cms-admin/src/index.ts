/// <reference lib="dom" />

export * from "./collections.js";
export * from "./collection-outline.js";
export * from "./editor-shell.js";
export * from "./platform.js";
export * from "./reusable-content.js";
export * from "@agency/cms-visual-editor";

import {
  Fragment,
  createElement,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type {
  CmsCapability,
  CmsEditorialReviewStatus,
  CmsProviderCapabilities,
} from "@agency/cms-core";

export type CmsAdminWorkflowAction =
  | "save"
  | "preview"
  | "publish"
  | "unpublish"
  | "schedule"
  | "unschedule"
  | "revisions"
  | "restore";

export type CmsAdminWorkflowUnavailableReason =
  | "provider-unsupported"
  | "permission-denied"
  | "document-required"
  | "schedule-required"
  | "publication-required";

export type CmsAdminWorkflowAvailability = Readonly<{
  available: boolean;
  capability: CmsCapability;
  reason: CmsAdminWorkflowUnavailableReason | null;
}>;

export type CmsAdminWorkflowModel = Readonly<
  Record<CmsAdminWorkflowAction, CmsAdminWorkflowAvailability>
>;

export type ResolveCmsAdminWorkflowOptions = {
  providerCapabilities: CmsProviderCapabilities;
  grantedCapabilities: readonly CmsCapability[];
  documentExists: boolean;
  published: boolean;
  scheduled: boolean;
};

const cmsAdminActionCapabilities = {
  save: "content.write",
  preview: "content.readDraft",
  publish: "content.publish",
  unpublish: "content.publish",
  schedule: "content.schedule",
  unschedule: "content.schedule",
  revisions: "content.readDraft",
  restore: "content.restore",
} as const satisfies Record<CmsAdminWorkflowAction, CmsCapability>;

/** Resolves headless admin actions from provider support, grants, and document state. */
export function resolveCmsAdminWorkflow({
  providerCapabilities,
  grantedCapabilities,
  documentExists,
  published,
  scheduled,
}: ResolveCmsAdminWorkflowOptions): CmsAdminWorkflowModel {
  const supported = new Set<CmsCapability>(providerCapabilities.supported);
  const granted = new Set<CmsCapability>(grantedCapabilities);
  const resolve = (
    action: CmsAdminWorkflowAction,
  ): CmsAdminWorkflowAvailability => {
    const capability = cmsAdminActionCapabilities[action];
    if (!supported.has(capability)) {
      return { available: false, capability, reason: "provider-unsupported" };
    }
    if (!granted.has(capability)) {
      return { available: false, capability, reason: "permission-denied" };
    }
    if ((action === "revisions" || action === "restore") && !documentExists) {
      return { available: false, capability, reason: "document-required" };
    }
    if (action === "unschedule" && !scheduled) {
      return { available: false, capability, reason: "schedule-required" };
    }
    if (action === "unpublish" && !published) {
      return { available: false, capability, reason: "publication-required" };
    }
    return { available: true, capability, reason: null };
  };

  return Object.freeze({
    save: resolve("save"),
    preview: resolve("preview"),
    publish: resolve("publish"),
    unpublish: resolve("unpublish"),
    schedule: resolve("schedule"),
    unschedule: resolve("unschedule"),
    revisions: resolve("revisions"),
    restore: resolve("restore"),
  });
}
export type CmsWorkflowTarget = Readonly<{ id: string; version: number }>;

export type RunCmsWorkflowCommandOptions<
  TTarget extends CmsWorkflowTarget,
  TResult,
> = {
  current: TTarget | null;
  dirty: boolean;
  save: () => Promise<TTarget | null>;
  command: (target: TTarget) => Promise<TResult>;
};

/** Saves a dirty/new document before running a provider workflow command. */
export async function runCmsWorkflowCommand<
  TTarget extends CmsWorkflowTarget,
  TResult,
>({
  current,
  dirty,
  save,
  command,
}: RunCmsWorkflowCommandOptions<TTarget, TResult>): Promise<TResult | null> {
  const target = dirty || !current ? await save() : current;
  return target ? command(target) : null;
}

export type CmsWorkflowActionSlotsProps = {
  model: CmsAdminWorkflowModel;
  slots: Partial<Record<CmsAdminWorkflowAction, ReactNode>>;
  order?: readonly CmsAdminWorkflowAction[];
};

const defaultCmsWorkflowActionOrder = [
  "save",
  "preview",
  "schedule",
  "unschedule",
  "publish",
  "unpublish",
  "revisions",
  "restore",
] as const satisfies readonly CmsAdminWorkflowAction[];

/** Renders injected action controls only when the resolved workflow permits them. */
export function CmsWorkflowActionSlots({
  model,
  slots,
  order = defaultCmsWorkflowActionOrder,
}: CmsWorkflowActionSlotsProps): ReactElement {
  return createElement(
    Fragment,
    null,
    ...order.flatMap((action) => {
      const slot = slots[action];
      return model[action].available && slot !== undefined
        ? [createElement(Fragment, { key: action }, slot)]
        : [];
    }),
  );
}

export type CmsEditorialReviewPresentationKind =
  | "loading"
  | "unavailable"
  | "unreviewed"
  | "dirty"
  | "stale"
  | "requested"
  | "changes-requested"
  | "approved"
  | "published";

export type CmsEditorialReviewPresentationState = Readonly<{
  published: boolean;
  reviewVersion: number | null;
  stale: boolean;
  status: CmsEditorialReviewStatus;
}>;

export type ResolveCmsEditorialReviewPresentationOptions = {
  currentVersion: number;
  decisionGranted: boolean;
  dirty: boolean;
  error?: boolean;
  loading?: boolean;
  requestGranted: boolean;
  state: CmsEditorialReviewPresentationState | null;
};

export type CmsEditorialReviewPresentation = Readonly<{
  actions: Readonly<{
    approve: boolean;
    request: boolean;
    requestChanges: boolean;
  }>;
  kind: CmsEditorialReviewPresentationKind;
  reviewVersion: number | null;
  stale: boolean;
}>;

/**
 * Resolves shared review status/actions while leaving labels and visual design
 * to the consuming admin. Unsaved content is never presented as reviewed.
 */
export function resolveCmsEditorialReviewPresentation({
  currentVersion,
  decisionGranted,
  dirty,
  error = false,
  loading = false,
  requestGranted,
  state,
}: ResolveCmsEditorialReviewPresentationOptions): CmsEditorialReviewPresentation {
  const stale = Boolean(
    dirty ||
    state?.stale ||
    (state?.reviewVersion !== null &&
      state?.reviewVersion !== undefined &&
      state.reviewVersion !== currentVersion),
  );
  const request = Boolean(
    requestGranted &&
    state &&
    (!state.published || dirty) &&
    (state.status === "none" || stale),
  );
  const decide = Boolean(
    decisionGranted && state?.status === "requested" && !stale,
  );

  let kind: CmsEditorialReviewPresentationKind;
  if (loading) kind = "loading";
  else if (error || !state) kind = "unavailable";
  else if (dirty && state.status !== "none") kind = "dirty";
  else if (state.published) kind = "published";
  else if (stale && state.status !== "none") kind = "stale";
  else if (state.status === "requested") kind = "requested";
  else if (state.status === "changes_requested") kind = "changes-requested";
  else if (state.status === "approved") kind = "approved";
  else kind = "unreviewed";

  return Object.freeze({
    actions: Object.freeze({
      approve: decide,
      request,
      requestChanges: decide,
    }),
    kind,
    reviewVersion: state?.reviewVersion ?? null,
    stale,
  });
}

export type CmsRevisionListProps<TRevision extends { id: string }> = {
  revisions: readonly TRevision[];
  loading?: boolean;
  renderRevision: (revision: TRevision, index: number) => ReactNode;
  empty?: ReactNode;
  loadingSlot?: ReactNode;
};

/** Composes a keyed revision list while leaving all row presentation injected. */
export function CmsRevisionList<TRevision extends { id: string }>({
  revisions,
  loading = false,
  renderRevision,
  empty = null,
  loadingSlot = null,
}: CmsRevisionListProps<TRevision>): ReactElement {
  if (loading) return createElement(Fragment, null, loadingSlot);
  if (!revisions.length) return createElement(Fragment, null, empty);
  return createElement(
    Fragment,
    null,
    ...revisions.map((revision, index) =>
      createElement(
        Fragment,
        { key: revision.id },
        renderRevision(revision, index),
      ),
    ),
  );
}

export type CmsRevisionBlock = Readonly<{ id: string; type: string }>;

export type CmsRevisionBlockChange<TBlock extends CmsRevisionBlock> = Readonly<{
  id: string;
  type: TBlock["type"];
  status: "added" | "removed" | "modified" | "moved" | "modified-and-moved";
  before: TBlock | null;
  after: TBlock | null;
  beforeIndex: number | null;
  afterIndex: number | null;
}>;

export type CmsBlockRevisionDiff<TBlock extends CmsRevisionBlock> = Readonly<{
  changes: readonly CmsRevisionBlockChange<TBlock>[];
  summary: Readonly<{
    added: number;
    removed: number;
    modified: number;
    moved: number;
    unchanged: number;
    totalChanges: number;
  }>;
}>;

export type CmsRevisionFieldDefinition<TRecord> = Readonly<{
  key: string;
  label: string;
  read: (record: TRecord) => unknown;
  summarize?: (record: TRecord) => string | null;
}>;

export type CmsRevisionFieldChange = Readonly<{
  key: string;
  label: string;
}>;

export type CmsRevisionFieldDetail = CmsRevisionFieldChange &
  Readonly<{
    beforeSummary: string | null;
    afterSummary: string | null;
  }>;

/** Deep equality for JSON-like revision values without relying on key order. */
export function areCmsRevisionValuesEqual(
  left: unknown,
  right: unknown,
): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime()
    );
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        areCmsRevisionValuesEqual(value, right[index]),
      )
    );
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const leftPrototype = Object.getPrototypeOf(left);
  const rightPrototype = Object.getPrototypeOf(right);
  const plainPrototype = (prototype: object | null) =>
    prototype === Object.prototype || prototype === null;
  if (!plainPrototype(leftPrototype) || !plainPrototype(rightPrototype))
    return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        areCmsRevisionValuesEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function indexCmsRevisionBlocks<TBlock extends CmsRevisionBlock>(
  blocks: readonly TBlock[],
  side: "before" | "after",
) {
  const indexed = new Map<string, { block: TBlock; index: number }>();
  blocks.forEach((block, index) => {
    if (indexed.has(block.id)) {
      throw new Error(
        `Duplicate CMS revision block id on ${side}: ${block.id}`,
      );
    }
    indexed.set(block.id, { block, index });
  });
  return indexed;
}

/**
 * Compares stable-ID block revisions. Movement uses relative surviving-block
 * order, so inserting or removing a neighbour is not misreported as a reorder.
 */
export function compareCmsBlockRevisions<TBlock extends CmsRevisionBlock>(
  before: readonly TBlock[],
  after: readonly TBlock[],
): CmsBlockRevisionDiff<TBlock> {
  const beforeById = indexCmsRevisionBlocks(before, "before");
  const afterById = indexCmsRevisionBlocks(after, "after");
  const commonBefore = before.filter((block) => afterById.has(block.id));
  const commonAfter = after.filter((block) => beforeById.has(block.id));
  const beforeCommonPosition = new Map(
    commonBefore.map((block, index) => [block.id, index]),
  );
  const afterCommonPosition = new Map(
    commonAfter.map((block, index) => [block.id, index]),
  );
  const changes: CmsRevisionBlockChange<TBlock>[] = [];
  let unchanged = 0;

  for (const [afterIndex, afterBlock] of after.entries()) {
    const previous = beforeById.get(afterBlock.id);
    if (!previous) {
      changes.push({
        id: afterBlock.id,
        type: afterBlock.type,
        status: "added",
        before: null,
        after: afterBlock,
        beforeIndex: null,
        afterIndex,
      });
      continue;
    }
    const moved =
      beforeCommonPosition.get(afterBlock.id) !==
      afterCommonPosition.get(afterBlock.id);
    const modified = !areCmsRevisionValuesEqual(previous.block, afterBlock);
    if (!moved && !modified) {
      unchanged += 1;
      continue;
    }
    changes.push({
      id: afterBlock.id,
      type: afterBlock.type,
      status:
        moved && modified ? "modified-and-moved" : moved ? "moved" : "modified",
      before: previous.block,
      after: afterBlock,
      beforeIndex: previous.index,
      afterIndex,
    });
  }

  for (const [beforeIndex, beforeBlock] of before.entries()) {
    if (afterById.has(beforeBlock.id)) continue;
    changes.push({
      id: beforeBlock.id,
      type: beforeBlock.type,
      status: "removed",
      before: beforeBlock,
      after: null,
      beforeIndex,
      afterIndex: null,
    });
  }

  const summary = {
    added: changes.filter(({ status }) => status === "added").length,
    removed: changes.filter(({ status }) => status === "removed").length,
    modified: changes.filter(
      ({ status }) => status === "modified" || status === "modified-and-moved",
    ).length,
    moved: changes.filter(
      ({ status }) => status === "moved" || status === "modified-and-moved",
    ).length,
    unchanged,
    totalChanges: changes.length,
  };
  return { changes, summary };
}

const cmsRevisionSummaryMaxCharacters = 160;

function normalizeCmsRevisionSummary(value: string | null) {
  if (value === null) return null;
  const normalized = value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const characters = [...normalized];
  if (characters.length <= cmsRevisionSummaryMaxCharacters) return normalized;
  return `${characters.slice(0, cmsRevisionSummaryMaxCharacters - 1).join("")}…`;
}

function summarizeCmsRevisionField<TRecord>(
  summarize: CmsRevisionFieldDefinition<TRecord>["summarize"],
  record: TRecord,
) {
  if (!summarize) return null;
  try {
    return normalizeCmsRevisionSummary(summarize(record));
  } catch {
    return null;
  }
}

/**
 * Returns changed-field metadata plus bounded, explicitly opted-in summaries.
 * Arbitrary revision values are never serialized implicitly.
 */
export function compareCmsRevisionFieldDetails<TRecord>(
  before: TRecord,
  after: TRecord,
  fields: readonly CmsRevisionFieldDefinition<TRecord>[],
): readonly CmsRevisionFieldDetail[] {
  return fields
    .filter(({ read }) => !areCmsRevisionValuesEqual(read(before), read(after)))
    .map(({ key, label, summarize }) => ({
      key,
      label,
      beforeSummary: summarizeCmsRevisionField(summarize, before),
      afterSummary: summarizeCmsRevisionField(summarize, after),
    }));
}

/** Returns only human-safe field metadata; raw revision values stay private. */
export function compareCmsRevisionFields<TRecord>(
  before: TRecord,
  after: TRecord,
  fields: readonly CmsRevisionFieldDefinition<TRecord>[],
): readonly CmsRevisionFieldChange[] {
  return compareCmsRevisionFieldDetails(before, after, fields).map(
    ({ key, label }) => ({ key, label }),
  );
}

export type CmsDraftSaveState =
  "clean" | "dirty" | "saving" | "saved" | "conflict";

export type CmsDraftStatusSlotsProps = {
  state: CmsDraftSaveState;
  slots: Partial<Record<CmsDraftSaveState, ReactNode>>;
  fallback?: ReactNode;
};

/** Selects injected, localized status presentation from the neutral save state. */
export function CmsDraftStatusSlots({
  state,
  slots,
  fallback = null,
}: CmsDraftStatusSlotsProps): ReactElement {
  return createElement(Fragment, null, slots[state] ?? fallback);
}

export type CmsDraftFlushState = {
  dirty: boolean;
  saving: boolean;
};

export type FlushCmsDraftOptions = {
  getState: () => CmsDraftFlushState;
  save: () => Promise<unknown | null | false>;
  waitForActiveSave: () => Promise<void>;
  settle?: () => Promise<void>;
  maxAttempts?: number;
};

const settleAfterSave = () =>
  new Promise<void>((resolve) => {
    const requestAnimationFrame = (
      globalThis as typeof globalThis & {
        requestAnimationFrame?: (callback: () => void) => number;
      }
    ).requestAnimationFrame;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    queueMicrotask(resolve);
  });

/** Flushes edits made during an in-flight save and fails closed after a cap. */
export async function flushCmsDraft({
  getState,
  save,
  waitForActiveSave,
  settle = settleAfterSave,
  maxAttempts = 5,
}: FlushCmsDraftOptions): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = getState();
    if (!state.dirty) return true;
    if (state.saving) {
      await waitForActiveSave();
      continue;
    }

    if (!(await save())) return false;
    await settle();
  }

  return !getState().dirty;
}

export type UseCmsDraftFlushOptions = {
  dirty: boolean;
  saving: boolean;
  save: () => Promise<unknown | null | false>;
  maxAttempts?: number;
};

export function useCmsDraftFlush({
  dirty,
  saving,
  save,
  maxAttempts,
}: UseCmsDraftFlushOptions) {
  const latest = useRef({ dirty, saving, save });
  const saveSettledWaiters = useRef(new Set<() => void>());
  latest.current = { dirty, saving, save };

  useEffect(() => {
    if (saving) return;
    for (const resolve of saveSettledWaiters.current) resolve();
    saveSettledWaiters.current.clear();
  }, [saving]);

  const waitForActiveSave = useCallback(() => {
    if (!latest.current.saving) return Promise.resolve();
    return new Promise<void>((resolve) => {
      saveSettledWaiters.current.add(resolve);
    });
  }, []);

  return useCallback(
    () =>
      flushCmsDraft({
        getState: () => latest.current,
        save: () => latest.current.save(),
        waitForActiveSave,
        maxAttempts,
      }),
    [maxAttempts, waitForActiveSave],
  );
}

export type UseCmsAutosaveOptions = {
  changeToken?: unknown;
  conflicted?: boolean;
  delayMs?: number;
  dirty: boolean;
  save: () => Promise<unknown> | unknown;
  saving: boolean;
};

export function shouldScheduleCmsAutosave({
  conflicted = false,
  dirty,
  saving,
}: Pick<UseCmsAutosaveOptions, "conflicted" | "dirty" | "saving">) {
  return dirty && !saving && !conflicted;
}

/** Schedules one trailing save and resets its timer for each change token. */
export function useCmsAutosave({
  changeToken,
  conflicted = false,
  delayMs = 1600,
  dirty,
  save,
  saving,
}: UseCmsAutosaveOptions) {
  const latestSave = useRef(save);
  latestSave.current = save;

  useEffect(() => {
    if (!shouldScheduleCmsAutosave({ dirty, saving, conflicted })) return;
    const timer = globalThis.setTimeout(
      () => void latestSave.current(),
      delayMs,
    );
    return () => globalThis.clearTimeout(timer);
  }, [changeToken, conflicted, delayMs, dirty, saving]);
}

export type ApplyCmsPlainTextPasteOptions = Readonly<{
  currentText: string;
  clipboardText: string;
  selectionStart: number;
  selectionEnd: number;
  maxLength?: number;
}>;

export type CmsPlainTextPasteResult = Readonly<{
  text: string;
  insertedText: string;
  selectionStart: number;
  selectionEnd: number;
  truncated: boolean;
}>;

const normalizeCmsClipboardText = (value: string) =>
  value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

function truncateCmsClipboardText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  let truncated = value.slice(0, maxLength);
  if (/[\ud800-\udbff]$/.test(truncated)) truncated = truncated.slice(0, -1);
  return truncated;
}

/**
 * Inserts only normalized `text/plain` clipboard data into a bounded authoring
 * field. HTML, CSS, classes and office metadata never cross this API.
 */
export function applyCmsPlainTextPaste({
  currentText,
  clipboardText,
  selectionStart,
  selectionEnd,
  maxLength = 20_000,
}: ApplyCmsPlainTextPasteOptions): CmsPlainTextPasteResult {
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new Error("CMS paste maximum length must be a positive integer.");
  }
  if (currentText.length > maxLength) {
    throw new Error("CMS paste target already exceeds its maximum length.");
  }
  const clampSelection = (value: number) =>
    Number.isFinite(value)
      ? Math.min(currentText.length, Math.max(0, Math.trunc(value)))
      : 0;
  const first = clampSelection(selectionStart);
  const second = clampSelection(selectionEnd);
  const start = Math.min(first, second);
  const end = Math.max(first, second);
  const normalized = normalizeCmsClipboardText(clipboardText);
  const available = maxLength - (currentText.length - (end - start));
  const insertedText = truncateCmsClipboardText(normalized, available);
  const text = `${currentText.slice(0, start)}${insertedText}${currentText.slice(end)}`;
  const nextSelection = start + insertedText.length;
  return Object.freeze({
    text,
    insertedText,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
    truncated: insertedText.length !== normalized.length,
  });
}

export type CmsPreviewHandle = {
  close: () => void;
  navigate: (url: string) => void;
};

export type OpenCmsPreviewOptions = {
  flushDraft: () => Promise<boolean>;
  openPlaceholder: () => CmsPreviewHandle | null;
  url: string;
};

export type OpenCmsPreviewResult = "opened" | "popup-blocked" | "save-blocked";

/** Opens synchronously, then exposes the draft URL only after a successful flush. */
export async function openCmsPreviewAfterSave({
  flushDraft,
  openPlaceholder,
  url,
}: OpenCmsPreviewOptions): Promise<OpenCmsPreviewResult> {
  const preview = openPlaceholder();
  if (!preview) return "popup-blocked";

  try {
    if (!(await flushDraft())) {
      preview.close();
      return "save-blocked";
    }
    preview.navigate(url);
    return "opened";
  } catch {
    preview.close();
    return "save-blocked";
  }
}

export type CmsBlockAuthoringDefinition<TType extends string = string> =
  Readonly<{
    type: TType;
    label: string;
    description: string;
    category: string;
    keywords: readonly string[];
  }>;

const normalizeCmsCatalogSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi")
    .trim();

/** Filters template-owned authoring metadata without imposing app UI. */
export function filterCmsBlockAuthoringCatalog<
  TDefinition extends CmsBlockAuthoringDefinition,
>(catalog: readonly TDefinition[], query: string): readonly TDefinition[] {
  const terms = normalizeCmsCatalogSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return catalog;
  return catalog.filter((entry) => {
    const searchable = normalizeCmsCatalogSearch(
      [
        entry.type,
        entry.label,
        entry.description,
        entry.category,
        ...entry.keywords,
      ].join(" "),
    );
    return terms.every((term) => searchable.includes(term));
  });
}

export type CmsMediaAssetSelection = Readonly<{
  key: string;
  url: string;
  altText?: string | null;
}>;

export type ResolveCmsMediaSelectionOptions = Readonly<{
  asset: CmsMediaAssetSelection;
  currentAlt: string;
  altPolicy?: "adopt" | "preserve";
}>;

/**
 * Applies a library asset to a template-owned image field without leaking a
 * provider record into the saved content contract. Public images adopt the
 * asset's reviewed alt text (or clear stale text when it is missing), while
 * decorative/context-owned images may explicitly preserve their local alt.
 */
export function resolveCmsMediaSelection({
  asset,
  currentAlt,
  altPolicy = "adopt",
}: ResolveCmsMediaSelectionOptions) {
  return {
    src: asset.url,
    alt: altPolicy === "preserve" ? currentAlt : (asset.altText?.trim() ?? ""),
  } as const;
}

export type CmsEditableBlock = { type: string };

export type CmsBlockEditorProps<TBlock extends CmsEditableBlock> = {
  block: TBlock;
  onChange: (block: TBlock) => void;
};

export type CmsBlockEditorDefinition<
  TBlock extends CmsEditableBlock,
  TContext,
> = {
  label: string;
  Editor: ComponentType<CmsBlockEditorProps<TBlock> & { context: TContext }>;
};

export type CmsBlockEditorRegistry<
  TBlock extends CmsEditableBlock,
  TContext,
> = {
  [TType in TBlock["type"]]: CmsBlockEditorDefinition<
    Extract<TBlock, { type: TType }>,
    TContext
  >;
};

export function createBlockEditorRegistry<
  TBlock extends CmsEditableBlock,
  TContext = undefined,
>(registry: CmsBlockEditorRegistry<TBlock, TContext>) {
  return registry;
}

export type UnknownEditorPolicy<TBlock extends CmsEditableBlock> =
  | { behavior: "skip" }
  | { behavior: "throw" }
  | { behavior: "fallback"; render: (block: TBlock) => ReactNode };

export type CmsBlockEditorRendererProps<
  TBlock extends CmsEditableBlock,
  TContext,
> = {
  block: TBlock;
  context: TContext;
  onChange: (block: TBlock) => void;
  registry: CmsBlockEditorRegistry<TBlock, TContext>;
  unknownBlock?: UnknownEditorPolicy<TBlock>;
};

export function CmsBlockEditor<TBlock extends CmsEditableBlock, TContext>({
  block,
  context,
  onChange,
  registry,
  unknownBlock = { behavior: "throw" },
}: CmsBlockEditorRendererProps<TBlock, TContext>): ReactElement | null {
  const definition = registry[block.type as TBlock["type"]];
  if (!definition) {
    if (unknownBlock.behavior === "skip") return null;
    if (unknownBlock.behavior === "fallback") {
      return createElement(
        "div",
        { "data-cms-unknown-editor": block.type },
        unknownBlock.render(block),
      );
    }
    throw new Error(`Unknown CMS block editor type: ${block.type}`);
  }

  const Editor = definition.Editor as unknown as ComponentType<
    CmsBlockEditorProps<TBlock> & { context: TContext }
  >;
  return createElement(Editor, { block, context, onChange });
}

export type CmsPreviewConnectionStatus = "connecting" | "connected" | "delayed";

export type CmsPreviewConnectionState = Readonly<{
  cycle: number;
  reloadKey: number;
  status: CmsPreviewConnectionStatus;
}>;

export type CmsPreviewConnectionEvent =
  | Readonly<{ type: "frame-loading" }>
  | Readonly<{ type: "frame-loaded" }>
  | Readonly<{ type: "ready" }>
  | Readonly<{ type: "timeout" }>
  | Readonly<{ type: "retry" }>;

export const initialCmsPreviewConnectionState: CmsPreviewConnectionState = {
  cycle: 0,
  reloadKey: 0,
  status: "connecting",
};

/**
 * Keeps visual-authoring chrome honest: a frame load is not treated as a live
 * editor connection until the child sends its validated ready handshake.
 */
export function reduceCmsPreviewConnection(
  state: CmsPreviewConnectionState,
  event: CmsPreviewConnectionEvent,
): CmsPreviewConnectionState {
  if (event.type === "frame-loading")
    return {
      ...state,
      cycle: state.cycle + 1,
      status: "connecting",
    };
  if (event.type === "frame-loaded")
    return {
      ...state,
      cycle: state.cycle + 1,
      status: state.status === "connected" ? "connected" : "connecting",
    };
  if (event.type === "ready") return { ...state, status: "connected" };
  if (event.type === "timeout")
    return state.status === "connecting"
      ? { ...state, status: "delayed" }
      : state;
  return {
    cycle: state.cycle + 1,
    reloadKey: state.reloadKey + 1,
    status: "connecting",
  };
}

export function useCmsPreviewConnection({
  timeoutMs = 8_000,
}: {
  timeoutMs?: number;
} = {}) {
  const [state, dispatch] = useReducer(
    reduceCmsPreviewConnection,
    initialCmsPreviewConnectionState,
  );

  useEffect(() => {
    if (state.status !== "connecting") return;
    const timeout = globalThis.setTimeout(
      () => dispatch({ type: "timeout" }),
      timeoutMs,
    );
    return () => globalThis.clearTimeout(timeout);
  }, [state.cycle, state.status, timeoutMs]);

  return {
    markFrameLoading: useCallback(
      () => dispatch({ type: "frame-loading" }),
      [],
    ),
    markConnected: useCallback(() => dispatch({ type: "ready" }), []),
    markFrameLoaded: useCallback(() => dispatch({ type: "frame-loaded" }), []),
    reloadKey: state.reloadKey,
    retry: useCallback(() => dispatch({ type: "retry" }), []),
    status: state.status,
  } as const;
}

export type UseCmsFocusWorkspaceOptions = Readonly<{
  focused: boolean;
  onFocusedChange: (focused: boolean) => void;
  desktopMediaQuery?: string;
}>;

/**
 * Shared behavior for a desktop canvas-plus-inspector focus workspace. Routes
 * retain ownership of layout and labels while the package enforces responsive
 * exit, background scroll lock, Escape, focus containment and trigger restore.
 */
export function useCmsFocusWorkspace({
  focused,
  onFocusedChange,
  desktopMediaQuery = "(min-width: 1280px)",
}: UseCmsFocusWorkspaceOptions) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktopWorkspace = window.matchMedia(desktopMediaQuery);
    const leaveBelowDesktop = () => {
      if (!desktopWorkspace.matches) onFocusedChange(false);
    };
    leaveBelowDesktop();
    desktopWorkspace.addEventListener("change", leaveBelowDesktop);
    return () =>
      desktopWorkspace.removeEventListener("change", leaveBelowDesktop);
  }, [desktopMediaQuery, onFocusedChange]);

  useEffect(() => {
    if (!focused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    triggerRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() =>
        triggerRef.current?.focus({ preventScroll: true }),
      );
    };
  }, [focused]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!focused) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onFocusedChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        workspaceRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [focused, onFocusedChange],
  );

  return { onKeyDown, triggerRef, workspaceRef } as const;
}
