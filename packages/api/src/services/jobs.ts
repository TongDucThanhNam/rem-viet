import {
  cmsJobEnvelopeSchema,
  cmsJobStatusSchema,
  cmsRetryPolicySchema,
  cmsWorkflowDefinitionSchema,
  type CmsJobEnvelope,
  type CmsJobStatus,
  type CmsWorkflowDefinition,
} from "@agency/cms-core";
import {
  calculateCmsRetryDelay,
  defineCmsTask,
  runCmsWorkflowSteps,
  runCmsTaskWithTimeout,
  type CmsTask,
  type CmsWorkflowStepHandler,
} from "@agency/cms-runtime";
import { redactOperationalText } from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  cmsJobQueues,
  cmsJobs,
  cmsJobSteps,
} from "@rem-viet/db/schema/automation";
import { auditEvents } from "@rem-viet/db/schema/governance";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import type { GovernanceActor } from "./governance";

const dayMs = 24 * 60 * 60 * 1000;
const leasePaddingMs = 5_000;
const taskRegistry = new Map<string, CmsTask<unknown, unknown>>();

export type CmsJobsRuntime = Readonly<{
  db?: ReturnType<typeof createDb>;
  now?: () => Date;
  random?: () => number;
}>;

function runtimeDb(runtime?: CmsJobsRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeNow(runtime?: CmsJobsRuntime) {
  return runtime?.now?.() ?? new Date();
}

export function registerCmsTask<TPayload, TResult>(
  task: CmsTask<TPayload, TResult>,
) {
  const existing = taskRegistry.get(task.definition.name);
  if (existing && existing !== task) {
    throw new Error(`CMS task already registered: ${task.definition.name}`);
  }
  taskRegistry.set(task.definition.name, task as CmsTask<unknown, unknown>);
  return task;
}

export function clearCmsTaskRegistryForTests() {
  taskRegistry.clear();
}

export function defineDurableCmsWorkflow<TPayload, TState, TResult = TState>(
  input: Readonly<{
    definition: CmsWorkflowDefinition;
    parsePayload: (payload: unknown) => TPayload;
    initialState: (payload: TPayload) => TState | Promise<TState>;
    handlers: Readonly<Record<string, CmsWorkflowStepHandler<TState>>>;
    mapResult?: (state: TState) => TResult | Promise<TResult>;
  }>,
  runtime?: CmsJobsRuntime,
) {
  const workflow = cmsWorkflowDefinitionSchema.parse(input.definition);
  return defineCmsTask<TPayload, TResult>({
    definition: {
      name: workflow.name,
      queue: workflow.queue,
      retry: workflow.retry,
      timeoutMs: workflow.timeoutMs,
      retentionDays: workflow.retentionDays,
    },
    parsePayload: input.parsePayload,
    async execute(payload, context) {
      const completed = (await listCompletedCmsJobSteps(
        context.jobId,
        runtime,
      )) as ReadonlyMap<string, TState>;
      const result = await runCmsWorkflowSteps({
        definition: workflow,
        initialState: await input.initialState(payload),
        completed,
        handlers: input.handlers,
        context,
        onStepComplete: (name, state) =>
          persistCmsJobStep(
            {
              jobId: context.jobId,
              name,
              attempt: context.attempt,
              idempotencyKey: `${context.idempotencyKey}/${name}`,
              state,
            },
            runtime,
          ),
      });
      return input.mapResult
        ? input.mapResult(result.state)
        : (result.state as unknown as TResult);
    },
  });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function toEnvelope(row: typeof cmsJobs.$inferSelect): CmsJobEnvelope {
  return cmsJobEnvelopeSchema.parse({
    id: row.id,
    taskName: row.taskName,
    queue: row.queueName,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toOperatorView(row: typeof cmsJobs.$inferSelect) {
  return {
    ...toEnvelope(row),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
    cancelRequested: row.cancelRequested,
    lastError: row.lastError,
  };
}

export const enqueueCmsJobInputSchema = z.object({
  taskName: z.string().trim().min(2).max(128),
  payload: z.unknown(),
  idempotencyKey: z.string().trim().min(1).max(256),
  availableAt: z.coerce.date().optional(),
});

export const listCmsJobsInputSchema = z.object({
  queue: z.string().trim().min(2).max(128).optional(),
  status: cmsJobStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const cmsJobIdInputSchema = z.object({
  jobId: z.string().trim().min(1).max(128),
});

export async function enqueueCmsJob(
  input: z.infer<typeof enqueueCmsJobInputSchema>,
  runtime?: CmsJobsRuntime,
) {
  const task = taskRegistry.get(input.taskName);
  if (!task) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unknown CMS task: ${input.taskName}`,
    });
  }
  const payload = task.parsePayload(input.payload);
  const retry = cmsRetryPolicySchema.parse(task.definition.retry);
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  const id = crypto.randomUUID();
  await db.batch([
    db
      .insert(cmsJobQueues)
      .values({
        name: task.definition.queue,
        concurrencyLimit: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: cmsJobQueues.name }),
    db
      .insert(cmsJobs)
      .values({
        id,
        taskName: task.definition.name,
        queueName: task.definition.queue,
        payload,
        idempotencyKey: input.idempotencyKey,
        status: "queued",
        attempt: 0,
        maxAttempts: retry.maxAttempts,
        retryPolicy: retry,
        timeoutMs: task.definition.timeoutMs,
        availableAt: input.availableAt ?? now,
        retentionUntil: new Date(
          now.getTime() + task.definition.retentionDays * dayMs,
        ),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: cmsJobs.idempotencyKey }),
  ]);
  const job = await db.query.cmsJobs.findFirst({
    where: eq(cmsJobs.idempotencyKey, input.idempotencyKey),
  });
  if (!job) throw new Error("CMS job enqueue did not persist a receipt");
  if (job.taskName !== task.definition.name) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Job idempotency key is already bound to another task",
    });
  }
  if (canonicalJson(job.payload) !== canonicalJson(payload)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Job idempotency key is already bound to another payload",
    });
  }
  return toEnvelope(job);
}

export async function listCmsJobs(
  input: {
    queue?: string;
    status?: CmsJobStatus;
    limit?: number;
  } = {},
  runtime?: CmsJobsRuntime,
) {
  const db = runtimeDb(runtime);
  const filters = [
    ...(input.queue ? [eq(cmsJobs.queueName, input.queue)] : []),
    ...(input.status ? [eq(cmsJobs.status, input.status)] : []),
  ];
  const rows = await db
    .select()
    .from(cmsJobs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(cmsJobs.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500));
  return rows.map(toOperatorView);
}

function jobAuditValues(input: {
  actor: GovernanceActor;
  action: string;
  job: typeof cmsJobs.$inferSelect;
}) {
  return {
    id: crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: "cms_job",
    entityId: input.job.id,
    before: {
      status: input.job.status,
      attempt: input.job.attempt,
      taskName: input.job.taskName,
    },
    requestId: input.actor.requestId,
    createdAt: new Date(),
  } satisfies typeof auditEvents.$inferInsert;
}

export async function cancelCmsJob(
  jobId: string,
  runtime?: CmsJobsRuntime,
  actor?: GovernanceActor,
) {
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  const job = await db.query.cmsJobs.findFirst({
    where: eq(cmsJobs.id, jobId),
  });
  if (!job)
    throw new TRPCError({ code: "NOT_FOUND", message: "CMS job not found" });
  if (["succeeded", "dead_letter", "cancelled"].includes(job.status)) {
    return { cancelled: job.status === "cancelled", status: job.status };
  }
  const update = db
    .update(cmsJobs)
    .set({
      cancelRequested: true,
      ...(job.status === "running"
        ? {}
        : { status: "cancelled" as const, completedAt: now }),
      updatedAt: now,
    })
    .where(eq(cmsJobs.id, jobId));
  if (actor) {
    await db.batch([
      update,
      db
        .insert(auditEvents)
        .values(jobAuditValues({ actor, action: "cms_job.cancel", job })),
    ]);
  } else {
    await update;
  }
  return {
    cancelled: job.status !== "running",
    status:
      job.status === "running" ? ("running" as const) : ("cancelled" as const),
  };
}

export async function retryCmsJob(
  jobId: string,
  runtime?: CmsJobsRuntime,
  actor?: GovernanceActor,
) {
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  const job = await db.query.cmsJobs.findFirst({
    where: eq(cmsJobs.id, jobId),
  });
  if (!job)
    throw new TRPCError({ code: "NOT_FOUND", message: "CMS job not found" });
  if (!taskRegistry.has(job.taskName)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "CMS task handler is not registered",
    });
  }
  const update = db
    .update(cmsJobs)
    .set({
      status: "queued",
      attempt: 0,
      availableAt: now,
      completedAt: null,
      lockedUntil: null,
      lockToken: null,
      cancelRequested: false,
      lastError: "",
      updatedAt: now,
    })
    .where(eq(cmsJobs.id, job.id));
  if (actor) {
    await db.batch([
      update,
      db
        .insert(auditEvents)
        .values(jobAuditValues({ actor, action: "cms_job.retry", job })),
    ]);
  } else {
    await update;
  }
  return { retried: true as const };
}

async function runningInQueue(
  queueName: string,
  now: Date,
  runtime?: CmsJobsRuntime,
) {
  const [row] = await runtimeDb(runtime)
    .select({ value: count() })
    .from(cmsJobs)
    .where(
      and(
        eq(cmsJobs.queueName, queueName),
        eq(cmsJobs.status, "running"),
        gt(cmsJobs.lockedUntil, now),
      ),
    );
  return row?.value ?? 0;
}

async function runClaimedJob(
  row: typeof cmsJobs.$inferSelect,
  concurrencyLimit: number,
  runtime?: CmsJobsRuntime,
) {
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  if (row.cancelRequested) {
    await db
      .update(cmsJobs)
      .set({
        status: "cancelled",
        completedAt: now,
        lockedUntil: null,
        lockToken: null,
        updatedAt: now,
      })
      .where(eq(cmsJobs.id, row.id));
    return "cancelled" as const;
  }
  const task = taskRegistry.get(row.taskName);
  const attempt = row.attempt + 1;
  const timeoutMs = task?.definition.timeoutMs ?? row.timeoutMs;
  const lockToken = crypto.randomUUID();
  await db
    .update(cmsJobs)
    .set({
      status: "running",
      attempt,
      startedAt: row.startedAt ?? now,
      lockedUntil: new Date(now.getTime() + timeoutMs + leasePaddingMs),
      lockToken,
      updatedAt: now,
    })
    .where(
      and(
        eq(cmsJobs.id, row.id),
        inArray(cmsJobs.status, ["queued", "waiting", "failed", "running"]),
        eq(cmsJobs.attempt, row.attempt),
        or(isNull(cmsJobs.lockedUntil), lte(cmsJobs.lockedUntil, now)),
        eq(cmsJobs.cancelRequested, false),
        sql`(
          SELECT count(*) FROM cms_jobs AS active_jobs
          WHERE active_jobs.queue_name = ${row.queueName}
            AND active_jobs.status = 'running'
            AND active_jobs.locked_until > ${now.getTime()}
        ) < ${concurrencyLimit}`,
      ),
    );
  const claimed = await db.query.cmsJobs.findFirst({
    where: eq(cmsJobs.id, row.id),
  });
  if (
    !claimed ||
    claimed.status !== "running" ||
    claimed.attempt !== attempt ||
    claimed.lockToken !== lockToken
  ) {
    return "skipped" as const;
  }
  try {
    if (!task) throw new Error(`Unregistered CMS task: ${row.taskName}`);
    const payload = task.parsePayload(row.payload);
    const result = await runCmsTaskWithTimeout(timeoutMs, (signal) =>
      task.execute(payload, {
        jobId: row.id,
        attempt,
        idempotencyKey: row.idempotencyKey,
        signal,
      }),
    );
    const completedAt = runtimeNow(runtime);
    await db
      .update(cmsJobs)
      .set({
        status: "succeeded",
        result,
        completedAt,
        lockedUntil: null,
        lockToken: null,
        lastError: "",
        updatedAt: completedAt,
      })
      .where(and(eq(cmsJobs.id, row.id), eq(cmsJobs.lockToken, lockToken)));
    return "succeeded" as const;
  } catch (error) {
    const failedAt = runtimeNow(runtime);
    const retry = cmsRetryPolicySchema.parse(row.retryPolicy);
    const exhausted = attempt >= retry.maxAttempts;
    const lastError = redactOperationalText(
      error instanceof Error ? error.message : String(error),
    );
    await db
      .update(cmsJobs)
      .set({
        status: exhausted ? "dead_letter" : "waiting",
        availableAt: exhausted
          ? failedAt
          : new Date(
              failedAt.getTime() +
                calculateCmsRetryDelay(
                  retry,
                  attempt,
                  runtime?.random ?? Math.random,
                ),
            ),
        completedAt: exhausted ? failedAt : null,
        lockedUntil: null,
        lockToken: null,
        lastError,
        updatedAt: failedAt,
      })
      .where(and(eq(cmsJobs.id, row.id), eq(cmsJobs.lockToken, lockToken)));
    return exhausted ? ("dead_letter" as const) : ("waiting" as const);
  }
}

export async function runDueCmsJobs(
  now = new Date(),
  limit = 25,
  runtime?: CmsJobsRuntime,
) {
  const db = runtimeDb(runtime);
  const candidates = await db
    .select({ job: cmsJobs, queue: cmsJobQueues })
    .from(cmsJobs)
    .innerJoin(cmsJobQueues, eq(cmsJobs.queueName, cmsJobQueues.name))
    .where(
      and(
        inArray(cmsJobs.status, ["queued", "waiting", "failed", "running"]),
        lte(cmsJobs.availableAt, now),
        or(isNull(cmsJobs.lockedUntil), lte(cmsJobs.lockedUntil, now)),
        eq(cmsJobQueues.paused, false),
      ),
    )
    .orderBy(asc(cmsJobs.availableAt), asc(cmsJobs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  const outcomes: Array<{ jobId: string; status: string }> = [];
  for (const candidate of candidates) {
    const running = await runningInQueue(candidate.job.queueName, now, runtime);
    if (running >= candidate.queue.concurrencyLimit) continue;
    outcomes.push({
      jobId: candidate.job.id,
      status: await runClaimedJob(
        candidate.job,
        candidate.queue.concurrencyLimit,
        runtime,
      ),
    });
  }
  return {
    processed: outcomes.filter((item) => item.status !== "skipped").length,
    succeeded: outcomes.filter((item) => item.status === "succeeded").length,
    waiting: outcomes.filter((item) => item.status === "waiting").length,
    deadLetter: outcomes.filter((item) => item.status === "dead_letter").length,
    cancelled: outcomes.filter((item) => item.status === "cancelled").length,
    outcomes,
  };
}

export async function listCompletedCmsJobSteps(
  jobId: string,
  runtime?: CmsJobsRuntime,
) {
  const rows = await runtimeDb(runtime)
    .select()
    .from(cmsJobSteps)
    .where(
      and(eq(cmsJobSteps.jobId, jobId), eq(cmsJobSteps.status, "succeeded")),
    )
    .orderBy(asc(cmsJobSteps.startedAt));
  return new Map(rows.map((row) => [row.name, row.state] as const));
}

export async function persistCmsJobStep(
  input: {
    jobId: string;
    name: string;
    attempt: number;
    idempotencyKey: string;
    state: unknown;
  },
  runtime?: CmsJobsRuntime,
) {
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  await db
    .insert(cmsJobSteps)
    .values({
      id: crypto.randomUUID(),
      jobId: input.jobId,
      name: input.name,
      status: "succeeded",
      attempt: input.attempt,
      idempotencyKey: input.idempotencyKey,
      state: input.state,
      startedAt: now,
      completedAt: now,
    })
    .onConflictDoUpdate({
      target: [cmsJobSteps.jobId, cmsJobSteps.name],
      set: {
        status: "succeeded",
        attempt: input.attempt,
        state: input.state,
        lastError: "",
        completedAt: now,
      },
    });
}

export async function purgeExpiredCmsJobs(
  now = new Date(),
  runtime?: CmsJobsRuntime,
) {
  const result = await runtimeDb(runtime)
    .delete(cmsJobs)
    .where(
      and(
        inArray(cmsJobs.status, ["succeeded", "dead_letter", "cancelled"]),
        lte(cmsJobs.retentionUntil, now),
      ),
    );
  return result;
}
