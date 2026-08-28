import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  documentationWalkthroughEvidenceSchema,
  type DocumentationWalkthroughEvidence,
} from "./documentation-walkthrough-evidence";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function validEvidence(
  commit = "a".repeat(40),
): DocumentationWalkthroughEvidence {
  return {
    schemaVersion: 1,
    repository: "TongDucThanhNam/rem-viet",
    documentationCommit: commit,
    recordedAt: "2026-08-29T04:10:00.000Z",
    projectOwnerName: "Project Owner",
    operator: {
      name: "Independent Operator",
      relationship: "independent-operator",
      operatingSystem: "Ubuntu 24.04",
      checkout: "independent-clean-checkout",
      startedAt: "2026-08-29T02:00:00.000Z",
      completedAt: "2026-08-29T04:00:00.000Z",
      usedOnlyCheckedInDocumentation: true,
      undocumentedDeveloperInterventions: 0,
      openP0: 0,
      openP1: 0,
    },
    tasks: {
      installationAndDiagnostics: true,
      schemaAndTemplateAuthoring: true,
      editorAndClientManual: true,
      providerConfiguration: true,
      extensionLifecycle: true,
      migrationUpgradeAndRollback: true,
      backupAndRestore: true,
      incidentResponse: true,
      clientHandover: true,
    },
    findings: [],
    operatorApproval: {
      name: "Independent Operator",
      approvedAt: "2026-08-29T04:05:00.000Z",
    },
  };
}

describe("documentation walkthrough evidence", () => {
  test("accepts a complete independent operator record", () => {
    expect(
      documentationWalkthroughEvidenceSchema.safeParse(validEvidence()).success,
    ).toBe(true);
  });

  test("rejects self-attestation and premature approval", () => {
    const evidence = validEvidence();
    evidence.operator.name = evidence.projectOwnerName;
    evidence.operatorApproval.name = evidence.projectOwnerName;
    evidence.operatorApproval.approvedAt = "2026-08-29T03:00:00.000Z";

    const result = documentationWalkthroughEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("operator.name");
      expect(paths).toContain("operatorApproval.approvedAt");
    }
  });

  test("rejects an incomplete walkthrough task", () => {
    const evidence = validEvidence();
    evidence.tasks.backupAndRestore = false as never;

    const result = documentationWalkthroughEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("tasks.backupAndRestore");
  });

  test("rejects duplicate finding identifiers", () => {
    const evidence = validEvidence();
    evidence.findings = [
      {
        issueId: "DOC-1",
        severity: "P2",
        summary: "Clarify the local provider command.",
        resolved: true,
      },
      {
        issueId: "doc-1",
        severity: "P3",
        summary: "Repeat identifier in different casing.",
        resolved: true,
      },
    ];

    const result = documentationWalkthroughEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("findings.1.issueId");
  });

  test("CLI binds the record and remediation commits to the requested commit", async () => {
    const root = join(import.meta.dir, "..");
    const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    })
      .stdout.toString()
      .trim();
    const directory = await mkdtemp(
      join(tmpdir(), "rem-viet-documentation-proof-"),
    );
    temporaryDirectories.push(directory);
    const path = join(directory, "documentation.json");
    const evidence = validEvidence(commit);
    evidence.findings = [
      {
        issueId: "DOC-1",
        severity: "P3",
        summary: "Clarified one bounded walkthrough instruction.",
        resolved: true,
        remediationCommit: commit,
      },
    ];
    await writeFile(path, JSON.stringify(evidence), "utf8");

    const accepted = Bun.spawnSync(
      [
        process.execPath,
        "scripts/verify-documentation-walkthrough-evidence.ts",
        `--evidence=${path}`,
        `--commit=${commit}`,
        `--repository=${evidence.repository}`,
      ],
      { cwd: root, stderr: "pipe", stdout: "pipe" },
    );
    expect(accepted.exitCode).toBe(0);
    expect(accepted.stdout.toString()).toContain('"documentationEvidence"');

    evidence.documentationCommit = "c".repeat(40);
    await writeFile(path, JSON.stringify(evidence), "utf8");
    const rejected = Bun.spawnSync(
      [
        process.execPath,
        "scripts/verify-documentation-walkthrough-evidence.ts",
        `--evidence=${path}`,
        `--commit=${commit}`,
        `--repository=${evidence.repository}`,
      ],
      { cwd: root, stderr: "pipe", stdout: "pipe" },
    );
    expect(rejected.exitCode).not.toBe(0);
    expect(rejected.stderr.toString()).toContain("does not match");
  });
});
