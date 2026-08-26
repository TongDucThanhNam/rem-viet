import { describe, expect, test } from "bun:test";

import {
  buildGithubBackupAuditReport,
  inspectGithubBackupConfiguration,
  inspectGithubBackupRun,
} from "./github-backup-audit-lib";

const run = (event: "workflow_dispatch" | "schedule", id: number) => ({
  id,
  run_attempt: 1,
  event,
  status: "completed",
  conclusion: "success",
  created_at:
    event === "workflow_dispatch"
      ? "2026-08-17T01:00:00.000Z"
      : "2026-08-24T02:17:00.000Z",
  updated_at:
    event === "workflow_dispatch"
      ? "2026-08-17T01:05:00.000Z"
      : "2026-08-24T02:22:00.000Z",
  html_url: `https://github.com/agency/site/actions/runs/${id}`,
  head_sha: "a".repeat(40),
  head_branch: "main",
});

function evidence(id: number, createdAt: string) {
  const path = `backups/rem-viet-production-gha-${id}-1.sql`;
  const digest = "b".repeat(64);
  const backup = {
    schemaVersion: 1,
    siteId: "rem-viet",
    stage: "production",
    database: "rem-viet-db-production",
    createdAt,
    artifact: {
      path,
      sha256: digest,
      sizeBytes: 42,
      immutable: false,
    },
    restoreDrill: {
      integrityCheck: "ok",
      tables: 26,
      counts: {
        pages: 1,
        page_revisions: 1,
        posts: 1,
        media: 1,
        form_submissions: 0,
        web_vitals: 0,
      },
      isolatedRestore: true,
    },
  };
  const archive = {
    schemaVersion: 1,
    siteId: "rem-viet",
    stage: "production",
    database: "rem-viet-db-production",
    source: { path, createdAt },
    archive: {
      artifactLocator: `r2://rem-viet-backups/d1/production/${id}-${digest}.sql`,
      bucket: "rem-viet-backups",
      objectKey: `d1/production/${id}-${digest}.sql`,
      sha256: digest,
      sizeBytes: 42,
      archivedAt: createdAt,
      verifiedAt: new Date(Date.parse(createdAt) + 30_000).toISOString(),
      immutable: true,
    },
    retention: {
      minimumDays: 90,
      mode: "age",
      prefix: "d1/",
      retentionSeconds: 365 * 86_400,
      protectedUntil: new Date(
        Date.parse(createdAt) + 365 * 86_400_000,
      ).toISOString(),
    },
  };
  return { backup, archive };
}

describe("GitHub scheduled-backup audit", () => {
  test("redacts values while requiring the exact site, stage, account and dedicated secret", () => {
    const configuration = inspectGithubBackupConfiguration({
      variables: [
        {
          name: "CMS_BACKUP_SITE",
          value: "rem-viet",
          updatedAt: "2026-08-16T01:00:00.000Z",
        },
        {
          name: "CMS_BACKUP_STAGE",
          value: "production",
          updatedAt: "2026-08-16T02:00:00.000Z",
        },
        {
          name: "CLOUDFLARE_ACCOUNT_ID",
          value: "a".repeat(32),
          updatedAt: "2026-08-16T03:00:00.000Z",
        },
      ],
      secrets: [
        {
          name: "CMS_BACKUP_CLOUDFLARE_API_TOKEN",
          updatedAt: "2026-08-16T04:00:00.000Z",
        },
      ],
      expectedSite: "rem-viet",
      expectedStage: "production",
    });

    expect(configuration.ready).toBe(true);
    expect(configuration.configuredAt).toBe("2026-08-16T04:00:00.000Z");
    expect(JSON.stringify(configuration)).not.toContain("rem-viet");
    expect(JSON.stringify(configuration)).not.toContain("a".repeat(32));

    const missing = inspectGithubBackupConfiguration({
      variables: [],
      secrets: [],
      expectedSite: "rem-viet",
      expectedStage: "production",
    });
    expect(missing.ready).toBe(false);
    expect(missing.site.present).toBe(false);
    expect(missing.token.present).toBe(false);
  });

  test("accepts only run-bound restore evidence archived immutably for the required retention", () => {
    const manualRun = run("workflow_dispatch", 101);
    const values = evidence(101, "2026-08-17T01:01:00.000Z");
    const inspection = inspectGithubBackupRun({
      run: manualRun,
      backupEvidence: values.backup,
      archiveEvidence: values.archive,
      expectedEvent: "workflow_dispatch",
      expectedSite: "rem-viet",
      expectedStage: "production",
      expectedBucket: "rem-viet-backups",
      defaultBranch: "main",
      configuredAt: "2026-08-16T04:00:00.000Z",
      retentionDays: 365,
    });

    expect(inspection.valid).toBe(true);
    expect(inspection.receipt).toMatchObject({
      runId: "101",
      artifactLocator: values.archive.archive.artifactLocator,
      immutable: true,
    });

    values.archive.retention.protectedUntil = "2026-09-01T00:00:00.000Z";
    const shortRetention = inspectGithubBackupRun({
      run: manualRun,
      backupEvidence: values.backup,
      archiveEvidence: values.archive,
      expectedEvent: "workflow_dispatch",
      expectedSite: "rem-viet",
      expectedStage: "production",
      expectedBucket: "rem-viet-backups",
      defaultBranch: "main",
      configuredAt: "2026-08-16T04:00:00.000Z",
      retentionDays: 365,
    });
    expect(shortRetention.valid).toBe(false);
    expect(shortRetention.errors).toContain(
      "The immutable object protection is shorter than required.",
    );

    const indefiniteArchive = {
      ...values.archive,
      retention: {
        minimumDays: 365,
        mode: "indefinite",
        prefix: "d1/",
        retentionSeconds: null,
        protectedUntil: null,
      },
    };
    const receiptWithoutDatedHorizon = inspectGithubBackupRun({
      run: manualRun,
      backupEvidence: values.backup,
      archiveEvidence: indefiniteArchive,
      expectedEvent: "workflow_dispatch",
      expectedSite: "rem-viet",
      expectedStage: "production",
      expectedBucket: "rem-viet-backups",
      defaultBranch: "main",
      configuredAt: "2026-08-16T04:00:00.000Z",
      retentionDays: 365,
    });
    expect(receiptWithoutDatedHorizon.valid).toBe(false);
    expect(receiptWithoutDatedHorizon.errors).toContain(
      "The immutable object protection is shorter than required.",
    );
  });

  test("reports a stage mismatch separately from run binding", () => {
    const manualRun = run("workflow_dispatch", 202);
    const values = evidence(202, "2026-08-17T01:01:00.000Z");
    const stagingPath = "backups/rem-viet-staging-gha-202-1.sql";
    values.backup.stage = "staging";
    values.backup.database = "rem-viet-db-staging";
    values.backup.artifact.path = stagingPath;
    values.archive.stage = "staging";
    values.archive.database = "rem-viet-db-staging";
    values.archive.source.path = stagingPath;

    const wrongStage = inspectGithubBackupRun({
      run: manualRun,
      backupEvidence: values.backup,
      archiveEvidence: values.archive,
      expectedEvent: "workflow_dispatch",
      expectedSite: "rem-viet",
      expectedStage: "production",
      expectedBucket: "rem-viet-backups",
      defaultBranch: "main",
      configuredAt: "2026-08-16T04:00:00.000Z",
      retentionDays: 365,
    });

    expect(wrongStage.valid).toBe(false);
    expect(wrongStage.errors).toContain(
      "The evidence belongs to a different stage.",
    );
    expect(wrongStage.errors).not.toContain(
      "The backup artifact path is not bound to this run and attempt.",
    );

    values.backup.artifact.path =
      "backups/rem-viet-staging-gha-different-run-1.sql";
    values.archive.source.path = values.backup.artifact.path;
    const wrongRun = inspectGithubBackupRun({
      run: manualRun,
      backupEvidence: values.backup,
      archiveEvidence: values.archive,
      expectedEvent: "workflow_dispatch",
      expectedSite: "rem-viet",
      expectedStage: "staging",
      expectedBucket: "rem-viet-backups",
      defaultBranch: "main",
      configuredAt: "2026-08-16T04:00:00.000Z",
      retentionDays: 365,
    });

    expect(wrongRun.errors).toContain(
      "The backup artifact path is not bound to this run and attempt.",
    );
  });

  test("requires a scheduled receipt after a distinct manual dispatch", () => {
    const configuration = inspectGithubBackupConfiguration({
      variables: [
        {
          name: "CMS_BACKUP_SITE",
          value: "rem-viet",
          updatedAt: "2026-08-16T01:00:00.000Z",
        },
        {
          name: "CMS_BACKUP_STAGE",
          value: "production",
          updatedAt: "2026-08-16T02:00:00.000Z",
        },
        {
          name: "CLOUDFLARE_ACCOUNT_ID",
          value: "a".repeat(32),
          updatedAt: "2026-08-16T03:00:00.000Z",
        },
      ],
      secrets: [
        {
          name: "CMS_BACKUP_CLOUDFLARE_API_TOKEN",
          updatedAt: "2026-08-16T04:00:00.000Z",
        },
      ],
      expectedSite: "rem-viet",
      expectedStage: "production",
    });
    const inspect = (event: "workflow_dispatch" | "schedule", id: number) => {
      const actionRun = run(event, id);
      const values = evidence(id, actionRun.created_at);
      return inspectGithubBackupRun({
        run: actionRun,
        backupEvidence: values.backup,
        archiveEvidence: values.archive,
        expectedEvent: event,
        expectedSite: "rem-viet",
        expectedStage: "production",
        expectedBucket: "rem-viet-backups",
        defaultBranch: "main",
        configuredAt: configuration.configuredAt,
        retentionDays: 365,
      });
    };
    const report = buildGithubBackupAuditReport({
      checkedAt: "2026-08-24T03:00:00.000Z",
      repository: { nameWithOwner: "agency/site", defaultBranch: "main" },
      workflow: {
        path: ".github/workflows/scheduled-cms-backup.yml",
        availableOnDefaultBranch: true,
        matchesLocalContract: true,
      },
      configuration,
      manualDispatch: inspect("workflow_dispatch", 101),
      scheduledRun: inspect("schedule", 202),
    });

    expect(report.ready).toBe(true);
    expect(report.sequenceValid).toBe(true);
    expect(report.gaps).toEqual([]);

    const missingSchedule = buildGithubBackupAuditReport({
      ...report,
      scheduledRun: inspectGithubBackupRun({
        run: null,
        backupEvidence: null,
        archiveEvidence: null,
        expectedEvent: "schedule",
        expectedSite: "rem-viet",
        expectedStage: "production",
        expectedBucket: "rem-viet-backups",
        defaultBranch: "main",
        configuredAt: configuration.configuredAt,
        retentionDays: 365,
      }),
    });
    expect(missingSchedule.ready).toBe(false);
    expect(missingSchedule.gaps.map((gap) => gap.gate)).toContain(
      "scheduled-run",
    );

    const lateScheduledRun = run("schedule", 303);
    lateScheduledRun.created_at = "2026-09-01T02:17:00.000Z";
    lateScheduledRun.updated_at = "2026-09-01T02:22:00.000Z";
    const lateEvidence = evidence(303, lateScheduledRun.created_at);
    const lateScheduled = inspectGithubBackupRun({
      run: lateScheduledRun,
      backupEvidence: lateEvidence.backup,
      archiveEvidence: lateEvidence.archive,
      expectedEvent: "schedule",
      expectedSite: "rem-viet",
      expectedStage: "production",
      expectedBucket: "rem-viet-backups",
      defaultBranch: "main",
      configuredAt: configuration.configuredAt,
      retentionDays: 365,
    });
    const lateReport = buildGithubBackupAuditReport({
      ...report,
      scheduledRun: lateScheduled,
    });
    expect(lateReport.ready).toBe(false);
    expect(lateReport.gaps.map((gap) => gap.gate)).toContain("run-sequence");
  });
});
