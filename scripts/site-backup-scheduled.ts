import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { z } from "zod";

import {
  backupArchiveEvidenceSchema,
  normalizeArchiveEvidencePath,
  releaseBackupEvidence,
} from "./cms-backup-archive-lib";
import { backupEvidenceSchema, buildSiteBackupPlan } from "./cms-backup-lib";
import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

const site = argument("site") ?? "";
const stage = argument("stage")?.trim().toLowerCase() ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
const authSource = z
  .enum(["environment", "alchemy"])
  .parse(argument("auth-source") ?? "alchemy");
const profile = argument("profile");
if (profile) process.env.ALCHEMY_PROFILE = profile;
const retentionDays = Number.parseInt(argument("retention-days") ?? "365", 10);
const minimumDays = Number.parseInt(argument("minimum-days") ?? "90", 10);

if (!site) throw new Error("Missing --site=<client-slug>.");
if (!/^[a-z][a-z0-9-]{0,31}$/.test(stage)) {
  throw new Error("Stage must be a safe deployment slug.");
}
if (dryRun === apply) {
  throw new Error("Choose exactly one of --dry-run or --apply.");
}
if (
  !Number.isSafeInteger(retentionDays) ||
  retentionDays < 90 ||
  retentionDays > 3650
) {
  throw new Error("--retention-days must be an integer from 90 to 3650.");
}
if (
  !Number.isSafeInteger(minimumDays) ||
  minimumDays < 1 ||
  minimumDays > retentionDays
) {
  throw new Error(
    "--minimum-days must be a positive integer no greater than --retention-days.",
  );
}

const { manifest } = await readSiteManifest(site);
const plan = buildSiteBackupPlan({
  manifest,
  stage,
  output: argument("output"),
});
const output = relative(repoRoot, plan.output).replaceAll("\\", "/");
const bucket = manifest.infrastructure.backupBucketName;
const safePlan = {
  site: manifest.id,
  stage: plan.stage,
  database: plan.database,
  bucket,
  output,
  authSource,
  retentionDays,
  minimumDays,
  steps: [
    "verify-private-locked-bucket",
    "export-remote-d1",
    "isolated-local-restore",
    "upload-immutable-r2-object",
    "download-and-hash-verify",
  ],
};

if (dryRun) {
  console.log(
    JSON.stringify({ ok: true, mode: "dry-run", ...safePlan }, null, 2),
  );
  process.exit(0);
}
if (argument("confirm-site") !== manifest.id) {
  throw new Error(
    "--confirm-site must exactly match the manifest site before --apply.",
  );
}
if (argument("confirm-bucket") !== bucket) {
  throw new Error(
    "--confirm-bucket must exactly match the manifest backup bucket before --apply.",
  );
}

if (authSource === "environment") {
  const { resolveCloudflareAuth } =
    await import("../packages/infra/src/cloudflare-auth");
  await resolveCloudflareAuth({ source: "environment" });
}

async function runJson(command: string[], operation: string) {
  const child = Bun.spawn(command, {
    cwd: repoRoot,
    env: Bun.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `${operation} failed with exit code ${exitCode}; child output was suppressed to protect provider credentials and signed URLs.`,
    );
  }
  try {
    return JSON.parse(stdout.trim()) as unknown;
  } catch {
    throw new Error(`${operation} returned invalid JSON.`);
  }
}

const sharedAuthArguments = [
  `--auth-source=${authSource}`,
  ...(profile ? [`--profile=${profile}`] : []),
];
const prepared = z
  .object({
    ok: z.literal(true),
    site: z.literal(manifest.id),
    bucket: z.literal(bucket),
    retentionDays: z.literal(retentionDays),
    private: z.literal(true),
    immutable: z.literal(true),
  })
  .passthrough()
  .parse(
    await runJson(
      [
        "bun",
        "scripts/site-backup-archive-prepare.ts",
        `--site=${manifest.id}`,
        `--retention-days=${retentionDays}`,
        `--confirm-bucket=${bucket}`,
        ...sharedAuthArguments,
        "--apply",
      ],
      "Backup archive preparation",
    ),
  );

const exported = z
  .object({
    ok: z.literal(true),
    site: z.literal(manifest.id),
    stage: z.literal(plan.stage),
    database: z.literal(plan.database),
    output: z.literal(output),
    evidence: backupEvidenceSchema,
  })
  .passthrough()
  .parse(
    await runJson(
      [
        "bun",
        "scripts/site-backup.ts",
        `--site=${manifest.id}`,
        `--stage=${plan.stage}`,
        `--output=${output}`,
        "--remote",
      ],
      "Remote D1 export",
    ),
  );
if (exported.evidence.artifact.path !== output) {
  throw new Error(
    "Remote D1 export evidence does not match the scheduled plan.",
  );
}

const archiveOutput = z
  .object({
    ok: z.literal(true),
    site: z.literal(manifest.id),
    stage: z.literal(plan.stage),
    database: z.literal(plan.database),
    bucket: z.literal(bucket),
    immutable: z.literal(true),
    evidence: z.string().min(1),
  })
  .passthrough()
  .parse(
    await runJson(
      [
        "bun",
        "scripts/site-backup-archive.ts",
        `--site=${manifest.id}`,
        `--stage=${plan.stage}`,
        `--file=${output}`,
        `--minimum-days=${minimumDays}`,
        `--confirm-bucket=${bucket}`,
        ...sharedAuthArguments,
        "--apply",
      ],
      "Immutable R2 archive",
    ),
  );
normalizeArchiveEvidencePath(
  archiveOutput.evidence,
  `${output}.immutable.json`,
);

const immutableEvidence = backupArchiveEvidenceSchema.parse(
  JSON.parse(await readFile(`${plan.output}.immutable.json`, "utf8")),
);
const releaseEvidence = releaseBackupEvidence(immutableEvidence);
if (
  immutableEvidence.siteId !== manifest.id ||
  immutableEvidence.stage !== plan.stage ||
  immutableEvidence.database !== plan.database ||
  immutableEvidence.archive.bucket !== bucket ||
  immutableEvidence.archive.sha256 !== exported.evidence.artifact.sha256 ||
  immutableEvidence.archive.sizeBytes !== exported.evidence.artifact.sizeBytes
) {
  throw new Error(
    "Immutable archive evidence does not match the scheduled run.",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "apply",
      ...safePlan,
      bucketChanged: prepared.changed === true,
      immutable: archiveOutput.immutable,
      localEvidence: `${output}.immutable.json`,
      releaseEvidence,
    },
    null,
    2,
  ),
);
