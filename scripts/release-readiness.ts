import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { z } from "zod";

import { clientReleaseEvidenceSchema } from "./release-evidence";
import { argument, flag, repoRoot } from "./site-lib";

const capacityAuditSchema = z
  .object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    remaining: z.number().int().nonnegative(),
    requiredSlots: z.number().int().nonnegative(),
    slotDeficit: z.number().int().nonnegative(),
    unrecognized: z.number().int().nonnegative(),
    databases: z.array(
      z.object({
        classification: z.enum(["managed", "unrecognized"]),
        numTables: z.number().int().nonnegative().optional(),
      }),
    ),
  })
  .passthrough();

const alertAuditSchema = z
  .object({
    windowDays: z.number().int().positive(),
    availableAlertTypeCount: z.number().int().nonnegative(),
    policyCount: z.number().int().nonnegative(),
    recentDispatchCount: z.number().int().nonnegative(),
    emailDeliveryReady: z.boolean(),
    operationalEmailPolicyConfigured: z.boolean(),
    operationalEmailReceiptRecorded: z.boolean(),
    capabilityReady: z.boolean(),
    releaseEvidenceReady: z.boolean(),
  })
  .passthrough();

const alertPolicyAuditSchema = z
  .object({
    mode: z.literal("dry-run"),
    readyToApply: z.boolean(),
    policyConfigured: z.boolean(),
    receiptRecorded: z.literal(false),
    recipientConfigured: z.boolean(),
    prerequisites: z
      .object({
        providerFailureStatusContract: z.boolean(),
        emailDeliveryReady: z.boolean(),
        writeAuthenticationReady: z.boolean(),
        deterministicPolicyUnambiguous: z.boolean(),
        underlyingAlertThresholdConfigured: z.literal(false),
      })
      .passthrough(),
    plan: z
      .object({
        action: z.enum(["create", "noop", "blocked", "manual-review"]),
        policiesToCreate: z.union([z.literal(0), z.literal(1)]),
        policiesToUpdate: z.literal(0),
        policiesToDelete: z.literal(0),
      })
      .passthrough(),
  })
  .passthrough();

const vitalsStatusSchema = z.enum(["insufficient", "pass", "fail"]);
const vitalsMetricSchema = (target: number, unit: "score" | "ms") =>
  z
    .object({
      samples: z.number().int().nonnegative(),
      p75: z.number().finite().nonnegative().nullable(),
      target: z.literal(target),
      unit: z.literal(unit),
      status: vitalsStatusSchema,
    })
    .passthrough();
const vitalsAuditSchema = z
  .object({
    ready: z.boolean(),
    window: z
      .object({
        days: z.literal(28),
      })
      .passthrough(),
    minimumSamples: z.literal(75),
    metrics: z
      .object({
        CLS: vitalsMetricSchema(0.1, "score"),
        LCP: vitalsMetricSchema(2_500, "ms"),
        INP: vitalsMetricSchema(200, "ms"),
      })
      .strict(),
  })
  .passthrough();

const notificationAuditSchema = z
  .object({
    mode: z.literal("dry-run"),
    readyToApply: z.boolean(),
    prerequisites: z
      .object({
        manifestDatabaseMatched: z.literal(true),
        formActive: z.literal(true),
        formEmailEnabled: z.literal(true),
        providerConfigurationExposed: z.boolean(),
        emailRuntimeConfigured: z.boolean(),
        deploymentProvenanceExposed: z.boolean(),
        deploymentClean: z.boolean(),
        deploymentSiteMatched: z.boolean(),
        deploymentStageMatched: z.boolean(),
        deploymentCommit: z.union([
          z.string().regex(/^[0-9a-f]{40}$/i),
          z.literal("unknown"),
          z.null(),
        ]),
        deploymentInputSha256: z.union([
          z.string().regex(/^[0-9a-f]{64}$/i),
          z.literal("unknown"),
          z.null(),
        ]),
      })
      .passthrough(),
    plannedEffects: z
      .object({
        leadRowsCreated: z.literal(1),
        externalEmailsRequested: z.literal(1),
        duplicateReplays: z.literal(1),
      })
      .passthrough(),
  })
  .passthrough();

const scheduledBackupAuditSchema = z
  .object({
    ready: z.boolean(),
    workflow: z
      .object({
        availableOnDefaultBranch: z.boolean(),
        matchesLocalContract: z.boolean(),
      })
      .passthrough(),
    configuration: z
      .object({
        ready: z.boolean(),
      })
      .passthrough(),
    manualDispatch: z
      .object({
        valid: z.boolean(),
      })
      .passthrough(),
    scheduledRun: z
      .object({
        valid: z.boolean(),
      })
      .passthrough(),
    sequenceValid: z.boolean(),
  })
  .passthrough();

const githubReleaseGateAuditSchema = z
  .object({
    ready: z.boolean(),
    workflow: z
      .object({
        availableOnDefaultBranch: z.boolean(),
        matchesLocalContract: z.boolean(),
        registered: z.boolean(),
        active: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough();

const releaseSections = [
  "quality",
  "staging",
  "pilot",
  "performance",
  "notification",
  "stagingRestore",
  "secondSite",
  "security",
  "production",
  "scheduledBackup",
  "approvals",
] as const;

type ReleaseSection = (typeof releaseSections)[number];

export type ReleaseEvidenceInspection = {
  present: boolean;
  valid: boolean;
  schemaVersion: number | null;
  qualityCommit: string | null;
  stagingDeploymentCommit: string | null;
  stagingDeploymentInputSha256: string | null;
  failedSections: Array<ReleaseSection | "releaseRecord">;
};

export function isExpectedReadinessAuditExitCode(exitCode: number) {
  return exitCode === 0 || exitCode === 2;
}

export function buildReleaseReadinessProfileArgs(input: {
  profile?: string;
  alertsProfile?: string;
}) {
  const profileArgs = input.profile ? [`--profile=${input.profile}`] : [];
  const alertsProfile = input.alertsProfile ?? input.profile;
  const alertsProfileArgs = alertsProfile ? [`--profile=${alertsProfile}`] : [];
  return { profileArgs, alertsProfileArgs };
}

export function validateReleaseReadinessAuditTarget(input: {
  site: string;
  stage: string;
  origin: string;
}) {
  const site = input.site.trim();
  const stage = input.stage.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(site))
    throw new Error(
      "Release readiness requires a safe --site=<client-slug> target.",
    );
  if (stage !== "staging")
    throw new Error(
      "Client-ready release evidence must be audited with --stage=staging.",
    );

  let origin: URL;
  try {
    origin = new URL(input.origin.trim());
  } catch {
    throw new Error(
      "Release readiness requires an absolute HTTPS staging origin.",
    );
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "Release readiness requires an origin-only HTTPS staging URL without credentials, path, query or hash.",
    );

  return { site, stage: "staging" as const, origin: origin.origin };
}

export function inspectReleaseEvidence(
  rawEvidence: unknown,
  present = true,
): ReleaseEvidenceInspection {
  if (!present)
    return {
      present: false,
      valid: false,
      schemaVersion: null,
      qualityCommit: null,
      stagingDeploymentCommit: null,
      stagingDeploymentInputSha256: null,
      failedSections: ["releaseRecord"],
    };

  const schemaVersion =
    rawEvidence &&
    typeof rawEvidence === "object" &&
    "schemaVersion" in rawEvidence &&
    typeof rawEvidence.schemaVersion === "number"
      ? rawEvidence.schemaVersion
      : null;
  const parsed = clientReleaseEvidenceSchema.safeParse(rawEvidence);
  const qualityCommit =
    rawEvidence &&
    typeof rawEvidence === "object" &&
    "quality" in rawEvidence &&
    rawEvidence.quality &&
    typeof rawEvidence.quality === "object" &&
    "commit" in rawEvidence.quality &&
    typeof rawEvidence.quality.commit === "string" &&
    /^[0-9a-f]{40}$/i.test(rawEvidence.quality.commit)
      ? rawEvidence.quality.commit
      : null;
  if (parsed.success)
    return {
      present: true,
      valid: true,
      schemaVersion,
      qualityCommit,
      stagingDeploymentCommit: parsed.data.staging.deployment.commit,
      stagingDeploymentInputSha256: parsed.data.staging.deployment.inputSha256,
      failedSections: [],
    };

  const failed = new Set<ReleaseSection | "releaseRecord">();
  for (const issue of parsed.error.issues) {
    const section = issue.path[0];
    if (
      typeof section === "string" &&
      releaseSections.includes(section as ReleaseSection)
    )
      failed.add(section as ReleaseSection);
    else failed.add("releaseRecord");
  }
  return {
    present: true,
    valid: false,
    schemaVersion,
    qualityCommit,
    stagingDeploymentCommit: null,
    stagingDeploymentInputSha256: null,
    failedSections: [...failed].sort(),
  };
}

export function buildReleaseReadinessReport(input: {
  checkedAt: string;
  capacity: unknown;
  alerts: unknown;
  alertPolicy: unknown | null;
  vitals: unknown | null;
  notification: unknown | null;
  scheduledBackup: unknown | null;
  releaseGate?: unknown | null;
  evidence: ReleaseEvidenceInspection;
  repository: { headCommit: string; clean: boolean };
}) {
  const capacity = capacityAuditSchema.parse(input.capacity);
  const alerts = alertAuditSchema.parse(input.alerts);
  const alertPolicy =
    input.alertPolicy === null
      ? null
      : alertPolicyAuditSchema.parse(input.alertPolicy);
  const vitals =
    input.vitals === null ? null : vitalsAuditSchema.parse(input.vitals);
  const notification =
    input.notification === null
      ? null
      : notificationAuditSchema.parse(input.notification);
  const scheduledBackup =
    input.scheduledBackup === null
      ? null
      : scheduledBackupAuditSchema.parse(input.scheduledBackup);
  const releaseGate =
    input.releaseGate == null
      ? null
      : githubReleaseGateAuditSchema.parse(input.releaseGate);
  const expectedRemaining = Math.max(0, capacity.limit - capacity.used);
  const expectedDeficit = Math.max(
    0,
    capacity.requiredSlots - expectedRemaining,
  );
  if (
    capacity.used > capacity.limit ||
    capacity.used !== capacity.databases.length ||
    capacity.remaining !== expectedRemaining ||
    capacity.slotDeficit !== expectedDeficit ||
    capacity.unrecognized !==
      capacity.databases.filter(
        (database) => database.classification === "unrecognized",
      ).length
  )
    throw new Error(
      "Cloudflare D1 capacity audit returned inconsistent totals.",
    );

  if (
    alerts.releaseEvidenceReady !==
    (alerts.capabilityReady &&
      alerts.operationalEmailPolicyConfigured &&
      alerts.operationalEmailReceiptRecorded)
  )
    throw new Error("Cloudflare alert audit returned inconsistent readiness.");

  if (alertPolicy) {
    const actionReady = ["create", "noop"].includes(alertPolicy.plan.action);
    const expectedReady =
      alertPolicy.prerequisites.providerFailureStatusContract &&
      alertPolicy.prerequisites.emailDeliveryReady &&
      alertPolicy.prerequisites.writeAuthenticationReady &&
      alertPolicy.recipientConfigured &&
      actionReady;
    const expectedConfigured = alertPolicy.plan.action === "noop";
    const expectedCreates = alertPolicy.plan.action === "create" ? 1 : 0;
    if (
      alertPolicy.readyToApply !== expectedReady ||
      alertPolicy.policyConfigured !== expectedConfigured ||
      alertPolicy.plan.policiesToCreate !== expectedCreates ||
      (alertPolicy.policyConfigured && !alerts.operationalEmailPolicyConfigured)
    )
      throw new Error(
        "Cloudflare operational alert policy dry-run returned inconsistent readiness.",
      );
  }

  if (vitals) {
    const expectedStatuses = Object.entries(vitals.metrics).map(
      ([name, metric]) => {
        if (
          (metric.samples === 0 && metric.p75 !== null) ||
          (metric.samples > 0 && metric.p75 === null)
        )
          throw new Error(
            "Cloudflare Web Vitals audit returned inconsistent metric data.",
          );
        const expected =
          metric.samples < vitals.minimumSamples
            ? "insufficient"
            : metric.p75 === null || (name !== "CLS" && metric.p75 <= 0)
              ? "fail"
              : metric.p75 <= metric.target
                ? "pass"
                : "fail";
        if (metric.status !== expected)
          throw new Error(
            "Cloudflare Web Vitals audit returned inconsistent metric status.",
          );
        return expected;
      },
    );
    if (vitals.ready !== expectedStatuses.every((status) => status === "pass"))
      throw new Error(
        "Cloudflare Web Vitals audit returned inconsistent readiness.",
      );
  }

  if (notification) {
    const prerequisites = notification.prerequisites;
    const hasReleaseIdentity =
      typeof prerequisites.deploymentCommit === "string" &&
      /^[0-9a-f]{40}$/i.test(prerequisites.deploymentCommit) &&
      typeof prerequisites.deploymentInputSha256 === "string" &&
      /^[0-9a-f]{64}$/i.test(prerequisites.deploymentInputSha256);
    const expectedReady =
      prerequisites.providerConfigurationExposed &&
      prerequisites.emailRuntimeConfigured &&
      prerequisites.deploymentProvenanceExposed &&
      prerequisites.deploymentClean &&
      prerequisites.deploymentSiteMatched &&
      prerequisites.deploymentStageMatched;
    if (
      notification.readyToApply !== expectedReady ||
      (!prerequisites.providerConfigurationExposed &&
        prerequisites.emailRuntimeConfigured) ||
      (!prerequisites.deploymentProvenanceExposed &&
        (prerequisites.deploymentClean ||
          prerequisites.deploymentSiteMatched ||
          prerequisites.deploymentStageMatched ||
          prerequisites.deploymentCommit !== null ||
          prerequisites.deploymentInputSha256 !== null)) ||
      (prerequisites.deploymentClean && !hasReleaseIdentity)
    )
      throw new Error(
        "Notification smoke audit returned inconsistent readiness.",
      );
  }

  if (scheduledBackup) {
    const expectedReady =
      scheduledBackup.workflow.availableOnDefaultBranch &&
      scheduledBackup.workflow.matchesLocalContract &&
      scheduledBackup.configuration.ready &&
      scheduledBackup.manualDispatch.valid &&
      scheduledBackup.scheduledRun.valid &&
      scheduledBackup.sequenceValid;
    if (
      scheduledBackup.ready !== expectedReady ||
      (scheduledBackup.workflow.matchesLocalContract &&
        !scheduledBackup.workflow.availableOnDefaultBranch) ||
      (scheduledBackup.sequenceValid &&
        (!scheduledBackup.manualDispatch.valid ||
          !scheduledBackup.scheduledRun.valid))
    )
      throw new Error(
        "GitHub scheduled-backup audit returned inconsistent readiness.",
      );
  }

  if (releaseGate) {
    const expectedReady =
      releaseGate.workflow.availableOnDefaultBranch &&
      releaseGate.workflow.matchesLocalContract &&
      releaseGate.workflow.registered &&
      releaseGate.workflow.active;
    if (
      releaseGate.ready !== expectedReady ||
      (releaseGate.workflow.matchesLocalContract &&
        !releaseGate.workflow.availableOnDefaultBranch) ||
      (releaseGate.workflow.active && !releaseGate.workflow.registered)
    )
      throw new Error(
        "GitHub client-ready release-gate audit returned inconsistent readiness.",
      );
  }

  const zeroTableOwnerReviewCandidates = capacity.databases.filter(
    (database) =>
      database.classification === "unrecognized" && database.numTables === 0,
  ).length;
  const evidenceCommitMatchesHead =
    input.evidence.qualityCommit !== null &&
    input.evidence.qualityCommit === input.repository.headCommit;
  const deploymentCommitMatchesHead =
    notification?.prerequisites.deploymentCommit ===
    input.repository.headCommit;
  const liveDeploymentIdentityMatchesEvidence =
    !input.evidence.valid ||
    (notification?.prerequisites.deploymentCommit ===
      input.evidence.stagingDeploymentCommit &&
      notification?.prerequisites.deploymentInputSha256 ===
        input.evidence.stagingDeploymentInputSha256);
  const stagingProvenanceReady =
    notification?.prerequisites.deploymentProvenanceExposed === true &&
    notification.prerequisites.deploymentClean &&
    notification.prerequisites.deploymentSiteMatched &&
    notification.prerequisites.deploymentStageMatched &&
    deploymentCommitMatchesHead &&
    liveDeploymentIdentityMatchesEvidence;
  const gaps: Array<{ gate: string; action: string }> = [];
  if (capacity.slotDeficit > 0)
    gaps.push({
      gate: "d1-capacity",
      action: `Owner approval or added capacity is required for ${capacity.slotDeficit} more D1 slot(s); unrecognized databases are never deletion-authorized automatically.`,
    });
  if (!alerts.operationalEmailPolicyConfigured)
    gaps.push({
      gate: "operational-alert-policy",
      action:
        alertPolicy?.readyToApply && alertPolicy.plan.action === "create"
          ? "Run cloudflare:alerts:policy with exact origin/policy confirmation to create the deterministic policy."
          : "Prepare the deterministic Workers Observability email policy with cloudflare:alerts:policy dry-run.",
    });
  if (!alerts.operationalEmailReceiptRecorded)
    gaps.push({
      gate: "operational-alert-receipt",
      action:
        "Trigger the configured operational failure path and retain its Cloudflare email dispatch receipt.",
    });
  if (!alertPolicy)
    gaps.push({
      gate: "operational-alert-policy-audit",
      action:
        "Pass --site, --stage and --origin to include deterministic alert-policy dry-run.",
    });
  else if (!alertPolicy.recipientConfigured)
    gaps.push({
      gate: "operational-alert-recipient",
      action:
        "Configure CLOUDFLARE_ALERT_EMAIL in private env, then rerun readiness; the address is never printed.",
    });
  else if (!alertPolicy.prerequisites.providerFailureStatusContract)
    gaps.push({
      gate: "operational-alert-provider-contract",
      action:
        "Review Cloudflare's current Workers Observability failure-status contract before any policy write.",
    });
  else if (
    alertPolicy.plan.action === "create" &&
    !alertPolicy.prerequisites.writeAuthenticationReady
  )
    gaps.push({
      gate: "operational-alert-write-auth",
      action:
        "Configure CLOUDFLARE_ALERT_API_TOKEN in private env with account-level Notifications Read/Write; Alchemy OAuth and the generic deploy token are not accepted for policy creation.",
    });
  else if (alertPolicy.plan.action === "manual-review")
    gaps.push({
      gate: "operational-alert-policy-drift",
      action:
        "Review the same-name Cloudflare policy manually; automated update/delete is intentionally disabled.",
    });
  if (!vitals)
    gaps.push({
      gate: "field-performance-audit",
      action:
        "Pass --site, --stage and --origin to include the read-only 28-day D1 Web Vitals audit.",
    });
  else if (!vitals.ready)
    gaps.push({
      gate: "field-performance",
      action: `Collect representative traffic and meet p75 budgets; qualifying samples are CLS ${vitals.metrics.CLS.samples}/75, LCP ${vitals.metrics.LCP.samples}/75 and INP ${vitals.metrics.INP.samples}/75.`,
    });
  if (!notification)
    gaps.push({
      gate: "staging-provenance-audit",
      action:
        "Pass --site, --stage and --origin to compare live Worker provenance with the current checkout.",
    });
  else if (!stagingProvenanceReady)
    gaps.push({
      gate: "staging-provenance",
      action:
        "Commit the release candidate, deploy that clean commit, and require live site/stage/commit/input-hash provenance to match before pilot evidence.",
    });
  if (!notification)
    gaps.push({
      gate: "notification-runtime-audit",
      action:
        "Pass --site, --stage and --origin to include the read-only notification smoke dry-run.",
    });
  else if (!notification.readyToApply)
    gaps.push({
      gate: "notification-runtime",
      action: !notification.prerequisites.providerConfigurationExposed
        ? "Deploy the current fail-closed health contract before attempting a notification smoke."
        : !notification.prerequisites.emailRuntimeConfigured
          ? "Configure RESEND_API_KEY, LEAD_NOTIFICATION_EMAIL and EMAIL_FROM for the deployed site, then redeploy and rerun dry-run."
          : "Deploy the exact clean release commit before attempting the notification smoke.",
    });
  if (!scheduledBackup)
    gaps.push({
      gate: "scheduled-backup-audit",
      action:
        "Pass --site, --stage and --origin to include the read-only GitHub scheduled-backup audit.",
    });
  else {
    if (!scheduledBackup.workflow.availableOnDefaultBranch)
      gaps.push({
        gate: "scheduled-backup-workflow",
        action:
          "Publish the audited scheduled-backup workflow to the repository default branch.",
      });
    else if (!scheduledBackup.workflow.matchesLocalContract)
      gaps.push({
        gate: "scheduled-backup-contract",
        action:
          "Make the default-branch scheduled-backup workflow match the audited local contract.",
      });
    if (!scheduledBackup.configuration.ready)
      gaps.push({
        gate: "scheduled-backup-configuration",
        action:
          "Configure the exact backup repository variables and dedicated Cloudflare secret; values remain suppressed.",
      });
    if (!scheduledBackup.manualDispatch.valid)
      gaps.push({
        gate: "scheduled-backup-manual-run",
        action:
          "Retain one successful manual backup run with run-bound restore and immutable archive evidence.",
      });
    if (!scheduledBackup.scheduledRun.valid)
      gaps.push({
        gate: "scheduled-backup-weekly-run",
        action:
          "Retain the following successful weekly run with distinct immutable evidence.",
      });
    else if (!scheduledBackup.sequenceValid)
      gaps.push({
        gate: "scheduled-backup-sequence",
        action:
          "Use a distinct weekly immutable object completed within eight days after the manual run.",
      });
  }
  if (!releaseGate)
    gaps.push({
      gate: "client-ready-workflow-audit",
      action:
        "Pass --site, --stage and --origin to verify the tag-triggered client-ready workflow on the GitHub default branch.",
    });
  else if (!releaseGate.workflow.availableOnDefaultBranch)
    gaps.push({
      gate: "client-ready-workflow",
      action:
        "Publish the audited client-ready release workflow to the repository default branch before creating a release tag.",
    });
  else if (!releaseGate.workflow.matchesLocalContract)
    gaps.push({
      gate: "client-ready-workflow-contract",
      action:
        "Make the default-branch client-ready workflow byte-identical to the audited local contract.",
    });
  if (releaseGate && !releaseGate.workflow.registered)
    gaps.push({
      gate: "client-ready-workflow-registration",
      action:
        "Wait for GitHub Actions to register the default-branch client-ready workflow, then rerun readiness.",
    });
  else if (releaseGate && !releaseGate.workflow.active)
    gaps.push({
      gate: "client-ready-workflow-active",
      action:
        "Enable the registered client-ready workflow in GitHub Actions before creating a release tag.",
    });
  if (!input.evidence.present)
    gaps.push({
      gate: "release-evidence",
      action:
        "Create docs/releases/v1.0.0-client-ready.json from the schema-v3 template using real receipts.",
    });
  else if (!input.evidence.valid)
    gaps.push({
      gate: "release-evidence",
      action: `Complete the failing release sections: ${input.evidence.failedSections.join(", ")}.`,
    });
  if (input.evidence.valid && !evidenceCommitMatchesHead)
    gaps.push({
      gate: "release-commit",
      action:
        "Regenerate release evidence for the exact current Git commit before verification.",
    });
  if (!input.repository.clean)
    gaps.push({
      gate: "release-checkout",
      action:
        "Commit the complete release candidate and rerun from a clean checkout.",
    });

  const releaseReady =
    input.evidence.valid &&
    evidenceCommitMatchesHead &&
    input.repository.clean &&
    stagingProvenanceReady &&
    releaseGate?.ready === true &&
    scheduledBackup?.ready === true;

  return {
    schemaVersion: 1 as const,
    checkedAt: input.checkedAt,
    releaseReady,
    livePrerequisitesReady:
      capacity.slotDeficit === 0 &&
      alerts.releaseEvidenceReady &&
      alertPolicy?.policyConfigured === true &&
      vitals?.ready === true &&
      notification?.readyToApply === true &&
      stagingProvenanceReady &&
      releaseGate?.ready === true &&
      scheduledBackup?.ready === true,
    d1: {
      used: capacity.used,
      limit: capacity.limit,
      remaining: capacity.remaining,
      requiredSlots: capacity.requiredSlots,
      slotDeficit: capacity.slotDeficit,
      unrecognizedDatabases: capacity.unrecognized,
      zeroTableOwnerReviewCandidates,
    },
    operationalAlert: {
      windowDays: alerts.windowDays,
      availableAlertTypeCount: alerts.availableAlertTypeCount,
      emailDeliveryReady: alerts.emailDeliveryReady,
      policyConfigured: alerts.operationalEmailPolicyConfigured,
      receiptRecorded: alerts.operationalEmailReceiptRecorded,
      releaseEvidenceReady: alerts.releaseEvidenceReady,
      provisioningChecked: alertPolicy !== null,
      recipientConfigured: alertPolicy?.recipientConfigured ?? false,
      providerFailureStatusContract:
        alertPolicy?.prerequisites.providerFailureStatusContract ?? false,
      writeAuthenticationReady:
        alertPolicy?.prerequisites.writeAuthenticationReady ?? false,
      deterministicPolicyConfigured: alertPolicy?.policyConfigured ?? false,
      policyReadyToApply: alertPolicy?.readyToApply ?? false,
      underlyingAlertThresholdConfigured:
        alertPolicy?.prerequisites.underlyingAlertThresholdConfigured ?? false,
    },
    fieldPerformance: vitals
      ? {
          checked: true as const,
          ready: vitals.ready,
          windowDays: vitals.window.days,
          minimumSamples: vitals.minimumSamples,
          metrics: Object.fromEntries(
            Object.entries(vitals.metrics).map(([name, metric]) => [
              name,
              {
                samples: metric.samples,
                p75: metric.p75,
                target: metric.target,
                unit: metric.unit,
                status: metric.status,
              },
            ]),
          ),
        }
      : {
          checked: false as const,
          ready: false,
          windowDays: 28 as const,
          minimumSamples: 75 as const,
          metrics: null,
        },
    stagingDeployment: notification
      ? {
          checked: true as const,
          ready: stagingProvenanceReady,
          provenanceExposed:
            notification.prerequisites.deploymentProvenanceExposed,
          clean: notification.prerequisites.deploymentClean,
          siteMatched: notification.prerequisites.deploymentSiteMatched,
          stageMatched: notification.prerequisites.deploymentStageMatched,
          commitMatchesHead: deploymentCommitMatchesHead,
          evidenceIdentityMatches: liveDeploymentIdentityMatchesEvidence,
        }
      : {
          checked: false as const,
          ready: false,
          provenanceExposed: false,
          clean: false,
          siteMatched: false,
          stageMatched: false,
          commitMatchesHead: false,
          evidenceIdentityMatches: false,
        },
    notificationRuntime: notification
      ? {
          checked: true as const,
          readyToApply: notification.readyToApply,
          providerConfigurationExposed:
            notification.prerequisites.providerConfigurationExposed,
          emailRuntimeConfigured:
            notification.prerequisites.emailRuntimeConfigured,
          deploymentReady: stagingProvenanceReady,
          plannedLeadRows: notification.plannedEffects.leadRowsCreated,
          plannedExternalEmails:
            notification.plannedEffects.externalEmailsRequested,
          plannedDuplicateReplays: notification.plannedEffects.duplicateReplays,
        }
      : {
          checked: false as const,
          readyToApply: false,
          providerConfigurationExposed: false,
          emailRuntimeConfigured: false,
          deploymentReady: false,
          plannedLeadRows: 1 as const,
          plannedExternalEmails: 1 as const,
          plannedDuplicateReplays: 1 as const,
        },
    scheduledBackup: scheduledBackup
      ? {
          checked: true as const,
          ready: scheduledBackup.ready,
          workflowOnDefaultBranch:
            scheduledBackup.workflow.availableOnDefaultBranch,
          workflowMatchesContract:
            scheduledBackup.workflow.matchesLocalContract,
          configurationReady: scheduledBackup.configuration.ready,
          manualDispatchReady: scheduledBackup.manualDispatch.valid,
          scheduledRunReady: scheduledBackup.scheduledRun.valid,
          sequenceValid: scheduledBackup.sequenceValid,
        }
      : {
          checked: false as const,
          ready: false,
          workflowOnDefaultBranch: false,
          workflowMatchesContract: false,
          configurationReady: false,
          manualDispatchReady: false,
          scheduledRunReady: false,
          sequenceValid: false,
        },
    clientReadyWorkflow: releaseGate
      ? {
          checked: true as const,
          ready: releaseGate.ready,
          workflowOnDefaultBranch:
            releaseGate.workflow.availableOnDefaultBranch,
          workflowMatchesContract: releaseGate.workflow.matchesLocalContract,
          registered: releaseGate.workflow.registered,
          active: releaseGate.workflow.active,
        }
      : {
          checked: false as const,
          ready: false,
          workflowOnDefaultBranch: false,
          workflowMatchesContract: false,
          registered: false,
          active: false,
        },
    releaseEvidence: {
      present: input.evidence.present,
      valid: input.evidence.valid,
      schemaVersion: input.evidence.schemaVersion,
      failedSections: input.evidence.failedSections,
      commitMatchesHead: evidenceCommitMatchesHead,
    },
    gaps,
  };
}

async function runJsonAudit(script: string, args: string[]) {
  const child = Bun.spawn(
    [process.execPath, resolve(repoRoot, script), ...args],
    {
      cwd: repoRoot,
      env: process.env,
      stderr: "pipe",
      stdout: "pipe",
    },
  );
  const [exitCode, stdout] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (!isExpectedReadinessAuditExitCode(exitCode))
    throw new Error("A read-only release readiness audit failed.");
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error("A read-only release audit returned invalid JSON.");
  }
}

async function readEvidence(path: string) {
  try {
    return inspectReleaseEvidence(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return inspectReleaseEvidence(null, false);
    return {
      present: true,
      valid: false,
      schemaVersion: null,
      qualityCommit: null,
      failedSections: ["releaseRecord"],
    } satisfies ReleaseEvidenceInspection;
  }
}

function readRepositoryState() {
  const head = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
  const headCommit = head.stdout.toString().trim();
  if (
    head.exitCode !== 0 ||
    status.exitCode !== 0 ||
    !/^[0-9a-f]{40}$/i.test(headCommit)
  )
    throw new Error("Could not verify the release repository state.");
  return { headCommit, clean: status.stdout.toString().trim().length === 0 };
}

async function main() {
  const evidencePath = resolve(
    repoRoot,
    argument("evidence") ?? "docs/releases/v1.0.0-client-ready.json",
  );
  const relativeEvidencePath = relative(repoRoot, evidencePath).replaceAll(
    "\\",
    "/",
  );
  if (
    !relativeEvidencePath ||
    relativeEvidencePath.startsWith("../") ||
    relativeEvidencePath === ".."
  )
    throw new Error("Release evidence must be inside this repository.");

  const { profileArgs, alertsProfileArgs } = buildReleaseReadinessProfileArgs({
    profile: argument("profile"),
    alertsProfile: argument("alerts-profile"),
  });
  const vitalsSite = argument("site");
  const vitalsStage = argument("stage");
  const vitalsOrigin = argument("origin");
  const vitalsArgumentCount = [vitalsSite, vitalsStage, vitalsOrigin].filter(
    Boolean,
  ).length;
  if (vitalsArgumentCount !== 0 && vitalsArgumentCount !== 3)
    throw new Error(
      "Pass --site, --stage and --origin together to audit field performance.",
    );
  const auditTarget =
    vitalsArgumentCount === 3
      ? validateReleaseReadinessAuditTarget({
          site: vitalsSite!,
          stage: vitalsStage!,
          origin: vitalsOrigin!,
        })
      : null;
  const repository = readRepositoryState();
  const [
    capacity,
    alerts,
    alertPolicy,
    vitals,
    notification,
    releaseGate,
    scheduledBackup,
    evidence,
  ] = await Promise.all([
    runJsonAudit("packages/infra/scripts/cloudflare-capacity-audit.ts", [
      "--json",
      // The isolated restore and second-site creation are already complete.
      // Final clean-checkout deploys update those resources in place.
      "--required-slots=0",
      ...profileArgs,
    ]),
    runJsonAudit("packages/infra/scripts/cloudflare-alerts-audit.ts", [
      "--json",
      "--days=30",
      ...alertsProfileArgs,
    ]),
    auditTarget
      ? runJsonAudit("packages/infra/scripts/cloudflare-alert-policy.ts", [
          "--json",
          `--site=${auditTarget.site}`,
          `--stage=${auditTarget.stage}`,
          `--origin=${auditTarget.origin}`,
          ...alertsProfileArgs,
        ])
      : Promise.resolve(null),
    auditTarget
      ? runJsonAudit("packages/infra/scripts/cloudflare-vitals-audit.ts", [
          "--json",
          `--site=${auditTarget.site}`,
          `--stage=${auditTarget.stage}`,
          `--origin=${auditTarget.origin}`,
          ...profileArgs,
        ])
      : Promise.resolve(null),
    auditTarget
      ? runJsonAudit(
          "packages/infra/scripts/cloudflare-notification-smoke.ts",
          [
            "--json",
            `--site=${auditTarget.site}`,
            `--stage=${auditTarget.stage}`,
            `--origin=${auditTarget.origin}`,
            ...profileArgs,
          ],
        )
      : Promise.resolve(null),
    auditTarget
      ? runJsonAudit("scripts/github-release-gate-audit.ts", ["--json"])
      : Promise.resolve(null),
    auditTarget
      ? runJsonAudit("scripts/github-backup-audit.ts", [
          "--json",
          `--site=${auditTarget.site}`,
          "--stage=production",
        ])
      : Promise.resolve(null),
    readEvidence(evidencePath),
  ]);
  const report = buildReleaseReadinessReport({
    checkedAt: new Date().toISOString(),
    capacity,
    alerts,
    alertPolicy,
    vitals,
    notification,
    releaseGate,
    scheduledBackup,
    evidence,
    repository,
  });

  if (flag("json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `Client-ready release: ${report.releaseReady ? "READY" : "NOT READY"}; live prerequisites: ${report.livePrerequisitesReady ? "READY" : "BLOCKED"}.`,
    );
    console.log(
      `D1 capacity: ${report.d1.used}/${report.d1.limit} used; ${report.d1.slotDeficit} slot deficit; ${report.d1.zeroTableOwnerReviewCandidates} zero-table owner-review candidate(s).`,
    );
    console.log(
      `Operational alert: policy ${report.operationalAlert.policyConfigured ? "configured" : "missing"}; receipt ${report.operationalAlert.receiptRecorded ? "recorded" : "missing"}.`,
    );
    console.log(
      report.operationalAlert.provisioningChecked
        ? `Alert provisioning: recipient ${report.operationalAlert.recipientConfigured ? "configured" : "missing"}; provider contract ${report.operationalAlert.providerFailureStatusContract ? "ready" : "drifted"}; write auth ${report.operationalAlert.writeAuthenticationReady ? "ready" : "missing"}; deterministic policy ${report.operationalAlert.deterministicPolicyConfigured ? "configured" : report.operationalAlert.policyReadyToApply ? "ready to create" : "blocked"}.`
        : "Alert provisioning: not audited; pass --site, --stage and --origin.",
    );
    console.log(
      report.fieldPerformance.checked && report.fieldPerformance.metrics
        ? `Field performance: ${report.fieldPerformance.ready ? "ready" : "blocked"}; samples CLS ${report.fieldPerformance.metrics.CLS.samples}/75, LCP ${report.fieldPerformance.metrics.LCP.samples}/75, INP ${report.fieldPerformance.metrics.INP.samples}/75.`
        : "Field performance: not audited; pass --site, --stage and --origin.",
    );
    console.log(
      report.stagingDeployment.checked
        ? `Staging provenance: ${report.stagingDeployment.ready ? "ready" : "blocked"}; contract ${report.stagingDeployment.provenanceExposed ? "exposed" : "missing"}; source ${report.stagingDeployment.clean ? "clean" : "not clean"}; commit ${report.stagingDeployment.commitMatchesHead ? "matches HEAD" : "does not match HEAD"}.`
        : "Staging provenance: not audited; pass --site, --stage and --origin.",
    );
    console.log(
      report.notificationRuntime.checked
        ? `Notification runtime: ${report.notificationRuntime.readyToApply ? "ready for controlled smoke" : "blocked"}; provider contract ${report.notificationRuntime.providerConfigurationExposed ? "exposed" : "not exposed"}; email configuration ${report.notificationRuntime.emailRuntimeConfigured ? "present" : "missing"}.`
        : "Notification runtime: not audited; pass --site, --stage and --origin.",
    );
    console.log(
      report.clientReadyWorkflow.checked
        ? `Client-ready workflow: ${report.clientReadyWorkflow.ready ? "ready" : "blocked"}; default branch ${report.clientReadyWorkflow.workflowOnDefaultBranch ? (report.clientReadyWorkflow.workflowMatchesContract ? "matches" : "drifted") : "missing"}; registration ${report.clientReadyWorkflow.registered ? (report.clientReadyWorkflow.active ? "active" : "disabled") : "missing"}.`
        : "Client-ready workflow: not audited; pass --site, --stage and --origin.",
    );
    console.log(
      report.scheduledBackup.checked
        ? `Scheduled backup: ${report.scheduledBackup.ready ? "ready" : "blocked"}; workflow ${report.scheduledBackup.workflowOnDefaultBranch ? (report.scheduledBackup.workflowMatchesContract ? "matches" : "drifted") : "missing"}; configuration ${report.scheduledBackup.configurationReady ? "ready" : "missing"}; manual ${report.scheduledBackup.manualDispatchReady ? "valid" : "missing"}; weekly ${report.scheduledBackup.scheduledRunReady ? "valid" : "missing"}.`
        : "Scheduled backup: not audited; pass --site, --stage and --origin.",
    );
    console.log(
      `Release evidence (${relativeEvidencePath}): ${report.releaseEvidence.present ? (report.releaseEvidence.valid ? "valid" : "incomplete") : "missing"}.`,
    );
    for (const gap of report.gaps)
      console.log(`GAP ${gap.gate}: ${gap.action}`);
  }
  if (!report.releaseReady) process.exitCode = 1;
}

if (import.meta.main) await main();
