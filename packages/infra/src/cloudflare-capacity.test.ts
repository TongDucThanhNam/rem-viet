import { describe, expect, test } from "bun:test";

import { buildCapacityReport } from "./cloudflare-capacity";

const manifests = [
  { id: "rem-viet", d1Name: "rem-viet-db" },
  { id: "acme-demo", d1Name: "acme-demo-db" },
];

describe("Cloudflare capacity classification", () => {
  test("matches only exact manifest and stage resource names", () => {
    const report = buildCapacityReport({
      databases: [
        { id: "1", name: "rem-viet-db-staging" },
        { id: "2", name: "acme-demo-db-production" },
        { id: "3", name: "rem-viet-db-old" },
      ],
      manifests,
    });

    expect(report.databases).toEqual([
      {
        id: "2",
        name: "acme-demo-db-production",
        classification: "managed",
        manifestId: "acme-demo",
        stage: "production",
      },
      {
        id: "3",
        name: "rem-viet-db-old",
        classification: "unrecognized",
      },
      {
        id: "1",
        name: "rem-viet-db-staging",
        classification: "managed",
        manifestId: "rem-viet",
        stage: "staging",
      },
    ]);
  });

  test("reports the two-slot release-proof deficit at the account limit", () => {
    const report = buildCapacityReport({
      databases: Array.from({ length: 10 }, (_, index) => ({
        id: String(index),
        name: `database-${index}`,
      })),
      manifests,
    });

    expect(report).toMatchObject({
      used: 10,
      limit: 10,
      remaining: 0,
      requiredSlots: 2,
      slotDeficit: 2,
    });
  });

  test("does not report a deficit when enough slots remain", () => {
    const report = buildCapacityReport({
      databases: [{ id: "1", name: "rem-viet-db-staging" }],
      manifests,
      limit: 10,
      requiredSlots: 2,
    });

    expect(report.remaining).toBe(9);
    expect(report.slotDeficit).toBe(0);
  });

  test("never infers deletion safety from an unrecognized name", () => {
    const report = buildCapacityReport({
      databases: [{ id: "legacy", name: "legacy-db" }],
      manifests: [],
    });

    expect(report.databases[0]?.classification).toBe("unrecognized");
    expect("deletionSafe" in (report.databases[0] ?? {})).toBe(false);
  });
});
