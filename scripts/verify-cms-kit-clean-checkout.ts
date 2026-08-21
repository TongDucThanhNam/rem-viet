import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  assertCleanSnapshotStatus,
  parseCleanSnapshotFileList,
  requireSingleRunDirectory,
} from "./cms-kit-clean-checkout-lib";

const repositoryRoot = resolve(import.meta.dir, "..");
const runRoot = join(
  repositoryRoot,
  ".tmp",
  `cms-kit-clean-checkout-${Date.now()}`,
);
const snapshotRoot = join(runRoot, "source");
mkdirSync(snapshotRoot, { recursive: true });

function run(
  command: string[],
  cwd: string,
  options: { capture?: boolean; quiet?: boolean } = {},
) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, CI: "1" },
    stdout: options.capture ? "pipe" : options.quiet ? "ignore" : "inherit",
    stderr: "inherit",
  });
  if (!result.success) {
    throw new Error(
      `Clean checkout command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
  return result.stdout?.toString().trim() ?? "";
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function snapshotStatus(phase: string) {
  assertCleanSnapshotStatus(
    run(
      ["git", "status", "--porcelain=v1", "--untracked-files=all"],
      snapshotRoot,
      { capture: true },
    ),
    phase,
  );
}

const files = parseCleanSnapshotFileList(
  run(
    [
      "git",
      "-c",
      "core.quotepath=false",
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ],
    repositoryRoot,
    { capture: true },
  ),
);
for (const required of [
  "package.json",
  "bun.lock",
  "scripts/verify-cms-kit-consumer.ts",
  "scripts/verify-cms-kit-upgrade.ts",
  "fixtures/cms-kit-clean-checkout/create-backup-fixture.ts",
]) {
  if (!files.includes(required)) {
    throw new Error(`Clean snapshot is missing required source: ${required}`);
  }
}
const sourceDigest = createHash("sha256");
for (const path of files) {
  const source = resolve(repositoryRoot, path);
  const sourceRelative = relative(repositoryRoot, source);
  if (
    sourceRelative.startsWith("..") ||
    isAbsolute(sourceRelative) ||
    !existsSync(source)
  ) {
    throw new Error(`Clean snapshot source is unavailable: ${path}`);
  }
  const details = lstatSync(source);
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new Error(`Clean snapshot source must be a regular file: ${path}`);
  }
  const target = resolve(snapshotRoot, path);
  const targetRelative = relative(snapshotRoot, target);
  if (targetRelative.startsWith("..") || isAbsolute(targetRelative)) {
    throw new Error(`Clean snapshot target escaped its root: ${path}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  chmodSync(target, details.mode);
  sourceDigest.update(path).update("\0").update(readFileSync(source));
}

run(["git", "init", "--initial-branch=main", "--quiet"], snapshotRoot);
run(["git", "config", "user.name", "Agency CMS verifier"], snapshotRoot);
run(
  ["git", "config", "user.email", "cms-verifier@example.invalid"],
  snapshotRoot,
);
run(["git", "config", "core.autocrlf", "false"], snapshotRoot);
run(["git", "config", "commit.gpgsign", "false"], snapshotRoot);
run(["git", "add", "--all"], snapshotRoot);
run(
  ["git", "commit", "--quiet", "-m", "Assembled CMS clean source snapshot"],
  snapshotRoot,
);
const commit = run(["git", "rev-parse", "HEAD"], snapshotRoot, {
  capture: true,
});
const tree = run(["git", "rev-parse", "HEAD^{tree}"], snapshotRoot, {
  capture: true,
});
snapshotStatus("source assembly");

run(["bun", "install", "--frozen-lockfile"], snapshotRoot);
snapshotStatus("frozen install");

run(["bun", "scripts/verify-cms-kit-consumer.ts"], snapshotRoot);
snapshotStatus("packed consumer and portability rehearsal");

const consumerRun = requireSingleRunDirectory(
  readdirSync(join(snapshotRoot, ".tmp")),
  "cms-kit-consumer-",
);
const consumerRoot = join(snapshotRoot, ".tmp", consumerRun, "consumer");
const consumerMigration = readJson(
  join(consumerRoot, "cli-proof", "migration.receipt.json"),
);
const consumerRollback = readJson(
  join(consumerRoot, "cli-proof", "rollback.receipt.json"),
);
const migrationBackup = consumerMigration.backup as
  Record<string, unknown> | undefined;
const rollbackBackup = consumerRollback.backup as
  Record<string, unknown> | undefined;
if (
  consumerMigration.status !== "applied" ||
  consumerRollback.status !== "restored" ||
  typeof migrationBackup?.sha256 !== "string" ||
  migrationBackup.sha256 !== rollbackBackup?.sha256
) {
  throw new Error(
    "Packed consumer did not prove receipt-bound migration rollback.",
  );
}

const fixtureOutput = JSON.parse(
  run(
    [
      "bun",
      "fixtures/cms-kit-clean-checkout/create-backup-fixture.ts",
      "--output=.tmp/clean-checkout-source.sqlite",
    ],
    snapshotRoot,
    { capture: true },
  ),
) as { output?: unknown };
if (fixtureOutput.output !== ".tmp/clean-checkout-source.sqlite") {
  throw new Error("Clean backup fixture did not emit its bounded source path.");
}
const backupOutput = JSON.parse(
  run(
    [
      "bun",
      "scripts/cms-backup-local.ts",
      "--source=.tmp/clean-checkout-source.sqlite",
      "--store=wrangler",
    ],
    snapshotRoot,
    { capture: true },
  ),
) as { destination?: unknown };
if (typeof backupOutput.destination !== "string") {
  throw new Error("Clean checkout backup did not emit a destination.");
}
const backupRelative = relative(
  snapshotRoot,
  backupOutput.destination,
).replaceAll("\\", "/");
if (backupRelative.startsWith("..") || !backupRelative.startsWith("backups/")) {
  throw new Error(
    "Clean checkout backup escaped the ignored backup directory.",
  );
}
const restore = JSON.parse(
  run(
    ["bun", "scripts/cms-restore-drill.ts", `--file=${backupRelative}`],
    snapshotRoot,
    { capture: true },
  ),
) as {
  integrityCheck?: unknown;
  isolatedRestore?: unknown;
  counts?: Record<string, unknown>;
};
if (
  restore.integrityCheck !== "ok" ||
  restore.isolatedRestore !== true ||
  !restore.counts ||
  Object.values(restore.counts).some((count) => count !== 1)
) {
  throw new Error("Clean checkout backup failed its isolated restore drill.");
}
snapshotStatus("backup and isolated restore drill");

run(["bun", "scripts/verify-cms-kit-upgrade.ts"], snapshotRoot);
snapshotStatus("24-package upgrade and rollback rehearsal");
const upgradeRun = requireSingleRunDirectory(
  readdirSync(join(snapshotRoot, ".tmp")),
  "cms-kit-upgrade-",
);
const upgrade = readJson(
  join(snapshotRoot, ".tmp", upgradeRun, "upgrade-rehearsal.receipt.json"),
);
const upgraded = upgrade.upgraded as Record<string, unknown> | undefined;
const rolledBack = upgrade.rolledBack as Record<string, unknown> | undefined;
const migrationReceipt = upgrade.migrationReceipt as
  Record<string, unknown> | undefined;
const receiptBackup = migrationReceipt?.backup as
  Record<string, unknown> | undefined;
const rollback = upgrade.rollback as Record<string, unknown> | undefined;
const artifacts = upgrade.artifacts as Record<string, unknown> | undefined;
if (
  upgrade.ok !== true ||
  upgraded?.schemaVersion !== 2 ||
  rolledBack?.schemaVersion !== 1 ||
  migrationReceipt?.status !== "applied" ||
  typeof receiptBackup?.sha256 !== "string" ||
  receiptBackup.sha256 !== rollback?.backupSha256 ||
  !artifacts ||
  Object.keys((artifacts.baseline as Record<string, unknown>) ?? {}).length !==
    24 ||
  Object.keys((artifacts.next as Record<string, unknown>) ?? {}).length !== 24
) {
  throw new Error("Clean checkout upgrade receipt is incomplete.");
}

snapshotStatus("final evidence collection");
const receipt = {
  schemaVersion: 1,
  ok: true,
  source: {
    kind: "assembled-current-source-snapshot",
    fileCount: files.length,
    sha256: sourceDigest.digest("hex"),
    commit,
    tree,
    cleanBefore: true,
    cleanAfter: true,
  },
  operations: {
    frozenInstall: true,
    packedConsumers: true,
    portabilityExportImport: true,
    cliMigrationRollback: {
      applied: true,
      restored: true,
      backupSha256: migrationBackup.sha256,
    },
    backupRestore: {
      artifact: backupRelative,
      sha256: createHash("sha256")
        .update(readFileSync(resolve(snapshotRoot, backupRelative)))
        .digest("hex"),
      restore,
    },
    packageUpgradeRollback: {
      packages: 24,
      baselineSchemaVersion: 1,
      upgradedSchemaVersion: 2,
      restoredSchemaVersion: 1,
      backupSha256: receiptBackup.sha256,
    },
  },
};
const receiptPath = join(runRoot, "clean-checkout.receipt.json");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
