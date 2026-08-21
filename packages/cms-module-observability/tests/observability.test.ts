import { describe, expect, test } from "bun:test";

import {
  cmsObservabilityExtensionManifest,
  cmsObservabilityModule,
  createCmsObservabilityHub,
  createCmsOpenTelemetrySink,
  createCmsSentryTelemetrySink,
  sanitizeCmsTelemetryValue,
  type CmsTelemetryEvent,
} from "../src";

describe("official observability module", () => {
  test("owns server-only lifecycle metadata and redacts credentials and PII", () => {
    expect(cmsObservabilityModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-observability",
      uninstall: { dataPolicy: "delete" },
    });
    expect(cmsObservabilityExtensionManifest).toMatchObject({
      id: "official/observability",
      entrypoints: [{ runtime: "server" }],
    });
    expect(cmsObservabilityExtensionManifest.secrets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "SENTRY_DSN",
          exposure: "server-only",
        }),
      ]),
    );
    expect(
      sanitizeCmsTelemetryValue({
        email: "client@example.com",
        nested: {
          authorization: "Bearer secret-token",
          note: "mail client@example.com",
        },
      }),
    ).toEqual({
      email: "[REDACTED]",
      nested: { authorization: "[REDACTED]", note: "mail [REDACTED_EMAIL]" },
    });
  });

  test("fans redacted spans/errors to Sentry and OpenTelemetry without exporter coupling", async () => {
    const events: CmsTelemetryEvent[] = [];
    const sentry: unknown[] = [];
    const sinkErrors: string[] = [];
    let clock = 0;
    const hub = createCmsObservabilityHub({
      sinks: [
        createCmsOpenTelemetrySink({
          recordSpan: (event) => events.push(event),
          recordMetric: (event) => events.push(event),
          recordException: (event) => events.push(event),
        }),
        createCmsSentryTelemetrySink({
          captureException: (error, context) => sentry.push({ error, context }),
          captureMessage: (message, context) =>
            sentry.push({ message, context }),
        }),
        {
          name: "failing-exporter",
          emit: () => Promise.reject(new Error("offline")),
        },
      ],
      random: () => 0,
      now: () => new Date(`2026-08-21T00:00:0${clock++}.000Z`),
      createTraceId: () => "a".repeat(32),
      onSinkError: (name) => sinkErrors.push(name),
    });
    await expect(
      hub.runSpan(
        { name: "cms.publish", attributes: { email: "owner@example.com" } },
        () => {
          throw new Error("publish failed for owner@example.com");
        },
      ),
    ).rejects.toThrow("publish failed");
    expect(events.map(({ type }) => type)).toEqual(["span", "exception"]);
    expect(events[1]).toMatchObject({
      message: "publish failed for [REDACTED_EMAIL]",
    });
    expect(JSON.stringify(events)).not.toContain("owner@example.com");
    expect(sentry).toHaveLength(2);
    expect(sinkErrors).toEqual(["failing-exporter", "failing-exporter"]);
  });
});
