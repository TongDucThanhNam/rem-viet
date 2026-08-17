import { mkdtemp, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertEmptyRemoteRestoreTarget,
  buildRemoteRestorePlan,
  normalizeD1ExportForRemoteImport,
  readVerifiedBackupEvidence,
  sanitizeBackupProviderOutput,
  verifyBackupArtifact,
  verifyRemoteRestoreOutput,
} from "./cms-backup-lib";
import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

const EMPTY_TARGET_QUERY =
  "SELECT count(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%';";
const RESTORE_COUNTS_QUERY = [
  "SELECT '__tables__' AS name, count(*) AS row_count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%'",
  "SELECT 'pages' AS name, count(*) AS row_count FROM pages",
  "SELECT 'page_revisions' AS name, count(*) AS row_count FROM page_revisions",
  "SELECT 'posts' AS name, count(*) AS row_count FROM posts",
  "SELECT 'media' AS name, count(*) AS row_count FROM media",
  "SELECT 'form_submissions' AS name, count(*) AS row_count FROM form_submissions",
  "SELECT 'web_vitals' AS name, count(*) AS row_count FROM web_vitals",
]
  .join("; ")
  .concat(";");

const site = argument("site") ?? "";
const stage = (argument("stage") ?? "staging").trim().toLowerCase();
const file = argument("file") ?? "";
const targetDatabase = argument("target") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
const verifyOnly = flag("verify-only");
const cleanup = flag("cleanup");
if (!site) throw new Error("Missing --site=<client-slug>.");
if (!file) throw new Error("Missing --file=backups/<artifact>.sql.");
if (!targetDatabase) throw new Error("Missing --target=<isolated-d1-name>.");
if ([dryRun, apply, verifyOnly, cleanup].filter(Boolean).length !== 1) {
  throw new Error(
    "Pass exactly one of --dry-run, --apply, --verify-only or --cleanup.",
  );
}

const [{ manifest }, verified] = await Promise.all([
  readSiteManifest(site),
  readVerifiedBackupEvidence(file),
]);
if (verified.evidence.siteId !== manifest.id) {
  throw new Error("Backup evidence belongs to a different site.");
}
if (verified.evidence.stage !== stage) {
  throw new Error("Backup evidence stage does not match --stage.");
}
if (
  verified.evidence.database !== `${manifest.infrastructure.d1Name}-${stage}`
) {
  throw new Error("Backup evidence database does not match the site manifest.");
}

const localRestore = await verifyBackupArtifact(verified.source);
if (
  localRestore.tables !== verified.evidence.restoreDrill.tables ||
  JSON.stringify(localRestore.counts) !==
    JSON.stringify(verified.evidence.restoreDrill.counts)
) {
  throw new Error("Fresh local restore results do not match backup metadata.");
}
const remoteImportSql = normalizeD1ExportForRemoteImport(
  await Bun.file(verified.source).text(),
);

const plan = buildRemoteRestorePlan({
  evidence: verified.evidence,
  targetDatabase,
});
const safePlan = {
  mode: dryRun
    ? "dry-run"
    : cleanup
      ? "remote-restore-cleanup"
      : verifyOnly
        ? "remote-restore-verification"
        : "remote-restore",
  site: plan.siteId,
  sourceStage: plan.sourceStage,
  sourceDatabase: plan.sourceDatabase,
  sourceArtifact: plan.sourceArtifact,
  sourceSha256: plan.sourceSha256,
  targetDatabase: plan.targetDatabase,
  targetMustAlreadyExist: true,
  targetMustBeEmpty: apply,
  targetWillBePreservedAfterDrill: !cleanup,
  remoteImportNormalized: true,
  expectedTables: plan.expectedTables,
  expectedCounts: plan.expectedCounts,
};
if (dryRun) {
  console.log(JSON.stringify(safePlan, null, 2));
  process.exit(0);
}
if (argument("confirm-target") !== targetDatabase) {
  throw new Error(
    "--confirm-target must exactly match --target before remote apply/verification.",
  );
}

async function wrangler(args: string[]) {
  const child = Bun.spawn(["bun", "x", "wrangler", "d1", ...args], {
    cwd: repoRoot,
    env: Bun.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    const detail = sanitizeBackupProviderOutput(`${stdout}\n${stderr}`).trim();
    throw new Error(
      `Wrangler D1 command failed with exit code ${exitCode}.${detail ? `\n${detail}` : ""}`,
    );
  }
  return stdout;
}

const restoreStartedAt = argument("restore-started-at");
const startedAt = verifyOnly ? new Date(restoreStartedAt ?? "") : new Date();
if (
  verifyOnly &&
  (Number.isNaN(startedAt.getTime()) || startedAt > new Date())
) {
  throw new Error(
    "--verify-only requires a valid past --restore-started-at=<ISO-8601>.",
  );
}

if (apply) {
  const emptyTargetOutput = await wrangler([
    "execute",
    targetDatabase,
    "--remote",
    "--command",
    EMPTY_TARGET_QUERY,
    "--json",
  ]);
  assertEmptyRemoteRestoreTarget(emptyTargetOutput);

  const importDirectory = await mkdtemp(
    join(tmpdir(), "rem-viet-d1-remote-restore-"),
  );
  const remoteImportPath = join(importDirectory, "restore.sql");
  try {
    await Bun.write(remoteImportPath, remoteImportSql);
    await wrangler([
      "execute",
      targetDatabase,
      "--remote",
      "--file",
      remoteImportPath,
      "--yes",
      "--json",
    ]);
  } catch (error) {
    const detail = sanitizeBackupProviderOutput(
      error instanceof Error ? error.message : String(error),
    ).trim();
    throw new Error(
      `Remote import failed. The isolated target may be partially populated; preserve it for diagnosis and do not reuse it without deleting/recreating it explicitly.${detail ? `\nProvider detail: ${detail}` : ""}`,
    );
  } finally {
    await rm(remoteImportPath, { force: true }).catch(() => undefined);
    await rmdir(importDirectory).catch(() => undefined);
  }
}

const [countsOutput, quickCheckOutput] = await Promise.all([
  wrangler([
    "execute",
    targetDatabase,
    "--remote",
    "--command",
    RESTORE_COUNTS_QUERY,
    "--json",
  ]),
  wrangler([
    "execute",
    targetDatabase,
    "--remote",
    "--command",
    "PRAGMA quick_check;",
    "--json",
  ]),
]);
const verification = verifyRemoteRestoreOutput({
  plan,
  countsOutput,
  quickCheckOutput,
});
const completedAt = new Date();

if (cleanup) {
  await wrangler(["delete", targetDatabase, "--skip-confirmation"]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...safePlan,
        evidence: {
          isolatedTarget: targetDatabase,
          sourceSha256: plan.sourceSha256,
          verifiedBeforeDelete: verification,
          targetDeleted: true,
          deletedAt: new Date().toISOString(),
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      ...safePlan,
      evidence: {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        recoveryMinutes:
          Math.round(
            ((completedAt.getTime() - startedAt.getTime()) / 60_000) * 100,
          ) / 100,
        resumedVerification: verifyOnly,
        isolatedTarget: targetDatabase,
        sourceSha256: plan.sourceSha256,
        ...verification,
      },
    },
    null,
    2,
  ),
);
