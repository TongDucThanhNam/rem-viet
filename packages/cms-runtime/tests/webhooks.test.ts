import { describe, expect, test } from "bun:test";

import {
  signCmsWebhookPayload,
  verifyCmsWebhookRequest,
} from "../src/webhooks";

describe("signed CMS webhook consumer", () => {
  test("accepts current or rotating secrets exactly once", async () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000);
    const body = JSON.stringify({ id: "event-1" });
    const claims = new Set<string>();
    const replayStore = {
      async claim(input: { deliveryId: string }) {
        if (claims.has(input.deliveryId)) return false;
        claims.add(input.deliveryId);
        return true;
      },
    };
    const signature = await signCmsWebhookPayload({
      secret: "previous-secret",
      timestamp,
      deliveryId: "delivery-1",
      body,
    });

    await expect(
      verifyCmsWebhookRequest({
        body,
        deliveryId: "delivery-1",
        signature,
        timestamp,
        secrets: ["current-secret", "previous-secret"],
        replayStore,
        now,
      }),
    ).resolves.toMatchObject({ ok: true, deliveryId: "delivery-1" });
    await expect(
      verifyCmsWebhookRequest({
        body,
        deliveryId: "delivery-1",
        signature,
        timestamp,
        secrets: ["current-secret", "previous-secret"],
        replayStore,
        now,
      }),
    ).resolves.toEqual({ ok: false, reason: "replayed_delivery" });
  });

  test("rejects tampering and stale timestamps before claiming replay state", async () => {
    const now = new Date("2026-08-21T00:10:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000) - 601;
    let claims = 0;
    const replayStore = {
      async claim() {
        claims += 1;
        return true;
      },
    };
    const signature = await signCmsWebhookPayload({
      secret: "secret",
      timestamp,
      deliveryId: "delivery-2",
      body: "original",
    });
    await expect(
      verifyCmsWebhookRequest({
        body: "original",
        deliveryId: "delivery-2",
        signature,
        timestamp,
        secrets: ["secret"],
        replayStore,
        now,
        toleranceSeconds: 300,
      }),
    ).resolves.toEqual({ ok: false, reason: "stale_timestamp" });
    await expect(
      verifyCmsWebhookRequest({
        body: "tampered",
        deliveryId: "delivery-2",
        signature,
        timestamp: Math.floor(now.getTime() / 1000),
        secrets: ["secret"],
        replayStore,
        now,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_signature" });
    expect(claims).toBe(0);
  });
});
