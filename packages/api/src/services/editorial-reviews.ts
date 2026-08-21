import { createDb } from "@rem-viet/db";
import { user } from "@rem-viet/db/schema/auth";
import { cmsOutboxEvents } from "@rem-viet/db/schema/automation";
import { pages, posts } from "@rem-viet/db/schema/content";
import { auditEvents, staffRoles } from "@rem-viet/db/schema/governance";
import {
  cmsCollectionSlugSchema,
  cmsEditorialReviewTaskSchema,
  cmsLocaleSchema,
  type CmsEditorialReviewTask,
} from "@agency/cms-core";
import { REM_VIET_STANDARD_PAGES_COLLECTION } from "@agency/cms-template-rem-viet";
import { cmsContentFolderSchema } from "@rem-viet/cms";
import {
  deriveCmsEditorialReviewState,
  isCmsEditorialReviewActorAssigned,
  missingRequiredCmsEditorialReviewChecklistItems,
  type CmsCollectionProvider,
  type CmsEditorialReviewEvent,
} from "@agency/cms-runtime";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { ContentWorkflowError, type CmsActor } from "./content-revisions";
import {
  assertCmsWorkflowReviewerAllowed,
  cmsWorkflowAuditTarget,
  getCmsWorkflowApprovalProgress,
} from "./workflow-policies";
import { createRemVietCollectionProvider } from "./standard-page-runtime";

export const editorialDocumentTypeSchema = z.enum(["page", "post"]);
export const editorialReviewDecisionSchema = z.enum([
  "approved",
  "changes_requested",
]);

const editorialReviewNoteSchema = z.string().trim().max(500).default("");

const editorialPagePostReviewTargetSchema = z.object({
  documentType: editorialDocumentTypeSchema,
  documentId: z.string().trim().min(1).max(256),
});

const editorialCollectionReviewTargetSchema = z.object({
  documentType: z.literal("collection"),
  collection: cmsCollectionSlugSchema.refine(
    (value) => value !== REM_VIET_STANDARD_PAGES_COLLECTION,
    "Use the page review target for standard pages",
  ),
  documentId: z.string().trim().min(1).max(256),
  locale: z.union([z.literal(""), cmsLocaleSchema]).default(""),
});

export const editorialReviewTargetSchema = z.discriminatedUnion(
  "documentType",
  [editorialPagePostReviewTargetSchema, editorialCollectionReviewTargetSchema],
);

export const requestEditorialReviewInputSchema = editorialReviewTargetSchema
  .and(
    z.object({
      expectedVersion: z.coerce.number().int().positive(),
      note: editorialReviewNoteSchema,
    }),
  )
  .and(cmsEditorialReviewTaskSchema)
  .superRefine((value, context) => {
    const invalidRole = value.assigneeRoles.find(
      (role) => role !== "owner" && role !== "admin",
    );
    if (invalidRole) {
      context.addIssue({
        code: "custom",
        message: `Role ${invalidRole} cannot decide editorial reviews`,
        path: ["assigneeRoles"],
      });
    }
  });

export const decideEditorialReviewInputSchema = editorialReviewTargetSchema
  .and(
    z.object({
      decision: editorialReviewDecisionSchema,
      expectedVersion: z.coerce.number().int().positive(),
      note: editorialReviewNoteSchema,
      stageId: z.string().trim().min(2).max(64).optional(),
      completedChecklistItemIds: z
        .array(z.string().trim().min(1).max(64))
        .max(20)
        .default([])
        .transform((values) => [...new Set(values)].sort()),
    }),
  )
  .superRefine((value, context) => {
    if (value.decision === "changes_requested" && !value.note) {
      context.addIssue({
        code: "custom",
        message: "A note is required when requesting changes",
        path: ["note"],
      });
    }
  });

export const editorialReviewQueueInputSchema = z
  .object({
    assigneeId: z.string().trim().min(1).max(256).optional(),
    dueFrom: z.string().datetime({ offset: true }).optional(),
    dueTo: z.string().datetime({ offset: true }).optional(),
    overdueOnly: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .default({ overdueOnly: false, limit: 50 });

export type EditorialDocumentType = z.infer<typeof editorialDocumentTypeSchema>;
export type EditorialReviewTarget = z.infer<typeof editorialReviewTargetSchema>;
type EditorialReviewDocumentType = EditorialReviewTarget["documentType"];
export type EditorialReviewStatus =
  "none" | "requested" | "changes_requested" | "approved";

type EditorialDocument = {
  collection: string;
  documentId: string;
  documentType: EditorialReviewDocumentType;
  folder: string;
  locale: string;
  publishedRevisionId: string | null;
  slug: string;
  status: "draft" | "published";
  title: string;
  version: number;
};

export type EditorialReviewRuntime = Readonly<{
  collectionProvider?: CmsCollectionProvider;
  db?: ReturnType<typeof createDb>;
  now?: () => Date;
}>;

function runtimeDb(runtime?: EditorialReviewRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeCollectionProvider(runtime?: EditorialReviewRuntime) {
  return runtime?.collectionProvider ?? createRemVietCollectionProvider();
}

function runtimeNow(runtime?: EditorialReviewRuntime) {
  return runtime?.now?.() ?? new Date();
}

type EditorialReviewEvent = {
  action: string;
  actorUserId?: string;
  actorRole: "owner" | "admin" | "editor" | "system";
  after: unknown | null;
  createdAt: Date;
  id: string;
};

const reviewPayloadSchema = z.object({
  assigneeIds: z.array(z.string()).default([]),
  assigneeRoles: z.array(z.string()).default([]),
  checklist: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        required: z.boolean().default(true),
      }),
    )
    .default([]),
  completedChecklistItemIds: z.array(z.string()).default([]),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  mentionIds: z.array(z.string()).default([]),
  note: z.string().max(500).catch(""),
  notify: z.boolean().default(true),
  target: editorialReviewTargetSchema.optional(),
  version: z.number().int().positive(),
});
const publicationPayloadSchema = z.object({
  version: z.number().int().positive(),
});

function workflowCollectionForTarget(target: EditorialReviewTarget) {
  return target.documentType === "collection"
    ? target.collection
    : target.documentType;
}

function targetForDocument(document: EditorialDocument): EditorialReviewTarget {
  return document.documentType === "collection"
    ? {
        documentType: "collection",
        collection: document.collection,
        documentId: document.documentId,
        locale: document.locale,
      }
    : {
        documentType: document.documentType,
        documentId: document.documentId,
      };
}

function auditTargetForEditorialTarget(target: EditorialReviewTarget) {
  return cmsWorkflowAuditTarget({
    collection: workflowCollectionForTarget(target),
    documentId: target.documentId,
    locale: target.documentType === "collection" ? target.locale : "",
  });
}

function reviewActionsForTarget(target: EditorialReviewTarget) {
  const prefix = auditTargetForEditorialTarget(target).actionPrefix;
  return [
    `${prefix}.review_requested`,
    `${prefix}.review_changes_requested`,
    `${prefix}.review_approved`,
  ];
}

function publishActionForTarget(target: EditorialReviewTarget) {
  return `${auditTargetForEditorialTarget(target).actionPrefix}.publish`;
}

function isReviewAction(action: string) {
  return (
    action.endsWith(".review_requested") ||
    action.endsWith(".review_changes_requested") ||
    action.endsWith(".review_approved")
  );
}

function reviewStatusFromAction(action: string): EditorialReviewStatus {
  if (action.endsWith(".review_requested")) return "requested";
  if (action.endsWith(".review_changes_requested")) return "changes_requested";
  if (action.endsWith(".review_approved")) return "approved";
  return "none";
}

export type EditorialReviewState = {
  actorRole: EditorialReviewEvent["actorRole"] | null;
  actorUserId: string | null;
  assigneeIds: string[];
  assigneeRoles: string[];
  checklist: Array<{
    id: string;
    label: string;
    required: boolean;
    completed: boolean;
  }>;
  currentVersion: number;
  collection?: string;
  documentId: string;
  documentType: EditorialReviewDocumentType;
  dueAt: string | null;
  locale?: string;
  mentionIds: string[];
  note: string;
  notify: boolean;
  published: boolean;
  requestedAt: Date | null;
  reviewVersion: number | null;
  stale: boolean;
  status: EditorialReviewStatus;
};

export function deriveEditorialReviewState(
  document: EditorialDocument,
  events: EditorialReviewEvent[],
): EditorialReviewState {
  const normalizedEvents = events.flatMap<CmsEditorialReviewEvent>((event) => {
    if (isReviewAction(event.action)) {
      const payload = reviewPayloadSchema.safeParse(event.after);
      const action = reviewStatusFromAction(event.action);
      if (!payload.success || action === "none") return [];
      return [
        {
          action,
          actorId: event.actorUserId ?? event.actorRole,
          completedChecklistItemIds: payload.data.completedChecklistItemIds,
          documentId: document.documentId,
          documentType: document.documentType,
          note: payload.data.note,
          occurredAt: event.createdAt.toISOString(),
          ...(action === "requested"
            ? {
                task: cmsEditorialReviewTaskSchema.parse(payload.data),
              }
            : {}),
          version: payload.data.version,
        },
      ];
    }
    if (event.action === publishActionForTarget(targetForDocument(document))) {
      const payload = publicationPayloadSchema.safeParse(event.after);
      if (!payload.success) return [];
      return [
        {
          action: "published",
          actorId: event.actorRole,
          documentId: document.documentId,
          documentType: document.documentType,
          note: "",
          occurredAt: event.createdAt.toISOString(),
          version: payload.data.version - 1,
        },
      ];
    }
    return [];
  });
  const state = deriveCmsEditorialReviewState(
    {
      documentId: document.documentId,
      documentType: document.documentType,
      publishedRevisionId: document.publishedRevisionId,
      status: document.status,
      version: document.version,
    },
    normalizedEvents,
  );
  const stateEvent = events.find((event) => {
    if (!isReviewAction(event.action)) return false;
    const payload = reviewPayloadSchema.safeParse(event.after);
    return (
      payload.success &&
      payload.data.version === state.reviewVersion &&
      reviewStatusFromAction(event.action) === state.status
    );
  });

  return {
    actorRole: stateEvent?.actorRole ?? null,
    actorUserId: state.actorId,
    assigneeIds: state.assigneeIds,
    assigneeRoles: state.assigneeRoles,
    checklist: state.checklist,
    ...(document.documentType === "collection"
      ? { collection: document.collection, locale: document.locale }
      : {}),
    currentVersion: state.currentVersion,
    documentId: document.documentId,
    documentType: document.documentType,
    dueAt: state.dueAt,
    mentionIds: state.mentionIds,
    note: state.note,
    notify: state.notify,
    published: state.published,
    requestedAt: state.requestedAt ? new Date(state.requestedAt) : null,
    reviewVersion: state.reviewVersion,
    stale: state.stale,
    status: state.status,
  };
}

async function loadEditorialDocument(
  target: EditorialReviewTarget,
  runtime?: EditorialReviewRuntime,
): Promise<EditorialDocument> {
  if (target.documentType === "collection") {
    const document = await runtimeCollectionProvider(runtime).getDraft({
      collection: target.collection,
      id: target.documentId,
      locale: target.locale,
    });
    if (!document) {
      throw new ContentWorkflowError("NOT_FOUND", "Content not found");
    }
    const stringValue = (...keys: string[]) => {
      for (const key of keys) {
        const value = document.data[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return "";
    };
    const folder = cmsContentFolderSchema.safeParse(document.data.folder);
    return {
      collection: document.collection,
      documentId: document.id,
      documentType: "collection",
      folder: folder.success ? folder.data : "",
      locale: document.locale ?? "",
      publishedRevisionId: document.publishedRevisionId,
      slug: stringValue("slug", "code") || document.id,
      status: document.status,
      title:
        stringValue("headline", "title", "name", "label", "code", "slug") ||
        `${document.collection}/${document.id}`,
      version: document.version,
    };
  }

  const db = runtimeDb(runtime);
  const document =
    target.documentType === "page"
      ? await db.query.pages.findFirst({
          where: eq(pages.id, target.documentId),
        })
      : await db.query.posts.findFirst({
          where: eq(posts.id, target.documentId),
        });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Content not found");
  }

  return {
    collection: target.documentType,
    documentId: document.id,
    documentType: target.documentType,
    folder: document.folder,
    locale: "",
    publishedRevisionId: document.publishedRevisionId,
    slug: document.slug,
    status: document.status,
    title: document.title,
    version: document.version,
  };
}

async function listEditorialReviewEvents(
  target: EditorialReviewTarget,
  runtime?: EditorialReviewRuntime,
) {
  const db = runtimeDb(runtime);
  const auditTarget = auditTargetForEditorialTarget(target);
  return db
    .select({
      action: auditEvents.action,
      actorUserId: auditEvents.actorUserId,
      actorRole: auditEvents.actorRole,
      after: auditEvents.after,
      createdAt: auditEvents.createdAt,
      id: auditEvents.id,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.entityType, auditTarget.entityType),
        eq(auditEvents.entityId, auditTarget.entityId),
        inArray(auditEvents.action, [
          ...reviewActionsForTarget(target),
          publishActionForTarget(target),
        ]),
      ),
    )
    .orderBy(desc(auditEvents.createdAt), sql`rowid desc`)
    .limit(50);
}

function assertExpectedVersion(actual: number, expected: number) {
  if (actual !== expected) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Content changed since it was loaded (expected version ${expected}, found ${actual})`,
    );
  }
}

function editorialReviewTaskFromRequest(
  input: z.infer<typeof requestEditorialReviewInputSchema>,
) {
  return cmsEditorialReviewTaskSchema.parse(input);
}

export function isEquivalentEditorialReviewRequest(
  current: EditorialReviewState,
  input: z.infer<typeof requestEditorialReviewInputSchema>,
  actorUserId: string,
) {
  const task = editorialReviewTaskFromRequest(input);
  return (
    current.actorUserId === actorUserId &&
    current.note === input.note &&
    JSON.stringify({
      assigneeIds: current.assigneeIds,
      assigneeRoles: current.assigneeRoles,
      mentionIds: current.mentionIds,
      dueAt: current.dueAt,
      checklist: current.checklist.map(
        ({ completed: _completed, ...item }) => item,
      ),
      notify: current.notify,
    }) === JSON.stringify(task)
  );
}

function editorialReviewTiming(state: EditorialReviewState, now = new Date()) {
  const dueAt = state.dueAt ? new Date(state.dueAt) : null;
  return {
    ...state,
    overdue:
      state.status === "requested" &&
      Boolean(dueAt && !Number.isNaN(dueAt.getTime()) && dueAt < now),
  };
}

async function assertEditorialReviewTaskParticipants(
  task: CmsEditorialReviewTask,
  runtime?: EditorialReviewRuntime,
) {
  const principalIds = [...new Set([...task.assigneeIds, ...task.mentionIds])];
  if (!principalIds.length) return;
  const rows = await runtimeDb(runtime)
    .select({ id: staffRoles.userId, role: staffRoles.role })
    .from(staffRoles)
    .where(inArray(staffRoles.userId, principalIds));
  const byId = new Map(rows.map((row) => [row.id, row.role]));
  const missing = principalIds.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Unknown or inactive editorial participant: ${missing.join(", ")}`,
    );
  }
  const invalidAssignee = task.assigneeIds.find(
    (id) => !["owner", "admin"].includes(byId.get(id) ?? ""),
  );
  if (invalidAssignee) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Editorial review assignees must have Owner or Admin authority",
    );
  }
}

export async function listEditorialReviewParticipants(
  runtime?: EditorialReviewRuntime,
) {
  const rows = await runtimeDb(runtime)
    .select({
      id: staffRoles.userId,
      name: user.name,
      role: staffRoles.role,
    })
    .from(staffRoles)
    .innerJoin(user, eq(user.id, staffRoles.userId))
    .orderBy(asc(user.name), asc(staffRoles.userId));
  return rows.flatMap((row) =>
    ["owner", "admin", "editor"].includes(row.role)
      ? [
          {
            id: row.id,
            name: row.name,
            role: row.role as "owner" | "admin" | "editor",
            canDecide: row.role === "owner" || row.role === "admin",
          },
        ]
      : [],
  );
}

export function editorialReviewRequestedOutboxValues(
  input: EditorialReviewTarget & {
    actorUserId: string;
    occurredAt: Date;
    task: CmsEditorialReviewTask;
    version: number;
  },
) {
  const target = editorialReviewTargetSchema.parse(input);
  const auditTarget = auditTargetForEditorialTarget(target);
  const topic = `content.${auditTarget.actionPrefix}.review_requested`;
  return {
    id: crypto.randomUUID(),
    topic,
    aggregateType: auditTarget.actionPrefix,
    aggregateId: auditTarget.entityId,
    aggregateVersion: input.version,
    payload: {
      actorUserId: input.actorUserId,
      documentId: input.documentId,
      documentType: input.documentType,
      ...(input.documentType === "collection"
        ? { collection: input.collection, locale: input.locale }
        : {}),
      target,
      version: input.version,
      task: input.task,
      notificationRecipientIds: input.task.notify
        ? [...new Set([...input.task.assigneeIds, ...input.task.mentionIds])]
        : [],
    },
    idempotencyKey: `${topic}:${auditTarget.entityId}:v${input.version}`,
    status: "pending" as const,
    attempts: 0,
    maxAttempts: 8,
    availableAt: input.occurredAt,
    occurredAt: input.occurredAt,
    retentionUntil: new Date(
      input.occurredAt.getTime() + 90 * 24 * 60 * 60 * 1_000,
    ),
  } satisfies typeof cmsOutboxEvents.$inferInsert;
}

export async function getEditorialReviewState(
  input: z.infer<typeof editorialReviewTargetSchema>,
  runtime?: EditorialReviewRuntime,
) {
  const parsed = editorialReviewTargetSchema.parse(input);
  const document = await loadEditorialDocument(parsed, runtime);
  const target = targetForDocument(document);
  const events = await listEditorialReviewEvents(target, runtime);
  const state = deriveEditorialReviewState(document, events);
  const workflow = await getCmsWorkflowApprovalProgress(
    {
      collection: document.collection,
      documentId: document.documentId,
      version: document.version,
      folder: document.folder,
      locale: document.locale,
    },
    runtime,
  );
  const result = {
    ...state,
    status:
      workflow.policy && !workflow.complete && state.status === "approved"
        ? ("requested" as const)
        : state.status,
    workflow,
  };
  return editorialReviewTiming(result, runtimeNow(runtime));
}

export async function requestEditorialReview(
  input: z.infer<typeof requestEditorialReviewInputSchema>,
  actor: CmsActor,
  runtime?: EditorialReviewRuntime,
) {
  const parsed = requestEditorialReviewInputSchema.parse(input);
  const document = await loadEditorialDocument(parsed, runtime);
  const target = targetForDocument(document);
  assertExpectedVersion(document.version, parsed.expectedVersion);
  const task = editorialReviewTaskFromRequest(parsed);
  if (task.dueAt && new Date(task.dueAt) <= runtimeNow(runtime)) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Editorial review due date must be in the future",
    );
  }
  await assertEditorialReviewTaskParticipants(task, runtime);
  const current = deriveEditorialReviewState(
    document,
    await listEditorialReviewEvents(target, runtime),
  );

  if (
    current.reviewVersion === document.version &&
    current.status === "requested"
  ) {
    if (isEquivalentEditorialReviewRequest(current, parsed, actor.userId)) {
      return getEditorialReviewState(parsed, runtime);
    }
    throw new ContentWorkflowError(
      "CONFLICT",
      "This version already has a different editorial review request",
    );
  }
  if (current.reviewVersion === document.version && current.status !== "none") {
    throw new ContentWorkflowError(
      "CONFLICT",
      current.status === "approved"
        ? "This version is already approved"
        : "Save a new version before requesting review again",
    );
  }

  const occurredAt = runtimeNow(runtime);
  const db = runtimeDb(runtime);
  const auditTarget = auditTargetForEditorialTarget(target);
  await db.batch([
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `${auditTarget.actionPrefix}.review_requested`,
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      before: null,
      after: {
        note: parsed.note,
        version: document.version,
        ...task,
        completedChecklistItemIds: [],
        target,
      },
      requestId: actor.requestId ?? "",
      createdAt: occurredAt,
    }),
    db
      .insert(cmsOutboxEvents)
      .values(
        editorialReviewRequestedOutboxValues({
          actorUserId: actor.userId,
          ...target,
          occurredAt,
          task,
          version: document.version,
        }),
      )
      .onConflictDoNothing({ target: cmsOutboxEvents.idempotencyKey }),
  ]);

  return getEditorialReviewState(parsed, runtime);
}

export async function decideEditorialReview(
  input: z.infer<typeof decideEditorialReviewInputSchema>,
  actor: CmsActor,
  runtime?: EditorialReviewRuntime,
) {
  const parsed = decideEditorialReviewInputSchema.parse(input);
  const document = await loadEditorialDocument(parsed, runtime);
  const target = targetForDocument(document);
  assertExpectedVersion(document.version, parsed.expectedVersion);
  const current = deriveEditorialReviewState(
    document,
    await listEditorialReviewEvents(target, runtime),
  );

  if (
    !["requested", "approved"].includes(current.status) ||
    current.reviewVersion !== document.version ||
    current.stale
  ) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Only the current requested version can be reviewed",
    );
  }
  if (!isCmsEditorialReviewActorAssigned(current, actor.userId, actor.role)) {
    throw new ContentWorkflowError(
      "FORBIDDEN",
      "This review is assigned to another reviewer or role",
    );
  }
  const knownChecklistIds = new Set(current.checklist.map((item) => item.id));
  const unknownChecklistItemId = parsed.completedChecklistItemIds.find(
    (itemId) => !knownChecklistIds.has(itemId),
  );
  if (unknownChecklistItemId) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Unknown editorial checklist item: ${unknownChecklistItemId}`,
    );
  }
  const missingChecklistItems = missingRequiredCmsEditorialReviewChecklistItems(
    current,
    parsed.completedChecklistItemIds,
  );
  if (parsed.decision === "approved" && missingChecklistItems.length) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Complete the required review checklist: ${missingChecklistItems
        .map((item) => item.label)
        .join(", ")}`,
    );
  }

  const workflowDecision =
    parsed.decision === "approved"
      ? await assertCmsWorkflowReviewerAllowed(
          {
            collection: document.collection,
            documentId: parsed.documentId,
            version: document.version,
            folder: document.folder,
            locale: document.locale,
            stageId: parsed.stageId,
          },
          actor,
          runtime,
        )
      : null;
  if (
    parsed.decision === "approved" &&
    !workflowDecision?.progress.policy &&
    current.status === "approved"
  ) {
    return getEditorialReviewState(input, runtime);
  }
  if (
    workflowDecision?.progress.stages
      .find((stage) => stage.id === workflowDecision.stageId)
      ?.actorIds.includes(actor.userId)
  ) {
    return getEditorialReviewState(input, runtime);
  }

  const auditTarget = auditTargetForEditorialTarget(target);
  await runtimeDb(runtime)
    .insert(auditEvents)
    .values({
      id: crypto.randomUUID(),
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `${auditTarget.actionPrefix}.review_${parsed.decision}`,
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      before: { status: current.status, version: current.reviewVersion },
      after: {
        note: parsed.note,
        version: document.version,
        completedChecklistItemIds: parsed.completedChecklistItemIds,
        target,
        ...(workflowDecision ? { stageId: workflowDecision.stageId } : {}),
      },
      requestId: actor.requestId ?? "",
      createdAt: runtimeNow(runtime),
    });

  return getEditorialReviewState(parsed, runtime);
}

export function filterAndSortEditorialReviewQueue<
  T extends {
    assigneeIds: string[];
    dueAt: string | null;
    overdue: boolean;
    requestedAt: Date | null;
  },
>(documents: T[], filters: z.infer<typeof editorialReviewQueueInputSchema>) {
  const dueFrom = filters.dueFrom ? new Date(filters.dueFrom).getTime() : null;
  const dueTo = filters.dueTo ? new Date(filters.dueTo).getTime() : null;
  return documents
    .filter((document) => {
      if (
        filters.assigneeId &&
        !document.assigneeIds.includes(filters.assigneeId)
      )
        return false;
      if (filters.overdueOnly && !document.overdue) return false;
      if (dueFrom !== null || dueTo !== null) {
        if (!document.dueAt) return false;
        const dueAt = new Date(document.dueAt).getTime();
        if (dueFrom !== null && dueAt < dueFrom) return false;
        if (dueTo !== null && dueAt > dueTo) return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftDue = left.dueAt
        ? new Date(left.dueAt).getTime()
        : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt
        ? new Date(right.dueAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return (
        (right.requestedAt?.getTime() ?? 0) - (left.requestedAt?.getTime() ?? 0)
      );
    })
    .slice(0, filters.limit);
}

export async function listEditorialReviewQueue(
  input: z.input<typeof editorialReviewQueueInputSchema> = {},
  runtime?: EditorialReviewRuntime,
) {
  const filters = editorialReviewQueueInputSchema.parse(input);
  const db = runtimeDb(runtime);
  const rankedReviewEvents = db
    .select({
      action: auditEvents.action,
      actorRole: auditEvents.actorRole,
      after: auditEvents.after,
      createdAt: auditEvents.createdAt,
      entityId: auditEvents.entityId,
      entityType: auditEvents.entityType,
      id: auditEvents.id,
      rank: sql<number>`row_number() over (
        partition by ${auditEvents.entityType}, ${auditEvents.entityId}
        order by ${auditEvents.createdAt} desc, rowid desc
      )`.as("review_rank"),
    })
    .from(auditEvents)
    .where(
      inArray(auditEvents.action, [
        "page.review_requested",
        "post.review_requested",
        "collection.review_requested",
      ]),
    )
    .as("ranked_review_events");
  const events = await db
    .select({
      action: rankedReviewEvents.action,
      actorRole: rankedReviewEvents.actorRole,
      after: rankedReviewEvents.after,
      createdAt: rankedReviewEvents.createdAt,
      entityId: rankedReviewEvents.entityId,
      entityType: rankedReviewEvents.entityType,
      id: rankedReviewEvents.id,
    })
    .from(rankedReviewEvents)
    .where(
      and(
        eq(rankedReviewEvents.rank, 1),
        inArray(rankedReviewEvents.action, [
          "page.review_requested",
          "post.review_requested",
          "collection.review_requested",
        ]),
      ),
    )
    .orderBy(desc(rankedReviewEvents.createdAt))
    .limit(100);
  const documents = await Promise.all(
    events.map(async (event) => {
      const payload = reviewPayloadSchema.safeParse(event.after);
      if (!payload.success) return null;
      const legacyDocumentType = editorialDocumentTypeSchema.safeParse(
        event.entityType,
      );
      const target = legacyDocumentType.success
        ? editorialReviewTargetSchema.safeParse({
            documentType: legacyDocumentType.data,
            documentId: event.entityId,
          })
        : editorialReviewTargetSchema.safeParse(payload.data.target);
      if (!target.success) return null;
      try {
        const document = await loadEditorialDocument(target.data, runtime);
        return {
          ...(await getEditorialReviewState(target.data, runtime)),
          slug: document.slug,
          title: document.title,
        };
      } catch (error) {
        if (error instanceof ContentWorkflowError && error.code === "NOT_FOUND")
          return null;
        throw error;
      }
    }),
  );

  return filterAndSortEditorialReviewQueue(
    documents.filter(
      (document): document is NonNullable<typeof document> =>
        document !== null && document.status === "requested" && !document.stale,
    ),
    filters,
  );
}
