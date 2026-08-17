import { describe, expect, test } from "bun:test";

import {
  createStandardPageBlockId,
  ensureStandardPageBlockIds,
  isPublicWebVitalPath,
  pageRevisionSnapshotSchema,
  postRevisionSnapshotSchema,
  roleHasCapability,
  webVitalReportSchema,
} from "../src";

describe("standard page block identity", () => {
  test("upgrades legacy blocks once and preserves unique persisted IDs", () => {
    const upgraded = ensureStandardPageBlockIds([
      { type: "richText", content: "Intro" },
      { id: "standard-cta-kept", type: "cta", title: "Talk", href: "/talk" },
      { id: "standard-cta-kept", type: "productGrid", limit: 6 },
    ]);

    expect(upgraded.map((block) => block.id)).toEqual([
      "standard-0-richText",
      "standard-cta-kept",
      "standard-2-productGrid",
    ]);
    expect(ensureStandardPageBlockIds(upgraded)).toEqual(upgraded);
  });

  test("creates bounded collision-safe IDs for new and duplicated blocks", () => {
    const first = createStandardPageBlockId("richText", [], "same value");
    const second = createStandardPageBlockId("richText", [first], "same value");

    expect(first).toBe("standard-richText-same-value");
    expect(second).toBe("standard-richText-same-value-2");
    expect(second.length).toBeLessThanOrEqual(128);
  });
});

describe("CMS revision contracts", () => {
  test("accepts a valid page snapshot", () => {
    const result = pageRevisionSnapshotSchema.safeParse({
      title: "Trang chủ",
      slug: "home",
      blocks: [
        {
          type: "hero",
          title: "Rèm Vina",
          subtitle: "Bảo vệ gần như vô hình",
        },
      ],
      seoTitle: "Rèm Vina",
      seoDescription: "Lưới chống muỗi may đo",
    });

    expect(result.success).toBe(true);
  });

  test("fails closed for an invalid public block", () => {
    const result = pageRevisionSnapshotSchema.safeParse({
      title: "Trang chủ",
      slug: "home",
      blocks: [{ type: "hero", title: "" }],
      seoTitle: "",
      seoDescription: "",
    });

    expect(result.success).toBe(false);
  });

  test("only accepts JSON-safe post table-of-contents data", () => {
    const valid = postRevisionSnapshotSchema.safeParse({
      title: "Bài viết",
      slug: "bai-viet",
      tableOfContents: [{ id: "intro", label: "Giới thiệu" }],
    });
    const invalid = postRevisionSnapshotSchema.safeParse({
      title: "Bài viết",
      slug: "bai-viet",
      tableOfContents: { render: () => "unsafe" },
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});

describe("CMS role policy", () => {
  test("editor can write drafts and request review but cannot decide, publish, or restore", () => {
    expect(roleHasCapability("editor", "content.write")).toBe(true);
    expect(roleHasCapability("editor", "content.review.request")).toBe(true);
    expect(roleHasCapability("editor", "content.review.decide")).toBe(false);
    expect(roleHasCapability("editor", "content.publish")).toBe(false);
    expect(roleHasCapability("editor", "content.schedule")).toBe(false);
    expect(roleHasCapability("editor", "content.restore")).toBe(false);
  });

  test("admin can publish but cannot manage owners", () => {
    expect(roleHasCapability("admin", "content.review.decide")).toBe(true);
    expect(roleHasCapability("admin", "content.publish")).toBe(true);
    expect(roleHasCapability("admin", "content.schedule")).toBe(true);
    expect(roleHasCapability("admin", "staff.manage")).toBe(false);
  });

  test("owner has every declared capability", () => {
    expect(roleHasCapability("owner", "content.delete")).toBe(true);
    expect(roleHasCapability("owner", "staff.manage")).toBe(true);
  });
});

describe("privacy-safe Web Vitals contract", () => {
  const validReport = {
    schemaVersion: 1,
    id: "v5-1786698000000-1234567890123",
    name: "LCP",
    value: 2_125.4,
    rating: "good",
    navigationType: "navigate",
    path: "/bai-viet/rem-cua",
    deviceClass: "mobile",
  };

  test("accepts the bounded anonymous report", () => {
    expect(webVitalReportSchema.safeParse(validReport).success).toBe(true);
  });

  test("keeps admin, API, authentication and preview paths out of RUM", () => {
    for (const path of [
      "/admin",
      "/admin/performance",
      "/api/vitals",
      "/dang-nhap",
      "/dang-nhap/",
      "/login",
      "/quen-mat-khau",
      "/sanity-preview/draft-id",
      "/__synthetic__/e2e",
    ]) {
      expect(isPublicWebVitalPath(path)).toBe(false);
    }
    expect(isPublicWebVitalPath("/administrator-guide")).toBe(true);
    expect(isPublicWebVitalPath("/bai-viet/rem-cua")).toBe(true);
    expect(
      webVitalReportSchema.safeParse({
        ...validReport,
        path: "/admin/performance",
      }).success,
    ).toBe(false);
    expect(
      webVitalReportSchema.safeParse({
        ...validReport,
        path: "/__synthetic__/e2e",
      }).success,
    ).toBe(true);
  });

  test("rejects origins, queries, fragments and unknown identity fields", () => {
    for (const path of [
      "https://example.com/page",
      "//example.com/page",
      "/page?email=person@example.com",
      "/page#account",
    ]) {
      expect(
        webVitalReportSchema.safeParse({ ...validReport, path }).success,
      ).toBe(false);
    }
    expect(
      webVitalReportSchema.safeParse({
        ...validReport,
        userId: "not-allowed",
      }).success,
    ).toBe(false);
  });

  test("rejects unsupported metrics, malformed IDs and implausible values", () => {
    expect(
      webVitalReportSchema.safeParse({ ...validReport, name: "FCP" }).success,
    ).toBe(false);
    expect(
      webVitalReportSchema.safeParse({ ...validReport, id: "custom-id" })
        .success,
    ).toBe(false);
    expect(
      webVitalReportSchema.safeParse({ ...validReport, value: 700_000 })
        .success,
    ).toBe(false);
  });
});
