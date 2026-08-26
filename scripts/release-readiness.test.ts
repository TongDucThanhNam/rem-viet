import { describe, expect, test } from "bun:test";

import {
  buildReleaseReadinessProfileArgs,
  buildReleaseReadinessReport,
  inspectReleaseEvidence,
  isExpectedReadinessAuditExitCode,
  validateReleaseReadinessAuditTarget,
} from "./release-readiness";

function liveInputs() {
  return {
    checkedAt: "2026-08-14T12:00:00.000Z",
    capacity: {
      used: 3,
      limit: 3,
      remaining: 0,
      requiredSlots: 2,
      slotDeficit: 2,
      unrecognized: 2,
      databases: [
        {
          id: "secret-database-id",
          name: "private-database-name",
          classification: "managed",
          numTables: 26,
        },
        {
          id: "secret-empty-id",
          name: "private-empty-name",
          classification: "unrecognized",
          numTables: 0,
        },
        {
          id: "secret-used-id",
          name: "private-used-name",
          classification: "unrecognized",
          numTables: 9,
        },
      ],
    },
    alerts: {
      windowDays: 30,
      availableAlertTypeCount: 57,
      policyCount: 1,
      recentDispatchCount: 0,
      emailDeliveryReady: true,
      operationalEmailPolicyConfigured: false,
      operationalEmailReceiptRecorded: false,
      capabilityReady: true,
      releaseEvidenceReady: false,
      policies: [{ recipientId: "secret-recipient" }],
    },
    alertPolicy: {
      mode: "dry-run",
      readyToApply: false,
      policyConfigured: false,
      receiptRecorded: false,
      recipientConfigured: false,
      prerequisites: {
        providerFailureStatusContract: true,
        emailDeliveryReady: true,
        writeAuthenticationReady: false,
        deterministicPolicyUnambiguous: false,
        underlyingAlertThresholdConfigured: false,
      },
      plan: {
        action: "blocked",
        policiesToCreate: 0,
        policiesToUpdate: 0,
        policiesToDelete: 0,
      },
      recipient: "secret-alert-recipient",
    },
    vitals: {
      ready: false,
      window: { days: 28 },
      minimumSamples: 75,
      metrics: {
        CLS: {
          samples: 0,
          p75: null,
          target: 0.1,
          unit: "score",
          status: "insufficient",
        },
        LCP: {
          samples: 0,
          p75: null,
          target: 2500,
          unit: "ms",
          status: "insufficient",
        },
        INP: {
          samples: 0,
          p75: null,
          target: 200,
          unit: "ms",
          status: "insufficient",
        },
      },
      databaseId: "secret-vitals-database-id",
    },
    notification: {
      mode: "dry-run",
      readyToApply: false,
      prerequisites: {
        manifestDatabaseMatched: true,
        formActive: true,
        formEmailEnabled: true,
        providerConfigurationExposed: true,
        emailRuntimeConfigured: false,
        deploymentProvenanceExposed: true,
        deploymentClean: false,
        deploymentSiteMatched: true,
        deploymentStageMatched: true,
        deploymentCommit: "a".repeat(40),
        deploymentInputSha256: "d".repeat(64),
        recipient: "secret-notification-recipient",
      },
      plannedEffects: {
        leadRowsCreated: 1,
        externalEmailsRequested: 1,
        duplicateReplays: 1,
      },
      runId: "secret-notification-run-id",
    },
    scheduledBackup: {
      ready: false,
      workflow: {
        availableOnDefaultBranch: false,
        matchesLocalContract: false,
      },
      configuration: { ready: false },
      manualDispatch: { valid: false },
      scheduledRun: { valid: false },
      sequenceValid: false,
      repositorySecret: "secret-github-backup-value",
    },
    releaseGate: {
      ready: false,
      workflow: {
        availableOnDefaultBranch: false,
        matchesLocalContract: false,
        registered: false,
        active: false,
      },
      repositorySecret: "secret-github-release-value",
    },
    evidence: inspectReleaseEvidence(null, false),
    repository: { headCommit: "a".repeat(40), clean: false },
  };
}

describe("client-ready live readiness report", () => {
  test("accepts only success or the audits' explicit release-gap exit", () => {
    expect(isExpectedReadinessAuditExitCode(0)).toBe(true);
    expect(isExpectedReadinessAuditExitCode(2)).toBe(true);
    expect(isExpectedReadinessAuditExitCode(1)).toBe(false);
    expect(isExpectedReadinessAuditExitCode(3)).toBe(false);
  });

  test("keeps deploy and alert audit profiles least-privilege", () => {
    expect(
      buildReleaseReadinessProfileArgs({
        profile: "default",
        alertsProfile: "alerts",
      }),
    ).toEqual({
      profileArgs: ["--profile=default"],
      alertsProfileArgs: ["--profile=alerts"],
    });
    expect(buildReleaseReadinessProfileArgs({ profile: "default" })).toEqual({
      profileArgs: ["--profile=default"],
      alertsProfileArgs: ["--profile=default"],
    });
  });

  test("fails fast unless live receipts target a clean staging origin", () => {
    expect(
      validateReleaseReadinessAuditTarget({
        site: " rem-viet ",
        stage: "STAGING",
        origin: "https://rem-viet-web-staging.example.workers.dev/",
      }),
    ).toEqual({
      site: "rem-viet",
      stage: "staging",
      origin: "https://rem-viet-web-staging.example.workers.dev",
    });
    expect(() =>
      validateReleaseReadinessAuditTarget({
        site: "rem-viet",
        stage: "production",
        origin: "https://luoichongmuoi.shop",
      }),
    ).toThrow("--stage=staging");
    for (const origin of [
      "http://staging.example.com",
      "https://staging.example.com/admin",
      "https://user:secret@staging.example.com",
      "https://staging.example.com?token=secret",
    ])
      expect(() =>
        validateReleaseReadinessAuditTarget({
          site: "rem-viet",
          stage: "staging",
          origin,
        }),
      ).toThrow("origin-only HTTPS staging URL");
  });

  test("reduces detailed provider payloads to non-secret counts and actions", () => {
    const report = buildReleaseReadinessReport(liveInputs());

    expect(report.releaseReady).toBe(false);
    expect(report.livePrerequisitesReady).toBe(false);
    expect(report.d1.zeroTableOwnerReviewCandidates).toBe(1);
    expect(report.scheduledBackup.stage).toBe("production");
    expect(report.gaps.map((gap) => gap.gate)).toEqual([
      "d1-capacity",
      "operational-alert-policy",
      "operational-alert-receipt",
      "operational-alert-recipient",
      "field-performance",
      "staging-provenance",
      "notification-runtime",
      "scheduled-backup-workflow",
      "scheduled-backup-configuration",
      "scheduled-backup-manual-run",
      "scheduled-backup-weekly-run",
      "client-ready-workflow",
      "client-ready-workflow-registration",
      "release-evidence",
      "release-checkout",
    ]);
    for (const gate of [
      "scheduled-backup-configuration",
      "scheduled-backup-manual-run",
      "scheduled-backup-weekly-run",
    ])
      expect(report.gaps.find((gap) => gap.gate === gate)?.action).toContain(
        "production",
      );
    const serialized = JSON.stringify(report);
    for (const secret of [
      "secret-database-id",
      "private-database-name",
      "secret-recipient",
      "secret-alert-recipient",
      "secret-vitals-database-id",
      "secret-notification-recipient",
      "secret-notification-run-id",
      "secret-github-backup-value",
      "secret-github-release-value",
    ])
      expect(serialized).not.toContain(secret);
  });

  test("reports readiness only from complete schema-v3 release evidence", () => {
    const input = liveInputs();
    input.capacity.requiredSlots = 0;
    input.capacity.slotDeficit = 0;
    input.alerts.operationalEmailPolicyConfigured = true;
    input.alerts.operationalEmailReceiptRecorded = true;
    input.alerts.releaseEvidenceReady = true;
    input.alertPolicy.readyToApply = true;
    input.alertPolicy.policyConfigured = true;
    input.alertPolicy.recipientConfigured = true;
    input.alertPolicy.prerequisites.writeAuthenticationReady = true;
    input.alertPolicy.prerequisites.deterministicPolicyUnambiguous = true;
    input.alertPolicy.plan.action = "noop";
    input.vitals.ready = true;
    input.vitals.metrics.CLS = {
      samples: 75,
      p75: 0.1,
      target: 0.1,
      unit: "score",
      status: "pass",
    };
    input.vitals.metrics.LCP = {
      samples: 75,
      p75: 2500,
      target: 2500,
      unit: "ms",
      status: "pass",
    };
    input.vitals.metrics.INP = {
      samples: 75,
      p75: 200,
      target: 200,
      unit: "ms",
      status: "pass",
    };
    input.notification.readyToApply = true;
    input.notification.prerequisites.emailRuntimeConfigured = true;
    input.notification.prerequisites.deploymentClean = true;
    input.scheduledBackup.ready = true;
    input.scheduledBackup.workflow.availableOnDefaultBranch = true;
    input.scheduledBackup.workflow.matchesLocalContract = true;
    input.scheduledBackup.configuration.ready = true;
    input.scheduledBackup.manualDispatch.valid = true;
    input.scheduledBackup.scheduledRun.valid = true;
    input.scheduledBackup.sequenceValid = true;
    input.releaseGate.ready = true;
    input.releaseGate.workflow.availableOnDefaultBranch = true;
    input.releaseGate.workflow.matchesLocalContract = true;
    input.releaseGate.workflow.registered = true;
    input.releaseGate.workflow.active = true;
    input.evidence = {
      present: true,
      valid: true,
      schemaVersion: 3,
      qualityCommit: "a".repeat(40),
      stagingDeploymentCommit: "a".repeat(40),
      stagingDeploymentInputSha256: "d".repeat(64),
      failedSections: [],
    };
    input.repository.clean = true;

    const report = buildReleaseReadinessReport(input);
    expect(report.releaseReady).toBe(true);
    expect(report.livePrerequisitesReady).toBe(true);
    expect(report.gaps).toEqual([]);
  });

  test("keeps no-argument mode explicit and fail-closed for site audits", () => {
    const input = {
      ...liveInputs(),
      alertPolicy: null,
      vitals: null,
      notification: null,
      scheduledBackup: null,
      releaseGate: null,
    };

    const report = buildReleaseReadinessReport(input);
    expect(report.fieldPerformance).toEqual({
      checked: false,
      ready: false,
      windowDays: 28,
      minimumSamples: 75,
      metrics: null,
    });
    expect(report.gaps.map((gap) => gap.gate)).toContain(
      "field-performance-audit",
    );
    expect(report.operationalAlert.provisioningChecked).toBe(false);
    expect(report.gaps.map((gap) => gap.gate)).toContain(
      "operational-alert-policy-audit",
    );
    expect(report.notificationRuntime).toEqual({
      checked: false,
      readyToApply: false,
      providerConfigurationExposed: false,
      emailRuntimeConfigured: false,
      deploymentReady: false,
      plannedLeadRows: 1,
      plannedExternalEmails: 1,
      plannedDuplicateReplays: 1,
    });
    expect(report.gaps.map((gap) => gap.gate)).toContain(
      "notification-runtime-audit",
    );
    expect(report.scheduledBackup).toEqual({
      checked: false,
      stage: "production",
      ready: false,
      workflowOnDefaultBranch: false,
      workflowMatchesContract: false,
      configurationReady: false,
      manualDispatchReady: false,
      scheduledRunReady: false,
      sequenceValid: false,
    });
    expect(report.gaps.map((gap) => gap.gate)).toContain(
      "scheduled-backup-audit",
    );
    expect(
      report.gaps.find((gap) => gap.gate === "scheduled-backup-audit")?.action,
    ).toContain("production");
    expect(report.clientReadyWorkflow).toEqual({
      checked: false,
      ready: false,
      workflowOnDefaultBranch: false,
      workflowMatchesContract: false,
      registered: false,
      active: false,
    });
    expect(report.gaps.map((gap) => gap.gate)).toContain(
      "client-ready-workflow-audit",
    );
  });

  test("rejects valid evidence bound to a different commit or dirty checkout", () => {
    const input = liveInputs();
    input.evidence = {
      present: true,
      valid: true,
      schemaVersion: 3,
      qualityCommit: "b".repeat(40),
      stagingDeploymentCommit: "b".repeat(40),
      stagingDeploymentInputSha256: "d".repeat(64),
      failedSections: [],
    };

    const report = buildReleaseReadinessReport(input);
    expect(report.releaseReady).toBe(false);
    expect(report.releaseEvidence.commitMatchesHead).toBe(false);
    expect(report.gaps.map((gap) => gap.gate)).toContain("release-commit");
    expect(report.gaps.map((gap) => gap.gate)).toContain("release-checkout");
  });

  test("fails closed on inconsistent capacity or alert totals", () => {
    const capacity = liveInputs();
    capacity.capacity.remaining = 1;
    expect(() => buildReleaseReadinessReport(capacity)).toThrow(
      /inconsistent totals/,
    );

    const alerts = liveInputs();
    alerts.alerts.releaseEvidenceReady = true;
    expect(() => buildReleaseReadinessReport(alerts)).toThrow(
      /inconsistent readiness/,
    );
  });

  test("fails closed on inconsistent Web Vitals status or readiness", () => {
    const status = liveInputs();
    status.vitals.metrics.CLS.status = "pass";
    expect(() => buildReleaseReadinessReport(status)).toThrow(
      /inconsistent metric status/,
    );

    const readiness = liveInputs();
    readiness.vitals.ready = true;
    expect(() => buildReleaseReadinessReport(readiness)).toThrow(
      /inconsistent readiness/,
    );
  });

  test("fails closed on inconsistent notification runtime readiness", () => {
    const input = liveInputs();
    input.notification.readyToApply = true;
    expect(() => buildReleaseReadinessReport(input)).toThrow(
      /Notification smoke audit returned inconsistent readiness/,
    );

    input.notification.prerequisites.providerConfigurationExposed = false;
    input.notification.prerequisites.emailRuntimeConfigured = true;
    expect(() => buildReleaseReadinessReport(input)).toThrow(
      /Notification smoke audit returned inconsistent readiness/,
    );
  });

  test("fails closed on inconsistent deterministic alert-policy readiness", () => {
    const input = liveInputs();
    input.alertPolicy.readyToApply = true;
    expect(() => buildReleaseReadinessReport(input)).toThrow(
      /operational alert policy dry-run returned inconsistent readiness/,
    );

    input.alertPolicy.readyToApply = false;
    input.alertPolicy.policyConfigured = true;
    expect(() => buildReleaseReadinessReport(input)).toThrow(
      /operational alert policy dry-run returned inconsistent readiness/,
    );
  });

  test("reports dedicated alert write authentication as a release gap", () => {
    const input = liveInputs();
    input.alertPolicy.recipientConfigured = true;
    input.alertPolicy.prerequisites.deterministicPolicyUnambiguous = true;
    input.alertPolicy.plan.action = "create";
    input.alertPolicy.plan.policiesToCreate = 1;

    const report = buildReleaseReadinessReport(input);

    expect(report.operationalAlert.writeAuthenticationReady).toBe(false);
    expect(report.gaps.map((gap) => gap.gate)).toContain(
      "operational-alert-write-auth",
    );
  });

  test("fails closed on inconsistent scheduled-backup readiness", () => {
    const impossibleWorkflow = liveInputs();
    impossibleWorkflow.scheduledBackup.workflow.matchesLocalContract = true;
    expect(() => buildReleaseReadinessReport(impossibleWorkflow)).toThrow(
      /scheduled-backup audit returned inconsistent readiness/,
    );

    const impossibleSequence = liveInputs();
    impossibleSequence.scheduledBackup.sequenceValid = true;
    expect(() => buildReleaseReadinessReport(impossibleSequence)).toThrow(
      /scheduled-backup audit returned inconsistent readiness/,
    );
  });

  test("fails closed on inconsistent client-ready workflow readiness", () => {
    const impossibleContract = liveInputs();
    impossibleContract.releaseGate.workflow.matchesLocalContract = true;
    expect(() => buildReleaseReadinessReport(impossibleContract)).toThrow(
      /release-gate audit returned inconsistent readiness/,
    );

    const impossibleRegistration = liveInputs();
    impossibleRegistration.releaseGate.workflow.active = true;
    expect(() => buildReleaseReadinessReport(impossibleRegistration)).toThrow(
      /release-gate audit returned inconsistent readiness/,
    );
  });
});
