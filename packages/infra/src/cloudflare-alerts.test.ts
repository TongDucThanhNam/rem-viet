import { describe, expect, test } from "bun:test";

import { buildCloudflareAlertAuditReport } from "./cloudflare-alerts";

const capabilitySnapshot = {
  availableAlerts: {
    "Health Checks": [
      {
        type: "health_check_status_notification",
        display_name: "Health Checks status notifier",
      },
    ],
    Pages: [{ type: "pages_event_alert", display_name: "Pages Alerts" }],
  },
  destinationsEligible: {
    email: { type: "email", eligible: true, ready: true },
    pagerduty: { type: "pagerduty", eligible: false, ready: false },
    webhooks: { type: "webhooks", eligible: false, ready: false },
  },
  policies: [
    {
      id: "secret-policy-id",
      name: "Budget owner@example.com",
      alert_type: "billing_budget_alert",
      enabled: true,
      mechanisms: { email: [{ id: "owner@example.com" }] },
    },
  ],
  history: [],
};

describe("Cloudflare alert audit", () => {
  test("separates account capability from configured release evidence", () => {
    const report = buildCloudflareAlertAuditReport(capabilitySnapshot);

    expect(report.capabilityReady).toBe(true);
    expect(report.releaseEvidenceReady).toBe(false);
    expect(report.healthCheckEmailPolicyConfigured).toBe(false);
    expect(report.healthCheckEmailReceiptRecorded).toBe(false);
    expect(report.gaps).toEqual([
      "No enabled Health Check or Workers Observability email notification policy is configured.",
      "No Health Check or Workers Observability email dispatch receipt is present in alert history.",
    ]);
  });

  test("accepts Cloudflare object and SDK-style array destination payloads", () => {
    const report = buildCloudflareAlertAuditReport({
      ...capabilitySnapshot,
      destinationsEligible: {
        Email: [{ type: "email", eligible: true, ready: true }],
        Webhooks: [{ type: "webhook", eligible: true, ready: false }],
      },
    });

    expect(report.destinations).toEqual([
      { type: "email", eligible: true, ready: true },
      { type: "webhook", eligible: true, ready: false },
    ]);
  });

  test("passes only after policy and dispatch evidence exist", () => {
    const report = buildCloudflareAlertAuditReport({
      ...capabilitySnapshot,
      policies: [
        {
          id: "private-policy-id",
          alert_type: "health_check_status_notification",
          enabled: true,
          mechanisms: { email: [{ id: "ops@example.com" }] },
        },
      ],
      history: [
        {
          alert_type: "health_check_status_notification",
          alert_body: "private provider body",
          mechanism: "ops@example.com",
          mechanism_type: "email",
          policy_id: "private-policy-id",
          sent: "2026-08-14T12:00:00Z",
        },
      ],
    });

    expect(report.releaseEvidenceReady).toBe(true);
    expect(report.gaps).toEqual([]);
  });

  test("accepts Workers Observability as the operational alert route", () => {
    const report = buildCloudflareAlertAuditReport({
      ...capabilitySnapshot,
      availableAlerts: {
        "Workers Observability": [
          {
            type: "workers_observability_alert",
            display_name: "Alert Policy",
          },
        ],
      },
      policies: [
        {
          id: "workers-policy-id",
          alert_type: "workers_observability_alert",
          enabled: true,
          mechanisms: { email: [{ id: "ops@example.com" }] },
        },
      ],
      history: [
        {
          policy_id: "workers-policy-id",
          alert_type: "workers_observability_alert",
          mechanism_type: "email",
          sent: "2026-08-14T12:00:00Z",
        },
      ],
    });

    expect(report.workerObservabilityAlertAvailable).toBe(true);
    expect(report.operationalEmailPolicyConfigured).toBe(true);
    expect(report.operationalEmailReceiptRecorded).toBe(true);
    expect(report.releaseEvidenceReady).toBe(true);
  });

  test("rejects a dispatch from an unrelated policy of the same type", () => {
    const report = buildCloudflareAlertAuditReport({
      ...capabilitySnapshot,
      policies: [
        {
          id: "expected-policy-id",
          alert_type: "workers_observability_alert",
          enabled: true,
          mechanisms: { email: [{ id: "ops@example.com" }] },
        },
      ],
      history: [
        {
          id: "unrelated-dispatch-id",
          policy_id: "another-policy-id",
          alert_type: "workers_observability_alert",
          mechanism_type: "email",
          sent: "2026-08-14T12:00:00Z",
        },
      ],
    });

    expect(report.operationalEmailPolicyConfigured).toBe(true);
    expect(report.operationalEmailReceiptRecorded).toBe(false);
    expect(report.releaseEvidenceReady).toBe(false);
  });

  test("never copies recipient, body, URL or provider identifiers", () => {
    const report = buildCloudflareAlertAuditReport({
      ...capabilitySnapshot,
      policies: [
        {
          id: "secret-policy-id",
          name: "owner@example.com",
          description: "private description",
          filters: { zones: ["secret-zone"] },
          alert_type: "health_check_status_notification",
          enabled: true,
          mechanisms: {
            email: [{ id: "owner@example.com" }],
            webhooks: [{ id: "https://hooks.example.com/private" }],
          },
        },
      ],
      history: [
        {
          id: "secret-history-id",
          alert_type: "health_check_status_notification",
          alert_body: "private provider body",
          mechanism: "owner@example.com",
          mechanism_type: "email",
          policy_id: "secret-policy-id",
          sent: "2026-08-14T12:00:00Z",
        },
      ],
    });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("private provider body");
    expect(serialized).not.toContain("hooks.example.com");
    expect(serialized).not.toContain("secret-policy-id");
    expect(serialized).not.toContain("secret-zone");
  });
});
