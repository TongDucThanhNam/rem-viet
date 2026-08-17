import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { z } from "zod";

import { assertR2BucketPrivate } from "../packages/infra/src/cloudflare-r2-lock";

import {
  readVerifiedBackupEvidence,
  verifyBackupArtifact,
} from "./cms-backup-lib";
import {
  buildBackupArchiveEvidence,
  buildBackupArchivePlan,
  parseR2LockAuditOutput,
  releaseBackupEvidence,
} from "./cms-backup-archive-lib";
import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

const site = argument("site") ?? "";
const stage = argument("stage")?.trim().toLowerCase() ?? "";
const file = argument("file") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
const profile = argument("profile");
if (profile) process.env.ALCHEMY_PROFILE = profile;
const authSource = z
  .enum(["environment", "alchemy"])
  .parse(argument("auth-source") ?? "alchemy");
const minimumRetentionDays = Number.parseInt(
  argument("minimum-days") ?? "90",
  10,
);

if (!site) throw new Error("Missing --site=<client-slug>.");
if (!/^[a-z][a-z0-9-]{0,31}$/.test(stage)) {
  throw new Error("Stage must be a safe deployment slug.");
}
if (!file) throw new Error("Missing --file=backups/<artifact>.sql.");
if (dryRun === apply) {
  throw new Error("Choose exactly one of --dry-run or --apply.");
}

const [{ manifest }, verified] = await Promise.all([
  readSiteManifest(site),
  readVerifiedBackupEvidence(file),
]);
if (verified.evidence.stage !== stage) {
  throw new Error("Backup evidence stage does not match --stage.");
}
const localRestore = await verifyBackupArtifact(verified.source);
if (
  localRestore.tables !== verified.evidence.restoreDrill.tables ||
  JSON.stringify(localRestore.counts) !==
    JSON.stringify(verified.evidence.restoreDrill.counts)
) {
  throw new Error("Fresh local restore results do not match backup metadata.");
}

const plan = buildBackupArchivePlan({
  manifest,
  evidence: verified.evidence,
  source: verified.source,
  minimumRetentionDays,
});
const safePlan = {
  site: plan.siteId,
  stage: plan.stage,
  database: plan.database,
  bucket: plan.bucket,
  objectKey: plan.objectKey,
  artifactLocator: plan.artifactLocator,
  sha256: plan.sha256,
  sizeBytes: plan.sizeBytes,
  minimumRetentionDays: plan.minimumRetentionDays,
  authSource,
  freshLocalRestore: "ok",
};

if (dryRun) {
  console.log(
    JSON.stringify({ ok: true, mode: "dry-run", ...safePlan }, null, 2),
  );
  process.exit(0);
}
if (argument("confirm-bucket") !== plan.bucket) {
  throw new Error(
    "--confirm-bucket must exactly match the manifest backup bucket before --apply.",
  );
}
if (existsSync(plan.evidenceOutput)) {
  throw new Error(
    "Immutable archive evidence already exists for this backup; refusing to overwrite it.",
  );
}

async function run(command: string[], operation: string) {
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
    throw new Error(`${operation} failed; provider output was suppressed.`);
  }
  return stdout;
}

type CloudflareEnvelope = {
  success?: unknown;
  result?: unknown;
  errors?: Array<{ code?: unknown }>;
};

async function readCloudflareResult(
  url: URL,
  headers: Record<string, string>,
  operation: string,
) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  let body: CloudflareEnvelope;
  try {
    body = (await response.json()) as CloudflareEnvelope;
  } catch {
    throw new Error(`${operation} returned invalid JSON.`);
  }
  if (!response.ok || body.success !== true) {
    const codes = (body.errors ?? [])
      .map((error) => error.code)
      .filter((code): code is string | number =>
        ["string", "number"].includes(typeof code),
      );
    const suffix = codes.length > 0 ? ` (codes: ${codes.join(", ")})` : "";
    throw new Error(`${operation} failed (HTTP ${response.status})${suffix}.`);
  }
  return body.result;
}

const lockArguments = [
  "bun",
  "packages/infra/scripts/cloudflare-r2-lock-audit.ts",
  `--bucket=${plan.bucket}`,
  `--object-key=${plan.objectKey}`,
  `--minimum-days=${plan.minimumRetentionDays}`,
  `--auth-source=${authSource}`,
  ...(profile ? [`--profile=${profile}`] : []),
];
const lock = parseR2LockAuditOutput(
  await run(lockArguments, "Cloudflare R2 lock audit"),
  plan,
);

const temporaryRoot = resolve(repoRoot, ".tmp");
await mkdir(temporaryRoot, { recursive: true });
const verifyDirectory = await mkdtemp(
  resolve(temporaryRoot, "cms-r2-archive-verify-"),
);
const downloaded = resolve(verifyDirectory, "downloaded.sql");
try {
  if (plan.sizeBytes > 300 * 1024 * 1024) {
    throw new Error(
      "Cloudflare's authenticated R2 object API accepts archives up to 300 MiB.",
    );
  }
  const { resolveCloudflareAuth } =
    await import("../packages/infra/src/cloudflare-auth");
  const { accountId, auth } = await resolveCloudflareAuth({
    accountId: argument("account-id"),
    source: authSource,
  });
  const bucketUrl = new URL(
    `/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(plan.bucket)}`,
    "https://api.cloudflare.com",
  );
  const access = assertR2BucketPrivate({
    managedResult: await readCloudflareResult(
      new URL(`${bucketUrl.pathname}/domains/managed`, bucketUrl.origin),
      auth.headers,
      "Cloudflare backup managed-domain audit",
    ),
    customResult: await readCloudflareResult(
      new URL(`${bucketUrl.pathname}/domains/custom`, bucketUrl.origin),
      auth.headers,
      "Cloudflare backup custom-domain audit",
    ),
  });
  const encodedKey = plan.objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const objectUrl = new URL(
    `${bucketUrl.pathname}/objects/${encodedKey}`,
    bucketUrl.origin,
  );
  const fetchObject = () =>
    fetch(objectUrl, {
      headers: auth.headers,
      signal: AbortSignal.timeout(30_000),
    });

  let archivedAt: Date;
  let downloadResponse = await fetchObject();
  if (downloadResponse.ok) {
    archivedAt = new Date(downloadResponse.headers.get("last-modified") ?? "");
    if (
      Number.isNaN(archivedAt.getTime()) ||
      Date.now() - archivedAt.getTime() > 60 * 60 * 1000
    ) {
      throw new Error(
        "Archive object already exists without recent local evidence; refusing to adopt or overwrite it.",
      );
    }
  } else {
    if (downloadResponse.status !== 404) {
      throw new Error(
        `Cloudflare R2 archive preflight failed (HTTP ${downloadResponse.status}).`,
      );
    }
    await downloadResponse.body?.cancel();
    const uploadResponse = await fetch(objectUrl, {
      method: "PUT",
      headers: {
        ...auth.headers,
        "Content-Type": "application/sql",
        "Content-Length": String(plan.sizeBytes),
      },
      body: Bun.file(plan.source),
      signal: AbortSignal.timeout(120_000),
    });
    let uploadBody: {
      success?: unknown;
      result?: { key?: unknown; size?: unknown; uploaded?: unknown };
      errors?: Array<{ code?: unknown }>;
    };
    try {
      uploadBody = (await uploadResponse.json()) as typeof uploadBody;
    } catch {
      throw new Error("Cloudflare R2 archive upload returned invalid JSON.");
    }
    if (
      !uploadResponse.ok ||
      uploadBody.success !== true ||
      uploadBody.result?.key !== plan.objectKey ||
      uploadBody.result?.size !== String(plan.sizeBytes) ||
      typeof uploadBody.result?.uploaded !== "string"
    ) {
      const codes = (uploadBody.errors ?? [])
        .map((error) => error.code)
        .filter((code): code is string | number =>
          ["string", "number"].includes(typeof code),
        );
      const suffix = codes.length > 0 ? ` (codes: ${codes.join(", ")})` : "";
      throw new Error(
        `Cloudflare R2 archive upload failed (HTTP ${uploadResponse.status})${suffix}.`,
      );
    }
    archivedAt = new Date(uploadBody.result.uploaded);
    if (Number.isNaN(archivedAt.getTime())) {
      throw new Error(
        "Cloudflare R2 archive upload returned an invalid timestamp.",
      );
    }
    downloadResponse = await fetchObject();
    if (!downloadResponse.ok) {
      throw new Error(
        `Cloudflare R2 archive verification download failed (HTTP ${downloadResponse.status}).`,
      );
    }
  }
  const providerVerificationTime = new Date(
    downloadResponse.headers.get("date") ?? "",
  );
  await Bun.write(downloaded, downloadResponse);
  const evidence = await buildBackupArchiveEvidence({
    plan,
    lock,
    downloaded,
    archivedAt,
    ...(Number.isNaN(providerVerificationTime.getTime())
      ? {}
      : { verifiedAt: providerVerificationTime }),
  });
  await Bun.write(
    plan.evidenceOutput,
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "apply",
        ...safePlan,
        ...access,
        immutable: true,
        retention: evidence.retention,
        evidence: relative(repoRoot, plan.evidenceOutput).replaceAll("\\", "/"),
        releaseEvidence: releaseBackupEvidence(evidence),
      },
      null,
      2,
    ),
  );
} finally {
  await rm(verifyDirectory, { recursive: true, force: true });
}
