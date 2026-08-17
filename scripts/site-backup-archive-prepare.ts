import { z } from "zod";

import {
  assertR2BucketPrivate,
  assertR2ObjectLock,
  ensureR2BackupLockRule,
} from "../packages/infra/src/cloudflare-r2-lock";

import { argument, flag, readSiteManifest } from "./site-lib";

const site = argument("site") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
const profile = argument("profile");
if (profile) process.env.ALCHEMY_PROFILE = profile;
const authSource = z
  .enum(["environment", "alchemy"])
  .parse(argument("auth-source") ?? "alchemy");
const retentionDays = Number.parseInt(argument("retention-days") ?? "365", 10);
const location = z
  .enum(["apac", "eeur", "enam", "oc", "weur", "wnam"])
  .parse(argument("location") ?? "apac");

if (!site) throw new Error("Missing --site=<client-slug>.");
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

const { manifest } = await readSiteManifest(site);
const bucket = manifest.infrastructure.backupBucketName;
const probeKey = "d1/archive-lock-probe.sql";
const safePlan = {
  site: manifest.id,
  bucket,
  location,
  lockPrefix: "d1/",
  retentionDays,
  authSource,
  managedByAlchemyStack: false,
};

if (dryRun) {
  console.log(
    JSON.stringify({ ok: true, mode: "dry-run", ...safePlan }, null, 2),
  );
  process.exit(0);
}
if (argument("confirm-bucket") !== bucket) {
  throw new Error(
    "--confirm-bucket must exactly match the manifest backup bucket before --apply.",
  );
}

type CloudflareEnvelope = {
  success?: unknown;
  result?: unknown;
  errors?: Array<{ code?: unknown }>;
};

function errorCodes(body: CloudflareEnvelope) {
  return (body.errors ?? [])
    .map((error) => error.code)
    .filter((code): code is string | number =>
      ["string", "number"].includes(typeof code),
    );
}

async function request(url: URL, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  let body: CloudflareEnvelope;
  try {
    body = (await response.json()) as CloudflareEnvelope;
  } catch {
    throw new Error("Cloudflare R2 returned an invalid response.");
  }
  return { response, body };
}

function assertSuccess(
  value: Awaited<ReturnType<typeof request>>,
  operation: string,
) {
  if (!value.response.ok || value.body.success !== true) {
    const codes = errorCodes(value.body);
    const suffix = codes.length > 0 ? ` (codes: ${codes.join(", ")})` : "";
    throw new Error(
      `${operation} failed (HTTP ${value.response.status})${suffix}; the Alchemy credential needs Workers R2 Storage Write.`,
    );
  }
  return value.body.result;
}

const { resolveCloudflareAuth } =
  await import("../packages/infra/src/cloudflare-auth");
const { accountId, auth } = await resolveCloudflareAuth({
  accountId: argument("account-id"),
  source: authSource,
});
const bucketUrl = new URL(
  `/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}`,
  "https://api.cloudflare.com",
);
let created = false;
const currentBucket = await request(bucketUrl, { headers: auth.headers });
if (!currentBucket.response.ok || currentBucket.body.success !== true) {
  const missing =
    currentBucket.response.status === 404 &&
    errorCodes(currentBucket.body).some((code) => String(code) === "10006");
  if (!missing) assertSuccess(currentBucket, "Cloudflare backup bucket lookup");

  const createUrl = new URL(
    `/client/v4/accounts/${accountId}/r2/buckets`,
    "https://api.cloudflare.com",
  );
  assertSuccess(
    await request(createUrl, {
      method: "POST",
      headers: { ...auth.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: bucket, locationHint: location }),
    }),
    "Cloudflare backup bucket creation",
  );
  created = true;
}

const managedDomainUrl = new URL(
  `${bucketUrl.pathname}/domains/managed`,
  bucketUrl.origin,
);
const customDomainsUrl = new URL(
  `${bucketUrl.pathname}/domains/custom`,
  bucketUrl.origin,
);
const access = assertR2BucketPrivate({
  managedResult: assertSuccess(
    await request(managedDomainUrl, { headers: auth.headers }),
    "Cloudflare backup managed-domain audit",
  ),
  customResult: assertSuccess(
    await request(customDomainsUrl, { headers: auth.headers }),
    "Cloudflare backup custom-domain audit",
  ),
});

const lockUrl = new URL(`${bucketUrl.pathname}/lock`, bucketUrl.origin);
const currentLocks = assertSuccess(
  await request(lockUrl, { headers: auth.headers }),
  "Cloudflare backup lock lookup",
);
const configured = ensureR2BackupLockRule({
  result: currentLocks,
  objectKey: probeKey,
  retentionDays,
  ruleId: `cms-d1-backups-${retentionDays}d`,
});
if (configured.changed) {
  assertSuccess(
    await request(lockUrl, {
      method: "PUT",
      headers: { ...auth.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ rules: configured.rules }),
    }),
    "Cloudflare backup lock update",
  );
}
const verifiedLocks = assertSuccess(
  await request(lockUrl, { headers: auth.headers }),
  "Cloudflare backup lock verification",
);
const lock = assertR2ObjectLock({
  result: verifiedLocks,
  objectKey: probeKey,
  minimumRetentionDays: retentionDays,
});
console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "apply",
      ...safePlan,
      changed: created || configured.changed,
      bucketCreated: created,
      lockUpdated: configured.changed,
      ...access,
      immutable: lock.immutable,
      protectionMode: lock.mode,
    },
    null,
    2,
  ),
);
