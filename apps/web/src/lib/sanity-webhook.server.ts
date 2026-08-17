import {
  receiveSanityWebhook,
  SanityWebhookRequestError,
  type SanityWebhookEvent,
} from "@agency/cms-provider-sanity/webhook";
import { env } from "@rem-viet/env/server";

import { readSanityWebhookEnvironment } from "./sanity-webhook-config";
import { createD1DeliveryStore } from "./sanity-webhook-delivery-store";

const retentionMs = 30 * 24 * 60 * 60 * 1000;

export async function handleSanityWebhook(request: Request) {
  let environment;
  try {
    environment = readSanityWebhookEnvironment(
      env as unknown as Record<string, unknown>,
    );
  } catch (error) {
    console.error("[sanity-webhook] Invalid configuration", error);
    return json({ code: "INVALID_CONFIGURATION" }, 503);
  }
  if (!environment) {
    return json({ code: "NOT_CONFIGURED" }, 503);
  }

  try {
    const receipt = await receiveSanityWebhook(request, {
      ...environment,
      deliveries: createD1DeliveryStore(databaseBinding()),
      revalidate: (event) => revalidateSanityPage(request, event),
    });
    return json(
      {
        accepted: true,
        duplicate: receipt.status === "duplicate",
        idempotencyKey: receipt.event.idempotencyKey,
        revalidation: receipt.revalidation,
      },
      receipt.status === "accepted" ? 202 : 200,
    );
  } catch (error) {
    if (error instanceof SanityWebhookRequestError) {
      return json({ code: error.code }, error.status, {
        ...(error.status === 405 ? { Allow: "POST" } : {}),
      });
    }
    console.error("[sanity-webhook] Delivery failed", error);
    return json({ code: "DELIVERY_FAILED" }, 503);
  }
}

export async function purgeExpiredSanityWebhookDeliveries(
  now: Date = new Date(),
) {
  const result = await databaseBinding()
    .prepare(
      `DELETE FROM sanity_webhook_deliveries
       WHERE status = 'completed' AND completed_at < ?`,
    )
    .bind(now.getTime() - retentionMs)
    .run();
  return { deleted: result.meta.changes };
}

async function revalidateSanityPage(
  request: Request,
  event: SanityWebhookEvent,
) {
  const cache = (
    globalThis.caches as (CacheStorage & { default?: Cache }) | undefined
  )?.default;
  if (!cache) {
    throw new Error("Cloudflare default cache is unavailable.");
  }
  const paths = [
    `/sanity-page/${encodeURIComponent(event.agencyId)}`,
    ...(event.agencyId === "home" ? ["/"] : []),
  ];
  await Promise.all(
    paths.map((path) =>
      cache.delete(new Request(new URL(path, request.url), { method: "GET" })),
    ),
  );
  return {
    paths,
    tags: [`sanity:agencyPage:${event.agencyId}`],
  };
}

function databaseBinding() {
  return env.DB as unknown as D1Database;
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
