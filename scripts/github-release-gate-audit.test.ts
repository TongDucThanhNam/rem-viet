import { describe, expect, test } from "bun:test";

import { buildGithubReleaseGateAuditReport } from "./github-release-gate-audit-lib";

const base = {
  checkedAt: "2026-08-17T12:00:00.000Z",
  repository: {
    nameWithOwner: "agency/site",
    defaultBranch: "main",
  },
  workflow: {
    path: ".github/workflows/client-ready-release.yml",
    availableOnDefaultBranch: true,
    matchesLocalContract: true,
    registered: true,
    active: true,
  },
};

describe("GitHub client-ready release gate audit", () => {
  test("accepts only the exact active default-branch workflow contract", () => {
    const report = buildGithubReleaseGateAuditReport(base);
    expect(report.ready).toBe(true);
    expect(report.gaps).toEqual([]);
  });

  test("reports a missing remote workflow and registration separately", () => {
    const report = buildGithubReleaseGateAuditReport({
      ...base,
      workflow: {
        ...base.workflow,
        availableOnDefaultBranch: false,
        matchesLocalContract: false,
        registered: false,
        active: false,
      },
    });
    expect(report.ready).toBe(false);
    expect(report.gaps.map((gap) => gap.gate)).toEqual([
      "workflow-default-branch",
      "workflow-registration",
    ]);
  });

  test("rejects contract drift and a disabled registration", () => {
    const report = buildGithubReleaseGateAuditReport({
      ...base,
      workflow: {
        ...base.workflow,
        matchesLocalContract: false,
        active: false,
      },
    });
    expect(report.ready).toBe(false);
    expect(report.gaps.map((gap) => gap.gate)).toEqual([
      "workflow-contract",
      "workflow-active",
    ]);
  });
});
