import { describe, expect, test } from "bun:test";

import {
  buildSecondSiteReleaseEvidence,
  measuredMinutes,
  summarizePlaywrightSmoke,
} from "./site-staging-smoke-lib";

describe("clean-checkout second-site staging smoke", () => {
  test("measures operator timestamps and builds the schema-valid fragment", () => {
    expect(
      measuredMinutes(
        {
          startedAt: "2026-08-15T01:00:00.000Z",
          completedAt: "2026-08-15T01:55:00.000Z",
        },
        "Deploy",
      ),
    ).toBe(55);
    expect(
      buildSecondSiteReleaseEvidence({
        siteId: "acme-demo",
        origin: "https://acme-demo.example.com",
        resources: {
          worker: "acme-demo-web-staging",
          d1: "acme-demo-db-staging",
          r2: "acme-demo-media-staging",
        },
        deploy: {
          startedAt: "2026-08-15T01:00:00.000Z",
          completedAt: "2026-08-15T01:55:00.000Z",
        },
        brandAndDemoContent: {
          startedAt: "2026-08-14T08:00:00.000Z",
          completedAt: "2026-08-14T12:00:00.000Z",
        },
        verifiedAt: "2026-08-15T02:00:00.000Z",
      }),
    ).toMatchObject({
      cleanCheckout: true,
      deployDurationMinutes: 55,
      brandAndDemoContentDurationMinutes: 240,
      smoke: {
        desktopChrome: true,
        mobileChrome: true,
        cloudflarePageProviderConformance: true,
        adminLogin: true,
        mediaUpload: true,
        draftPreview: true,
        publishWithoutDeploy: true,
        publicPublishedRead: true,
        leadSubmission: true,
        sitemap: true,
      },
    });
  });

  test("rejects reversed timestamps and KPI overruns", () => {
    expect(() =>
      measuredMinutes(
        {
          startedAt: "2026-08-15T02:00:00.000Z",
          completedAt: "2026-08-15T01:00:00.000Z",
        },
        "Deploy",
      ),
    ).toThrow(/must follow/);
    expect(() =>
      buildSecondSiteReleaseEvidence({
        siteId: "acme-demo",
        origin: "https://acme-demo.example.com",
        resources: {
          worker: "acme-demo-web-staging",
          d1: "acme-demo-db-staging",
          r2: "acme-demo-media-staging",
        },
        deploy: {
          startedAt: "2026-08-15T01:00:00.000Z",
          completedAt: "2026-08-15T03:00:01.000Z",
        },
        brandAndDemoContent: {
          startedAt: "2026-08-14T08:00:00.000Z",
          completedAt: "2026-08-14T12:00:00.000Z",
        },
        verifiedAt: "2026-08-15T03:01:00.000Z",
      }),
    ).toThrow();
    expect(() =>
      buildSecondSiteReleaseEvidence({
        siteId: "acme-demo",
        origin: "https://acme-demo.example.com",
        resources: {
          worker: "acme-demo-web-staging",
          d1: "acme-demo-db-staging",
          r2: "acme-demo-media-staging",
        },
        deploy: {
          startedAt: "2026-08-15T01:00:00.000Z",
          completedAt: "2026-08-15T01:55:00.000Z",
        },
        brandAndDemoContent: {
          startedAt: "2026-08-14T08:00:00.000Z",
          completedAt: "2026-08-14T12:00:00.000Z",
        },
        verifiedAt: "2026-08-15T01:54:59.000Z",
      }),
    ).toThrow(/Verification must follow/);
  });

  test("accepts only each exact device-specific Playwright result", () => {
    expect(
      summarizePlaywrightSmoke(
        {
          stats: { expected: 4, unexpected: 0, flaky: 0, skipped: 0 },
        },
        4,
      ),
    ).toEqual({ expected: 4, unexpected: 0, flaky: 0, skipped: 0 });
    expect(() =>
      summarizePlaywrightSmoke(
        {
          stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 1 },
        },
        4,
      ),
    ).toThrow(/exact expected test set/);
    expect(
      summarizePlaywrightSmoke(
        {
          stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 0 },
        },
        2,
      ),
    ).toEqual({ expected: 2, unexpected: 0, flaky: 0, skipped: 0 });
    expect(() =>
      summarizePlaywrightSmoke(
        {
          stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 1 },
        },
        2,
      ),
    ).toThrow(/exact expected test set/);
  });
});
