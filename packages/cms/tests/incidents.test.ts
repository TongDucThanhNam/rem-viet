import { describe, expect, test } from "bun:test";

import {
  createOperationalIncidentEvent,
  operationalIncidentEventSchema,
  redactOperationalText,
} from "../src/incidents";

describe("operational incident contract", () => {
  test("builds a stable alert fingerprint without actor or payload data", () => {
    const event = createOperationalIncidentEvent({
      category: "publish",
      operation: "page.publish.scheduled",
      source: "scheduler",
      error: Object.assign(new Error("D1 write failed"), { code: 7500 }),
      entityType: "page",
      entityId: "page-123",
      detail: { attempts: 2, scheduled: true },
      now: new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(operationalIncidentEventSchema.parse(event)).toEqual(event);
    expect(event.fingerprint).toBe("publish:page.publish.scheduled");
    expect(event.error).toEqual({
      name: "Error",
      message: "D1 write failed",
      code: "7500",
    });
    expect(event.timestamp).toBe("2026-08-14T12:00:00.000Z");
    expect(event).not.toHaveProperty("actorEmail");
    expect(event).not.toHaveProperty("payload");
  });

  test("redacts credentials, recipients, URLs and long opaque tokens", () => {
    const event = createOperationalIncidentEvent({
      category: "notification",
      operation: "lead.notification.send",
      source: "request",
      error: new Error(
        "Bearer secret-token owner@example.com https://provider.test/hook?token=private cfoa-abcdefghijklmnopqrstuvwxyz123456",
      ),
      detail: {
        destination: "owner@example.com",
        providerUrl: "https://provider.test/private?id=123",
        opaque: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF",
      },
    });
    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("provider.test");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyz1234567890");
    expect(serialized).toContain("[redacted-");
  });

  test("normalizes multiline provider text and enforces the size limit", () => {
    const result = redactOperationalText(
      `first\nsecond ${"short phrase ".repeat(100)}`,
    );

    expect(result.startsWith("first second")).toBe(true);
    expect(result.length).toBe(500);
  });
});
