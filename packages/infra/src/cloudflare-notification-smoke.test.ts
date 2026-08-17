import { describe, expect, test } from "bun:test";

import {
  buildCloudflareNotificationSmokeReport,
  buildNotificationSmokePayload,
  cloudflareNotificationDefinitionSql,
  cloudflareNotificationSubmissionSql,
  notificationSmokeIdempotencyKey,
  parseCloudflareNotificationDefinition,
  parseNotificationSmokeHealth,
} from "./cloudflare-notification-smoke";

const runId = "9743ed2d-e177-437b-aada-c3aab0b9ba43";
const generatedAt = new Date("2026-08-14T12:30:00.000Z");
const providerMessageId = "provider-message-private";

const definitionRows = [
  {
    key: "contact",
    name: "Contact",
    fields: JSON.stringify([
      { key: "name", label: "Name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      {
        key: "topic",
        label: "Topic",
        type: "select",
        required: true,
        options: ["Consultation"],
      },
      {
        key: "consent",
        label: "Consent",
        type: "checkbox",
        required: true,
      },
      {
        key: "message",
        label: "Message",
        type: "textarea",
        required: true,
      },
    ]),
    notification_settings: JSON.stringify({ email: true, telegram: false }),
    active: 1,
    retention_days: 365,
  },
];

function storedRows(overrides: Record<string, unknown> = {}) {
  return [
    {
      id: "submission-1",
      idempotency_key: notificationSmokeIdempotencyKey(runId),
      notification_status: "sent",
      notification_results: JSON.stringify({
        adapters: [
          {
            adapter: "email",
            status: "sent",
            providerId: providerMessageId,
          },
        ],
        attemptCount: 1,
        lastAttemptAt: "2026-08-14T12:00:00.000Z",
      }),
      notified_at: 1_786_708_800_000,
      ...overrides,
    },
  ];
}

describe("Cloudflare notification smoke", () => {
  test("uses read-only, exact-key D1 queries", () => {
    for (const sql of [
      cloudflareNotificationDefinitionSql,
      cloudflareNotificationSubmissionSql,
    ]) {
      expect(sql).toMatch(/^SELECT/u);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/u);
    }
    expect(cloudflareNotificationSubmissionSql).toContain(
      "WHERE idempotency_key = ?",
    );
  });

  test("builds a bounded payload from the deployed human form", () => {
    const definition = parseCloudflareNotificationDefinition(definitionRows);
    const submission = buildNotificationSmokePayload(definition, runId);

    expect(submission).toEqual({
      formKey: "contact",
      payload: {
        name: `Notification smoke ${runId}`,
        email: "notification-smoke@example.com",
        topic: "Consultation",
        consent: true,
        message: `Agency CMS exactly-once notification smoke ${runId}`,
      },
      sourcePage: "/__synthetic__/notification-smoke",
      website: "",
      idempotencyKey: `agency-cms-notification-smoke/${runId}`,
    });
  });

  test("fails closed when staging health omits provider configuration", () => {
    expect(
      parseNotificationSmokeHealth({
        status: "ok",
        checks: {
          notifications: { status: "ok", failed: 0, stalePending: 0 },
        },
      }),
    ).toEqual({
      healthStatus: "ok",
      providerConfigurationExposed: false,
      emailRuntimeConfigured: false,
      deployment: null,
      cleanDeployment: false,
    });
    expect(
      parseNotificationSmokeHealth({
        status: "ok",
        checks: {
          notifications: {
            status: "ok",
            configuration: "ok",
            missingProviders: [],
          },
        },
      }),
    ).toEqual({
      healthStatus: "ok",
      providerConfigurationExposed: true,
      emailRuntimeConfigured: true,
      deployment: null,
      cleanDeployment: false,
    });
  });

  test("parses clean deployment provenance without weakening notification health", () => {
    const deployment = {
      siteId: "rem-viet",
      stage: "staging",
      commit: "a".repeat(40),
      inputSha256: "b".repeat(64),
      sourceState: "clean",
    } as const;
    expect(
      parseNotificationSmokeHealth({
        status: "degraded",
        deployment,
        checks: {
          notifications: {
            configuration: "degraded",
            missingProviders: ["email"],
          },
        },
      }),
    ).toEqual({
      healthStatus: "degraded",
      providerConfigurationExposed: true,
      emailRuntimeConfigured: false,
      deployment,
      cleanDeployment: true,
    });
  });

  test("proves apply persisted and provider-accepted exactly once", () => {
    const report = buildCloudflareNotificationSmokeReport({
      mode: "apply",
      origin: "https://staging.example.com",
      runId,
      generatedAt,
      beforeRows: [],
      afterRows: storedRows(),
      responses: [
        { accepted: true, duplicate: false, id: "submission-1" },
        { accepted: true, duplicate: true, id: "submission-1" },
      ],
    });

    expect(report.ready).toBe(false);
    expect(report.checks).toEqual({
      adminInboxCreated: true,
      persistedExactlyOnce: true,
      duplicateSuppressed: true,
      providerAcceptedExactlyOnce: true,
      recipientReceiptConfirmed: false,
    });
    expect(report.submission).toEqual({
      notificationStatus: "sent",
      attemptCount: 1,
      providerMessageRecorded: true,
      notifiedAt: "2026-08-14T12:00:00.000Z",
    });
    expect(report.releaseEvidence).toBeNull();
    expect(JSON.stringify(report)).not.toContain(providerMessageId);
  });

  test("emits release evidence only after duplicate replay and receipt attestation", () => {
    const report = buildCloudflareNotificationSmokeReport({
      mode: "verify",
      origin: "https://staging.example.com",
      runId,
      generatedAt,
      beforeRows: storedRows(),
      afterRows: storedRows(),
      responses: [{ accepted: true, duplicate: true, id: "submission-1" }],
      receiptConfirmedAt: "2026-08-14T12:05:00.000Z",
    });

    expect(report.ready).toBe(true);
    expect(report.releaseEvidence).toEqual({
      provider: "resend",
      submissionId: "submission-1",
      adminInboxCreated: true,
      deliveredCount: 1,
      providerMessageId,
      verifiedAt: "2026-08-14T12:05:00.000Z",
    });
  });

  test("fails closed on extra attempts, changed provider state or invalid receipt", () => {
    expect(() =>
      buildCloudflareNotificationSmokeReport({
        mode: "verify",
        origin: "https://staging.example.com",
        runId,
        generatedAt,
        beforeRows: storedRows(),
        afterRows: storedRows({
          notification_results: JSON.stringify({
            adapters: [
              {
                adapter: "email",
                status: "sent",
                providerId: providerMessageId,
              },
            ],
            attemptCount: 2,
          }),
        }),
        responses: [{ accepted: true, duplicate: true, id: "submission-1" }],
      }),
    ).toThrow("exactly one provider attempt");

    expect(() =>
      buildCloudflareNotificationSmokeReport({
        mode: "verify",
        origin: "https://staging.example.com",
        runId,
        generatedAt,
        beforeRows: storedRows(),
        afterRows: storedRows(),
        responses: [{ accepted: true, duplicate: true, id: "submission-1" }],
        receiptConfirmedAt: "2026-08-14T11:59:59.000Z",
      }),
    ).toThrow("cannot predate");
  });

  test("rejects inactive or email-disabled smoke forms", () => {
    expect(() =>
      parseCloudflareNotificationDefinition([
        { ...definitionRows[0], active: 0 },
      ]),
    ).toThrow("must be active");
    expect(() =>
      parseCloudflareNotificationDefinition([
        {
          ...definitionRows[0],
          notification_settings: JSON.stringify({
            email: false,
            telegram: false,
          }),
        },
      ]),
    ).toThrow("must have email enabled");
  });
});
