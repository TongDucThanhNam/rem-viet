import {
  CmsError,
  type CmsBlock,
  type CmsEditorialReviewDecision,
  type CmsEditorialReviewChecklistItem,
  type CmsEditorialReviewStatus,
  type CmsEditorialReviewTarget,
  type CmsEditorialReviewTask,
  type CmsProviderCapabilities,
  type DecideCmsEditorialReviewInput,
  type RequestCmsEditorialReviewInput,
} from "@agency/cms-core";

export * from "./dam.js";

export * from "./collections.js";
export * from "./jobs.js";
export * from "./page-collection-adapter.js";
export * from "./portability.js";
export * from "./reusable-content.js";
export * from "./server.js";
export * from "./webhooks.js";

export type CmsPageTemplate = "landing" | "standard";

export type CmsSeoFields = {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

export type CmsPageContent<TBlock extends CmsBlock = CmsBlock> = {
  title: string;
  slug: string;
  template: CmsPageTemplate;
  blocks: TBlock[];
  seo: CmsSeoFields;
};

export type CmsPageDocument<TContent extends CmsPageContent = CmsPageContent> =
  {
    id: string;
    schemaVersion: number;
    version: number;
    status: "draft" | "published";
    content: TContent;
    publishedRevisionId: string | null;
    scheduledAt: string | null;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
  };

export type CmsPageRevision<TContent extends CmsPageContent = CmsPageContent> =
  {
    id: string;
    documentId: string;
    version: number;
    content: TContent;
    note: string;
    createdAt: string;
    createdBy: string;
  };

export type PageLookup =
  { id: string; slug?: never } | { id?: never; slug: string };

export type CreateDraftInput<TContent extends CmsPageContent> = {
  id?: string;
  schemaVersion?: number;
  content: TContent;
  actorId: string;
};

export type SaveDraftInput<TContent extends CmsPageContent> = {
  id: string;
  expectedVersion: number;
  content: TContent;
  actorId: string;
};

export type PublishDraftInput = {
  id: string;
  expectedVersion: number;
  actorId: string;
  note?: string;
};

export type RestoreRevisionInput = {
  id: string;
  revisionId: string;
  expectedVersion: number;
  actorId: string;
};

export type ScheduleDraftInput = {
  id: string;
  expectedVersion: number;
  scheduledAt: string;
  actorId: string;
  note?: string;
};

export type UnscheduleDraftInput = {
  id: string;
  expectedVersion: number;
  actorId: string;
};

export type UnpublishDraftInput = {
  id: string;
  expectedVersion: number;
  actorId: string;
};

export type DeleteDraftInput = {
  id: string;
  expectedVersion: number;
  actorId: string;
};

export interface ContentReader<
  TContent extends CmsPageContent = CmsPageContent,
> {
  getDraft(lookup: PageLookup): Promise<CmsPageDocument<TContent> | null>;
  getPublished(lookup: PageLookup): Promise<CmsPageDocument<TContent> | null>;
}

export interface DraftWriter<TContent extends CmsPageContent = CmsPageContent> {
  createDraft(
    input: CreateDraftInput<TContent>,
  ): Promise<CmsPageDocument<TContent>>;
  saveDraft(
    input: SaveDraftInput<TContent>,
  ): Promise<CmsPageDocument<TContent>>;
}

export interface PublishingWorkflow<
  TContent extends CmsPageContent = CmsPageContent,
> {
  publish(input: PublishDraftInput): Promise<{
    document: CmsPageDocument<TContent>;
    revision: CmsPageRevision<TContent>;
  }>;
  schedule(input: ScheduleDraftInput): Promise<CmsPageDocument<TContent>>;
  unschedule(input: UnscheduleDraftInput): Promise<CmsPageDocument<TContent>>;
  unpublish(input: UnpublishDraftInput): Promise<CmsPageDocument<TContent>>;
  listRevisions(id: string): Promise<CmsPageRevision<TContent>[]>;
  restore(input: RestoreRevisionInput): Promise<CmsPageDocument<TContent>>;
}

export interface DocumentLifecycle<
  TContent extends CmsPageContent = CmsPageContent,
> {
  delete(input: DeleteDraftInput): Promise<CmsPageDocument<TContent>>;
}

export type CmsEditorialReviewDocument = CmsEditorialReviewTarget & {
  version: number;
  status: "draft" | "published";
  publishedRevisionId: string | null;
};

export type CmsEditorialReviewEvent = CmsEditorialReviewTarget & {
  action: CmsEditorialReviewDecision | "requested" | "published";
  actorId: string;
  completedChecklistItemIds?: readonly string[];
  note: string;
  occurredAt: string;
  task?: CmsEditorialReviewTask;
  version: number;
};

export type CmsEditorialReviewChecklistState =
  CmsEditorialReviewChecklistItem & {
    completed: boolean;
  };

export type CmsEditorialReviewState = CmsEditorialReviewTarget & {
  actorId: string | null;
  assigneeIds: string[];
  assigneeRoles: string[];
  checklist: CmsEditorialReviewChecklistState[];
  currentVersion: number;
  dueAt: string | null;
  mentionIds: string[];
  note: string;
  notify: boolean;
  occurredAt: string | null;
  published: boolean;
  requestedAt: string | null;
  reviewVersion: number | null;
  stale: boolean;
  status: CmsEditorialReviewStatus;
};

export type ListPendingCmsEditorialReviewsInput = {
  limit?: number;
};

/** A provider-neutral, version-bound editorial handoff workflow. */
export interface CmsEditorialReviewWorkflow {
  getState(target: CmsEditorialReviewTarget): Promise<CmsEditorialReviewState>;
  requestReview(
    input: RequestCmsEditorialReviewInput,
  ): Promise<CmsEditorialReviewState>;
  decideReview(
    input: DecideCmsEditorialReviewInput,
  ): Promise<CmsEditorialReviewState>;
  listPending(
    input?: ListPendingCmsEditorialReviewsInput,
  ): Promise<CmsEditorialReviewState[]>;
}

export function isCmsEditorialReviewActorAssigned(
  state: Pick<CmsEditorialReviewState, "assigneeIds" | "assigneeRoles">,
  actorId: string,
  actorRole?: string,
) {
  if (!state.assigneeIds.length && !state.assigneeRoles.length) return true;
  return (
    state.assigneeIds.includes(actorId) ||
    Boolean(actorRole && state.assigneeRoles.includes(actorRole))
  );
}

export function missingRequiredCmsEditorialReviewChecklistItems(
  state: Pick<CmsEditorialReviewState, "checklist">,
  completedChecklistItemIds: readonly string[],
) {
  const completed = new Set([
    ...state.checklist.filter((item) => item.completed).map((item) => item.id),
    ...completedChecklistItemIds,
  ]);
  return state.checklist.filter(
    (item) => item.required && !completed.has(item.id),
  );
}

/**
 * Derives review state from a current document and newest-first immutable
 * review/publication events. Saving creates a new version, so an older decision
 * becomes stale without mutating its provenance.
 */
export function deriveCmsEditorialReviewState(
  document: CmsEditorialReviewDocument,
  events: readonly CmsEditorialReviewEvent[],
): CmsEditorialReviewState {
  const reviewEvent = events.find((event) => event.action !== "published");
  if (!reviewEvent || reviewEvent.action === "published") {
    return {
      actorId: null,
      assigneeIds: [],
      assigneeRoles: [],
      checklist: [],
      currentVersion: document.version,
      documentId: document.documentId,
      documentType: document.documentType,
      dueAt: null,
      mentionIds: [],
      note: "",
      notify: true,
      occurredAt: null,
      published: false,
      requestedAt: null,
      reviewVersion: null,
      stale: false,
      status: "none",
    };
  }

  const reviewIndex = events.indexOf(reviewEvent);
  const requestEvent = events.find(
    (event) =>
      event.action === "requested" && event.version === reviewEvent.version,
  );
  const task = requestEvent?.task ?? {
    assigneeIds: [],
    assigneeRoles: [],
    checklist: [],
    dueAt: null,
    mentionIds: [],
    notify: true,
  };
  const completedChecklistItemIds = new Set(
    events
      .filter(
        (event) =>
          event.version === reviewEvent.version &&
          event.action !== "requested" &&
          event.action !== "published",
      )
      .flatMap((event) => event.completedChecklistItemIds ?? []),
  );
  const publication = events
    .slice(0, reviewIndex)
    .find((event) => event.action === "published");
  const published = Boolean(
    reviewEvent.action === "approved" &&
    publication?.version === reviewEvent.version &&
    document.status === "published" &&
    document.publishedRevisionId &&
    document.version === reviewEvent.version + 1,
  );

  return {
    actorId: reviewEvent.actorId,
    assigneeIds: [...task.assigneeIds],
    assigneeRoles: [...task.assigneeRoles],
    checklist: task.checklist.map((item) => ({
      ...item,
      completed: completedChecklistItemIds.has(item.id),
    })),
    currentVersion: document.version,
    documentId: document.documentId,
    documentType: document.documentType,
    dueAt: task.dueAt,
    mentionIds: [...task.mentionIds],
    note: reviewEvent.note,
    notify: task.notify,
    occurredAt: reviewEvent.occurredAt,
    published,
    requestedAt: requestEvent?.occurredAt ?? null,
    reviewVersion: reviewEvent.version,
    stale: !published && document.version !== reviewEvent.version,
    status: reviewEvent.action,
  };
}

export type CmsPageProvider<TContent extends CmsPageContent = CmsPageContent> =
  ContentReader<TContent> &
    DraftWriter<TContent> &
    PublishingWorkflow<TContent> & {
      delete(input: DeleteDraftInput): Promise<CmsPageDocument<TContent>>;
      capabilities: CmsProviderCapabilities;
      reviews?: CmsEditorialReviewWorkflow;
    };

export type CmsPageRuntime<TContent extends CmsPageContent = CmsPageContent> =
  Readonly<{
    capabilities: CmsProviderCapabilities;
    content: ContentReader<TContent>;
    drafts: DraftWriter<TContent>;
    publishing: PublishingWorkflow<TContent>;
    lifecycle: DocumentLifecycle<TContent>;
    reviews: CmsEditorialReviewWorkflow | null;
  }>;

export function createCmsPageRuntime<TContent extends CmsPageContent>(
  provider: CmsPageProvider<TContent>,
): CmsPageRuntime<TContent> {
  return Object.freeze({
    capabilities: provider.capabilities,
    content: provider,
    drafts: provider,
    publishing: provider,
    lifecycle: provider,
    reviews: provider.reviews ?? null,
  });
}

export type EditorialReviewProviderConformanceEvidence = {
  approvalResolution: boolean;
  decisionValidation: boolean;
  idempotentRequest: boolean;
  pendingQueue: boolean;
  staleProtection: boolean;
  taskGovernance: boolean;
  versionBound: boolean;
};

function isCmsErrorCode(error: unknown, code: CmsError["code"]) {
  return error instanceof CmsError && error.code === code;
}

/**
 * Exercises the portable review contract against a provider and real document
 * lifecycle callbacks. The publish callback must record publication in the same
 * provider boundary so an approval can be resolved without UI inference.
 */
export async function runEditorialReviewProviderConformance(input: {
  workflow: CmsEditorialReviewWorkflow;
  target: CmsEditorialReviewTarget;
  advanceDocument: () => Promise<{ version: number }>;
  publishDocument: () => Promise<{ version: number }>;
  requesterId?: string;
  reviewerId?: string;
}): Promise<EditorialReviewProviderConformanceEvidence> {
  const requesterId = input.requesterId ?? "editor-conformance";
  const reviewerId = input.reviewerId ?? "reviewer-conformance";
  const initial = await input.workflow.getState(input.target);
  if (initial.status !== "none") {
    throw new Error("Review conformance requires an unreviewed document.");
  }

  const requested = await input.workflow.requestReview({
    ...input.target,
    actorId: requesterId,
    expectedVersion: initial.currentVersion,
    note: "Ready for review",
  });
  const duplicate = await input.workflow.requestReview({
    ...input.target,
    actorId: requesterId,
    expectedVersion: initial.currentVersion,
    note: "Ready for review",
  });
  let divergentRequestRejected = false;
  try {
    await input.workflow.requestReview({
      ...input.target,
      actorId: requesterId,
      expectedVersion: initial.currentVersion,
      note: "A different request",
    });
  } catch (error) {
    divergentRequestRejected = isCmsErrorCode(error, "CONFLICT");
  }
  const queued = await input.workflow.listPending();
  const pendingQueue = queued.some(
    (item) =>
      item.documentType === input.target.documentType &&
      item.documentId === input.target.documentId &&
      item.reviewVersion === initial.currentVersion,
  );

  const changed = await input.advanceDocument();
  const stale = await input.workflow.getState(input.target);
  const staleQueue = await input.workflow.listPending();
  let staleDecisionRejected = false;
  try {
    await input.workflow.decideReview({
      ...input.target,
      actorId: reviewerId,
      decision: "approved",
      expectedVersion: changed.version,
      note: "",
    });
  } catch (error) {
    staleDecisionRejected = isCmsErrorCode(error, "CONFLICT");
  }

  const requestedChanged = await input.workflow.requestReview({
    ...input.target,
    actorId: requesterId,
    expectedVersion: changed.version,
    note: "Updated version",
  });
  let emptyChangesRejected = false;
  try {
    await input.workflow.decideReview({
      ...input.target,
      actorId: reviewerId,
      decision: "changes_requested",
      expectedVersion: changed.version,
      note: "",
    });
  } catch (error) {
    emptyChangesRejected = isCmsErrorCode(error, "VALIDATION_FAILED");
  }
  await input.workflow.decideReview({
    ...input.target,
    actorId: reviewerId,
    decision: "changes_requested",
    expectedVersion: changed.version,
    note: "Clarify the opening copy",
  });

  const finalDraft = await input.advanceDocument();
  await input.workflow.requestReview({
    ...input.target,
    actorId: requesterId,
    expectedVersion: finalDraft.version,
    note: "Changes addressed",
    assigneeIds: [reviewerId],
    checklist: [
      { id: "release-readiness", label: "Release readiness", required: true },
    ],
  });
  let assignmentRejected = false;
  try {
    await input.workflow.decideReview({
      ...input.target,
      actorId: "unassigned-reviewer",
      decision: "approved",
      expectedVersion: finalDraft.version,
      note: "Should not be accepted",
      completedChecklistItemIds: ["release-readiness"],
    });
  } catch (error) {
    assignmentRejected = isCmsErrorCode(error, "FORBIDDEN");
  }
  let checklistRejected = false;
  try {
    await input.workflow.decideReview({
      ...input.target,
      actorId: reviewerId,
      decision: "approved",
      expectedVersion: finalDraft.version,
      note: "Checklist is incomplete",
    });
  } catch (error) {
    checklistRejected = isCmsErrorCode(error, "VALIDATION_FAILED");
  }
  const approved = await input.workflow.decideReview({
    ...input.target,
    actorId: reviewerId,
    decision: "approved",
    expectedVersion: finalDraft.version,
    note: "Approved for publication",
    completedChecklistItemIds: ["release-readiness"],
  });
  const publishedDocument = await input.publishDocument();
  const published = await input.workflow.getState(input.target);
  const resolvedQueue = await input.workflow.listPending();

  const evidence = {
    approvalResolution:
      approved.status === "approved" &&
      !approved.published &&
      published.status === "approved" &&
      published.published &&
      published.currentVersion === publishedDocument.version &&
      !resolvedQueue.some(
        (item) =>
          item.documentType === input.target.documentType &&
          item.documentId === input.target.documentId,
      ),
    decisionValidation: emptyChangesRejected,
    idempotentRequest:
      requested.status === "requested" &&
      duplicate.status === "requested" &&
      duplicate.reviewVersion === requested.reviewVersion &&
      duplicate.occurredAt === requested.occurredAt &&
      divergentRequestRejected,
    pendingQueue,
    staleProtection:
      stale.stale &&
      stale.reviewVersion === initial.currentVersion &&
      staleDecisionRejected &&
      !staleQueue.some(
        (item) =>
          item.documentType === input.target.documentType &&
          item.documentId === input.target.documentId,
      ),
    taskGovernance:
      assignmentRejected &&
      checklistRejected &&
      approved.checklist.every((item) => !item.required || item.completed),
    versionBound:
      requestedChanged.reviewVersion === changed.version &&
      approved.reviewVersion === finalDraft.version,
  } satisfies EditorialReviewProviderConformanceEvidence;

  if (Object.values(evidence).some((value) => !value)) {
    throw new Error("Editorial review provider failed conformance.");
  }
  return evidence;
}

export type CmsMediaUsageReference = {
  type: string;
  id: string;
};

export type CmsMediaRecord = {
  id: string;
  key: string;
  url: string;
  altText: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  usageReferences: readonly CmsMediaUsageReference[];
};

export type UploadMediaInput = {
  id?: string;
  key: string;
  url: string;
  altText?: string;
  size: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  body: unknown;
  actorId: string;
};

export type UpdateMediaMetadataInput = {
  id: string;
  altText: string;
  actorId: string;
};

export type DeleteMediaInput = {
  id: string;
  actorId: string;
  force?: boolean;
};

export interface MediaStore {
  list(): Promise<CmsMediaRecord[]>;
  get(id: string): Promise<CmsMediaRecord | null>;
  getUsage(id: string): Promise<CmsMediaUsageReference[]>;
  upload(input: UploadMediaInput): Promise<CmsMediaRecord>;
  updateMetadata(input: UpdateMediaMetadataInput): Promise<CmsMediaRecord>;
  delete(input: DeleteMediaInput): Promise<CmsMediaRecord>;
}

export type CmsMediaProvider = MediaStore & {
  capabilities: CmsProviderCapabilities;
};

export type MediaProviderConformanceEvidence = {
  objectLifecycle: true;
  metadata: true;
  usage: true;
  safeDelete: true;
};

export async function runMediaProviderConformance(input: {
  provider: CmsMediaProvider;
  body?: unknown;
  actorId?: string;
}): Promise<MediaProviderConformanceEvidence> {
  const {
    provider,
    body = new Uint8Array([1, 2, 3]),
    actorId = "conformance-user",
  } = input;
  assertCondition(
    (await provider.list()).length === 0,
    "empty media state must return an empty list",
  );

  const uploaded = await provider.upload({
    id: "conformance-media",
    key: "media/conformance.png",
    url: "/api/media/media/conformance.png",
    altText: "",
    size: 3,
    mimeType: "image/png",
    width: 1,
    height: 1,
    body,
    actorId,
  });
  assertCondition(
    uploaded.key === "media/conformance.png",
    "upload must persist metadata",
  );

  const usage = await provider.getUsage(uploaded.id);
  assertCondition(
    usage.length === 1,
    "usage discovery must be provider-accessible",
  );
  let protectedDelete = false;
  try {
    await provider.delete({ id: uploaded.id, actorId });
  } catch (error) {
    protectedDelete = error instanceof CmsError && error.code === "CONFLICT";
  }
  assertCondition(
    protectedDelete,
    "referenced media must reject ordinary delete",
  );

  const updated = await provider.updateMetadata({
    id: uploaded.id,
    altText: "Conformance image",
    actorId,
  });
  assertCondition(
    updated.altText === "Conformance image",
    "metadata updates must persist",
  );

  const deleted = await provider.delete({
    id: uploaded.id,
    actorId,
    force: true,
  });
  assertCondition(
    deleted.id === uploaded.id,
    "forced delete must return the removed record",
  );
  assertCondition(
    (await provider.get(uploaded.id)) === null,
    "delete must remove metadata",
  );

  return {
    objectLifecycle: true,
    metadata: true,
    usage: true,
    safeDelete: true,
  };
}

export type PageProviderConformanceEvidence = {
  delete: true;
  draftIsolation: true;
  optimisticConflict: true;
  publish: true;
  revisionRestore: true;
  scheduling: true;
  unpublish: true;
};

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Provider conformance failed: ${message}`);
  }
}

/**
 * Provider-neutral vertical-slice conformance scenario. A provider test supplies
 * valid content twice; the scenario proves empty state, draft isolation,
 * optimistic conflicts, immutable publication, and non-publishing restore.
 */
export async function runPageProviderConformance<
  TContent extends CmsPageContent,
>(input: {
  provider: CmsPageProvider<TContent>;
  initial: TContent;
  changed: TContent;
  actorId?: string;
  documentId?: string;
}): Promise<PageProviderConformanceEvidence> {
  const {
    provider,
    initial,
    changed,
    actorId = "conformance-user",
    documentId: id = "conformance-home",
  } = input;

  assertCondition(
    (await provider.getDraft({ id })) === null,
    "empty draft state must return null",
  );
  assertCondition(
    (await provider.getPublished({ slug: initial.slug })) === null,
    "empty published state must return null",
  );

  const created = await provider.createDraft({ id, content: initial, actorId });
  assertCondition(created.version === 1, "new drafts must start at version 1");

  const scheduledAt = "2099-01-01T00:00:00.000Z";
  const scheduledInitial = await provider.schedule({
    id,
    expectedVersion: created.version,
    scheduledAt,
    actorId,
    note: "Initial schedule",
  });
  assertCondition(
    scheduledInitial.scheduledAt === scheduledAt,
    "schedule must persist the normalized future timestamp",
  );
  const unscheduledInitial = await provider.unschedule({
    id,
    expectedVersion: scheduledInitial.version,
    actorId,
  });
  assertCondition(
    unscheduledInitial.scheduledAt === null,
    "unschedule must clear the pending timestamp",
  );

  const firstPublish = await provider.publish({
    id,
    expectedVersion: unscheduledInitial.version,
    actorId,
    note: "Initial publish",
  });
  const edited = await provider.saveDraft({
    id,
    expectedVersion: firstPublish.document.version,
    content: changed,
    actorId,
  });
  const stillPublished = await provider.getPublished({ slug: initial.slug });
  assertCondition(
    stillPublished?.content.title === initial.title,
    "saving a draft must not mutate the published snapshot",
  );

  let conflict = false;
  try {
    await provider.saveDraft({
      id,
      expectedVersion: firstPublish.document.version,
      content: initial,
      actorId,
    });
  } catch (error) {
    conflict = error instanceof CmsError && error.code === "CONFLICT";
  }
  assertCondition(conflict, "stale writes must return a portable conflict");

  const scheduledChanged = await provider.schedule({
    id,
    expectedVersion: edited.version,
    scheduledAt,
    actorId,
    note: "Changed schedule",
  });
  const secondPublish = await provider.publish({
    id,
    expectedVersion: scheduledChanged.version,
    actorId,
    note: "Changed publish",
  });
  const publishedChanged = await provider.getPublished({ slug: changed.slug });
  assertCondition(
    publishedChanged?.content.title === changed.title,
    "publish must expose the new immutable snapshot",
  );
  assertCondition(
    secondPublish.document.scheduledAt === null,
    "publish must clear the pending schedule",
  );

  const revisions = await provider.listRevisions(id);
  assertCondition(
    revisions.length === 2,
    "two publishes must create two revisions",
  );
  const restored = await provider.restore({
    id,
    revisionId: firstPublish.revision.id,
    expectedVersion: secondPublish.document.version,
    actorId,
  });
  assertCondition(
    restored.content.title === initial.title,
    "restore must copy the selected revision to the draft",
  );
  const publicAfterRestore = await provider.getPublished({
    slug: changed.slug,
  });
  assertCondition(
    publicAfterRestore?.content.title === changed.title,
    "restore must not publish automatically",
  );

  const unpublished = await provider.unpublish({
    id,
    expectedVersion: restored.version,
    actorId,
  });
  assertCondition(
    unpublished.status === "draft" && unpublished.publishedRevisionId === null,
    "unpublish must clear the public pointer while retaining the draft",
  );
  assertCondition(
    (await provider.getPublished({ slug: changed.slug })) === null,
    "unpublish must remove the public snapshot",
  );
  assertCondition(
    (await provider.listRevisions(id)).length === 2,
    "unpublish must retain revision history",
  );
  const resavedAfterUnpublish = await provider.saveDraft({
    id,
    expectedVersion: unpublished.version,
    content: changed,
    actorId,
  });
  const republished = await provider.publish({
    id,
    expectedVersion: resavedAfterUnpublish.version,
    actorId,
    note: "Republish after unpublish",
  });
  assertCondition(
    (await provider.getPublished({ slug: changed.slug }))?.content.title ===
      changed.title,
    "an unpublished draft must remain publishable",
  );
  assertCondition(
    republished.revision.version === republished.document.version,
    "republish must create a new immutable revision",
  );

  const deleteContent = {
    ...initial,
    slug: `${initial.slug}-delete`,
  } as TContent;
  const deleteId = `${id}-delete`;
  const deleteCandidate = await provider.createDraft({
    id: deleteId,
    content: deleteContent,
    actorId,
  });
  const deleted = await provider.delete({
    id: deleteCandidate.id,
    expectedVersion: deleteCandidate.version,
    actorId,
  });
  assertCondition(
    deleted.id === deleteCandidate.id,
    "delete must return the removed document",
  );
  assertCondition(
    (await provider.getDraft({ id: deleteCandidate.id })) === null,
    "delete must remove the working document",
  );
  assertCondition(
    (await provider.listRevisions(deleteCandidate.id)).length === 0,
    "delete must remove the document revision history",
  );

  return {
    delete: true,
    draftIsolation: true,
    optimisticConflict: true,
    publish: true,
    revisionRestore: true,
    scheduling: true,
    unpublish: true,
  };
}

export type CmsGlobalDocument<TContent = unknown> = {
  key: string;
  content: TContent;
  version: number;
  status: "draft" | "published";
  publishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type CmsGlobalRevision<TContent = unknown> = {
  id: string;
  key: string;
  version: number;
  content: TContent;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type SaveGlobalContentInput<TContent = unknown> = {
  key: string;
  expectedVersion: number | null;
  content: TContent;
  actorId: string;
  note?: string;
};

export type RestoreGlobalContentInput = {
  key: string;
  revisionId: string;
  expectedVersion: number;
  actorId: string;
  note?: string;
};

export type PublishGlobalContentInput = {
  key: string;
  expectedVersion: number;
  actorId: string;
  note?: string;
};

export type RollbackGlobalPublicationInput = {
  key: string;
  expectedVersion: number;
  restoreVersion: number;
  restorePublishedRevisionId: string | null;
  publicationRevisionId: string;
  actorId: string;
};

export interface GlobalContentReader<TContent = unknown> {
  get(input: { key: string }): Promise<CmsGlobalDocument<TContent> | null>;
  getPublished(input: {
    key: string;
  }): Promise<CmsGlobalDocument<TContent> | null>;
}

export interface GlobalContentWriter<TContent = unknown> {
  save(
    input: SaveGlobalContentInput<TContent>,
  ): Promise<CmsGlobalDocument<TContent>>;
}

export interface GlobalContentHistory<TContent = unknown> {
  listRevisions(key: string): Promise<CmsGlobalRevision<TContent>[]>;
  restore(
    input: RestoreGlobalContentInput,
  ): Promise<CmsGlobalDocument<TContent>>;
}

export interface GlobalContentPublishing<TContent = unknown> {
  publish(input: PublishGlobalContentInput): Promise<{
    document: CmsGlobalDocument<TContent>;
    revision: CmsGlobalRevision<TContent>;
  }>;
  rollbackPublication(
    input: RollbackGlobalPublicationInput,
  ): Promise<CmsGlobalDocument<TContent>>;
}

export type CmsGlobalContentProvider<TContent = unknown> =
  GlobalContentReader<TContent> &
    GlobalContentWriter<TContent> &
    GlobalContentHistory<TContent> & {
      publish: GlobalContentPublishing<TContent>["publish"];
      rollbackPublication: GlobalContentPublishing<TContent>["rollbackPublication"];
      capabilities: CmsProviderCapabilities;
    };

export type GlobalContentProviderConformanceEvidence = {
  compensatingRollback: true;
  create: true;
  draftIsolation: true;
  optimisticConflict: true;
  publish: true;
  revisionHistory: true;
  restore: true;
  update: true;
};

/**
 * Provider-neutral conformance for versioned singleton and keyed global content.
 * The provider test supplies two valid values; the scenario proves empty reads,
 * create/update versioning, portable conflicts, immutable history and restore.
 */
export async function runGlobalContentProviderConformance<TContent>(input: {
  provider: CmsGlobalContentProvider<TContent>;
  initial: TContent;
  changed: TContent;
  actorId?: string;
  key?: string;
}): Promise<GlobalContentProviderConformanceEvidence> {
  const {
    provider,
    initial,
    changed,
    actorId = "conformance-user",
    key = "conformance:site-settings",
  } = input;
  const sameContent = (left: TContent | undefined, right: TContent) =>
    JSON.stringify(left) === JSON.stringify(right);

  assertCondition(
    (await provider.get({ key })) === null,
    "empty global content must return null",
  );
  const created = await provider.save({
    key,
    expectedVersion: null,
    content: initial,
    actorId,
    note: "Initial global content",
  });
  assertCondition(
    created.version === 1,
    "new global content must start at version 1",
  );
  assertCondition(
    (await provider.getPublished({ key })) === null,
    "an unpublished global draft must not be publicly readable",
  );
  const initialPublication = await provider.publish({
    key,
    expectedVersion: created.version,
    actorId,
    note: "Publish initial global content",
  });
  assertCondition(
    initialPublication.document.version === 2 &&
      sameContent(initialPublication.revision.content, initial),
    "publishing global content must create an immutable published revision",
  );
  const changedDocument = await provider.save({
    key,
    expectedVersion: initialPublication.document.version,
    content: changed,
    actorId,
    note: "Changed global content",
  });
  assertCondition(
    changedDocument.version === 3,
    "global content updates must increment the version",
  );
  const stillPublished = await provider.getPublished({ key });
  assertCondition(
    sameContent(stillPublished?.content, initial) &&
      stillPublished?.publishedRevisionId === initialPublication.revision.id,
    "saving a global draft must not change the published snapshot",
  );
  const changedPublication = await provider.publish({
    key,
    expectedVersion: changedDocument.version,
    actorId,
    note: "Publish changed global content",
  });
  assertCondition(
    changedPublication.document.version === 4 &&
      sameContent((await provider.getPublished({ key }))?.content, changed),
    "publishing a changed global draft must update the public snapshot",
  );
  const rolledBack = await provider.rollbackPublication({
    key,
    expectedVersion: changedPublication.document.version,
    restoreVersion: changedDocument.version,
    restorePublishedRevisionId: initialPublication.revision.id,
    publicationRevisionId: changedPublication.revision.id,
    actorId,
  });
  assertCondition(
    rolledBack.version === changedDocument.version &&
      sameContent((await provider.getPublished({ key }))?.content, initial),
    "global publication compensation must restore the exact prior public snapshot",
  );
  const republished = await provider.publish({
    key,
    expectedVersion: rolledBack.version,
    actorId,
    note: "Republish changed global content",
  });

  let conflict = false;
  try {
    await provider.save({
      key,
      expectedVersion: changedDocument.version,
      content: initial,
      actorId,
    });
  } catch (error) {
    conflict = error instanceof CmsError && error.code === "CONFLICT";
  }
  assertCondition(
    conflict,
    "stale global content writes must return a portable conflict",
  );

  const revisions = await provider.listRevisions(key);
  assertCondition(
    revisions.length === 4 && revisions[0]?.version === 4,
    "global content saves and publications must create newest-first immutable revisions",
  );
  const initialRevision = revisions.find(
    (revision) => revision.version === created.version,
  );
  assertCondition(
    Boolean(initialRevision),
    "the initial global content revision must remain available",
  );
  const restored = await provider.restore({
    key,
    revisionId: initialRevision!.id,
    expectedVersion: republished.document.version,
    actorId,
    note: "Restore initial global content",
  });
  assertCondition(
    restored.version === 5,
    "restore must create a new working version",
  );
  assertCondition(
    sameContent((await provider.getPublished({ key }))?.content, changed),
    "restoring a global draft must not change the published snapshot",
  );
  const afterRestore = await provider.listRevisions(key);
  assertCondition(
    afterRestore.length === 5 && afterRestore[0]?.version === 5,
    "restore must append rather than mutate revision history",
  );

  return {
    compensatingRollback: true,
    create: true,
    draftIsolation: true,
    optimisticConflict: true,
    publish: true,
    revisionHistory: true,
    restore: true,
    update: true,
  };
}
