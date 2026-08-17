import { describe, expect, mock, test } from "bun:test";

mock.module("cloudflare:workers", () => ({ env: {} }));

const { notificationRuntimeStatus, sendLeadNotifications } =
  await import("../src/services/notifications");
const { mergeNotificationResults, nextNotificationRetryAt } =
  await import("../src/services/operations");

const definition = {
  key: "contact",
  name: "Liên hệ",
  fields: [{ key: "email", label: "Email", type: "email" as const }],
  notificationSettings: { email: true, telegram: true },
  active: true,
  retentionDays: 365,
};

const submission = {
  id: "submission-123",
  formId: "form-123",
  formKey: "contact",
  payload: { email: "lead@example.com" },
  status: "new" as const,
  sourcePage: "/contact",
  ipHash: "hash",
  userAgent: "test",
  internalNote: "",
  idempotencyKey: "public-request-123",
  notificationStatus: "pending" as const,
  notificationResults: {},
  notifiedAt: null,
  notificationError: "",
  createdAt: new Date("2026-08-14T00:00:00.000Z"),
  updatedAt: new Date("2026-08-14T00:00:00.000Z"),
};

describe("lead notification delivery", () => {
  test("uses a stable Resend idempotency key and stores the provider id", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return Response.json({ id: "email-provider-123" });
    }) as typeof fetch;

    const first = await sendLeadNotifications({
      definition,
      submission,
      adapters: ["email"],
      runtime: {
        values: {
          RESEND_API_KEY: "re_test",
          LEAD_NOTIFICATION_EMAIL: "owner@example.com",
          EMAIL_FROM: "Website <leads@example.com>",
        },
        fetch: fetcher,
      },
    });
    const second = await sendLeadNotifications({
      definition,
      submission,
      adapters: ["email"],
      runtime: {
        values: {
          RESEND_API_KEY: "re_test",
          LEAD_NOTIFICATION_EMAIL: "owner@example.com",
          EMAIL_FROM: "Website <leads@example.com>",
        },
        fetch: fetcher,
      },
    });

    expect(first).toEqual([
      {
        adapter: "email",
        status: "sent",
        providerId: "email-provider-123",
      },
    ]);
    expect(second).toEqual(first);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url).toBe("https://api.resend.com/emails");
      expect(new Headers(request.init?.headers).get("Idempotency-Key")).toBe(
        "lead/submission-123/email-v1",
      );
    }
  });

  test("skips an unconfigured optional provider in local environments", async () => {
    const results = await sendLeadNotifications({
      definition,
      submission,
      adapters: ["email"],
      runtime: { values: {} },
    });

    expect(results).toEqual([{ adapter: "email", status: "skipped" }]);
  });

  test("fails closed when a required provider lacks credentials", async () => {
    let called = false;
    const results = await sendLeadNotifications({
      definition,
      submission,
      adapters: ["email"],
      runtime: {
        values: { NOTIFICATIONS_REQUIRED: "1" },
        fetch: (async () => {
          called = true;
          return Response.json({});
        }) as typeof fetch,
      },
    });

    expect(results).toEqual([
      {
        adapter: "email",
        status: "failed",
        error: "Email notification provider is not configured",
      },
    ]);
    expect(called).toBe(false);
  });

  test("keeps Telegram optional when its credentials are absent", async () => {
    const results = await sendLeadNotifications({
      definition,
      submission,
      adapters: ["telegram"],
      runtime: { values: { NOTIFICATIONS_REQUIRED: "1" } },
    });

    expect(results).toEqual([{ adapter: "telegram", status: "skipped" }]);
  });

  test("reports only missing provider names in runtime health", () => {
    expect(
      notificationRuntimeStatus([definition], {
        NOTIFICATIONS_REQUIRED: "1",
      }),
    ).toEqual({
      required: true,
      status: "degraded",
      missing: ["email"],
    });

    expect(
      notificationRuntimeStatus([definition], {
        NOTIFICATIONS_REQUIRED: "0",
      }),
    ).toEqual({
      required: false,
      status: "ok",
      missing: ["email"],
    });
  });
});

describe("lead notification retry policy", () => {
  test("does not erase a provider failure when a retry is skipped", () => {
    const failed = {
      adapter: "email" as const,
      status: "failed" as const,
      error: "provider timeout",
    };

    expect(
      mergeNotificationResults(
        [failed],
        [{ adapter: "email", status: "skipped" }],
      ),
    ).toEqual([failed]);
  });

  test("schedules retries inside the deduplication window only", () => {
    const createdAt = new Date("2026-08-14T00:00:00.000Z");
    const failed = [{ adapter: "email" as const, status: "failed" as const }];

    expect(nextNotificationRetryAt(failed, 1, createdAt, createdAt)).toBe(
      "2026-08-14T00:01:00.000Z",
    );
    expect(nextNotificationRetryAt(failed, 6, createdAt, createdAt)).toBe(
      undefined,
    );
    expect(
      nextNotificationRetryAt(
        failed,
        1,
        new Date("2026-08-14T23:00:00.000Z"),
        createdAt,
      ),
    ).toBe(undefined);
  });
});
