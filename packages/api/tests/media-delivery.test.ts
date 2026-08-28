import { describe, expect, test } from "bun:test";

import {
  getMediaDeliveryPolicy,
  signPrivateMediaDelivery,
  verifyPrivateMediaDelivery,
} from "../src/services/media-delivery";

const secret = "test-private-media-secret-that-is-long-enough";
const key = "4503d467-4064-4b8c-a73e-7271b29e1399.png";
const now = new Date("2026-08-29T00:00:00.000Z");

describe("private media delivery", () => {
  test("binds a short-lived signature to the exact object key and expiry", async () => {
    const signed = await signPrivateMediaDelivery({
      key,
      url: `/api/media/${key}`,
      expiresAt: new Date(now.getTime() + 60_000),
      secret,
    });
    const url = new URL(signed, "https://cms.test");
    const proof = {
      expires: url.searchParams.get("expires"),
      signature: url.searchParams.get("signature"),
    };

    expect(
      await verifyPrivateMediaDelivery({ key, ...proof, secret, now }),
    ).toBe(true);
    expect(
      await verifyPrivateMediaDelivery({
        key: "c5ea3e1d-b1e3-4ad2-8674-55e7fb9f998e.png",
        ...proof,
        secret,
        now,
      }),
    ).toBe(false);
    expect(
      await verifyPrivateMediaDelivery({
        key,
        ...proof,
        secret,
        now: new Date(now.getTime() + 60_001),
      }),
    ).toBe(false);
  });

  test("rejects malformed and excessively long-lived proofs", async () => {
    expect(
      await verifyPrivateMediaDelivery({
        key,
        expires: String(now.getTime() + 3_600_001),
        signature: "x".repeat(43),
        secret,
        now,
      }),
    ).toBe(false);
    expect(
      await verifyPrivateMediaDelivery({
        key,
        expires: "not-a-time",
        signature: "x".repeat(43),
        secret,
        now,
      }),
    ).toBe(false);
  });

  test("loads visibility, lifecycle and expiry policy by exact key", async () => {
    const bindings: unknown[] = [];
    const database = {
      prepare(statement: string) {
        expect(statement).toContain("FROM media WHERE key = ?");
        return {
          bind(...values: unknown[]) {
            bindings.push(...values);
            return this;
          },
          async first() {
            return {
              visibility: "private" as const,
              status: "active" as const,
              expiresAt: 1_788_000_000_000,
            };
          },
        };
      },
    };

    await expect(
      getMediaDeliveryPolicy(key, database as never),
    ).resolves.toEqual({
      visibility: "private",
      status: "active",
      expiresAt: 1_788_000_000_000,
    });
    expect(bindings).toEqual([key]);
  });
});
