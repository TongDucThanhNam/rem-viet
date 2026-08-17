import {
  formDefinitionSchema,
  formSubmissionStatusSchema,
  internalPathSchema,
  publicFormSubmissionSchema,
  redirectStatusCodeSchema,
  wouldCreateRedirectLoop,
  type FormDefinition,
  type PublicFormSubmission,
  type StaffRole,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  formDefinitions,
  formSubmissions,
  redirects,
} from "@rem-viet/db/schema/content";
import { auditEvents } from "@rem-viet/db/schema/governance";
import { env } from "@rem-viet/env/server";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { z } from "zod";

import {
  notificationRuntimeStatus,
  sendLeadNotifications,
  type NotificationResult,
} from "./notifications";
import { reportOperationalIncident } from "./incidents";

type OperationsActor = {
  userId: string;
  email: string;
  role: StaffRole | "system";
  requestId?: string;
};

const systemActor: OperationsActor = {
  userId: "",
  email: "",
  role: "system",
};

export const redirectIdInputSchema = z.object({
  redirectId: z.string().min(1),
});
export const redirectPathInputSchema = z.object({ path: internalPathSchema });
export const createRedirectInputSchema = z.object({
  oldPath: internalPathSchema,
  newPath: internalPathSchema,
  statusCode: redirectStatusCodeSchema.optional().default(301),
  active: z.boolean().optional().default(true),
});
export const updateRedirectInputSchema = z.object({
  redirectId: z.string().min(1),
  oldPath: internalPathSchema.optional(),
  newPath: internalPathSchema.optional(),
  statusCode: redirectStatusCodeSchema.optional(),
  active: z.boolean().optional(),
});

export const formDefinitionKeyInputSchema = z.object({
  key: z.string().min(1),
});
export const upsertFormDefinitionInputSchema = formDefinitionSchema;
export const listSubmissionsInputSchema = z
  .object({
    status: formSubmissionStatusSchema.optional(),
    formKey: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .optional();
export const updateSubmissionInputSchema = z.object({
  submissionId: z.string().min(1),
  status: formSubmissionStatusSchema.optional(),
  internalNote: z.string().max(5000).optional(),
});
export const deleteSubmissionInputSchema = z.object({
  submissionId: z.string().min(1),
});
export const retrySubmissionNotificationInputSchema = z.object({
  submissionId: z.string().min(1),
});

const notificationRetryDelaysMs = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
] as const;
const notificationRetryWindowMs = 23 * 60 * 60_000;
const maxNotificationAttempts = notificationRetryDelaysMs.length + 1;

type StoredNotificationState = {
  adapters: NotificationResult[];
  attemptCount: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
};

function readNotificationState(value: Record<string, unknown>) {
  const rawAdapters = Array.isArray(value.adapters) ? value.adapters : [];
  const adapters = rawAdapters.filter(
    (item): item is NotificationResult =>
      typeof item === "object" &&
      item !== null &&
      (item as NotificationResult).adapter !== undefined &&
      ["email", "telegram"].includes((item as NotificationResult).adapter) &&
      ["sent", "skipped", "failed"].includes(
        (item as NotificationResult).status,
      ),
  );
  return {
    adapters,
    attemptCount:
      typeof value.attemptCount === "number" && value.attemptCount >= 0
        ? Math.floor(value.attemptCount)
        : adapters.length
          ? 1
          : 0,
    ...(typeof value.lastAttemptAt === "string" && {
      lastAttemptAt: value.lastAttemptAt,
    }),
    ...(typeof value.nextRetryAt === "string" && {
      nextRetryAt: value.nextRetryAt,
    }),
  } satisfies StoredNotificationState;
}

export function mergeNotificationResults(
  previous: NotificationResult[],
  latest: NotificationResult[],
) {
  const merged = new Map(previous.map((item) => [item.adapter, item]));
  for (const item of latest) {
    const existing = merged.get(item.adapter);
    if (item.status === "skipped" && existing?.status === "failed") continue;
    merged.set(item.adapter, item);
  }
  return [...merged.values()];
}

function summarizeNotificationResults(results: NotificationResult[]) {
  const failed = results.some((item) => item.status === "failed");
  const sent = results.some((item) => item.status === "sent");
  return {
    status: failed
      ? ("failed" as const)
      : sent
        ? ("sent" as const)
        : ("skipped" as const),
    sent,
    error: results
      .filter((item) => item.status === "failed")
      .map((item) => item.error)
      .filter(Boolean)
      .join("; "),
  };
}

export function nextNotificationRetryAt(
  results: NotificationResult[],
  attemptCount: number,
  now: Date,
  createdAt: Date,
) {
  const emailFailed = results.some(
    (item) => item.adapter === "email" && item.status === "failed",
  );
  if (
    !emailFailed ||
    attemptCount >= maxNotificationAttempts ||
    now.getTime() - createdAt.getTime() >= notificationRetryWindowMs
  )
    return undefined;
  const delay = notificationRetryDelaysMs[Math.max(0, attemptCount - 1)];
  return delay ? new Date(now.getTime() + delay).toISOString() : undefined;
}

function normalizePath(path: string) {
  const normalized = path !== "/" ? path.replace(/\/+$/, "") : path;
  return normalized || "/";
}

async function recordAudit(input: {
  action: string;
  entityType: "redirect" | "form_definition" | "form_submission" | "system";
  entityId: string;
  actor?: OperationsActor;
  before?: unknown;
  after?: unknown;
}) {
  const actor = input.actor ?? systemActor;
  await createDb()
    .insert(auditEvents)
    .values({
      id: crypto.randomUUID(),
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? null,
      requestId: actor.requestId ?? "",
      createdAt: new Date(),
    });
}

async function assertRedirectGraph(
  oldPath: string,
  newPath: string,
  exceptId?: string,
) {
  const rows = await createDb()
    .select()
    .from(redirects)
    .where(eq(redirects.active, true));
  if (wouldCreateRedirectLoop(rows, { oldPath, newPath, exceptId })) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        oldPath === newPath
          ? "Redirect không thể trỏ về chính nó."
          : "Redirect tạo thành vòng lặp.",
    });
  }
}

export async function validateRedirectGraph(oldPath: string, newPath: string) {
  const normalizedOldPath = normalizePath(oldPath);
  const normalizedNewPath = normalizePath(newPath);
  await assertRedirectGraph(normalizedOldPath, normalizedNewPath);
  return { oldPath: normalizedOldPath, newPath: normalizedNewPath };
}

export async function listRedirects() {
  return createDb().select().from(redirects).orderBy(desc(redirects.updatedAt));
}

export async function resolveRedirect(path: string) {
  const parsed = redirectPathInputSchema.parse({ path: normalizePath(path) });
  const row = await createDb().query.redirects.findFirst({
    where: and(eq(redirects.oldPath, parsed.path), eq(redirects.active, true)),
  });
  return row ?? null;
}

export async function createRedirect(
  input: z.infer<typeof createRedirectInputSchema>,
  actor: OperationsActor = systemActor,
) {
  const { oldPath, newPath } = await validateRedirectGraph(
    input.oldPath,
    input.newPath,
  );
  const [created] = await createDb()
    .insert(redirects)
    .values({
      id: crypto.randomUUID(),
      oldPath,
      newPath,
      statusCode: input.statusCode,
      active: input.active,
      createdBy: actor.userId,
    })
    .returning();
  if (!created) throw new Error("Failed to create redirect");
  await recordAudit({
    action: "redirect.create",
    actor,
    entityType: "redirect",
    entityId: created.id,
    after: created,
  });
  return created;
}

export async function updateRedirect(
  input: z.infer<typeof updateRedirectInputSchema>,
  actor: OperationsActor = systemActor,
) {
  const db = createDb();
  const existing = await db.query.redirects.findFirst({
    where: eq(redirects.id, input.redirectId),
  });
  if (!existing)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Redirect không tồn tại.",
    });
  const oldPath = normalizePath(input.oldPath ?? existing.oldPath);
  const newPath = normalizePath(input.newPath ?? existing.newPath);
  if (input.active ?? existing.active)
    await assertRedirectGraph(oldPath, newPath, existing.id);
  const [updated] = await db
    .update(redirects)
    .set({
      oldPath,
      newPath,
      statusCode: input.statusCode ?? existing.statusCode,
      active: input.active ?? existing.active,
      updatedAt: new Date(),
    })
    .where(eq(redirects.id, existing.id))
    .returning();
  if (!updated) throw new Error("Failed to update redirect");
  await recordAudit({
    action: "redirect.update",
    actor,
    entityType: "redirect",
    entityId: updated.id,
    before: existing,
    after: updated,
  });
  return updated;
}

export async function deleteRedirect(
  input: z.infer<typeof redirectIdInputSchema>,
  actor: OperationsActor = systemActor,
) {
  const [deleted] = await createDb()
    .delete(redirects)
    .where(eq(redirects.id, input.redirectId))
    .returning();
  if (!deleted)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Redirect không tồn tại.",
    });
  await recordAudit({
    action: "redirect.delete",
    actor,
    entityType: "redirect",
    entityId: deleted.id,
    before: deleted,
  });
  return deleted;
}

export async function listFormDefinitions() {
  return createDb()
    .select()
    .from(formDefinitions)
    .orderBy(desc(formDefinitions.updatedAt));
}

export async function upsertFormDefinition(
  input: z.infer<typeof upsertFormDefinitionInputSchema>,
  actor: OperationsActor = systemActor,
) {
  const parsed = formDefinitionSchema.parse(input);
  const db = createDb();
  const existing = await db.query.formDefinitions.findFirst({
    where: eq(formDefinitions.key, parsed.key),
  });
  const id = existing?.id ?? crypto.randomUUID();
  const values = {
    id,
    key: parsed.key,
    name: parsed.name,
    fields: parsed.fields,
    notificationSettings: parsed.notificationSettings,
    active: parsed.active,
    retentionDays: parsed.retentionDays,
    updatedAt: new Date(),
  };
  const [saved] = existing
    ? await db
        .update(formDefinitions)
        .set(values)
        .where(eq(formDefinitions.id, existing.id))
        .returning()
    : await db.insert(formDefinitions).values(values).returning();
  if (!saved) throw new Error("Failed to save form definition");
  await recordAudit({
    action: existing ? "form.update" : "form.create",
    actor,
    entityType: "form_definition",
    entityId: id,
    before: existing,
    after: saved,
  });
  return saved;
}

function validateSubmission(
  definition: FormDefinition,
  submission: PublicFormSubmission,
) {
  const allowed = new Set(definition.fields.map((field) => field.key));
  for (const key of Object.keys(submission.payload)) {
    if (!allowed.has(key))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Trường không hợp lệ: ${key}`,
      });
  }
  for (const field of definition.fields) {
    const value = submission.payload[field.key];
    if (
      field.required &&
      (value === undefined || value === "" || value === false)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${field.label} là bắt buộc.`,
      });
    }
    if (
      field.type === "email" &&
      typeof value === "string" &&
      value &&
      !z.string().email().safeParse(value).success
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${field.label} không đúng định dạng email.`,
      });
    }
  }
}

async function hashIp(ip: string) {
  const secret =
    (env as unknown as Record<string, string | undefined>).BETTER_AUTH_SECRET ??
    "local";
  const bytes = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function submitForm(
  rawInput: unknown,
  metadata: { ip: string; userAgent: string },
) {
  const input = publicFormSubmissionSchema.parse(rawInput);
  if (input.website) return { accepted: true, duplicate: false };
  const db = createDb();
  const definitionRow = await db.query.formDefinitions.findFirst({
    where: and(
      eq(formDefinitions.key, input.formKey),
      eq(formDefinitions.active, true),
    ),
  });
  if (!definitionRow)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Biểu mẫu không hoạt động.",
    });
  const definition = formDefinitionSchema.parse(definitionRow);
  validateSubmission(definition, input);

  if (input.idempotencyKey) {
    const existing = await db.query.formSubmissions.findFirst({
      where: eq(formSubmissions.idempotencyKey, input.idempotencyKey),
    });
    if (existing) return { accepted: true, duplicate: true, id: existing.id };
  }

  const ipHash = await hashIp(metadata.ip);
  const windowStart = new Date(Date.now() - 10 * 60_000);
  const [rate] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formKey, input.formKey),
        eq(formSubmissions.ipHash, ipHash),
        gte(formSubmissions.createdAt, windowStart),
      ),
    );
  if ((rate?.value ?? 0) >= 5)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Bạn gửi quá nhanh. Vui lòng thử lại sau.",
    });

  const id = crypto.randomUUID();
  const insert = db.insert(formSubmissions).values({
    id,
    formId: definitionRow.id,
    formKey: input.formKey,
    payload: input.payload,
    sourcePage: input.sourcePage,
    ipHash,
    userAgent: metadata.userAgent.slice(0, 500),
    idempotencyKey: input.idempotencyKey,
  });
  const [created] = input.idempotencyKey
    ? await insert
        .onConflictDoNothing({ target: formSubmissions.idempotencyKey })
        .returning()
    : await insert.returning();
  if (!created && input.idempotencyKey) {
    const duplicate = await db.query.formSubmissions.findFirst({
      where: eq(formSubmissions.idempotencyKey, input.idempotencyKey),
    });
    if (duplicate) return { accepted: true, duplicate: true, id: duplicate.id };
  }
  if (!created) throw new Error("Failed to save submission");

  const notifications = await sendLeadNotifications({
    definition,
    submission: created,
  });
  const attemptedAt = new Date();
  const notificationSummary = summarizeNotificationResults(notifications);
  const nextRetryAt = nextNotificationRetryAt(
    notifications,
    1,
    attemptedAt,
    created.createdAt,
  );
  await db
    .update(formSubmissions)
    .set({
      notificationStatus: notificationSummary.status,
      notificationResults: {
        adapters: notifications,
        attemptCount: 1,
        lastAttemptAt: attemptedAt.toISOString(),
        ...(nextRetryAt && { nextRetryAt }),
      },
      notifiedAt: notificationSummary.sent ? attemptedAt : null,
      notificationError: notificationSummary.error,
      updatedAt: attemptedAt,
    })
    .where(eq(formSubmissions.id, id));
  if (notificationSummary.status === "failed") {
    reportOperationalIncident({
      category: "notification",
      operation: "lead.notification.initial",
      source: "request",
      error: new Error(
        notificationSummary.error || "Lead notification delivery failed",
      ),
      entityType: "form_submission",
      entityId: id,
      recoverable: Boolean(nextRetryAt),
      detail: {
        failedAdapters: notifications.filter(
          (notification) => notification.status === "failed",
        ).length,
        retryScheduled: Boolean(nextRetryAt),
      },
    });
  }
  await recordAudit({
    action:
      notificationSummary.status === "failed"
        ? "form_submission.notification_failed"
        : "form_submission.create",
    entityType: "form_submission",
    entityId: id,
    after: {
      formKey: input.formKey,
      notificationStatus: notificationSummary.status,
    },
  });
  return { accepted: true, duplicate: false, id };
}

export async function listSubmissions(
  input: z.infer<typeof listSubmissionsInputSchema> = { limit: 100 },
) {
  const conditions = [
    ...(input?.status ? [eq(formSubmissions.status, input.status)] : []),
    ...(input?.formKey ? [eq(formSubmissions.formKey, input.formKey)] : []),
  ];
  return createDb()
    .select()
    .from(formSubmissions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(formSubmissions.createdAt))
    .limit(input?.limit ?? 100);
}

export async function updateSubmission(
  input: z.infer<typeof updateSubmissionInputSchema>,
  actor: OperationsActor = systemActor,
) {
  const db = createDb();
  const existing = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, input.submissionId),
  });
  if (!existing)
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead không tồn tại." });
  const [updated] = await db
    .update(formSubmissions)
    .set({
      ...(input.status && { status: input.status }),
      ...(input.internalNote !== undefined && {
        internalNote: input.internalNote,
      }),
      updatedAt: new Date(),
    })
    .where(eq(formSubmissions.id, input.submissionId))
    .returning();
  if (!updated) throw new Error("Failed to update lead");
  await recordAudit({
    action: "form_submission.update",
    actor,
    entityType: "form_submission",
    entityId: updated.id,
    before: existing,
    after: updated,
  });
  return updated;
}

export async function deleteSubmission(
  input: z.infer<typeof deleteSubmissionInputSchema>,
  actor: OperationsActor = systemActor,
) {
  const [deleted] = await createDb()
    .delete(formSubmissions)
    .where(eq(formSubmissions.id, input.submissionId))
    .returning();
  if (!deleted)
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead không tồn tại." });
  await recordAudit({
    action: "form_submission.delete",
    actor,
    entityType: "form_submission",
    entityId: deleted.id,
    before: { formKey: deleted.formKey, createdAt: deleted.createdAt },
  });
  return { deleted: true };
}

async function retrySubmissionNotification(
  input: z.infer<typeof retrySubmissionNotificationInputSchema>,
  actor: OperationsActor,
  options: { automatic: boolean; now: Date },
) {
  const db = createDb();
  const submission = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, input.submissionId),
  });
  if (!submission)
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead không tồn tại." });

  const definitionRow = await db.query.formDefinitions.findFirst({
    where: eq(formDefinitions.id, submission.formId),
  });
  if (!definitionRow)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Cấu hình biểu mẫu của lead không còn tồn tại.",
    });

  const previous = readNotificationState(submission.notificationResults);
  const previousEmail = previous.adapters.find(
    (item) => item.adapter === "email",
  );
  const canRetryEmail =
    formDefinitionSchema.parse(definitionRow).notificationSettings.email &&
    previousEmail?.status !== "sent" &&
    (!options.automatic ||
      previousEmail?.status === "failed" ||
      (submission.notificationStatus === "pending" && !previousEmail));
  if (!canRetryEmail) {
    if (!options.automatic)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Lead này không có email lỗi để thử lại an toàn. Telegram cần được kiểm tra thủ công để tránh gửi trùng.",
      });
    return {
      attempted: false as const,
      reason: "no-retry-safe-adapter" as const,
    };
  }

  const definition = formDefinitionSchema.parse(definitionRow);
  const latest = await sendLeadNotifications({
    definition,
    submission,
    adapters: ["email"],
  });
  const attemptedAt = options.now;
  const attemptCount = previous.attemptCount + 1;
  const adapters = mergeNotificationResults(previous.adapters, latest);
  const summary = summarizeNotificationResults(adapters);
  const nextRetryAt = nextNotificationRetryAt(
    adapters,
    attemptCount,
    attemptedAt,
    submission.createdAt,
  );
  const [updated] = await db
    .update(formSubmissions)
    .set({
      notificationStatus: summary.status,
      notificationResults: {
        adapters,
        attemptCount,
        lastAttemptAt: attemptedAt.toISOString(),
        ...(nextRetryAt && { nextRetryAt }),
      },
      notifiedAt: summary.sent
        ? (submission.notifiedAt ?? attemptedAt)
        : submission.notifiedAt,
      notificationError: summary.error,
      updatedAt: attemptedAt,
    })
    .where(eq(formSubmissions.id, submission.id))
    .returning();
  if (!updated) throw new Error("Failed to update notification attempt");

  await recordAudit({
    action:
      summary.status === "failed"
        ? "form_submission.notification_retry_failed"
        : "form_submission.notification_retry_sent",
    actor,
    entityType: "form_submission",
    entityId: submission.id,
    before: {
      notificationStatus: submission.notificationStatus,
      attemptCount: previous.attemptCount,
    },
    after: {
      notificationStatus: summary.status,
      attemptCount,
      automatic: options.automatic,
      nextRetryAt,
    },
  });
  if (summary.status === "failed") {
    reportOperationalIncident({
      category: "notification",
      operation: options.automatic
        ? "lead.notification.retry.automatic"
        : "lead.notification.retry.manual",
      source: options.automatic ? "scheduler" : "request",
      error: new Error(summary.error || "Lead notification retry failed"),
      entityType: "form_submission",
      entityId: submission.id,
      requestId: actor.requestId,
      recoverable: Boolean(nextRetryAt),
      detail: {
        attemptCount,
        retryScheduled: Boolean(nextRetryAt),
      },
    });
  }
  return {
    attempted: true as const,
    notificationStatus: summary.status,
    emailStatus: latest.find((item) => item.adapter === "email")?.status,
    attemptCount,
    nextRetryAt,
  };
}

export async function retrySubmissionNotificationManually(
  input: z.infer<typeof retrySubmissionNotificationInputSchema>,
  actor: OperationsActor = systemActor,
) {
  return retrySubmissionNotification(input, actor, {
    automatic: false,
    now: new Date(),
  });
}

export async function retryFailedNotifications(now = new Date()) {
  const candidates = await createDb()
    .select()
    .from(formSubmissions)
    .where(
      and(
        or(
          eq(formSubmissions.notificationStatus, "failed"),
          and(
            eq(formSubmissions.notificationStatus, "pending"),
            lte(
              formSubmissions.createdAt,
              new Date(now.getTime() - 10 * 60_000),
            ),
          ),
        ),
        gte(
          formSubmissions.createdAt,
          new Date(now.getTime() - notificationRetryWindowMs),
        ),
      ),
    )
    .orderBy(formSubmissions.createdAt)
    .limit(500);
  const result = {
    candidates: candidates.length,
    retried: 0,
    sent: 0,
    failed: 0,
    deferred: 0,
    exhausted: 0,
    unretryable: 0,
  };

  for (const submission of candidates) {
    if (result.retried >= 25) break;
    const state = readNotificationState(submission.notificationResults);
    const stalePending = submission.notificationStatus === "pending";
    if (
      state.attemptCount >= maxNotificationAttempts ||
      now.getTime() - submission.createdAt.getTime() >=
        notificationRetryWindowMs
    ) {
      result.exhausted += 1;
      continue;
    }
    if (!stalePending && !state.nextRetryAt) {
      result.unretryable += 1;
      continue;
    }
    if (
      !stalePending &&
      state.nextRetryAt &&
      new Date(state.nextRetryAt).getTime() > now.getTime()
    ) {
      result.deferred += 1;
      continue;
    }
    try {
      const attempt = await retrySubmissionNotification(
        { submissionId: submission.id },
        systemActor,
        { automatic: true, now },
      );
      if (!attempt.attempted) {
        result.unretryable += 1;
        continue;
      }
      result.retried += 1;
      if (attempt.emailStatus === "sent") result.sent += 1;
      else if (attempt.notificationStatus === "failed") result.failed += 1;
      else result.unretryable += 1;
    } catch (error) {
      result.failed += 1;
      reportOperationalIncident({
        category: "notification",
        operation: "lead.notification.retry.persistence",
        source: "scheduler",
        error,
        entityType: "form_submission",
        entityId: submission.id,
        recoverable: true,
      });
    }
  }
  return result;
}

export async function purgeExpiredSubmissions(now = new Date()) {
  const db = createDb();
  const definitions = await db.select().from(formDefinitions);
  let deleted = 0;
  for (const definition of definitions) {
    const cutoff = new Date(
      now.getTime() - definition.retentionDays * 86_400_000,
    );
    const rows = await db
      .delete(formSubmissions)
      .where(
        and(
          eq(formSubmissions.formId, definition.id),
          lt(formSubmissions.createdAt, cutoff),
        ),
      )
      .returning({ id: formSubmissions.id });
    deleted += rows.length;
  }
  if (deleted)
    await recordAudit({
      action: "form_submission.retention_purge",
      entityType: "system",
      entityId: "retention",
      after: { deleted },
    });
  return { deleted };
}

export async function checkOperationsHealth() {
  const startedAt = performance.now();
  const db = createDb();
  const definitions = await db
    .select({
      active: formDefinitions.active,
      notificationSettings: formDefinitions.notificationSettings,
    })
    .from(formDefinitions);
  const runtimeStatus = notificationRuntimeStatus(
    definitions.map((definition) => ({
      active: definition.active,
      notificationSettings: {
        email: definition.notificationSettings.email === true,
        telegram: definition.notificationSettings.telegram === true,
      },
    })),
    env as unknown as Record<string, string | undefined>,
  );
  const [failedNotifications] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(eq(formSubmissions.notificationStatus, "failed"));
  const [stalePendingNotifications] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.notificationStatus, "pending"),
        lte(formSubmissions.createdAt, new Date(Date.now() - 10 * 60_000)),
      ),
    );
  const failed = failedNotifications?.value ?? 0;
  const stalePending = stalePendingNotifications?.value ?? 0;
  const healthy =
    failed === 0 && stalePending === 0 && runtimeStatus.status === "ok";
  return {
    status: healthy ? ("ok" as const) : ("degraded" as const),
    checks: {
      database: "ok" as const,
      notifications: {
        status: healthy ? ("ok" as const) : ("degraded" as const),
        required: runtimeStatus.required,
        configuration: runtimeStatus.status,
        missingProviders: runtimeStatus.missing,
        failed,
        stalePending,
      },
    },
    latencyMs: Math.round(performance.now() - startedAt),
    timestamp: new Date().toISOString(),
  };
}
