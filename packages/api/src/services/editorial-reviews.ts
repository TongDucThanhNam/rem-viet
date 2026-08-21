import { createDb } from "@rem-viet/db";
import { user } from "@rem-viet/db/schema/auth";
import { cmsOutboxEvents } from "@rem-viet/db/schema/automation";
import { pages, posts } from "@rem-viet/db/schema/content";
import { auditEvents, staffRoles } from "@rem-viet/db/schema/governance";
import {
  cmsEditorialReviewTaskSchema,
  type CmsEditorialReviewTask,
} from "@agency/cms-core";
import {
  deriveCmsEditorialReviewState,
  isCmsEditorialReviewActorAssigned,
  missingRequiredCmsEditorialReviewChecklistItems,
  type CmsEditorialReviewEvent,
} from "@agency/cms-runtime";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  ContentWorkflowError,
  recordContentAudit,
  type CmsActor,
} from "./content-revisions";
import {
  assertCmsWorkflowReviewerAllowed,
  getCmsWorkflowApprovalProgress,
} from "./workflow-policies";

export const editorialDocumentTypeSchema = z.enum(["page", "post"]);
export const editorialReviewDecisionSchema = z.enum([
  "approved",
  "changes_requested",
]);

const editorialReviewNoteSchema = z.string().trim().max(500).default("");

export const editorialReviewTargetSchema = z.object({
  documentType: editorialDocumentTypeSchema,
  documentId: z.string().min(1),
});

export const requestEditorialReviewInputSchema = editorialReviewTargetSchema
  .extend({
    expectedVersion: z.coerce.number().int().positive(),
    note: editorialReviewNoteSchema,
  })
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
  .extend({
    decision: editorialReviewDecisionSchema,
    expectedVersion: z.coerce.number().int().positive(),
    note: editorialReviewNoteSchema,
    stageId: z.string().trim().min(2).max(64).optional(),
    completedChecklistItemIds: z
      .array(z.string().trim().min(1).max(64))
      .max(20)
      .default([])
      .transform((values) => [...new Set(values)].sort()),
  })
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
export type EditorialReviewStatus =
  "none" | "requested" | "changes_requested" | "approved";

type EditorialDocument = {
  documentId: string;
  documentType: EditorialDocumentType;
  publishedRevisionId: string | null;
  slug: string;
  status: "draft" | "published";
  title: string;
  version: number;
};

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
  version: z.number().int().positive(),
});
const publicationPayloadSchema = z.object({
  version: z.number().int().positive(),
});

const reviewActions = [
  "page.review_requested",
  "page.review_changes_requested",
  "page.review_approved",
  "post.review_requested",
  "post.review_changes_requested",
  "post.review_approved",
] as const;

const publishActions = ["page.publish", "post.publish"] as const;

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
  documentId: string;
  documentType: EditorialDocumentType;
  dueAt: string | null;
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
    if (
      reviewActions.includes(event.action as (typeof reviewActions)[number])
    ) {
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
    if (
      publishActions.includes(event.action as (typeof publishActions)[number])
    ) {
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
    if (!reviewActions.includes(event.action as (typeof reviewActions)[number]))
      return false;
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
  documentType: EditorialDocumentType,
  documentId: string,
): Promise<EditorialDocument> {
  const db = createDb();
  const document =
    documentType === "page"
      ? await db.query.pages.findFirst({ where: eq(pages.id, documentId) })
      : await db.query.posts.findFirst({ where: eq(posts.id, documentId) });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Content not found");
  }

  return {
    documentId: document.id,
    documentType,
    publishedRevisionId: document.publishedRevisionId,
    slug: document.slug,
    status: document.status,
    title: document.title,
    version: document.version,
  };
}

async function listEditorialReviewEvents(
  documentType: EditorialDocumentType,
  documentId: string,
) {
  const db = createDb();
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
        eq(auditEvents.entityType, documentType),
        eq(auditEvents.entityId, documentId),
        inArray(auditEvents.action, [...reviewActions, ...publishActions]),
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
) {
  const principalIds = [...new Set([...task.assigneeIds, ...task.mentionIds])];
  if (!principalIds.length) return;
  const rows = await createDb()
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

export async function listEditorialReviewParticipants() {
  const rows = await createDb()
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

export function editorialReviewRequestedOutboxValues(input: {
  actorUserId: string;
  documentId: string;
  documentType: EditorialDocumentType;
  occurredAt: Date;
  task: CmsEditorialReviewTask;
  version: number;
}) {
  const topic = `content.${input.documentType}.review_requested`;
  return {
    id: crypto.randomUUID(),
    topic,
    aggregateType: input.documentType,
    aggregateId: input.documentId,
    aggregateVersion: input.version,
    payload: {
      actorUserId: input.actorUserId,
      documentId: input.documentId,
      documentType: input.documentType,
      version: input.version,
      task: input.task,
      notificationRecipientIds: input.task.notify
        ? [...new Set([...input.task.assigneeIds, ...input.task.mentionIds])]
        : [],
    },
    idempotencyKey: `${topic}:${input.documentId}:v${input.version}`,
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
) {
  const document = await loadEditorialDocument(
    input.documentType,
    input.documentId,
  );
  const events = await listEditorialReviewEvents(
    input.documentType,
    input.documentId,
  );
  const state = deriveEditorialReviewState(document, events);
  const workflow = await getCmsWorkflowApprovalProgress({
    documentType: input.documentType,
    documentId: input.documentId,
    version: document.version,
  });
  const result = {
    ...state,
    status:
      workflow.policy && !workflow.complete && state.status === "approved"
        ? ("requested" as const)
        : state.status,
    workflow,
  };
  return editorialReviewTiming(result);
}

export async function requestEditorialReview(
  input: z.infer<typeof requestEditorialReviewInputSchema>,
  actor: CmsActor,
) {
  const parsed = requestEditorialReviewInputSchema.parse(input);
  const document = await loadEditorialDocument(
    parsed.documentType,
    parsed.documentId,
  );
  assertExpectedVersion(document.version, parsed.expectedVersion);
  const task = editorialReviewTaskFromRequest(parsed);
  if (task.dueAt && new Date(task.dueAt) <= new Date()) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Editorial review due date must be in the future",
    );
  }
  await assertEditorialReviewTaskParticipants(task);
  const current = deriveEditorialReviewState(
    document,
    await listEditorialReviewEvents(parsed.documentType, parsed.documentId),
  );

  if (
    current.reviewVersion === document.version &&
    current.status === "requested"
  ) {
    if (isEquivalentEditorialReviewRequest(current, parsed, actor.userId)) {
      return getEditorialReviewState(parsed);
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

  const occurredAt = new Date();
  const db = createDb();
  await db.batch([
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `${parsed.documentType}.review_requested`,
      entityType: document.documentType,
      entityId: document.documentId,
      before: null,
      after: {
        note: parsed.note,
        version: document.version,
        ...task,
        completedChecklistItemIds: [],
      },
      requestId: actor.requestId ?? "",
      createdAt: occurredAt,
    }),
    db
      .insert(cmsOutboxEvents)
      .values(
        editorialReviewRequestedOutboxValues({
          actorUserId: actor.userId,
          documentId: document.documentId,
          documentType: document.documentType,
          occurredAt,
          task,
          version: document.version,
        }),
      )
      .onConflictDoNothing({ target: cmsOutboxEvents.idempotencyKey }),
  ]);

  return getEditorialReviewState(parsed);
}

export async function decideEditorialReview(
  input: z.infer<typeof decideEditorialReviewInputSchema>,
  actor: CmsActor,
) {
  const parsed = decideEditorialReviewInputSchema.parse(input);
  const document = await loadEditorialDocument(
    parsed.documentType,
    parsed.documentId,
  );
  assertExpectedVersion(document.version, parsed.expectedVersion);
  const current = deriveEditorialReviewState(
    document,
    await listEditorialReviewEvents(parsed.documentType, parsed.documentId),
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
            documentType: parsed.documentType,
            documentId: parsed.documentId,
            version: document.version,
            stageId: parsed.stageId,
          },
          actor,
        )
      : null;
  if (
    parsed.decision === "approved" &&
    !workflowDecision?.progress.policy &&
    current.status === "approved"
  ) {
    return getEditorialReviewState(input);
  }
  if (
    workflowDecision?.progress.stages
      .find((stage) => stage.id === workflowDecision.stageId)
      ?.actorIds.includes(actor.userId)
  ) {
    return getEditorialReviewState(input);
  }

  await recordContentAudit({
    action: `${parsed.documentType}.review_${parsed.decision}`,
    actor,
    after: {
      note: parsed.note,
      version: document.version,
      completedChecklistItemIds: parsed.completedChecklistItemIds,
      ...(workflowDecision ? { stageId: workflowDecision.stageId } : {}),
    },
    before: { status: current.status, version: current.reviewVersion },
    entityId: document.documentId,
    entityType: document.documentType,
  });

  return getEditorialReviewState(parsed);
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
) {
  const filters = editorialReviewQueueInputSchema.parse(input);
  const db = createDb();
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
        ]),
      ),
    )
    .orderBy(desc(rankedReviewEvents.createdAt))
    .limit(100);
  const documents = await Promise.all(
    events.map(async (event) => {
      const documentType = editorialDocumentTypeSchema.safeParse(
        event.entityType,
      );
      if (!documentType.success) return null;
      try {
        const document = await loadEditorialDocument(
          documentType.data,
          event.entityId,
        );
        const payload = reviewPayloadSchema.safeParse(event.after);
        if (!payload.success) return null;
        return {
          ...(await getEditorialReviewState({
            documentType: documentType.data,
            documentId: event.entityId,
          })),
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
