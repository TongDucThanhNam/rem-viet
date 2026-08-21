import {
  normalizeCmsCollaborationTarget,
  type CmsCollaborationTarget,
  type CmsCommentReply,
  type CmsCommentThread,
} from "@agency/cms-collaboration";
import { createDb } from "@rem-viet/db";
import { user } from "@rem-viet/db/schema/auth";
import { cmsOutboxEvents } from "@rem-viet/db/schema/automation";
import { pages, posts } from "@rem-viet/db/schema/content";
import {
  auditEvents,
  cmsCommentMutations,
  cmsCommentReplies,
  cmsCommentThreads,
  staffRoles,
} from "@rem-viet/db/schema/governance";
import { and, asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { ContentWorkflowError, type CmsActor } from "./content-revisions";
import { editorialDocumentTypeSchema } from "./editorial-reviews";

const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const fieldPathPattern =
  /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const maximumRepliesPerThread = 200;
const retentionMilliseconds = 90 * 24 * 60 * 60 * 1_000;

const identitySchema = z.string().trim().min(1).max(128).regex(identityPattern);
const commentBodySchema = z.string().trim().min(1).max(5_000);
const mentionIdsSchema = z
  .array(identitySchema)
  .max(50)
  .default([])
  .transform((values) => [...new Set(values)].sort());
const operationIdSchema = z.string().uuid();

const optionalAnchorSchema = z
  .string()
  .trim()
  .max(256)
  .nullable()
  .optional()
  .transform((value) => value || null);

export const editorialCommentTargetSchema = z
  .object({
    documentType: editorialDocumentTypeSchema,
    documentId: identitySchema,
    fieldPath: optionalAnchorSchema,
    blockId: optionalAnchorSchema,
  })
  .superRefine((value, context) => {
    if (value.fieldPath && !fieldPathPattern.test(value.fieldPath)) {
      context.addIssue({
        code: "custom",
        message: "Field path is invalid",
        path: ["fieldPath"],
      });
    }
    if (value.blockId && !identityPattern.test(value.blockId)) {
      context.addIssue({
        code: "custom",
        message: "Block ID is invalid",
        path: ["blockId"],
      });
    }
    if (value.blockId && !value.fieldPath) {
      context.addIssue({
        code: "custom",
        message: "A block anchor requires a field path",
        path: ["blockId"],
      });
    }
  });

export const listEditorialCommentsInputSchema = editorialCommentTargetSchema
  .extend({
    status: z.enum(["open", "resolved"]).optional(),
    limit: z.number().int().min(1).max(50).default(50),
  })
  .superRefine((value, context) => {
    if (value.blockId && !value.fieldPath) {
      context.addIssue({
        code: "custom",
        message: "A block anchor requires a field path",
        path: ["blockId"],
      });
    }
  });

export const createEditorialCommentInputSchema = editorialCommentTargetSchema
  .extend({
    body: commentBodySchema,
    mentionIds: mentionIdsSchema,
    operationId: operationIdSchema,
  })
  .superRefine((value, context) => {
    if (value.blockId && !value.fieldPath) {
      context.addIssue({
        code: "custom",
        message: "A block anchor requires a field path",
        path: ["blockId"],
      });
    }
  });

export const replyEditorialCommentInputSchema = z.object({
  threadId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  body: commentBodySchema,
  mentionIds: mentionIdsSchema,
  operationId: operationIdSchema,
});

export const setEditorialCommentResolvedInputSchema = z.object({
  threadId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  resolved: z.boolean(),
  operationId: operationIdSchema,
});

type CommentDatabase = ReturnType<typeof createDb>;

export type EditorialCommentRuntime = {
  db?: CommentDatabase;
  now?: () => Date;
  createId?: () => string;
};

export type EditorialCommentThread = CmsCommentThread &
  Readonly<{
    updatedAt: string;
    version: number;
  }>;

type MutationAction = "created" | "replied" | "resolved" | "reopened";

function runtimeValues(runtime?: EditorialCommentRuntime) {
  return {
    db: runtime?.db ?? createDb(),
    now: runtime?.now ?? (() => new Date()),
    createId: runtime?.createId ?? (() => crypto.randomUUID()),
  };
}

function collectionForDocumentType(documentType: "page" | "post") {
  return documentType;
}

function collaborationTarget(input: {
  documentType: "page" | "post";
  documentId: string;
  fieldPath?: string | null;
  blockId?: string | null;
}): CmsCollaborationTarget {
  return normalizeCmsCollaborationTarget({
    collection: collectionForDocumentType(input.documentType),
    documentId: input.documentId,
    locale: null,
    fieldPath: input.fieldPath ?? null,
    blockId: input.blockId ?? null,
  });
}

function toIso(value: Date) {
  return new Date(value).toISOString();
}

function normalizeStoredMentions(value: unknown) {
  return mentionIdsSchema.parse(value);
}

async function payloadHash(value: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function assertDocumentExists(
  db: CommentDatabase,
  input: { documentType: "page" | "post"; documentId: string },
) {
  const rows =
    input.documentType === "page"
      ? await db
          .select({ id: pages.id })
          .from(pages)
          .where(eq(pages.id, input.documentId))
          .limit(1)
      : await db
          .select({ id: posts.id })
          .from(posts)
          .where(eq(posts.id, input.documentId))
          .limit(1);
  if (!rows[0]) {
    throw new ContentWorkflowError(
      "NOT_FOUND",
      `${input.documentType === "page" ? "Page" : "Post"} not found`,
    );
  }
}

async function assertMentionParticipants(
  db: CommentDatabase,
  mentionIds: readonly string[],
) {
  if (!mentionIds.length) return;
  const rows = await db
    .select({ id: staffRoles.userId })
    .from(staffRoles)
    .innerJoin(user, eq(user.id, staffRoles.userId))
    .where(inArray(staffRoles.userId, [...mentionIds]));
  const known = new Set(rows.map((row) => row.id));
  const missing = mentionIds.filter((id) => !known.has(id));
  if (missing.length) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Unknown or inactive comment participant: ${missing.join(", ")}`,
    );
  }
}

async function listThreadRows(
  db: CommentDatabase,
  input: {
    documentType: "page" | "post";
    documentId: string;
    fieldPath?: string | null;
    blockId?: string | null;
    status?: "open" | "resolved";
    limit: number;
  },
) {
  const predicates = [
    eq(cmsCommentThreads.documentType, input.documentType),
    eq(cmsCommentThreads.documentId, input.documentId),
  ];
  if (input.fieldPath !== undefined && input.fieldPath !== null) {
    predicates.push(eq(cmsCommentThreads.fieldPath, input.fieldPath));
  }
  if (input.blockId !== undefined && input.blockId !== null) {
    predicates.push(eq(cmsCommentThreads.blockId, input.blockId));
  }
  if (input.status) predicates.push(eq(cmsCommentThreads.status, input.status));
  return db
    .select()
    .from(cmsCommentThreads)
    .where(and(...predicates))
    .orderBy(
      asc(cmsCommentThreads.status),
      desc(cmsCommentThreads.updatedAt),
      desc(cmsCommentThreads.id),
    )
    .limit(input.limit);
}

async function hydrateThreads(
  db: CommentDatabase,
  threadRows: Array<typeof cmsCommentThreads.$inferSelect>,
): Promise<EditorialCommentThread[]> {
  if (!threadRows.length) return [];
  const replyRows = await db
    .select()
    .from(cmsCommentReplies)
    .where(
      inArray(
        cmsCommentReplies.threadId,
        threadRows.map((row) => row.id),
      ),
    )
    .orderBy(asc(cmsCommentReplies.createdAt), asc(cmsCommentReplies.id))
    .limit(threadRows.length * maximumRepliesPerThread);
  const repliesByThread = new Map<string, CmsCommentReply[]>();
  for (const reply of replyRows) {
    const replies = repliesByThread.get(reply.threadId) ?? [];
    replies.push(
      Object.freeze({
        id: reply.id,
        authorId: reply.authorId,
        body: reply.body,
        mentions: normalizeStoredMentions(reply.mentions),
        createdAt: toIso(reply.createdAt),
      }),
    );
    repliesByThread.set(reply.threadId, replies);
  }
  return threadRows.map((thread) =>
    Object.freeze({
      id: thread.id,
      target: collaborationTarget(thread),
      authorId: thread.authorId,
      body: thread.body,
      mentions: normalizeStoredMentions(thread.mentions),
      createdAt: toIso(thread.createdAt),
      status: thread.status,
      resolvedAt: thread.resolvedAt ? toIso(thread.resolvedAt) : null,
      resolvedBy: thread.resolvedBy,
      replies: Object.freeze(repliesByThread.get(thread.id) ?? []),
      updatedAt: toIso(thread.updatedAt),
      version: thread.version,
    }),
  );
}

async function getThread(
  db: CommentDatabase,
  threadId: string,
): Promise<EditorialCommentThread> {
  const [row] = await db
    .select()
    .from(cmsCommentThreads)
    .where(eq(cmsCommentThreads.id, threadId))
    .limit(1);
  if (!row) {
    throw new ContentWorkflowError("NOT_FOUND", "Comment thread not found");
  }
  return (await hydrateThreads(db, [row]))[0]!;
}

async function exactReplay(
  db: CommentDatabase,
  input: {
    operationId: string;
    action: MutationAction;
    actorId: string;
    hash: string;
  },
) {
  const [mutation] = await db
    .select()
    .from(cmsCommentMutations)
    .where(eq(cmsCommentMutations.operationId, input.operationId))
    .limit(1);
  if (!mutation) return null;
  if (
    mutation.action !== input.action ||
    mutation.actorId !== input.actorId ||
    mutation.payloadHash !== input.hash
  ) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Comment operation ID was already used with different input",
    );
  }
  return getThread(db, mutation.threadId);
}

function auditInsertSelect(
  db: CommentDatabase,
  input: {
    operationId: string;
    auditId: string;
    actor: CmsActor;
    action: string;
    entityType: "page" | "post";
    entityId: string;
    before: unknown;
    after: unknown;
    occurredAt: Date;
  },
) {
  return db.insert(auditEvents).select(
    db
      .select({
        id: sql<string>`${input.auditId}`.as("id"),
        actorUserId: sql<string>`${input.actor.userId}`.as("actor_user_id"),
        actorEmail: sql<string>`${input.actor.email}`.as("actor_email"),
        actorRole: sql<
          "owner" | "admin" | "editor" | "system"
        >`${input.actor.role}`.as("actor_role"),
        action: sql<string>`${input.action}`.as("action"),
        entityType: sql<string>`${input.entityType}`.as("entity_type"),
        entityId: sql<string>`${input.entityId}`.as("entity_id"),
        before: sql<unknown>`${JSON.stringify(input.before)}`.as("before"),
        after: sql<unknown>`${JSON.stringify(input.after)}`.as("after"),
        requestId: sql<string>`${input.actor.requestId ?? ""}`.as("request_id"),
        createdAt: sql<Date>`${input.occurredAt.getTime()}`.as("created_at"),
      })
      .from(cmsCommentMutations)
      .where(eq(cmsCommentMutations.operationId, input.operationId)),
  );
}

function outboxInsertSelect(
  db: CommentDatabase,
  input: {
    operationId: string;
    outboxId: string;
    topic: string;
    threadId: string;
    aggregateVersion: number;
    payload: unknown;
    occurredAt: Date;
  },
) {
  return db
    .insert(cmsOutboxEvents)
    .select(
      db
        .select({
          id: sql<string>`${input.outboxId}`.as("id"),
          topic: sql<string>`${input.topic}`.as("topic"),
          aggregateType: sql<string>`${"comment_thread"}`.as("aggregate_type"),
          aggregateId: sql<string>`${input.threadId}`.as("aggregate_id"),
          aggregateVersion: sql<number>`${input.aggregateVersion}`.as(
            "aggregate_version",
          ),
          payload: sql<unknown>`${JSON.stringify(input.payload)}`.as("payload"),
          idempotencyKey:
            sql<string>`${`${input.topic}:${input.operationId}`}`.as(
              "idempotency_key",
            ),
          status: sql<"pending">`${"pending"}`.as("status"),
          attempts: sql<number>`0`.as("attempts"),
          maxAttempts: sql<number>`8`.as("max_attempts"),
          availableAt: sql<Date>`${input.occurredAt.getTime()}`.as(
            "available_at",
          ),
          lockedUntil: sql<Date | null>`null`.as("locked_until"),
          lockToken: sql<string | null>`null`.as("lock_token"),
          lastError: sql<string>`''`.as("last_error"),
          occurredAt: sql<Date>`${input.occurredAt.getTime()}`.as(
            "occurred_at",
          ),
          dispatchedAt: sql<Date | null>`null`.as("dispatched_at"),
          retentionUntil: sql<Date>`${
            input.occurredAt.getTime() + retentionMilliseconds
          }`.as("retention_until"),
        })
        .from(cmsCommentMutations)
        .where(eq(cmsCommentMutations.operationId, input.operationId)),
    )
    .onConflictDoNothing({ target: cmsOutboxEvents.idempotencyKey });
}

function notificationPayload(input: {
  actorUserId: string;
  documentId: string;
  documentType: "page" | "post";
  fieldPath?: string | null;
  blockId?: string | null;
  threadId: string;
  notificationRecipientIds: readonly string[];
}) {
  return {
    actorUserId: input.actorUserId,
    documentId: input.documentId,
    documentType: input.documentType,
    fieldPath: input.fieldPath ?? null,
    blockId: input.blockId ?? null,
    threadId: input.threadId,
    notificationRecipientIds: [...new Set(input.notificationRecipientIds)]
      .filter((id) => id !== input.actorUserId)
      .sort(),
  };
}

export async function listEditorialComments(
  input: z.input<typeof listEditorialCommentsInputSchema>,
  runtime?: EditorialCommentRuntime,
) {
  const parsed = listEditorialCommentsInputSchema.parse(input);
  const { db } = runtimeValues(runtime);
  await assertDocumentExists(db, parsed);
  return hydrateThreads(db, await listThreadRows(db, parsed));
}

export async function createEditorialComment(
  input: z.input<typeof createEditorialCommentInputSchema>,
  actor: CmsActor,
  runtime?: EditorialCommentRuntime,
) {
  const parsed = createEditorialCommentInputSchema.parse(input);
  const target = collaborationTarget(parsed);
  const hash = await payloadHash({
    target,
    body: parsed.body,
    mentionIds: parsed.mentionIds,
  });
  const { db, now, createId } = runtimeValues(runtime);
  const replay = await exactReplay(db, {
    operationId: parsed.operationId,
    action: "created",
    actorId: actor.userId,
    hash,
  });
  if (replay) return replay;
  await assertDocumentExists(db, parsed);
  await assertMentionParticipants(db, parsed.mentionIds);

  const occurredAt = now();
  const threadId = createId();
  const topic = "content.comment.created";
  const mutation = {
    operationId: parsed.operationId,
    threadId,
    action: "created" as const,
    actorId: actor.userId,
    payloadHash: hash,
    resultingVersion: 1,
    createdAt: occurredAt,
  } satisfies typeof cmsCommentMutations.$inferInsert;
  try {
    await db.batch([
      db.insert(cmsCommentThreads).values({
        id: threadId,
        documentType: parsed.documentType,
        documentId: parsed.documentId,
        locale: "",
        fieldPath: parsed.fieldPath ?? "",
        blockId: parsed.blockId ?? "",
        authorId: actor.userId,
        body: parsed.body,
        mentions: parsed.mentionIds,
        status: "open",
        resolvedAt: null,
        resolvedBy: null,
        version: 1,
        lastOperationId: parsed.operationId,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }),
      db.insert(cmsCommentMutations).values(mutation),
      auditInsertSelect(db, {
        operationId: parsed.operationId,
        auditId: createId(),
        actor,
        action: `${parsed.documentType}.comment_created`,
        entityType: parsed.documentType,
        entityId: parsed.documentId,
        before: null,
        after: {
          threadId,
          version: 1,
          fieldPath: parsed.fieldPath,
          blockId: parsed.blockId,
          mentionIds: parsed.mentionIds,
        },
        occurredAt,
      }),
      outboxInsertSelect(db, {
        operationId: parsed.operationId,
        outboxId: createId(),
        topic,
        threadId,
        aggregateVersion: 1,
        payload: notificationPayload({
          actorUserId: actor.userId,
          documentId: parsed.documentId,
          documentType: parsed.documentType,
          fieldPath: parsed.fieldPath,
          blockId: parsed.blockId,
          threadId,
          notificationRecipientIds: parsed.mentionIds,
        }),
        occurredAt,
      }),
    ]);
  } catch (error) {
    const concurrentReplay = await exactReplay(db, {
      operationId: parsed.operationId,
      action: "created",
      actorId: actor.userId,
      hash,
    });
    if (concurrentReplay) return concurrentReplay;
    throw error;
  }
  return getThread(db, threadId);
}

export async function replyEditorialComment(
  input: z.input<typeof replyEditorialCommentInputSchema>,
  actor: CmsActor,
  runtime?: EditorialCommentRuntime,
) {
  const parsed = replyEditorialCommentInputSchema.parse(input);
  const hash = await payloadHash({
    threadId: parsed.threadId,
    expectedVersion: parsed.expectedVersion,
    body: parsed.body,
    mentionIds: parsed.mentionIds,
  });
  const { db, now, createId } = runtimeValues(runtime);
  const replay = await exactReplay(db, {
    operationId: parsed.operationId,
    action: "replied",
    actorId: actor.userId,
    hash,
  });
  if (replay) return replay;
  const current = await getThread(db, parsed.threadId);
  if (current.status === "resolved") {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Resolved comment threads cannot receive replies",
    );
  }
  if (current.version !== parsed.expectedVersion) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Comment thread changed from v${parsed.expectedVersion} to v${current.version}`,
    );
  }
  if (current.replies.length >= maximumRepliesPerThread) {
    throw new ContentWorkflowError("CONFLICT", "Comment reply limit exceeded");
  }
  await assertMentionParticipants(db, parsed.mentionIds);

  const occurredAt = now();
  const replyId = createId();
  const resultingVersion = parsed.expectedVersion + 1;
  const topic = "content.comment.replied";
  const eligibleThread = and(
    eq(cmsCommentThreads.id, parsed.threadId),
    eq(cmsCommentThreads.status, "open"),
    eq(cmsCommentThreads.version, parsed.expectedVersion),
    sql`(select count(*) from ${cmsCommentReplies} where ${cmsCommentReplies.threadId} = ${cmsCommentThreads.id}) < ${maximumRepliesPerThread}`,
  );
  try {
    await db.batch([
      db.insert(cmsCommentMutations).select(
        db
          .select({
            operationId: sql<string>`${parsed.operationId}`.as("operation_id"),
            threadId: cmsCommentThreads.id,
            action: sql<"replied">`${"replied"}`.as("action"),
            actorId: sql<string>`${actor.userId}`.as("actor_id"),
            payloadHash: sql<string>`${hash}`.as("payload_hash"),
            resultingVersion: sql<number>`${resultingVersion}`.as(
              "resulting_version",
            ),
            createdAt: sql<Date>`${occurredAt.getTime()}`.as("created_at"),
          })
          .from(cmsCommentThreads)
          .where(eligibleThread),
      ),
      db.insert(cmsCommentReplies).select(
        db
          .select({
            id: sql<string>`${replyId}`.as("id"),
            threadId: cmsCommentMutations.threadId,
            authorId: sql<string>`${actor.userId}`.as("author_id"),
            body: sql<string>`${parsed.body}`.as("body"),
            mentions: sql<string>`${JSON.stringify(parsed.mentionIds)}`.as(
              "mentions",
            ),
            createdAt: sql<Date>`${occurredAt.getTime()}`.as("created_at"),
          })
          .from(cmsCommentMutations)
          .where(eq(cmsCommentMutations.operationId, parsed.operationId)),
      ),
      db
        .update(cmsCommentThreads)
        .set({
          version: resultingVersion,
          lastOperationId: parsed.operationId,
          updatedAt: occurredAt,
        })
        .where(
          and(
            eligibleThread,
            exists(
              db
                .select({ operationId: cmsCommentMutations.operationId })
                .from(cmsCommentMutations)
                .where(eq(cmsCommentMutations.operationId, parsed.operationId)),
            ),
          ),
        ),
      auditInsertSelect(db, {
        operationId: parsed.operationId,
        auditId: createId(),
        actor,
        action: `${current.target.collection}.comment_replied`,
        entityType: current.target.collection as "page" | "post",
        entityId: current.target.documentId,
        before: { threadId: current.id, version: current.version },
        after: {
          threadId: current.id,
          replyId,
          version: resultingVersion,
          mentionIds: parsed.mentionIds,
        },
        occurredAt,
      }),
      outboxInsertSelect(db, {
        operationId: parsed.operationId,
        outboxId: createId(),
        topic,
        threadId: current.id,
        aggregateVersion: resultingVersion,
        payload: notificationPayload({
          actorUserId: actor.userId,
          documentId: current.target.documentId,
          documentType: current.target.collection as "page" | "post",
          fieldPath: current.target.fieldPath,
          blockId: current.target.blockId,
          threadId: current.id,
          notificationRecipientIds: [
            current.authorId,
            ...current.mentions,
            ...parsed.mentionIds,
          ],
        }),
        occurredAt,
      }),
    ]);
  } catch (error) {
    const concurrentReplay = await exactReplay(db, {
      operationId: parsed.operationId,
      action: "replied",
      actorId: actor.userId,
      hash,
    });
    if (concurrentReplay) return concurrentReplay;
    throw error;
  }
  const mutationReplay = await exactReplay(db, {
    operationId: parsed.operationId,
    action: "replied",
    actorId: actor.userId,
    hash,
  });
  if (mutationReplay) return mutationReplay;
  const latest = await getThread(db, parsed.threadId);
  if (latest.replies.length >= maximumRepliesPerThread) {
    throw new ContentWorkflowError("CONFLICT", "Comment reply limit exceeded");
  }
  throw new ContentWorkflowError(
    "CONFLICT",
    `Comment thread changed from v${parsed.expectedVersion} to v${latest.version}`,
  );
}

export async function setEditorialCommentResolved(
  input: z.input<typeof setEditorialCommentResolvedInputSchema>,
  actor: CmsActor,
  runtime?: EditorialCommentRuntime,
) {
  const parsed = setEditorialCommentResolvedInputSchema.parse(input);
  const action = parsed.resolved ? "resolved" : "reopened";
  const hash = await payloadHash({
    threadId: parsed.threadId,
    expectedVersion: parsed.expectedVersion,
    resolved: parsed.resolved,
  });
  const { db, now, createId } = runtimeValues(runtime);
  const replay = await exactReplay(db, {
    operationId: parsed.operationId,
    action,
    actorId: actor.userId,
    hash,
  });
  if (replay) return replay;
  const current = await getThread(db, parsed.threadId);
  if (current.version !== parsed.expectedVersion) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Comment thread changed from v${parsed.expectedVersion} to v${current.version}`,
    );
  }
  const expectedStatus = parsed.resolved ? "open" : "resolved";
  if (current.status !== expectedStatus) {
    throw new ContentWorkflowError(
      "CONFLICT",
      parsed.resolved
        ? "Comment thread is already resolved"
        : "Comment thread is already open",
    );
  }

  const occurredAt = now();
  const resultingVersion = parsed.expectedVersion + 1;
  const topic = `content.comment.${action}`;
  const eligibleThread = and(
    eq(cmsCommentThreads.id, parsed.threadId),
    eq(cmsCommentThreads.status, expectedStatus),
    eq(cmsCommentThreads.version, parsed.expectedVersion),
  );
  try {
    await db.batch([
      db.insert(cmsCommentMutations).select(
        db
          .select({
            operationId: sql<string>`${parsed.operationId}`.as("operation_id"),
            threadId: cmsCommentThreads.id,
            action: sql<"resolved" | "reopened">`${action}`.as("action"),
            actorId: sql<string>`${actor.userId}`.as("actor_id"),
            payloadHash: sql<string>`${hash}`.as("payload_hash"),
            resultingVersion: sql<number>`${resultingVersion}`.as(
              "resulting_version",
            ),
            createdAt: sql<Date>`${occurredAt.getTime()}`.as("created_at"),
          })
          .from(cmsCommentThreads)
          .where(eligibleThread),
      ),
      db
        .update(cmsCommentThreads)
        .set({
          status: parsed.resolved ? "resolved" : "open",
          resolvedAt: parsed.resolved ? occurredAt : null,
          resolvedBy: parsed.resolved ? actor.userId : null,
          version: resultingVersion,
          lastOperationId: parsed.operationId,
          updatedAt: occurredAt,
        })
        .where(
          and(
            eligibleThread,
            exists(
              db
                .select({ operationId: cmsCommentMutations.operationId })
                .from(cmsCommentMutations)
                .where(eq(cmsCommentMutations.operationId, parsed.operationId)),
            ),
          ),
        ),
      auditInsertSelect(db, {
        operationId: parsed.operationId,
        auditId: createId(),
        actor,
        action: `${current.target.collection}.comment_${action}`,
        entityType: current.target.collection as "page" | "post",
        entityId: current.target.documentId,
        before: {
          threadId: current.id,
          status: current.status,
          version: current.version,
        },
        after: {
          threadId: current.id,
          status: parsed.resolved ? "resolved" : "open",
          version: resultingVersion,
        },
        occurredAt,
      }),
      outboxInsertSelect(db, {
        operationId: parsed.operationId,
        outboxId: createId(),
        topic,
        threadId: current.id,
        aggregateVersion: resultingVersion,
        payload: notificationPayload({
          actorUserId: actor.userId,
          documentId: current.target.documentId,
          documentType: current.target.collection as "page" | "post",
          fieldPath: current.target.fieldPath,
          blockId: current.target.blockId,
          threadId: current.id,
          notificationRecipientIds: [current.authorId],
        }),
        occurredAt,
      }),
    ]);
  } catch (error) {
    const concurrentReplay = await exactReplay(db, {
      operationId: parsed.operationId,
      action,
      actorId: actor.userId,
      hash,
    });
    if (concurrentReplay) return concurrentReplay;
    throw error;
  }
  const mutationReplay = await exactReplay(db, {
    operationId: parsed.operationId,
    action,
    actorId: actor.userId,
    hash,
  });
  if (mutationReplay) return mutationReplay;
  const latest = await getThread(db, parsed.threadId);
  throw new ContentWorkflowError(
    "CONFLICT",
    `Comment thread changed from v${parsed.expectedVersion} to v${latest.version}`,
  );
}
