import { describe, expect, test } from "bun:test";

import {
  buildCloudflareVitalsAuditReport,
  cloudflareVitalsEvidenceSql,
  cloudflareVitalsEvidenceWindow,
} from "./cloudflare-vitals";

const generatedAt = new Date("2026-08-14T12:00:00.000Z");

describe("Cloudflare Web Vitals audit", () => {
  test("builds a fixed 28-day, public-traffic-only read-only query window", () => {
    const window = cloudflareVitalsEvidenceWindow(generatedAt);

    expect(window.days).toBe(28);
    expect(window.from.toISOString()).toBe("2026-07-17T12:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-14T12:00:00.000Z");
    expect(window.params).toEqual([1784289600000, 1786708800000]);
    expect(cloudflareVitalsEvidenceSql).toContain(
      "path NOT LIKE '/__synthetic__/%'",
    );
    expect(cloudflareVitalsEvidenceSql).toContain("path NOT LIKE '/admin/%'");
    expect(cloudflareVitalsEvidenceSql).toContain("path NOT LIKE '/api/%'");
    expect(cloudflareVitalsEvidenceSql).toContain("path != '/dang-nhap'");
    expect(cloudflareVitalsEvidenceSql).toContain(
      "path NOT LIKE '/dang-nhap/%'",
    );
    expect(cloudflareVitalsEvidenceSql).toContain("path != '/login'");
    expect(cloudflareVitalsEvidenceSql).toContain("path != '/quen-mat-khau'");
    expect(cloudflareVitalsEvidenceSql).toContain(
      "path NOT LIKE '/sanity-preview/%'",
    );
    expect(cloudflareVitalsEvidenceSql).toContain("schema_version = 1");
    expect(cloudflareVitalsEvidenceSql).toContain("row_number() OVER");
    expect(cloudflareVitalsEvidenceSql).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/u,
    );
  });

  test("emits copy-safe release evidence only when every metric passes", () => {
    const report = buildCloudflareVitalsAuditReport({
      origin: "https://staging.example.com",
      generatedAt,
      rows: [
        { name: "INP", sample_count: 77, p75: 199.5 },
        { name: "CLS", sample_count: 75, p75: 0.0996 },
        { name: "LCP", sample_count: 90, p75: 2499.6 },
      ],
    });

    expect(report.ready).toBe(true);
    expect(report.metrics.CLS.p75).toBe(0.1);
    expect(report.metrics.LCP.p75).toBe(2500);
    expect(report.metrics.INP.p75).toBe(200);
    expect(report.releaseEvidence).toEqual({
      origin: "https://staging.example.com",
      windowDays: 28,
      automatedTrafficExcluded: true,
      exportedAt: "2026-08-14T12:00:00.000Z",
      metrics: {
        CLS: { samples: 75, p75: 0.1, unit: "score" },
        LCP: { samples: 90, p75: 2500, unit: "ms" },
        INP: { samples: 77, p75: 200, unit: "ms" },
      },
    });
  });

  test("keeps insufficient and over-budget results out of release evidence", () => {
    const report = buildCloudflareVitalsAuditReport({
      origin: "https://staging.example.com",
      generatedAt,
      rows: [
        { name: "CLS", sample_count: 74, p75: 0.01 },
        { name: "LCP", sample_count: 75, p75: 2501 },
        { name: "INP", sample_count: 0, p75: null },
      ],
    });

    expect(report.ready).toBe(false);
    expect(report.metrics.CLS.status).toBe("insufficient");
    expect(report.metrics.LCP.status).toBe("fail");
    expect(report.metrics.INP.status).toBe("insufficient");
    expect(report.releaseEvidence).toBeNull();
  });

  test("rejects duplicate, missing or internally inconsistent query rows", () => {
    expect(() =>
      buildCloudflareVitalsAuditReport({
        origin: "https://staging.example.com",
        generatedAt,
        rows: [
          { name: "CLS", sample_count: 75, p75: 0.01 },
          { name: "CLS", sample_count: 75, p75: 0.01 },
          { name: "INP", sample_count: 75, p75: 100 },
        ],
      }),
    ).toThrow("duplicate or missing metrics");

    expect(() =>
      buildCloudflareVitalsAuditReport({
        origin: "https://staging.example.com",
        generatedAt,
        rows: [
          { name: "CLS", sample_count: 75, p75: null },
          { name: "LCP", sample_count: 75, p75: 1000 },
          { name: "INP", sample_count: 75, p75: 100 },
        ],
      }),
    ).toThrow("inconsistent CLS data");
  });
});
