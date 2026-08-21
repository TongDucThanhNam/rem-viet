import { calculateCmsRetryDelay } from "@agency/cms-runtime";
import { redactOperationalText } from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  cmsOutboxEvents,
  cmsWebhookDeliveries,
  cmsWebhookEndpoints,
} from "@rem-viet/db/schema/automation";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

const dayMs = 24 * 60 * 60 * 1000;
const outboxRetry = {
  maxAttempts: 8,
  initialDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 15 * 60 * 1000,
  jitter: 0.2,
};

export type CmsOutboxRuntime = Readonly<{
  db?: ReturnType<typeof createDb>;
  now?: () => Date;
  random?: () => number;
}>;

function runtimeDb(runtime?: CmsOutboxRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeNow(runtime?: CmsOutboxRuntime) {
  return runtime?.now?.() ?? new Date();
}

export function contentPublishedOutboxValues(input: {
  documentType: "page" | "post";
  documentId: string;
  version: number;
  revisionId: string;
  occurredAt: Date;
}) {
  const topic = `content.${input.documentType}.published`;
  return {
    id: crypto.randomUUID(),
    topic,
    aggregateType: input.documentType,
    aggregateId: input.documentId,
    aggregateVersion: input.version,
    payload: {
      documentType: input.documentType,
      documentId: input.documentId,
      version: input.version,
      revisionId: input.revisionId,
    },
    idempotencyKey: `${topic}:${input.documentId}:v${input.version}`,
    status: "pending" as const,
    attempts: 0,
    maxAttempts: outboxRetry.maxAttempts,
    availableAt: input.occurredAt,
    occurredAt: input.occurredAt,
    retentionUntil: new Date(input.occurredAt.getTime() + 90 * dayMs),
  } satisfies typeof cmsOutboxEvents.$inferInsert;
}

function endpointReceivesTopic(
  endpoint: typeof cmsWebhookEndpoints.$inferSelect,
  topic: string,
) {
  return endpoint.topics.includes("*") || endpoint.topics.includes(topic);
}

export async function dispatchCmsOutboxEvents(
  now = new Date(),
  limit = 50,
  runtime?: CmsOutboxRuntime,
) {
  const db = runtimeDb(runtime);
  const events = await db
    .select()
    .from(cmsOutboxEvents)
    .where(
      and(
        inArray(cmsOutboxEvents.status, ["pending", "dispatching"]),
        lte(cmsOutboxEvents.availableAt, now),
        or(
          isNull(cmsOutboxEvents.lockedUntil),
          lte(cmsOutboxEvents.lockedUntil, now),
        ),
      ),
    )
    .orderBy(asc(cmsOutboxEvents.occurredAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  const endpoints = await db
    .select()
    .from(cmsWebhookEndpoints)
    .where(
      and(
        eq(cmsWebhookEndpoints.active, true),
        isNull(cmsWebhookEndpoints.revokedAt),
      ),
    );
  const outcomes: Array<{
    eventId: string;
    status: "dispatched" | "pending" | "dead_letter";
    deliveries: number;
  }> = [];
  for (const event of events) {
    const claimedAt = runtimeNow(runtime);
    const lockToken = crypto.randomUUID();
    await db
      .update(cmsOutboxEvents)
      .set({
        status: "dispatching",
        lockedUntil: new Date(claimedAt.getTime() + 60_000),
        lockToken,
        attempts: event.attempts + 1,
      })
      .where(
        and(
          eq(cmsOutboxEvents.id, event.id),
          inArray(cmsOutboxEvents.status, ["pending", "dispatching"]),
          eq(cmsOutboxEvents.attempts, event.attempts),
          or(
            isNull(cmsOutboxEvents.lockedUntil),
            lte(cmsOutboxEvents.lockedUntil, claimedAt),
          ),
        ),
      );
    const claimed = await db.query.cmsOutboxEvents.findFirst({
      where: eq(cmsOutboxEvents.id, event.id),
    });
    if (
      !claimed ||
      claimed.status !== "dispatching" ||
      claimed.attempts !== event.attempts + 1 ||
      claimed.lockToken !== lockToken
    ) {
      continue;
    }
    const targets = endpoints.filter((endpoint) =>
      endpointReceivesTopic(endpoint, event.topic),
    );
    try {
      const dispatchedAt = runtimeNow(runtime);
      await db.batch([
        db
          .update(cmsOutboxEvents)
          .set({
            status: "dispatched",
            dispatchedAt,
            lockedUntil: null,
            lockToken: null,
            lastError: "",
          })
          .where(
            and(
              eq(cmsOutboxEvents.id, event.id),
              eq(cmsOutboxEvents.lockToken, lockToken),
            ),
          ),
        ...targets.map((endpoint) =>
          db
            .insert(cmsWebhookDeliveries)
            .values({
              id: crypto.randomUUID(),
              endpointId: endpoint.id,
              eventId: event.id,
              dedupeKey: `${endpoint.id}:${event.id}:original`,
              status: "pending",
              attempt: 0,
              maxAttempts: 8,
              nextAttemptAt: dispatchedAt,
              createdAt: dispatchedAt,
              updatedAt: dispatchedAt,
            })
            .onConflictDoNothing({ target: cmsWebhookDeliveries.dedupeKey }),
        ),
      ]);
      outcomes.push({
        eventId: event.id,
        status: "dispatched",
        deliveries: targets.length,
      });
    } catch (error) {
      const failedAt = runtimeNow(runtime);
      const attempt = event.attempts + 1;
      const exhausted = attempt >= event.maxAttempts;
      await db
        .update(cmsOutboxEvents)
        .set({
          status: exhausted ? "dead_letter" : "pending",
          availableAt: exhausted
            ? failedAt
            : new Date(
                failedAt.getTime() +
                  calculateCmsRetryDelay(
                    outboxRetry,
                    attempt,
                    runtime?.random ?? Math.random,
                  ),
              ),
          lockedUntil: null,
          lockToken: null,
          lastError: redactOperationalText(
            error instanceof Error ? error.message : String(error),
          ),
        })
        .where(
          and(
            eq(cmsOutboxEvents.id, event.id),
            eq(cmsOutboxEvents.lockToken, lockToken),
          ),
        );
      outcomes.push({
        eventId: event.id,
        status: exhausted ? "dead_letter" : "pending",
        deliveries: 0,
      });
    }
  }
  return {
    processed: outcomes.length,
    dispatched: outcomes.filter((item) => item.status === "dispatched").length,
    deadLetter: outcomes.filter((item) => item.status === "dead_letter").length,
    deliveries: outcomes.reduce((sum, item) => sum + item.deliveries, 0),
    outcomes,
  };
}

export async function purgeExpiredCmsOutbox(
  now = new Date(),
  runtime?: CmsOutboxRuntime,
) {
  return runtimeDb(runtime)
    .delete(cmsOutboxEvents)
    .where(
      and(
        inArray(cmsOutboxEvents.status, ["dispatched", "dead_letter"]),
        lte(cmsOutboxEvents.retentionUntil, now),
      ),
    );
}
