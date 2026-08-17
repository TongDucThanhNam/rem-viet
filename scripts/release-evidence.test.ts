import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  clientReleaseEvidenceSchema,
  pilotEvidenceRecordSchema,
} from "./release-evidence";

const timestamp = (minute: number) =>
  `2026-08-14T10:${String(minute).padStart(2, "0")}:00.000Z`;

function validEvidence() {
  return {
    schemaVersion: 3,
    releaseTag: "v1.0.0-client-ready",
    assembledAt: "2026-08-21T10:59:00.000Z",
    flagship: {
      siteId: "rem-viet",
      origin: "https://rem-viet.example.com",
      resources: {
        worker: "rem-viet-web-production",
        d1: "rem-viet-db-production",
        r2: "rem-viet-media-production",
      },
    },
    quality: {
      commit: "a".repeat(40),
      command: "bun run quality",
      passed: true,
      passedAt: timestamp(1),
    },
    staging: {
      origin: "https://rem-viet-web-staging.example.workers.dev",
      deployedAt: timestamp(2),
      deployment: {
        commit: "a".repeat(40),
        inputSha256: "d".repeat(64),
        sourceState: "clean",
      },
      publishVisibilitySeconds: 5,
      desktopSmoke: true,
      mobileSmoke: true,
      draftLeakChecks: true,
      keyboardCriticalPath: true,
      noUnexpectedHorizontalOverflow: true,
      openP0: 0,
      openP1: 0,
    },
    pilot: {
      deployment: {
        commit: "a".repeat(40),
        inputSha256: "d".repeat(64),
      },
      testerName: "Pilot User",
      testerRelationship: "non-developer",
      browserAndDevice: "Chrome on Windows laptop",
      startedAt: timestamp(5),
      completedAt: timestamp(25),
      durationMinutes: 20,
      trainingDurationMinutes: 10,
      revisionRestoreMinutes: 3,
      editableRecurringContentPercent: 95,
      clientManualUsedWithoutExtraGuidance: true,
      developerInterventions: 0,
      openP0: 0,
      openP1: 0,
      issueIds: [],
      tasks: {
        loginAndRole: true,
        editHeroImageFaqAndGallery: true,
        privateResponsivePreview: true,
        publishRestoreAndRepublish: true,
        pageSlugAndRedirect: true,
        sanitizedRichTextPost: true,
        leadInboxNoteAndCsv: true,
        referencedMediaDeleteBlocked: true,
        noJsonOrCode: true,
      },
    },
    performance: {
      origin: "https://rem-viet-web-staging.example.workers.dev",
      windowDays: 28,
      automatedTrafficExcluded: true,
      exportedAt: timestamp(30),
      metrics: {
        CLS: { samples: 75, p75: 0.1, unit: "score" },
        LCP: { samples: 75, p75: 2500, unit: "ms" },
        INP: { samples: 75, p75: 200, unit: "ms" },
      },
    },
    notification: {
      provider: "resend",
      submissionId: "submission-1",
      adminInboxCreated: true,
      deliveredCount: 1,
      providerMessageId: "provider-message-1",
      verifiedAt: timestamp(31),
      operationalAlert: {
        provider: "cloudflare",
        stage: "staging",
        trigger: "notification-failure",
        alertType: "workers_observability_alert",
        deliveryMechanism: "email",
        policyEnabled: true,
        delivered: true,
        dispatchReceiptId: "provider-alert-1",
        verifiedAt: timestamp(32),
      },
    },
    stagingRestore: {
      siteId: "rem-viet",
      stage: "staging",
      sourceDatabase: "rem-viet-db-staging",
      backup: {
        createdAt: timestamp(10),
        artifactLocator: "r2://agency-backups/d1/staging/restore-source.sql",
        sha256: "d".repeat(64),
        sizeBytes: 2048,
        immutable: true,
        protectedUntil: "2027-08-14T10:11:00.000Z",
      },
      restore: {
        targetDatabase: "rem-viet-restore-drill-20260814",
        startedAt: timestamp(11),
        completedAt: timestamp(15),
        integrityCheck: "ok",
        exactTableParity: true,
        exactRowParity: true,
        targetDeleted: true,
        recoveryMinutes: 4,
      },
    },
    secondSite: {
      siteId: "acme-demo",
      origin: "https://acme-demo.example.com",
      resources: {
        worker: "acme-demo-web-staging",
        d1: "acme-demo-db-staging",
        r2: "acme-demo-media-staging",
      },
      cleanCheckout: true,
      deployDurationMinutes: 90,
      brandAndDemoContentDurationMinutes: 300,
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
      verifiedAt: timestamp(32),
    },
    security: {
      productionSecretsRotatedAt: timestamp(33),
      publicSignupDisabled: true,
      productionHttpsAndTrustedOriginVerified: true,
      dependencyAudit: {
        command: "bun run audit:security",
        criticalFindings: 0,
        highFindings: 0,
        passedAt: timestamp(34),
      },
    },
    production: {
      migrationStartedAt: timestamp(40),
      backup: {
        createdAt: timestamp(35),
        artifactLocator: "r2://agency-backups/d1/production/pre-migration.sql",
        sha256: "b".repeat(64),
        sizeBytes: 1024,
        immutable: true,
      },
      restoreDrill: {
        completedAt: timestamp(50),
        isolatedTarget: "rem-viet-restore-drill",
        integrityCheck: "ok",
        recoveryMinutes: 4,
      },
    },
    scheduledBackup: {
      siteId: "rem-viet",
      stage: "production",
      bucket: "agency-backups",
      workflow: ".github/workflows/scheduled-cms-backup.yml",
      configuredAt: "2026-08-14T10:35:00.000Z",
      retentionDays: 365,
      manualDispatch: {
        trigger: "workflow_dispatch",
        runId: "1001",
        runUrl: "https://github.com/acme/rem-viet/actions/runs/1001",
        completedAt: "2026-08-14T10:36:00.000Z",
        conclusion: "success",
        artifactLocator:
          "r2://agency-backups/d1/production/20260814T103600Z-backup.sql",
        sha256: "c".repeat(64),
        sizeBytes: 2048,
        immutable: true,
        protectedUntil: "2027-08-14T10:37:00.000Z",
      },
      scheduledRun: {
        trigger: "schedule",
        runId: "1002",
        runUrl: "https://github.com/acme/rem-viet/actions/runs/1002",
        completedAt: "2026-08-21T10:36:00.000Z",
        conclusion: "success",
        artifactLocator:
          "r2://agency-backups/d1/production/20260821T103600Z-backup.sql",
        sha256: "c".repeat(64),
        sizeBytes: 2048,
        immutable: true,
        protectedUntil: "2027-08-21T10:37:00.000Z",
      },
    },
    approvals: {
      agencyOwner: {
        name: "Agency Owner",
        approvedAt: "2026-08-21T10:55:00.000Z",
      },
      pilotTester: { name: "Pilot User", approvedAt: timestamp(56) },
    },
  };
}

function validPilotRecord(commit = "a".repeat(40)) {
  const evidence = validEvidence();
  return {
    schemaVersion: 1,
    siteId: "rem-viet",
    stage: "staging",
    origin: evidence.staging.origin,
    recordedAt: timestamp(27),
    pilot: {
      ...evidence.pilot,
      deployment: { ...evidence.pilot.deployment, commit },
    },
    taskMinutes: {
      loginAndRole: 1,
      editHeroImageFaqAndGallery: 5,
      privateResponsivePreview: 2,
      publishRestoreAndRepublish: 4,
      pageSlugAndRedirect: 2,
      sanitizedRichTextPost: 2,
      leadInboxNoteAndCsv: 2,
      referencedMediaDeleteBlocked: 2,
    },
    confusionPoints: [],
    testerApproval: {
      name: evidence.pilot.testerName,
      approvedAt: timestamp(26),
    },
  };
}

describe("client-ready release evidence", () => {
  test("accepts evidence at every master-plan boundary", () => {
    expect(clientReleaseEvidenceSchema.safeParse(validEvidence()).success).toBe(
      true,
    );
  });

  test("rejects legacy schema-v1 evidence without the new operational gates", () => {
    const evidence = validEvidence();
    evidence.schemaVersion = 1;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("schemaVersion");
  });

  test("rejects insufficient or over-budget field performance", () => {
    const evidence = validEvidence();
    evidence.performance.metrics.LCP.samples = 74;
    evidence.performance.metrics.INP.p75 = 201;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("performance.metrics.LCP.samples");
      expect(paths).toContain("performance.metrics.INP.p75");
    }
  });

  test("rejects RUM from an origin other than the staging pilot", () => {
    const evidence = validEvidence();
    evidence.performance.origin = evidence.flagship.origin;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("performance.origin");
  });

  test("rejects agency approval recorded before the final release receipt", () => {
    const evidence = validEvidence();
    evidence.approvals.agencyOwner.approvedAt = timestamp(55);

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("approvals.agencyOwner.approvedAt");
  });

  test("rejects every numeric business KPI beyond its release limit", () => {
    const evidence = validEvidence();
    evidence.staging.publishVisibilitySeconds = 10.1;
    evidence.pilot.trainingDurationMinutes = 30.1;
    evidence.pilot.revisionRestoreMinutes = 5.1;
    evidence.pilot.editableRecurringContentPercent = 89.9;
    evidence.secondSite.deployDurationMinutes = 120.1;
    evidence.secondSite.brandAndDemoContentDurationMinutes = 1440.1;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      for (const path of [
        "staging.publishVisibilitySeconds",
        "pilot.trainingDurationMinutes",
        "pilot.revisionRestoreMinutes",
        "pilot.editableRecurringContentPercent",
        "secondSite.deployDurationMinutes",
        "secondSite.brandAndDemoContentDurationMinutes",
      ])
        expect(paths).toContain(path);
    }
  });

  test("rejects shared resources and late backups", () => {
    const evidence = validEvidence();
    evidence.secondSite.resources.d1 = evidence.flagship.resources.d1;
    evidence.production.backup.createdAt = timestamp(45);

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("secondSite.resources");
      expect(paths).toContain("production.backup.createdAt");
    }
  });

  test("rejects second-site evidence without both browser device projects", () => {
    const missingMobile = validEvidence();
    missingMobile.secondSite.smoke.mobileChrome = false as true;

    const result = clientReleaseEvidenceSchema.safeParse(missingMobile);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("secondSite.smoke.mobileChrome");
  });

  test("rejects second-site evidence without deployed provider conformance", () => {
    const missingConformance = validEvidence();
    missingConformance.secondSite.smoke.cloudflarePageProviderConformance =
      false as true;

    const result = clientReleaseEvidenceSchema.safeParse(missingConformance);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("secondSite.smoke.cloudflarePageProviderConformance");
  });

  test("rejects reused or late scheduled-backup receipts", () => {
    const evidence = validEvidence();
    evidence.scheduledBackup.scheduledRun.runId =
      evidence.scheduledBackup.manualDispatch.runId;
    evidence.scheduledBackup.scheduledRun.artifactLocator =
      evidence.scheduledBackup.manualDispatch.artifactLocator;
    evidence.scheduledBackup.scheduledRun.completedAt =
      "2026-08-23T10:36:00.000Z";

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("scheduledBackup.scheduledRun.runId");
      expect(paths).toContain("scheduledBackup.scheduledRun.artifactLocator");
      expect(paths).toContain("scheduledBackup.scheduledRun.completedAt");
    }
  });

  test("rejects a non-immutable scheduled-backup receipt", () => {
    const evidence = validEvidence();
    evidence.scheduledBackup.scheduledRun.immutable = false;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("scheduledBackup.scheduledRun.immutable");
    }
  });

  test("rejects an unconfigured operational alert or missing dispatch receipt", () => {
    const evidence = validEvidence();
    evidence.notification.operationalAlert.policyEnabled = false;
    evidence.notification.operationalAlert.dispatchReceiptId = "";

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("notification.operationalAlert.policyEnabled");
      expect(paths).toContain(
        "notification.operationalAlert.dispatchReceiptId",
      );
    }
  });

  test("rejects a non-isolated or out-of-sequence staging restore", () => {
    const evidence = validEvidence();
    evidence.stagingRestore.restore.targetDatabase =
      evidence.stagingRestore.sourceDatabase;
    evidence.stagingRestore.restore.completedAt = timestamp(33);
    evidence.stagingRestore.restore.recoveryMinutes = 22;
    evidence.stagingRestore.backup.artifactLocator =
      "r2://agency-backups/d1/production/wrong-stage.sql";

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("stagingRestore.restore.targetDatabase");
      expect(paths).toContain("stagingRestore.restore.completedAt");
      expect(paths).toContain("stagingRestore.backup.artifactLocator");
    }
  });

  test("rejects a restore target that was not cleaned up", () => {
    const evidence = validEvidence();
    evidence.stagingRestore.restore.targetDeleted = false;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("stagingRestore.restore.targetDeleted");
  });

  test("rejects a pilot that needed developer intervention", () => {
    const evidence = validEvidence();
    evidence.pilot.developerInterventions = 1;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("pilot.developerInterventions");
  });

  test("rejects pilot duration claims that disagree with timestamps", () => {
    const evidence = validEvidence();
    evidence.pilot.durationMinutes = 5;

    const result = clientReleaseEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("pilot.durationMinutes");
  });

  test("rejects release evidence not bound to one clean staging deployment", () => {
    const dirtyEvidence = validEvidence();
    dirtyEvidence.staging.deployment.sourceState = "dirty";
    const dirtyResult = clientReleaseEvidenceSchema.safeParse(dirtyEvidence);
    expect(dirtyResult.success).toBe(false);
    if (!dirtyResult.success)
      expect(
        dirtyResult.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("staging.deployment.sourceState");

    const mismatchedEvidence = validEvidence();
    mismatchedEvidence.staging.deployment.commit = "b".repeat(40);
    mismatchedEvidence.pilot.deployment.inputSha256 = "e".repeat(64);
    const result = clientReleaseEvidenceSchema.safeParse(mismatchedEvidence);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("staging.deployment.commit");
      expect(paths).toContain("pilot.deployment");
    }
  });

  test("accepts a standalone, tester-approved pilot record", () => {
    expect(
      pilotEvidenceRecordSchema.safeParse(validPilotRecord()).success,
    ).toBe(true);
  });

  test("rejects a pilot record with copied or premature tester approval", () => {
    const record = validPilotRecord();
    record.testerApproval.name = "Different Person";
    record.testerApproval.approvedAt = timestamp(24);

    const result = pilotEvidenceRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("testerApproval.name");
      expect(paths).toContain("testerApproval.approvedAt");
    }
  });

  test("rejects pilot step timings that do not explain the elapsed duration", () => {
    const record = validPilotRecord();
    record.taskMinutes.editHeroImageFaqAndGallery = 1;

    const result = pilotEvidenceRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("taskMinutes");
  });

  test("standalone pilot CLI binds evidence to site, origin and deployed commit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rem-viet-pilot-proof-"));
    const path = join(directory, "pilot.json");
    const root = join(import.meta.dir, "..");
    const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    })
      .stdout.toString()
      .trim();
    const record = validPilotRecord(commit);
    const preloadPath = join(directory, "mock-deployment.ts");
    const writeDeploymentMock = async (inputSha256: string) =>
      writeFile(
        preloadPath,
        `globalThis.fetch = async () => Response.json({ deployment: ${JSON.stringify(
          {
            siteId: record.siteId,
            stage: record.stage,
            commit,
            inputSha256,
            sourceState: "clean",
          },
        )} });\n`,
        "utf8",
      );
    await writeFile(path, JSON.stringify(record), "utf8");
    await writeDeploymentMock(record.pilot.deployment.inputSha256);

    try {
      const accepted = Bun.spawnSync(
        [
          process.execPath,
          "--preload",
          preloadPath,
          "scripts/verify-pilot-evidence.ts",
          `--evidence=${path}`,
          "--site=rem-viet",
          `--origin=${record.origin}`,
          `--commit=${commit}`,
        ],
        { cwd: root, stderr: "pipe", stdout: "pipe" },
      );
      expect(accepted.exitCode).toBe(0);
      expect(accepted.stdout.toString()).toContain('"releaseEvidence"');

      await writeDeploymentMock("e".repeat(64));
      const wrongDeployInput = Bun.spawnSync(
        [
          process.execPath,
          "--preload",
          preloadPath,
          "scripts/verify-pilot-evidence.ts",
          `--evidence=${path}`,
          "--site=rem-viet",
          `--origin=${record.origin}`,
          `--commit=${commit}`,
        ],
        { cwd: root, stderr: "pipe", stdout: "pipe" },
      );
      expect(wrongDeployInput.exitCode).not.toBe(0);
      expect(wrongDeployInput.stderr.toString()).toContain(
        "deploy-input hash does not match",
      );

      record.pilot.deployment.commit = "c".repeat(40);
      await writeFile(path, JSON.stringify(record), "utf8");
      const rejected = Bun.spawnSync(
        [
          process.execPath,
          "--preload",
          preloadPath,
          "scripts/verify-pilot-evidence.ts",
          `--evidence=${path}`,
          "--site=rem-viet",
          `--origin=${record.origin}`,
          `--commit=${commit}`,
        ],
        { cwd: root, stderr: "pipe", stdout: "pipe" },
      );
      expect(rejected.exitCode).not.toBe(0);
      expect(rejected.stderr.toString()).toContain(
        "does not match deployed commit",
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("CLI binds complete evidence to the requested release commit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rem-viet-release-proof-"));
    const path = join(directory, "evidence.json");
    const commit = "a".repeat(40);
    await writeFile(path, JSON.stringify(validEvidence()), "utf8");

    try {
      const accepted = Bun.spawnSync(
        [
          process.execPath,
          "scripts/verify-client-release.ts",
          `--evidence=${path}`,
          `--commit=${commit}`,
          "--allow-dirty",
        ],
        { cwd: join(import.meta.dir, ".."), stderr: "pipe", stdout: "pipe" },
      );
      expect(accepted.exitCode).toBe(0);
      expect(accepted.stdout.toString()).toContain(
        '"releaseTag": "v1.0.0-client-ready"',
      );

      const rejected = Bun.spawnSync(
        [
          process.execPath,
          "scripts/verify-client-release.ts",
          `--evidence=${path}`,
          `--commit=${"c".repeat(40)}`,
          "--allow-dirty",
        ],
        { cwd: join(import.meta.dir, ".."), stderr: "pipe", stdout: "pipe" },
      );
      expect(rejected.exitCode).not.toBe(0);
      expect(rejected.stderr.toString()).toContain(
        "does not match release commit",
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
