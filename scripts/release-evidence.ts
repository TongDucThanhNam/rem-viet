import { z } from "zod";

const isoTimestamp = z.string().refine((value) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && value.includes("T");
}, "Must be an ISO-8601 timestamp");

const httpsOrigin = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}, "Must be an HTTPS origin without path, query, credentials or hash");

const gitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/i, "Must be a full Git SHA");
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/i);

const r2ArtifactLocator = z
  .string()
  .regex(
    /^r2:\/\/[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9][A-Za-z0-9._/-]*\.sql$/,
    "Must be an R2 SQL artifact locator",
  );

const githubActionsRunUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/[^/]+\/[^/]+\/actions\/runs\/[1-9]\d*\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}, "Must be a canonical HTTPS GitHub Actions run URL");

const backupRunReceiptFields = {
  runId: z.string().regex(/^[1-9]\d*$/, "Must be a positive GitHub run ID"),
  runUrl: githubActionsRunUrl,
  completedAt: isoTimestamp,
  conclusion: z.literal("success"),
  artifactLocator: r2ArtifactLocator,
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  sizeBytes: z.number().int().positive(),
  immutable: z.literal(true),
  protectedUntil: isoTimestamp,
};

const resourcesSchema = z
  .object({
    worker: z.string().min(1),
    d1: z.string().min(1),
    r2: z.string().min(1),
  })
  .strict();

export const passedPilotTasksSchema = z
  .object({
    loginAndRole: z.literal(true),
    editHeroImageFaqAndGallery: z.literal(true),
    privateResponsivePreview: z.literal(true),
    publishRestoreAndRepublish: z.literal(true),
    pageSlugAndRedirect: z.literal(true),
    sanitizedRichTextPost: z.literal(true),
    leadInboxNoteAndCsv: z.literal(true),
    referencedMediaDeleteBlocked: z.literal(true),
    noJsonOrCode: z.literal(true),
  })
  .strict();

const pilotTaskMinutesSchema = z
  .object({
    loginAndRole: z.number().positive().max(30),
    editHeroImageFaqAndGallery: z.number().positive().max(30),
    privateResponsivePreview: z.number().positive().max(30),
    publishRestoreAndRepublish: z.number().positive().max(30),
    pageSlugAndRedirect: z.number().positive().max(30),
    sanitizedRichTextPost: z.number().positive().max(30),
    leadInboxNoteAndCsv: z.number().positive().max(30),
    referencedMediaDeleteBlocked: z.number().positive().max(30),
  })
  .strict();

export const pilotReleaseEvidenceSchema = z
  .object({
    deployment: z
      .object({ commit: gitShaSchema, inputSha256: sha256Schema })
      .strict(),
    testerName: z.string().min(2),
    testerRelationship: z.literal("non-developer"),
    browserAndDevice: z.string().min(3),
    startedAt: isoTimestamp,
    completedAt: isoTimestamp,
    durationMinutes: z.number().positive().max(30),
    trainingDurationMinutes: z.number().positive().max(30),
    revisionRestoreMinutes: z.number().positive().max(5),
    editableRecurringContentPercent: z.number().min(90).max(100),
    clientManualUsedWithoutExtraGuidance: z.literal(true),
    developerInterventions: z.literal(0),
    openP0: z.literal(0),
    openP1: z.literal(0),
    issueIds: z.array(z.string().min(1)),
    tasks: passedPilotTasksSchema,
  })
  .strict()
  .superRefine((pilot, context) => {
    const started = Date.parse(pilot.startedAt);
    const completed = Date.parse(pilot.completedAt);
    const measuredMinutes = (completed - started) / 60_000;
    if (completed < started)
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Pilot completion precedes start",
      });
    if (Math.abs(measuredMinutes - pilot.durationMinutes) > 1)
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message:
          "Declared duration differs from timestamps by more than one minute",
      });
  });

export const pilotEvidenceRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    siteId: z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,62}$/, "Must be a safe site slug"),
    stage: z.literal("staging"),
    origin: httpsOrigin,
    recordedAt: isoTimestamp,
    pilot: pilotReleaseEvidenceSchema,
    taskMinutes: pilotTaskMinutesSchema,
    confusionPoints: z.array(z.string().min(1)),
    testerApproval: z
      .object({ name: z.string().min(2), approvedAt: isoTimestamp })
      .strict(),
  })
  .strict()
  .superRefine((record, context) => {
    const completed = Date.parse(record.pilot.completedAt);
    const approved = Date.parse(record.testerApproval.approvedAt);
    const recorded = Date.parse(record.recordedAt);
    const taskMinutes = Object.values(record.taskMinutes).reduce(
      (total, value) => total + value,
      0,
    );
    if (Math.abs(taskMinutes - record.pilot.durationMinutes) > 1)
      context.addIssue({
        code: "custom",
        path: ["taskMinutes"],
        message:
          "Per-step timing total differs from declared pilot duration by more than one minute",
      });
    if (record.testerApproval.name !== record.pilot.testerName)
      context.addIssue({
        code: "custom",
        path: ["testerApproval", "name"],
        message: "Pilot approval must be made by the recorded pilot tester",
      });
    if (approved < completed)
      context.addIssue({
        code: "custom",
        path: ["testerApproval", "approvedAt"],
        message: "Pilot tester approval must follow pilot completion",
      });
    if (recorded < approved)
      context.addIssue({
        code: "custom",
        path: ["recordedAt"],
        message: "Record timestamp must follow pilot tester approval",
      });
  });

export const passedSecondSiteSmokeSchema = z
  .object({
    desktopChrome: z.literal(true),
    mobileChrome: z.literal(true),
    cloudflarePageProviderConformance: z.literal(true),
    adminLogin: z.literal(true),
    mediaUpload: z.literal(true),
    draftPreview: z.literal(true),
    publishWithoutDeploy: z.literal(true),
    publicPublishedRead: z.literal(true),
    leadSubmission: z.literal(true),
    sitemap: z.literal(true),
  })
  .strict();

export const secondSiteReleaseEvidenceSchema = z
  .object({
    siteId: z.string().min(1),
    origin: httpsOrigin,
    resources: resourcesSchema,
    cleanCheckout: z.literal(true),
    deployDurationMinutes: z.number().positive().max(120),
    brandAndDemoContentDurationMinutes: z.number().positive().max(1440),
    smoke: passedSecondSiteSmokeSchema,
    verifiedAt: isoTimestamp,
  })
  .strict();

export const clientReleaseEvidenceSchema = z
  .object({
    schemaVersion: z.literal(3),
    releaseTag: z.literal("v1.0.0-client-ready"),
    assembledAt: isoTimestamp,
    flagship: z
      .object({
        siteId: z.string().min(1),
        origin: httpsOrigin,
        resources: resourcesSchema,
      })
      .strict(),
    quality: z
      .object({
        commit: gitShaSchema,
        command: z.literal("bun run quality"),
        passed: z.literal(true),
        passedAt: isoTimestamp,
      })
      .strict(),
    staging: z
      .object({
        origin: httpsOrigin,
        deployedAt: isoTimestamp,
        deployment: z
          .object({
            commit: gitShaSchema,
            inputSha256: sha256Schema,
            sourceState: z.literal("clean"),
          })
          .strict(),
        publishVisibilitySeconds: z.number().positive().max(10),
        desktopSmoke: z.literal(true),
        mobileSmoke: z.literal(true),
        draftLeakChecks: z.literal(true),
        keyboardCriticalPath: z.literal(true),
        noUnexpectedHorizontalOverflow: z.literal(true),
        openP0: z.literal(0),
        openP1: z.literal(0),
      })
      .strict(),
    pilot: pilotReleaseEvidenceSchema,
    performance: z
      .object({
        origin: httpsOrigin,
        windowDays: z.literal(28),
        automatedTrafficExcluded: z.literal(true),
        exportedAt: isoTimestamp,
        metrics: z
          .object({
            CLS: z
              .object({
                samples: z.number().int().min(75),
                p75: z.number().nonnegative().max(0.1),
                unit: z.literal("score"),
              })
              .strict(),
            LCP: z
              .object({
                samples: z.number().int().min(75),
                p75: z.number().positive().max(2500),
                unit: z.literal("ms"),
              })
              .strict(),
            INP: z
              .object({
                samples: z.number().int().min(75),
                p75: z.number().positive().max(200),
                unit: z.literal("ms"),
              })
              .strict(),
          })
          .strict(),
      })
      .strict(),
    notification: z
      .object({
        provider: z.literal("resend"),
        submissionId: z.string().min(1),
        adminInboxCreated: z.literal(true),
        deliveredCount: z.literal(1),
        providerMessageId: z.string().min(1),
        verifiedAt: isoTimestamp,
        operationalAlert: z
          .object({
            provider: z.literal("cloudflare"),
            stage: z.literal("staging"),
            trigger: z.literal("notification-failure"),
            alertType: z.enum([
              "health_check_status_notification",
              "workers_observability_alert",
            ]),
            deliveryMechanism: z.literal("email"),
            policyEnabled: z.literal(true),
            delivered: z.literal(true),
            dispatchReceiptId: z.string().min(1),
            verifiedAt: isoTimestamp,
          })
          .strict(),
      })
      .strict(),
    stagingRestore: z
      .object({
        siteId: z.string().min(1),
        stage: z.literal("staging"),
        sourceDatabase: z.string().min(3),
        backup: z
          .object({
            createdAt: isoTimestamp,
            artifactLocator: r2ArtifactLocator,
            sha256: z.string().regex(/^[0-9a-f]{64}$/i),
            sizeBytes: z.number().int().positive(),
            immutable: z.literal(true),
            protectedUntil: isoTimestamp,
          })
          .strict(),
        restore: z
          .object({
            targetDatabase: z.string().min(3),
            startedAt: isoTimestamp,
            completedAt: isoTimestamp,
            integrityCheck: z.literal("ok"),
            exactTableParity: z.literal(true),
            exactRowParity: z.literal(true),
            targetDeleted: z.literal(true),
            recoveryMinutes: z.number().positive(),
          })
          .strict(),
      })
      .strict(),
    secondSite: secondSiteReleaseEvidenceSchema,
    security: z
      .object({
        productionSecretsRotatedAt: isoTimestamp,
        publicSignupDisabled: z.literal(true),
        productionHttpsAndTrustedOriginVerified: z.literal(true),
        dependencyAudit: z
          .object({
            command: z.literal("bun run audit:security"),
            criticalFindings: z.literal(0),
            highFindings: z.literal(0),
            passedAt: isoTimestamp,
          })
          .strict(),
      })
      .strict(),
    production: z
      .object({
        migrationStartedAt: isoTimestamp,
        backup: z
          .object({
            createdAt: isoTimestamp,
            artifactLocator: r2ArtifactLocator,
            sha256: z.string().regex(/^[0-9a-f]{64}$/i),
            sizeBytes: z.number().int().positive(),
            immutable: z.literal(true),
          })
          .strict(),
        restoreDrill: z
          .object({
            completedAt: isoTimestamp,
            isolatedTarget: z.string().min(3),
            integrityCheck: z.literal("ok"),
            recoveryMinutes: z.number().positive().max(5),
          })
          .strict(),
      })
      .strict(),
    scheduledBackup: z
      .object({
        siteId: z.string().min(1),
        stage: z.literal("production"),
        bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/),
        workflow: z.literal(".github/workflows/scheduled-cms-backup.yml"),
        configuredAt: isoTimestamp,
        retentionDays: z.number().int().min(90).max(3650),
        manualDispatch: z
          .object({
            trigger: z.literal("workflow_dispatch"),
            ...backupRunReceiptFields,
          })
          .strict(),
        scheduledRun: z
          .object({
            trigger: z.literal("schedule"),
            ...backupRunReceiptFields,
          })
          .strict(),
      })
      .strict(),
    approvals: z
      .object({
        agencyOwner: z
          .object({ name: z.string().min(2), approvedAt: isoTimestamp })
          .strict(),
        pilotTester: z
          .object({ name: z.string().min(2), approvedAt: isoTimestamp })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((evidence, context) => {
    const addIssue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    if (evidence.staging.deployment.commit !== evidence.quality.commit)
      addIssue(
        ["staging", "deployment", "commit"],
        "Staging deployment must use the exact quality-verified release commit",
      );
    if (
      evidence.pilot.deployment.commit !== evidence.staging.deployment.commit ||
      evidence.pilot.deployment.inputSha256 !==
        evidence.staging.deployment.inputSha256
    )
      addIssue(
        ["pilot", "deployment"],
        "Pilot must run against the exact staging deployment identity",
      );

    const pilotCompleted = Date.parse(evidence.pilot.completedAt);

    if (evidence.performance.origin !== evidence.staging.origin)
      addIssue(
        ["performance", "origin"],
        "Performance evidence must belong to the flagship staging origin",
      );
    if (evidence.staging.origin === evidence.flagship.origin)
      addIssue(
        ["staging", "origin"],
        "Staging and production flagship origins must differ",
      );

    if (evidence.stagingRestore.siteId !== evidence.flagship.siteId)
      addIssue(
        ["stagingRestore", "siteId"],
        "Staging restore evidence must belong to the flagship site",
      );
    if (
      evidence.stagingRestore.sourceDatabase === evidence.flagship.resources.d1
    )
      addIssue(
        ["stagingRestore", "sourceDatabase"],
        "Staging restore source must differ from the production database",
      );
    const restoreTarget = evidence.stagingRestore.restore.targetDatabase;
    if (
      restoreTarget === evidence.stagingRestore.sourceDatabase ||
      restoreTarget === evidence.flagship.resources.d1 ||
      restoreTarget === evidence.secondSite.resources.d1
    )
      addIssue(
        ["stagingRestore", "restore", "targetDatabase"],
        "Restore drill target must be isolated from every live site database",
      );
    const restoreBackupCreatedAt = Date.parse(
      evidence.stagingRestore.backup.createdAt,
    );
    const restoreStartedAt = Date.parse(
      evidence.stagingRestore.restore.startedAt,
    );
    const restoreCompletedAt = Date.parse(
      evidence.stagingRestore.restore.completedAt,
    );
    if (restoreBackupCreatedAt >= restoreStartedAt)
      addIssue(
        ["stagingRestore", "backup", "createdAt"],
        "Staging backup must exist before the isolated restore starts",
      );
    if (restoreCompletedAt <= restoreStartedAt)
      addIssue(
        ["stagingRestore", "restore", "completedAt"],
        "Staging restore completion must follow its start",
      );
    const measuredRecoveryMinutes =
      (restoreCompletedAt - restoreStartedAt) / 60_000;
    if (
      Math.abs(
        measuredRecoveryMinutes -
          evidence.stagingRestore.restore.recoveryMinutes,
      ) > 1
    )
      addIssue(
        ["stagingRestore", "restore", "recoveryMinutes"],
        "Declared staging restore duration differs from timestamps by more than one minute",
      );
    if (restoreCompletedAt >= Date.parse(evidence.secondSite.verifiedAt))
      addIssue(
        ["stagingRestore", "restore", "completedAt"],
        "Isolated staging restore must complete before second-site verification",
      );

    if (evidence.secondSite.siteId === evidence.flagship.siteId)
      addIssue(
        ["secondSite", "siteId"],
        "Second-site ID must differ from the flagship",
      );
    if (evidence.secondSite.origin === evidence.flagship.origin)
      addIssue(
        ["secondSite", "origin"],
        "Second-site origin must differ from the flagship",
      );

    const flagshipResources = Object.values(evidence.flagship.resources);
    const secondSiteResources = Object.values(evidence.secondSite.resources);
    const allResources = [...flagshipResources, ...secondSiteResources];
    if (new Set(flagshipResources).size !== flagshipResources.length)
      addIssue(
        ["flagship", "resources"],
        "Flagship Worker, D1 and R2 names must be unique",
      );
    if (new Set(secondSiteResources).size !== secondSiteResources.length)
      addIssue(
        ["secondSite", "resources"],
        "Second-site Worker, D1 and R2 names must be unique",
      );
    if (new Set(allResources).size !== allResources.length)
      addIssue(
        ["secondSite", "resources"],
        "Second site must not share Worker, D1 or R2 resources with flagship",
      );

    if (
      Date.parse(evidence.production.backup.createdAt) >=
      Date.parse(evidence.production.migrationStartedAt)
    )
      addIssue(
        ["production", "backup", "createdAt"],
        "Production backup must precede the production migration",
      );
    if (
      Date.parse(evidence.production.restoreDrill.completedAt) <=
      Date.parse(evidence.production.backup.createdAt)
    )
      addIssue(
        ["production", "restoreDrill", "completedAt"],
        "Restore drill must complete after the recorded backup",
      );

    if (evidence.scheduledBackup.siteId !== evidence.flagship.siteId)
      addIssue(
        ["scheduledBackup", "siteId"],
        "Scheduled backup must belong to the flagship site",
      );

    const manualBackup = evidence.scheduledBackup.manualDispatch;
    const scheduledBackup = evidence.scheduledBackup.scheduledRun;
    const configuredAt = Date.parse(evidence.scheduledBackup.configuredAt);
    const manualCompletedAt = Date.parse(manualBackup.completedAt);
    const scheduledCompletedAt = Date.parse(scheduledBackup.completedAt);
    if (configuredAt > manualCompletedAt)
      addIssue(
        ["scheduledBackup", "configuredAt"],
        "Scheduled-backup configuration must precede the manual dispatch receipt",
      );
    if (scheduledCompletedAt <= manualCompletedAt)
      addIssue(
        ["scheduledBackup", "scheduledRun", "completedAt"],
        "Scheduled receipt must follow the manual dispatch receipt",
      );
    if (scheduledCompletedAt - manualCompletedAt > 8 * 24 * 60 * 60 * 1000)
      addIssue(
        ["scheduledBackup", "scheduledRun", "completedAt"],
        "Scheduled receipt must be from the next weekly run (within eight days)",
      );
    if (manualBackup.runId === scheduledBackup.runId)
      addIssue(
        ["scheduledBackup", "scheduledRun", "runId"],
        "Manual and scheduled backup receipts need distinct GitHub run IDs",
      );
    if (manualBackup.artifactLocator === scheduledBackup.artifactLocator)
      addIssue(
        ["scheduledBackup", "scheduledRun", "artifactLocator"],
        "Manual and scheduled runs need distinct immutable R2 objects",
      );

    const expectedBackupPrefix = `r2://${evidence.scheduledBackup.bucket}/d1/production/`;
    const expectedStagingBackupPrefix = `r2://${evidence.scheduledBackup.bucket}/d1/staging/`;
    if (
      !evidence.stagingRestore.backup.artifactLocator.startsWith(
        expectedStagingBackupPrefix,
      )
    )
      addIssue(
        ["stagingRestore", "backup", "artifactLocator"],
        "Staging restore must use an immutable staging artifact from the configured backup bucket",
      );
    const stagingProtectionMs =
      Date.parse(evidence.stagingRestore.backup.protectedUntil) -
      restoreBackupCreatedAt;
    const minimumStagingProtectionMs =
      (evidence.scheduledBackup.retentionDays - 1) * 24 * 60 * 60 * 1000;
    if (stagingProtectionMs < minimumStagingProtectionMs)
      addIssue(
        ["stagingRestore", "backup", "protectedUntil"],
        "Staging restore artifact protection is shorter than the backup retention policy",
      );
    for (const [name, receipt] of [
      ["manualDispatch", manualBackup],
      ["scheduledRun", scheduledBackup],
    ] as const) {
      if (!receipt.runUrl.endsWith(`/actions/runs/${receipt.runId}`))
        addIssue(
          ["scheduledBackup", name, "runUrl"],
          "GitHub Actions run URL must end with the recorded run ID",
        );
      if (!receipt.artifactLocator.startsWith(expectedBackupPrefix))
        addIssue(
          ["scheduledBackup", name, "artifactLocator"],
          "Scheduled backup receipt must reference the configured production backup bucket",
        );
      const protectedForMs =
        Date.parse(receipt.protectedUntil) - Date.parse(receipt.completedAt);
      const minimumProtectionMs =
        (evidence.scheduledBackup.retentionDays - 1) * 24 * 60 * 60 * 1000;
      if (protectedForMs < minimumProtectionMs)
        addIssue(
          ["scheduledBackup", name, "protectedUntil"],
          "Immutable object protection is shorter than the recorded retention policy",
        );
    }
    if (
      !evidence.production.backup.artifactLocator.startsWith(
        expectedBackupPrefix,
      )
    )
      addIssue(
        ["production", "backup", "artifactLocator"],
        "Production pre-migration backup must use the configured production backup bucket",
      );

    if (
      Date.parse(evidence.security.dependencyAudit.passedAt) <
      Date.parse(evidence.security.productionSecretsRotatedAt)
    )
      addIssue(
        ["security", "dependencyAudit", "passedAt"],
        "Final dependency/security review must follow production secret rotation",
      );

    if (
      evidence.notification.providerMessageId ===
      evidence.notification.operationalAlert.dispatchReceiptId
    )
      addIssue(
        ["notification", "operationalAlert", "providerMessageId"],
        "Lead notification and operational alert need distinct provider receipts",
      );

    if (evidence.approvals.pilotTester.name !== evidence.pilot.testerName)
      addIssue(
        ["approvals", "pilotTester", "name"],
        "Pilot approval must be made by the recorded pilot tester",
      );
    if (
      evidence.approvals.agencyOwner.name ===
      evidence.approvals.pilotTester.name
    )
      addIssue(
        ["approvals"],
        "Agency owner and non-developer pilot tester must be different people",
      );
    if (Date.parse(evidence.approvals.pilotTester.approvedAt) < pilotCompleted)
      addIssue(
        ["approvals", "pilotTester", "approvedAt"],
        "Pilot tester approval must follow pilot completion",
      );

    const assembledAt = Date.parse(evidence.assembledAt);
    const evidenceBeforeOwnerApproval = [
      evidence.quality.passedAt,
      evidence.staging.deployedAt,
      evidence.pilot.completedAt,
      evidence.performance.exportedAt,
      evidence.notification.verifiedAt,
      evidence.notification.operationalAlert.verifiedAt,
      evidence.stagingRestore.restore.completedAt,
      evidence.secondSite.verifiedAt,
      evidence.security.dependencyAudit.passedAt,
      evidence.production.restoreDrill.completedAt,
      evidence.scheduledBackup.manualDispatch.completedAt,
      evidence.scheduledBackup.scheduledRun.completedAt,
      evidence.approvals.pilotTester.approvedAt,
    ];
    const evidenceTimestamps = [
      ...evidenceBeforeOwnerApproval,
      evidence.approvals.agencyOwner.approvedAt,
    ];
    if (evidenceTimestamps.some((value) => Date.parse(value) > assembledAt))
      addIssue(
        ["assembledAt"],
        "Release evidence cannot be assembled before one of its recorded events",
      );

    const ownerApprovedAt = Date.parse(
      evidence.approvals.agencyOwner.approvedAt,
    );
    if (
      evidenceBeforeOwnerApproval.some(
        (value) => Date.parse(value) > ownerApprovedAt,
      )
    )
      addIssue(
        ["approvals", "agencyOwner", "approvedAt"],
        "Agency owner approval must follow every recorded release gate",
      );
  });

export type ClientReleaseEvidence = z.infer<typeof clientReleaseEvidenceSchema>;
export type PilotEvidenceRecord = z.infer<typeof pilotEvidenceRecordSchema>;

export function formatReleaseEvidenceErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `- ${issue.path.join(".") || "evidence"}: ${issue.message}`)
    .join("\n");
}
