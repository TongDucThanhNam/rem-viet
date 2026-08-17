import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import {
  buildBackupEvidence,
  buildSiteBackupPlan,
  verifyBackupArtifact,
} from "./cms-backup-lib";
import {
  buildBackupArchiveEvidence,
  buildBackupArchivePlan,
  parseR2LockAuditOutput,
  normalizeArchiveEvidencePath,
  releaseBackupEvidence,
} from "./cms-backup-archive-lib";
import { manifestFor, repoRoot } from "./site-lib";

const testDirectory = await mkdtemp(join(tmpdir(), "rem-viet-archive-"));

afterAll(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

function fixtureEvidence(content: string) {
  return {
    schemaVersion: 1 as const,
    siteId: "acme-demo",
    stage: "staging",
    database: "acme-demo-db-staging",
    createdAt: "2026-08-14T12:34:56.000Z",
    artifact: {
      path: "backups/acme-demo-test.sql",
      sha256: createHash("sha256").update(content).digest("hex"),
      sizeBytes: Buffer.byteLength(content),
      immutable: false,
    },
    restoreDrill: {
      integrityCheck: "ok" as const,
      tables: 7,
      counts: {
        pages: 1,
        page_revisions: 0,
        posts: 0,
        media: 0,
        form_submissions: 0,
        web_vitals: 0,
      },
      isolatedRestore: true as const,
    },
  };
}

describe("immutable R2 backup archive", () => {
  test("builds a per-client content-addressed archive plan", () => {
    const content = "SELECT 1;\n";
    const evidence = fixtureEvidence(content);
    const plan = buildBackupArchivePlan({
      manifest: manifestFor("acme-demo", "showcase"),
      evidence,
      source: resolve(repoRoot, evidence.artifact.path),
    });

    expect(plan.bucket).toBe("acme-demo-backups");
    expect(plan.objectKey).toBe(
      `d1/staging/20260814T123456Z-${evidence.artifact.sha256}.sql`,
    );
    expect(plan.artifactLocator).toBe(
      `r2://acme-demo-backups/${plan.objectKey}`,
    );
    expect(plan.minimumRetentionDays).toBe(90);

    const shared = manifestFor("acme-demo", "showcase");
    shared.infrastructure.backupBucketName = shared.infrastructure.r2BucketName;
    expect(() =>
      buildBackupArchivePlan({
        manifest: shared,
        evidence,
        source: resolve(repoRoot, evidence.artifact.path),
      }),
    ).toThrow(/isolated/);
  });

  test("accepts matching lock proof and verifies the downloaded bytes", async () => {
    const content = "SELECT 1;\n";
    const evidence = fixtureEvidence(content);
    const plan = buildBackupArchivePlan({
      manifest: manifestFor("acme-demo", "showcase"),
      evidence,
      source: resolve(repoRoot, evidence.artifact.path),
    });
    const lock = parseR2LockAuditOutput(
      JSON.stringify({
        ok: true,
        bucket: plan.bucket,
        objectKey: plan.objectKey,
        minimumRetentionDays: 90,
        immutable: true,
        mode: "age",
        prefix: "d1/",
        retentionSeconds: 90 * 86_400,
        retainUntil: null,
      }),
      plan,
    );
    const downloaded = join(testDirectory, "downloaded.sql");
    await Bun.write(downloaded, content);
    const archive = await buildBackupArchiveEvidence({
      plan,
      lock,
      downloaded,
      archivedAt: new Date("2026-08-14T13:00:00.000Z"),
      verifiedAt: new Date("2026-08-14T13:00:01.000Z"),
    });

    expect(archive.archive.immutable).toBe(true);
    expect(archive.retention.protectedUntil).toBe("2026-11-12T13:00:00.000Z");
    expect(releaseBackupEvidence(archive)).toEqual({
      createdAt: evidence.createdAt,
      artifactLocator: plan.artifactLocator,
      sha256: evidence.artifact.sha256,
      sizeBytes: evidence.artifact.sizeBytes,
      immutable: true,
    });
    const relativeEvidence = `${evidence.artifact.path}.immutable.json`;
    expect(
      normalizeArchiveEvidencePath(relativeEvidence, relativeEvidence),
    ).toBe(relativeEvidence);
    expect(
      normalizeArchiveEvidencePath(
        resolve(repoRoot, relativeEvidence),
        relativeEvidence,
      ),
    ).toBe(relativeEvidence);
    expect(() =>
      normalizeArchiveEvidencePath(
        "backups/different.sql.immutable.json",
        relativeEvidence,
      ),
    ).toThrow(/does not match/);

    expect(() =>
      parseR2LockAuditOutput(
        JSON.stringify({
          ok: true,
          bucket: plan.bucket,
          objectKey: plan.objectKey,
          minimumRetentionDays: 90,
          immutable: true,
          mode: "age",
          prefix: "d1/",
          retentionSeconds: null,
          retainUntil: null,
        }),
        plan,
      ),
    ).toThrow();

    await Bun.write(downloaded, "corrupt");
    await expect(
      buildBackupArchiveEvidence({
        plan,
        lock,
        downloaded,
        archivedAt: new Date("2026-08-14T13:00:00.000Z"),
      }),
    ).rejects.toThrow(/size|SHA-256/);
  });

  test("CLI dry-run validates a restorable artifact and apply is confirmation-gated", async () => {
    const ignoredFixture = join(
      repoRoot,
      "backups",
      `archive-cli-${basename(testDirectory)}.sql`,
    );
    const sql = `${[
      "pages",
      "page_revisions",
      "posts",
      "media",
      "audit_events",
      "form_submissions",
      "web_vitals",
    ]
      .map((table) => `CREATE TABLE ${table} (id TEXT PRIMARY KEY);`)
      .join("\n")}\nINSERT INTO pages (id) VALUES ('home');\n`;
    await Bun.write(ignoredFixture, sql);
    const backupPlan = buildSiteBackupPlan({
      manifest: manifestFor("acme-demo", "showcase"),
      stage: "staging",
      output: relative(repoRoot, ignoredFixture),
    });
    const evidence = await buildBackupEvidence(
      backupPlan,
      await verifyBackupArtifact(ignoredFixture),
    );
    await Bun.write(
      `${ignoredFixture}.evidence.json`,
      JSON.stringify(evidence),
    );
    const commonArguments = [
      process.execPath,
      "scripts/site-backup-archive.ts",
      "--site=acme-demo",
      "--stage=staging",
      `--file=${relative(repoRoot, ignoredFixture)}`,
    ];

    try {
      const dryRun = Bun.spawnSync([...commonArguments, "--dry-run"], {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.stdout.toString()).toContain(
        '"bucket": "acme-demo-backups"',
      );

      const unconfirmed = Bun.spawnSync([...commonArguments, "--apply"], {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(unconfirmed.exitCode).not.toBe(0);
      expect(unconfirmed.stderr.toString()).toContain(
        "--confirm-bucket must exactly match",
      );
    } finally {
      await rm(ignoredFixture, { force: true });
      await rm(`${ignoredFixture}.evidence.json`, { force: true });
      await rm(`${ignoredFixture}.immutable.json`, { force: true });
    }
  });

  test("bucket preparation is dry-run safe and exact-confirmation gated", () => {
    const commonArguments = [
      process.execPath,
      "scripts/site-backup-archive-prepare.ts",
      "--site=acme-demo",
    ];
    const dryRun = Bun.spawnSync([...commonArguments, "--dry-run"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(dryRun.exitCode).toBe(0);
    expect(dryRun.stdout.toString()).toContain('"bucket": "acme-demo-backups"');
    expect(dryRun.stdout.toString()).toContain('"retentionDays": 365');

    const unconfirmed = Bun.spawnSync([...commonArguments, "--apply"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(unconfirmed.exitCode).not.toBe(0);
    expect(unconfirmed.stderr.toString()).toContain(
      "--confirm-bucket must exactly match",
    );
  });

  test("scheduled archive orchestration is network-free, confirmation-gated and evidence-only", async () => {
    const commonArguments = [
      process.execPath,
      "scripts/site-backup-scheduled.ts",
      "--site=acme-demo",
      "--stage=staging",
      "--output=backups/acme-demo-scheduled-test.sql",
      "--auth-source=environment",
    ];
    const dryRun = Bun.spawnSync([...commonArguments, "--dry-run"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...Bun.env,
        CLOUDFLARE_ACCOUNT_ID: "",
        CLOUDFLARE_API_TOKEN: "",
      },
    });
    expect(dryRun.exitCode).toBe(0);
    expect(JSON.parse(dryRun.stdout.toString())).toMatchObject({
      ok: true,
      mode: "dry-run",
      site: "acme-demo",
      stage: "staging",
      database: "acme-demo-db-staging",
      bucket: "acme-demo-backups",
      authSource: "environment",
      retentionDays: 365,
      minimumDays: 90,
    });

    const unconfirmed = Bun.spawnSync([...commonArguments, "--apply"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...Bun.env,
        CLOUDFLARE_ACCOUNT_ID: "",
        CLOUDFLARE_API_TOKEN: "",
      },
    });
    expect(unconfirmed.exitCode).not.toBe(0);
    expect(unconfirmed.stderr.toString()).toContain(
      "--confirm-site must exactly match",
    );

    const workflow = await Bun.file(
      join(repoRoot, ".github", "workflows", "scheduled-cms-backup.yml"),
    ).text();
    expect(workflow).toContain('cron: "17 2 * * 0"');
    expect(workflow).toContain("secrets.CMS_BACKUP_CLOUDFLARE_API_TOKEN");
    expect(workflow).toContain("bun run site:backup:scheduled");
    expect(workflow).toContain("${{ env.CMS_BACKUP_OUTPUT }}.immutable.json");
    expect(workflow).not.toMatch(/^\s*\$\{\{ env\.CMS_BACKUP_OUTPUT \}\}\s*$/m);
  });
});
