import { stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { z } from "zod";

import type { SiteManifest } from "../packages/cms/src/site-manifest";

import { type BackupEvidence, sha256File } from "./cms-backup-lib";
import { repoRoot } from "./site-lib";

const safeResourceName = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const safeStage = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const isoTimestamp = z.string().refine((value) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && value.includes("T");
}, "Must be an ISO-8601 timestamp");

const r2LockAuditBase = {
  ok: z.literal(true),
  bucket: safeResourceName,
  objectKey: z.string().min(3).max(512),
  minimumRetentionDays: z.number().int().min(1).max(3650),
  immutable: z.literal(true),
  prefix: z.string(),
};

export const r2LockAuditSchema = z.discriminatedUnion("mode", [
  z
    .object({
      ...r2LockAuditBase,
      mode: z.literal("age"),
      retentionSeconds: z.number().int().positive(),
      retainUntil: z.null(),
    })
    .strict(),
  z
    .object({
      ...r2LockAuditBase,
      mode: z.literal("date"),
      retentionSeconds: z.null(),
      retainUntil: isoTimestamp,
    })
    .strict(),
  z
    .object({
      ...r2LockAuditBase,
      mode: z.literal("indefinite"),
      retentionSeconds: z.null(),
      retainUntil: z.null(),
    })
    .strict(),
]);

const backupRetentionSchema = z.discriminatedUnion("mode", [
  z
    .object({
      minimumDays: z.number().int().min(1).max(3650),
      mode: z.literal("age"),
      prefix: z.string(),
      retentionSeconds: z.number().int().positive(),
      protectedUntil: isoTimestamp,
    })
    .strict(),
  z
    .object({
      minimumDays: z.number().int().min(1).max(3650),
      mode: z.literal("date"),
      prefix: z.string(),
      retentionSeconds: z.null(),
      protectedUntil: isoTimestamp,
    })
    .strict(),
  z
    .object({
      minimumDays: z.number().int().min(1).max(3650),
      mode: z.literal("indefinite"),
      prefix: z.string(),
      retentionSeconds: z.null(),
      protectedUntil: z.null(),
    })
    .strict(),
]);

export const backupArchiveEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    siteId: safeResourceName,
    stage: safeStage,
    database: safeResourceName,
    source: z
      .object({
        path: z.string().regex(/^backups\/[^/]+\.sql$/),
        createdAt: isoTimestamp,
      })
      .strict(),
    archive: z
      .object({
        artifactLocator: z.string().regex(/^r2:\/\/[a-z][a-z0-9-]{1,62}\/.+/),
        bucket: safeResourceName,
        objectKey: z.string().min(3).max(512),
        sha256,
        sizeBytes: z.number().int().positive(),
        archivedAt: isoTimestamp,
        verifiedAt: isoTimestamp,
        immutable: z.literal(true),
      })
      .strict(),
    retention: backupRetentionSchema,
  })
  .strict();

export type BackupArchivePlan = {
  siteId: string;
  stage: string;
  database: string;
  source: string;
  sourcePath: string;
  sourceCreatedAt: string;
  sha256: string;
  sizeBytes: number;
  bucket: string;
  objectKey: string;
  artifactLocator: string;
  evidenceOutput: string;
  minimumRetentionDays: number;
};

export type BackupArchiveEvidence = z.infer<typeof backupArchiveEvidenceSchema>;

function archiveTimestamp(value: string) {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildBackupArchivePlan(input: {
  manifest: SiteManifest;
  evidence: BackupEvidence;
  source: string;
  minimumRetentionDays?: number;
}): BackupArchivePlan {
  const minimumRetentionDays = input.minimumRetentionDays ?? 90;
  if (
    !Number.isSafeInteger(minimumRetentionDays) ||
    minimumRetentionDays < 1 ||
    minimumRetentionDays > 3650
  ) {
    throw new Error(
      "Minimum retention must be an integer from 1 to 3650 days.",
    );
  }
  if (input.manifest.id !== input.evidence.siteId) {
    throw new Error("Backup evidence belongs to a different site.");
  }
  const expectedDatabase = `${input.manifest.infrastructure.d1Name}-${input.evidence.stage}`;
  if (input.evidence.database !== expectedDatabase) {
    throw new Error(
      "Backup evidence database does not match the site manifest.",
    );
  }

  const infrastructureNames = Object.values(input.manifest.infrastructure);
  if (new Set(infrastructureNames).size !== infrastructureNames.length) {
    throw new Error(
      "Backup bucket must be isolated from application resources.",
    );
  }
  const source = resolve(input.source);
  const sourcePath = relative(repoRoot, source).replaceAll("\\", "/");
  if (sourcePath !== input.evidence.artifact.path) {
    throw new Error("Backup source path does not match verified evidence.");
  }

  const bucket = input.manifest.infrastructure.backupBucketName;
  const objectKey = `d1/${input.evidence.stage}/${archiveTimestamp(input.evidence.createdAt)}-${input.evidence.artifact.sha256}.sql`;
  return {
    siteId: input.manifest.id,
    stage: input.evidence.stage,
    database: input.evidence.database,
    source,
    sourcePath,
    sourceCreatedAt: input.evidence.createdAt,
    sha256: input.evidence.artifact.sha256,
    sizeBytes: input.evidence.artifact.sizeBytes,
    bucket,
    objectKey,
    artifactLocator: `r2://${bucket}/${objectKey}`,
    evidenceOutput: `${source}.immutable.json`,
    minimumRetentionDays,
  };
}

export function parseR2LockAuditOutput(
  output: string,
  plan: BackupArchivePlan,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.trim());
  } catch {
    throw new Error("Cloudflare R2 lock audit returned invalid JSON.");
  }
  const audit = r2LockAuditSchema.parse(parsed);
  if (
    audit.bucket !== plan.bucket ||
    audit.objectKey !== plan.objectKey ||
    audit.minimumRetentionDays !== plan.minimumRetentionDays
  ) {
    throw new Error(
      "Cloudflare R2 lock audit does not match the archive plan.",
    );
  }
  return audit;
}

export async function buildBackupArchiveEvidence(input: {
  plan: BackupArchivePlan;
  lock: z.infer<typeof r2LockAuditSchema>;
  downloaded: string;
  archivedAt: Date;
  verifiedAt?: Date;
}): Promise<BackupArchiveEvidence> {
  const details = await stat(input.downloaded);
  if (details.size !== input.plan.sizeBytes) {
    throw new Error(
      "Downloaded R2 archive size does not match the source backup.",
    );
  }
  if ((await sha256File(input.downloaded)) !== input.plan.sha256) {
    throw new Error(
      "Downloaded R2 archive SHA-256 does not match the source backup.",
    );
  }
  if (Number.isNaN(input.archivedAt.getTime())) {
    throw new Error("Archive time is invalid.");
  }
  const verifiedAt = input.verifiedAt ?? new Date();
  if (Number.isNaN(verifiedAt.getTime())) {
    throw new Error("Archive verification time is invalid.");
  }

  const protectedUntil =
    input.lock.mode === "indefinite"
      ? null
      : input.lock.mode === "date"
        ? input.lock.retainUntil
        : new Date(
            input.archivedAt.getTime() +
              (input.lock.retentionSeconds ?? 0) * 1000,
          ).toISOString();

  return backupArchiveEvidenceSchema.parse({
    schemaVersion: 1,
    siteId: input.plan.siteId,
    stage: input.plan.stage,
    database: input.plan.database,
    source: {
      path: input.plan.sourcePath,
      createdAt: input.plan.sourceCreatedAt,
    },
    archive: {
      artifactLocator: input.plan.artifactLocator,
      bucket: input.plan.bucket,
      objectKey: input.plan.objectKey,
      sha256: input.plan.sha256,
      sizeBytes: input.plan.sizeBytes,
      archivedAt: input.archivedAt.toISOString(),
      verifiedAt: verifiedAt.toISOString(),
      immutable: true,
    },
    retention: {
      minimumDays: input.plan.minimumRetentionDays,
      mode: input.lock.mode,
      prefix: input.lock.prefix,
      retentionSeconds: input.lock.retentionSeconds,
      protectedUntil,
    },
  });
}

export function releaseBackupEvidence(evidence: BackupArchiveEvidence) {
  return {
    createdAt: evidence.source.createdAt,
    artifactLocator: evidence.archive.artifactLocator,
    sha256: evidence.archive.sha256,
    sizeBytes: evidence.archive.sizeBytes,
    immutable: true as const,
  };
}

export function normalizeArchiveEvidencePath(
  value: string,
  expectedRelativePath: string,
) {
  const actual = resolve(repoRoot, z.string().min(1).parse(value));
  const expected = resolve(repoRoot, expectedRelativePath);
  if (actual !== expected) {
    throw new Error("Archive evidence path does not match the scheduled plan.");
  }
  return relative(repoRoot, actual).replaceAll("\\", "/");
}
