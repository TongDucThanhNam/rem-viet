import { z } from "zod";

import {
  backupArchiveEvidenceSchema,
  type BackupArchiveEvidence,
} from "./cms-backup-archive-lib";
import { backupEvidenceSchema, type BackupEvidence } from "./cms-backup-lib";

const safeSite = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const safeStage = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const sha = z.string().regex(/^[0-9a-f]{40}$/i);
const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));

export const githubVariableSchema = z
  .object({
    name: z.string().min(1),
    value: z.string(),
    updatedAt: isoTimestamp,
  })
  .strict();

export const githubSecretSchema = z
  .object({
    name: z.string().min(1),
    updatedAt: isoTimestamp,
  })
  .strict();

export const githubBackupRunSchema = z
  .object({
    id: z.number().int().positive(),
    run_attempt: z.number().int().positive(),
    event: z.enum(["workflow_dispatch", "schedule"]),
    status: z.string(),
    conclusion: z.string().nullable(),
    created_at: isoTimestamp,
    updated_at: isoTimestamp,
    html_url: z.string().url(),
    head_sha: sha,
    head_branch: z.string().min(1),
  })
  .passthrough();

export type GithubBackupRun = z.infer<typeof githubBackupRunSchema>;

type ConfigurationEntry = Readonly<{
  present: boolean;
  shapeValid: boolean;
  matchesExpected: boolean | null;
  updatedAt: string | null;
}>;

export type GithubBackupConfiguration = Readonly<{
  ready: boolean;
  configuredAt: string | null;
  site: ConfigurationEntry;
  stage: ConfigurationEntry;
  accountId: Omit<ConfigurationEntry, "matchesExpected">;
  token: Readonly<{ present: boolean; updatedAt: string | null }>;
}>;

function latestTimestamp(values: Array<string | null>) {
  const timestamps = values.filter((value): value is string => value !== null);
  if (!timestamps.length) return null;
  return timestamps.sort(
    (left, right) => Date.parse(right) - Date.parse(left),
  )[0]!;
}

export function inspectGithubBackupConfiguration(input: {
  variables: unknown;
  secrets: unknown;
  expectedSite: string;
  expectedStage: string;
}): GithubBackupConfiguration {
  const expectedSite = safeSite.parse(input.expectedSite);
  const expectedStage = safeStage.parse(input.expectedStage);
  const variables = z.array(githubVariableSchema).parse(input.variables);
  const secrets = z.array(githubSecretSchema).parse(input.secrets);

  const findVariable = (name: string) =>
    variables.find((entry) => entry.name === name) ?? null;
  const siteVariable = findVariable("CMS_BACKUP_SITE");
  const stageVariable = findVariable("CMS_BACKUP_STAGE");
  const accountVariable = findVariable("CLOUDFLARE_ACCOUNT_ID");
  const token =
    secrets.find((entry) => entry.name === "CMS_BACKUP_CLOUDFLARE_API_TOKEN") ??
    null;

  const site = {
    present: Boolean(siteVariable),
    shapeValid: Boolean(siteVariable?.value.match(/^[a-z][a-z0-9-]{1,62}$/)),
    matchesExpected: siteVariable ? siteVariable.value === expectedSite : null,
    updatedAt: siteVariable?.updatedAt ?? null,
  } satisfies ConfigurationEntry;
  const stage = {
    present: Boolean(stageVariable),
    shapeValid: Boolean(stageVariable?.value.match(/^[a-z][a-z0-9-]{0,31}$/)),
    matchesExpected: stageVariable
      ? stageVariable.value === expectedStage
      : null,
    updatedAt: stageVariable?.updatedAt ?? null,
  } satisfies ConfigurationEntry;
  const accountId = {
    present: Boolean(accountVariable),
    shapeValid: Boolean(accountVariable?.value.match(/^[0-9a-fA-F]{32}$/)),
    updatedAt: accountVariable?.updatedAt ?? null,
  };
  const tokenStatus = {
    present: Boolean(token),
    updatedAt: token?.updatedAt ?? null,
  };
  const ready =
    site.present &&
    site.shapeValid &&
    site.matchesExpected === true &&
    stage.present &&
    stage.shapeValid &&
    stage.matchesExpected === true &&
    accountId.present &&
    accountId.shapeValid &&
    tokenStatus.present;

  return {
    ready,
    configuredAt: ready
      ? latestTimestamp([
          site.updatedAt,
          stage.updatedAt,
          accountId.updatedAt,
          tokenStatus.updatedAt,
        ])
      : null,
    site,
    stage,
    accountId,
    token: tokenStatus,
  };
}

export type GithubBackupReceipt = Readonly<{
  trigger: GithubBackupRun["event"];
  runId: string;
  runAttempt: number;
  runUrl: string;
  headSha: string;
  completedAt: string;
  artifactLocator: string;
  sha256: string;
  sizeBytes: number;
  immutable: true;
  protectedUntil: string;
}>;

export type GithubBackupRunInspection = Readonly<{
  run: GithubBackupRun | null;
  valid: boolean;
  receipt: GithubBackupReceipt | null;
  errors: readonly string[];
}>;

function atLeastDaysAfter(start: string, end: string, days: number) {
  return Date.parse(end) - Date.parse(start) >= (days - 1) * 86_400_000;
}

export function inspectGithubBackupRun(input: {
  run: unknown;
  backupEvidence: unknown;
  archiveEvidence: unknown;
  expectedEvent: GithubBackupRun["event"];
  expectedSite: string;
  expectedStage: string;
  expectedBucket: string;
  defaultBranch: string;
  configuredAt: string | null;
  retentionDays: number;
}): GithubBackupRunInspection {
  const parsedRun = githubBackupRunSchema.safeParse(input.run);
  if (!parsedRun.success)
    return {
      run: null,
      valid: false,
      receipt: null,
      errors: ["No parseable GitHub Actions run exists for this trigger."],
    };

  const run = parsedRun.data;
  const errors: string[] = [];
  if (run.event !== input.expectedEvent)
    errors.push("The workflow event does not match the required trigger.");
  if (run.status !== "completed" || run.conclusion !== "success")
    errors.push("The latest workflow run did not complete successfully.");
  if (run.head_branch !== input.defaultBranch)
    errors.push("The workflow run does not belong to the default branch.");
  if (
    input.configuredAt &&
    Date.parse(run.created_at) < Date.parse(input.configuredAt)
  )
    errors.push("The workflow run predates the current backup configuration.");

  const parsedBackup = backupEvidenceSchema.safeParse(input.backupEvidence);
  const parsedArchive = backupArchiveEvidenceSchema.safeParse(
    input.archiveEvidence,
  );
  if (!parsedBackup.success)
    errors.push("The run is missing valid restore-drill backup evidence.");
  if (!parsedArchive.success)
    errors.push("The run is missing valid immutable archive evidence.");
  if (!parsedBackup.success || !parsedArchive.success)
    return { run, valid: false, receipt: null, errors };

  const backup: BackupEvidence = parsedBackup.data;
  const archive: BackupArchiveEvidence = parsedArchive.data;
  const expectedPath = `backups/${input.expectedSite}-${input.expectedStage}-gha-${run.id}-${run.run_attempt}.sql`;
  if (
    backup.siteId !== input.expectedSite ||
    archive.siteId !== input.expectedSite
  )
    errors.push("The evidence belongs to a different site.");
  if (
    backup.stage !== input.expectedStage ||
    archive.stage !== input.expectedStage
  )
    errors.push("The evidence belongs to a different stage.");
  if (backup.database !== archive.database)
    errors.push("The export and immutable archive name different databases.");
  if (backup.artifact.path !== expectedPath)
    errors.push(
      "The backup artifact path is not bound to this run and attempt.",
    );
  if (
    archive.source.path !== backup.artifact.path ||
    archive.source.createdAt !== backup.createdAt
  )
    errors.push(
      "The immutable archive source does not match the restored export.",
    );
  if (
    archive.archive.sha256 !== backup.artifact.sha256 ||
    archive.archive.sizeBytes !== backup.artifact.sizeBytes
  )
    errors.push(
      "The immutable archive hash or size does not match the export.",
    );
  if (
    archive.archive.bucket !== input.expectedBucket ||
    archive.archive.artifactLocator !==
      `r2://${archive.archive.bucket}/${archive.archive.objectKey}`
  )
    errors.push(
      "The immutable archive locator does not match the manifest bucket.",
    );
  if (backup.artifact.immutable)
    errors.push(
      "The local export must not claim immutability before archival.",
    );
  if (
    !archive.retention.protectedUntil ||
    !atLeastDaysAfter(
      run.updated_at,
      archive.retention.protectedUntil,
      input.retentionDays,
    )
  )
    errors.push("The immutable object protection is shorter than required.");
  if (Date.parse(archive.archive.verifiedAt) > Date.parse(run.updated_at))
    errors.push(
      "The run completed before archive download verification finished.",
    );

  const valid = errors.length === 0;
  return {
    run,
    valid,
    receipt: valid
      ? {
          trigger: run.event,
          runId: String(run.id),
          runAttempt: run.run_attempt,
          runUrl: run.html_url,
          headSha: run.head_sha,
          completedAt: run.updated_at,
          artifactLocator: archive.archive.artifactLocator,
          sha256: archive.archive.sha256,
          sizeBytes: archive.archive.sizeBytes,
          immutable: true,
          protectedUntil: archive.retention.protectedUntil!,
        }
      : null,
    errors,
  };
}

export type GithubBackupAuditReport = Readonly<{
  schemaVersion: 1;
  checkedAt: string;
  ready: boolean;
  repository: Readonly<{
    nameWithOwner: string;
    defaultBranch: string;
  }>;
  workflow: Readonly<{
    path: string;
    availableOnDefaultBranch: boolean;
    matchesLocalContract: boolean;
  }>;
  configuration: GithubBackupConfiguration;
  manualDispatch: GithubBackupRunInspection;
  scheduledRun: GithubBackupRunInspection;
  sequenceValid: boolean;
  gaps: readonly Readonly<{ gate: string; action: string }>[];
}>;

export function buildGithubBackupAuditReport(input: {
  checkedAt: string;
  repository: { nameWithOwner: string; defaultBranch: string };
  workflow: {
    path: string;
    availableOnDefaultBranch: boolean;
    matchesLocalContract: boolean;
  };
  configuration: GithubBackupConfiguration;
  manualDispatch: GithubBackupRunInspection;
  scheduledRun: GithubBackupRunInspection;
}): GithubBackupAuditReport {
  const manualCompletedAt = input.manualDispatch.receipt?.completedAt ?? null;
  const scheduledCompletedAt = input.scheduledRun.receipt?.completedAt ?? null;
  const sequenceDurationMs =
    manualCompletedAt && scheduledCompletedAt
      ? Date.parse(scheduledCompletedAt) - Date.parse(manualCompletedAt)
      : null;
  const sequenceValid = Boolean(
    input.manualDispatch.receipt &&
    input.scheduledRun.receipt &&
    input.manualDispatch.receipt.runId !== input.scheduledRun.receipt.runId &&
    input.manualDispatch.receipt.artifactLocator !==
      input.scheduledRun.receipt.artifactLocator &&
    sequenceDurationMs !== null &&
    sequenceDurationMs > 0 &&
    sequenceDurationMs <= 8 * 86_400_000,
  );
  const gaps: Array<{ gate: string; action: string }> = [];
  if (!input.workflow.availableOnDefaultBranch)
    gaps.push({
      gate: "workflow-default-branch",
      action:
        "Publish the scheduled-backup workflow to the repository default branch.",
    });
  else if (!input.workflow.matchesLocalContract)
    gaps.push({
      gate: "workflow-contract",
      action:
        "Make the default-branch workflow match the audited local contract.",
    });
  if (!input.configuration.ready)
    gaps.push({
      gate: "workflow-configuration",
      action:
        "Configure CMS_BACKUP_SITE, CMS_BACKUP_STAGE, CLOUDFLARE_ACCOUNT_ID and the dedicated CMS_BACKUP_CLOUDFLARE_API_TOKEN secret.",
    });
  if (!input.manualDispatch.valid)
    gaps.push({
      gate: "manual-dispatch",
      action:
        "Retain one successful workflow_dispatch run with valid immutable evidence.",
    });
  if (!input.scheduledRun.valid)
    gaps.push({
      gate: "scheduled-run",
      action:
        "Retain the next successful scheduled run with valid immutable evidence.",
    });
  if (input.manualDispatch.valid && input.scheduledRun.valid && !sequenceValid)
    gaps.push({
      gate: "run-sequence",
      action:
        "Use distinct immutable objects from the next scheduled run completed within eight days after the manual dispatch.",
    });

  return {
    schemaVersion: 1,
    checkedAt: isoTimestamp.parse(input.checkedAt),
    ready:
      input.workflow.availableOnDefaultBranch &&
      input.workflow.matchesLocalContract &&
      input.configuration.ready &&
      input.manualDispatch.valid &&
      input.scheduledRun.valid &&
      sequenceValid,
    repository: input.repository,
    workflow: input.workflow,
    configuration: input.configuration,
    manualDispatch: input.manualDispatch,
    scheduledRun: input.scheduledRun,
    sequenceValid,
    gaps,
  };
}
