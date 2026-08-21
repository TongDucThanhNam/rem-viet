import {
  calculateCmsRetryDelay,
  signCmsWebhookPayload,
} from "@agency/cms-runtime";
import { redactOperationalText } from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  cmsOutboxEvents,
  cmsWebhookDeliveries,
  cmsWebhookEndpoints,
} from "@rem-viet/db/schema/automation";
import { auditEvents } from "@rem-viet/db/schema/governance";
import { env } from "@rem-viet/env/server";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";

import type { GovernanceActor } from "./governance";

const webhookRetry = {
  maxAttempts: 8,
  initialDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 60 * 60 * 1000,
  jitter: 0.2,
};
const webhookLeaseMs = 30_000;
const topicSchema = z.union([
  z.literal("*"),
  z
    .string()
    .trim()
    .min(2)
    .max(128)
    .regex(/^[a-z][a-z0-9.-]*$/),
]);

export const createWebhookEndpointInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.url().max(2048),
  topics: z
    .array(topicSchema)
    .min(1)
    .max(50)
    .transform((topics) => [...new Set(topics)]),
});

export const webhookEndpointIdInputSchema = z.object({
  endpointId: z.string().trim().min(1),
});

export const replayWebhookDeliveryInputSchema = z.object({
  deliveryId: z.string().trim().min(1),
});

export const listWebhookDeliveriesInputSchema = z.object({
  limit: z.number().int().min(1).max(500).default(100),
});

export type CmsWebhookRuntime = Readonly<{
  db?: ReturnType<typeof createDb>;
  now?: () => Date;
  random?: () => number;
  fetch?: typeof fetch;
  values?: Readonly<Record<string, string | undefined>>;
}>;

function runtimeDb(runtime?: CmsWebhookRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeNow(runtime?: CmsWebhookRuntime) {
  return runtime?.now?.() ?? new Date();
}

function runtimeValues(runtime?: CmsWebhookRuntime) {
  return (
    runtime?.values ??
    (env as unknown as Readonly<Record<string, string | undefined>>)
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`cms-webhook-encryption-v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptWebhookSecret(
  secret: string,
  runtime?: CmsWebhookRuntime,
) {
  const master = runtimeValues(runtime).BETTER_AUTH_SECRET?.trim();
  if (!master) throw new Error("Webhook encryption key is not configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(master),
    new TextEncoder().encode(secret),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptWebhookSecret(
  ciphertext: string,
  runtime?: CmsWebhookRuntime,
) {
  const [version, encodedIv, encodedPayload] = ciphertext.split(".");
  const master = runtimeValues(runtime).BETTER_AUTH_SECRET?.trim();
  if (version !== "v1" || !encodedIv || !encodedPayload || !master) {
    throw new Error("Webhook secret ciphertext is invalid");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(encodedIv) },
    await encryptionKey(master),
    base64UrlToBytes(encodedPayload),
  );
  return new TextDecoder().decode(plaintext);
}

function generateWebhookSecret() {
  return `whsec_${bytesToHex(crypto.getRandomValues(new Uint8Array(32)))}`;
}

function privateHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1"
  ) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (!ipv4) return normalized.includes(":");
  const [first, second] = ipv4.slice(1).map(Number);
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 168)
  );
}

export function validateCmsWebhookUrl(
  value: string,
  values: Readonly<Record<string, string | undefined>>,
) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    privateHost(url.hostname)
  ) {
    throw new Error("Webhook URL must be a public HTTPS endpoint on port 443");
  }
  const allowlist = new Set(
    (values.CMS_WEBHOOK_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowlist.has(url.hostname.toLowerCase())) {
    throw new Error("Webhook hostname is not in CMS_WEBHOOK_ALLOWED_HOSTS");
  }
  return url.href;
}

export { signCmsWebhookPayload };

function audit(input: {
  actor: GovernanceActor;
  action: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  return {
    id: crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: "webhook_endpoint",
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor.requestId,
    createdAt: new Date(),
  } satisfies typeof auditEvents.$inferInsert;
}

function publicEndpoint(endpoint: typeof cmsWebhookEndpoints.$inferSelect) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    topics: endpoint.topics,
    active: endpoint.active,
    previousSecretValidUntil: endpoint.previousSecretValidUntil,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
    revokedAt: endpoint.revokedAt,
  };
}

function redactOptionalOperationalText(value: string, limit = 500) {
  return value.trim() ? redactOperationalText(value, limit) : "";
}

export async function listWebhookEndpoints(runtime?: CmsWebhookRuntime) {
  const rows = await runtimeDb(runtime)
    .select()
    .from(cmsWebhookEndpoints)
    .orderBy(asc(cmsWebhookEndpoints.createdAt));
  return rows.map(publicEndpoint);
}

export async function createWebhookEndpoint(
  input: z.infer<typeof createWebhookEndpointInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsWebhookRuntime,
) {
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  const id = crypto.randomUUID();
  const secret = generateWebhookSecret();
  const url = validateCmsWebhookUrl(input.url, runtimeValues(runtime));
  const secretCiphertext = await encryptWebhookSecret(secret, runtime);
  await db.batch([
    db.insert(cmsWebhookEndpoints).values({
      id,
      name: input.name,
      url,
      topics: input.topics,
      secretCiphertext,
      active: true,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditEvents).values(
      audit({
        action: "webhook.endpoint_create",
        actor,
        entityId: id,
        after: { name: input.name, url, topics: input.topics },
      }),
    ),
  ]);
  return {
    endpoint: publicEndpoint({
      id,
      name: input.name,
      url,
      topics: input.topics,
      secretCiphertext,
      previousSecretCiphertext: null,
      previousSecretValidUntil: null,
      active: true,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
    }),
    secret,
  };
}

export async function rotateWebhookSecret(
  input: z.infer<typeof webhookEndpointIdInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsWebhookRuntime,
) {
  const db = runtimeDb(runtime);
  const endpoint = await db.query.cmsWebhookEndpoints.findFirst({
    where: and(
      eq(cmsWebhookEndpoints.id, input.endpointId),
      isNull(cmsWebhookEndpoints.revokedAt),
    ),
  });
  if (!endpoint) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Webhook endpoint not found",
    });
  }
  const now = runtimeNow(runtime);
  const secret = generateWebhookSecret();
  const secretCiphertext = await encryptWebhookSecret(secret, runtime);
  const previousSecretValidUntil = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  );
  await db.batch([
    db
      .update(cmsWebhookEndpoints)
      .set({
        previousSecretCiphertext: endpoint.secretCiphertext,
        previousSecretValidUntil,
        secretCiphertext,
        updatedAt: now,
      })
      .where(eq(cmsWebhookEndpoints.id, endpoint.id)),
    db.insert(auditEvents).values(
      audit({
        action: "webhook.secret_rotate",
        actor,
        entityId: endpoint.id,
        after: { previousSecretValidUntil },
      }),
    ),
  ]);
  return { endpointId: endpoint.id, secret, previousSecretValidUntil };
}

export async function revokeWebhookEndpoint(
  input: z.infer<typeof webhookEndpointIdInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsWebhookRuntime,
) {
  const db = runtimeDb(runtime);
  const endpoint = await db.query.cmsWebhookEndpoints.findFirst({
    where: eq(cmsWebhookEndpoints.id, input.endpointId),
  });
  if (!endpoint) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Webhook endpoint not found",
    });
  }
  const now = runtimeNow(runtime);
  await db.batch([
    db
      .update(cmsWebhookEndpoints)
      .set({ active: false, revokedAt: now, updatedAt: now })
      .where(eq(cmsWebhookEndpoints.id, endpoint.id)),
    db
      .update(cmsWebhookDeliveries)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(cmsWebhookDeliveries.endpointId, endpoint.id),
          inArray(cmsWebhookDeliveries.status, ["pending", "failed"]),
        ),
      ),
    db.insert(auditEvents).values(
      audit({
        action: "webhook.endpoint_revoke",
        actor,
        entityId: endpoint.id,
        before: { name: endpoint.name, url: endpoint.url },
      }),
    ),
  ]);
  return { revoked: true as const };
}

function deliveryBody(event: typeof cmsOutboxEvents.$inferSelect) {
  return JSON.stringify({
    schemaVersion: 1,
    id: event.id,
    topic: event.topic,
    aggregate: {
      type: event.aggregateType,
      id: event.aggregateId,
      version: event.aggregateVersion,
    },
    payload: event.payload,
    occurredAt: event.occurredAt.toISOString(),
  });
}

async function failDelivery(input: {
  delivery: typeof cmsWebhookDeliveries.$inferSelect;
  lockToken: string;
  error: unknown;
  httpStatus?: number;
  responseSnippet?: string;
  runtime?: CmsWebhookRuntime;
}) {
  const db = runtimeDb(input.runtime);
  const now = runtimeNow(input.runtime);
  const attempt = input.delivery.attempt + 1;
  const exhausted = attempt >= input.delivery.maxAttempts;
  await db
    .update(cmsWebhookDeliveries)
    .set({
      status: exhausted ? "dead_letter" : "failed",
      attempt,
      httpStatus: input.httpStatus,
      responseSnippet: redactOptionalOperationalText(
        input.responseSnippet ?? "",
        500,
      ),
      lastError: redactOperationalText(
        input.error instanceof Error
          ? input.error.message
          : String(input.error),
      ),
      nextAttemptAt: exhausted
        ? now
        : new Date(
            now.getTime() +
              calculateCmsRetryDelay(
                webhookRetry,
                attempt,
                input.runtime?.random ?? Math.random,
              ),
          ),
      lockedUntil: null,
      lockToken: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(cmsWebhookDeliveries.id, input.delivery.id),
        eq(cmsWebhookDeliveries.lockToken, input.lockToken),
      ),
    );
  return exhausted ? ("dead_letter" as const) : ("failed" as const);
}

export async function deliverDueCmsWebhooks(
  now = new Date(),
  limit = 25,
  runtime?: CmsWebhookRuntime,
) {
  const db = runtimeDb(runtime);
  const rows = await db
    .select({
      delivery: cmsWebhookDeliveries,
      endpoint: cmsWebhookEndpoints,
      event: cmsOutboxEvents,
    })
    .from(cmsWebhookDeliveries)
    .innerJoin(
      cmsWebhookEndpoints,
      eq(cmsWebhookDeliveries.endpointId, cmsWebhookEndpoints.id),
    )
    .innerJoin(
      cmsOutboxEvents,
      eq(cmsWebhookDeliveries.eventId, cmsOutboxEvents.id),
    )
    .where(
      and(
        or(
          inArray(cmsWebhookDeliveries.status, ["pending", "failed"]),
          and(
            eq(cmsWebhookDeliveries.status, "delivering"),
            lte(cmsWebhookDeliveries.lockedUntil, now),
          ),
        ),
        lte(cmsWebhookDeliveries.nextAttemptAt, now),
        eq(cmsWebhookEndpoints.active, true),
        isNull(cmsWebhookEndpoints.revokedAt),
      ),
    )
    .orderBy(asc(cmsWebhookDeliveries.nextAttemptAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  const outcomes: Array<{ deliveryId: string; status: string }> = [];
  for (const row of rows) {
    const claimedAt = runtimeNow(runtime);
    const lockToken = crypto.randomUUID();
    await db
      .update(cmsWebhookDeliveries)
      .set({
        status: "delivering",
        lockedUntil: new Date(claimedAt.getTime() + webhookLeaseMs),
        lockToken,
        updatedAt: claimedAt,
      })
      .where(
        and(
          eq(cmsWebhookDeliveries.id, row.delivery.id),
          eq(cmsWebhookDeliveries.attempt, row.delivery.attempt),
          or(
            inArray(cmsWebhookDeliveries.status, ["pending", "failed"]),
            and(
              eq(cmsWebhookDeliveries.status, "delivering"),
              lte(cmsWebhookDeliveries.lockedUntil, claimedAt),
            ),
          ),
        ),
      );
    const claimed = await db.query.cmsWebhookDeliveries.findFirst({
      where: eq(cmsWebhookDeliveries.id, row.delivery.id),
    });
    if (
      !claimed ||
      claimed.status !== "delivering" ||
      claimed.attempt !== row.delivery.attempt ||
      claimed.lockToken !== lockToken
    ) {
      continue;
    }
    const body = deliveryBody(row.event);
    const timestamp = Math.floor(claimedAt.getTime() / 1000);
    try {
      const secret = await decryptWebhookSecret(
        row.endpoint.secretCiphertext,
        runtime,
      );
      const signature = await signCmsWebhookPayload({
        secret,
        timestamp,
        deliveryId: row.delivery.id,
        body,
      });
      const response = await (runtime?.fetch ?? fetch)(row.endpoint.url, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": row.delivery.dedupeKey,
          "X-CMS-Delivery": row.delivery.id,
          "X-CMS-Event": row.event.topic,
          "X-CMS-Signature": signature,
          "X-CMS-Timestamp": String(timestamp),
        },
        body,
        signal: AbortSignal.timeout(webhookLeaseMs - 5_000),
      });
      const responseSnippet = (await response.text().catch(() => "")).slice(
        0,
        500,
      );
      if (!response.ok) {
        const status = await failDelivery({
          delivery: row.delivery,
          lockToken,
          error: new Error(`Webhook returned ${response.status}`),
          httpStatus: response.status,
          responseSnippet,
          runtime,
        });
        outcomes.push({ deliveryId: row.delivery.id, status });
        continue;
      }
      const deliveredAt = runtimeNow(runtime);
      const payloadHash = bytesToHex(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
        ),
      );
      await db
        .update(cmsWebhookDeliveries)
        .set({
          status: "delivered",
          attempt: row.delivery.attempt + 1,
          payloadHash,
          httpStatus: response.status,
          responseSnippet: redactOptionalOperationalText(responseSnippet, 500),
          lastError: "",
          deliveredAt,
          lockedUntil: null,
          lockToken: null,
          updatedAt: deliveredAt,
        })
        .where(
          and(
            eq(cmsWebhookDeliveries.id, row.delivery.id),
            eq(cmsWebhookDeliveries.lockToken, lockToken),
          ),
        );
      outcomes.push({ deliveryId: row.delivery.id, status: "delivered" });
    } catch (error) {
      const status = await failDelivery({
        delivery: row.delivery,
        lockToken,
        error,
        runtime,
      });
      outcomes.push({ deliveryId: row.delivery.id, status });
    }
  }
  return {
    processed: outcomes.length,
    delivered: outcomes.filter((item) => item.status === "delivered").length,
    failed: outcomes.filter((item) => item.status === "failed").length,
    deadLetter: outcomes.filter((item) => item.status === "dead_letter").length,
    outcomes,
  };
}

export async function replayWebhookDelivery(
  input: z.infer<typeof replayWebhookDeliveryInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsWebhookRuntime,
) {
  const db = runtimeDb(runtime);
  const original = await db.query.cmsWebhookDeliveries.findFirst({
    where: eq(cmsWebhookDeliveries.id, input.deliveryId),
  });
  if (!original) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Webhook delivery not found",
    });
  }
  const now = runtimeNow(runtime);
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(cmsWebhookDeliveries).values({
      id,
      endpointId: original.endpointId,
      eventId: original.eventId,
      dedupeKey: `${original.endpointId}:${original.eventId}:replay:${id}`,
      status: "pending",
      attempt: 0,
      maxAttempts: original.maxAttempts,
      nextAttemptAt: now,
      replayOfDeliveryId: original.id,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditEvents).values(
      audit({
        action: "webhook.delivery_replay",
        actor,
        entityId: original.endpointId,
        after: { deliveryId: id, replayOfDeliveryId: original.id },
      }),
    ),
  ]);
  return { deliveryId: id, replayOfDeliveryId: original.id };
}

export async function listWebhookDeliveries(
  limit = 100,
  runtime?: CmsWebhookRuntime,
) {
  return runtimeDb(runtime)
    .select({
      delivery: cmsWebhookDeliveries,
      endpoint: {
        id: cmsWebhookEndpoints.id,
        name: cmsWebhookEndpoints.name,
        url: cmsWebhookEndpoints.url,
      },
      event: {
        id: cmsOutboxEvents.id,
        topic: cmsOutboxEvents.topic,
      },
    })
    .from(cmsWebhookDeliveries)
    .innerJoin(
      cmsWebhookEndpoints,
      eq(cmsWebhookDeliveries.endpointId, cmsWebhookEndpoints.id),
    )
    .innerJoin(
      cmsOutboxEvents,
      eq(cmsWebhookDeliveries.eventId, cmsOutboxEvents.id),
    )
    .orderBy(desc(cmsWebhookDeliveries.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}
