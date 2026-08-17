import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as d1 from "@distilled.cloud/cloudflare/d1";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as BunServices from "@effect/platform-bun/BunServices";
import {
  resolveDeploymentOrigin,
  siteManifestSchema,
  type SiteManifest,
} from "@rem-viet/cms";
import { AuthProviders } from "alchemy/Auth/AuthProvider";
import { CloudflareApiLive, CloudflareEnvironment } from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import {
  buildCloudflareNotificationSmokeReport,
  buildNotificationSmokePayload,
  cloudflareNotificationDefinitionSql,
  cloudflareNotificationSubmissionSql,
  notificationSmokeIdempotencyKey,
  notificationSmokeRunIdSchema,
  parseCloudflareNotificationDefinition,
  parseNotificationSmokeHealth,
} from "../src/cloudflare-notification-smoke";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const site = argument("site") ?? "";
const stage = (argument("stage") ?? "").trim().toLowerCase();
const explicitOrigin = argument("origin");
const profile = argument("profile");
const requestedRunId = argument("run-id");
const confirmOrigin = argument("confirm-origin");
const receiptConfirmedAt = argument("receipt-confirmed-at");
const json = flag("json");
const apply = flag("apply");
const verify = flag("verify");

if (!/^[a-z][a-z0-9-]{1,62}$/.test(site)) {
  throw new Error("Pass a safe manifest site ID with --site=<client-slug>.");
}
if (!stage) throw new Error("Pass the deployed stage with --stage=<stage>.");
if (apply && verify) throw new Error("Choose either --apply or --verify.");
if (receiptConfirmedAt && !verify) {
  throw new Error("--receipt-confirmed-at is valid only with --verify.");
}
if ((apply || verify) && !requestedRunId) {
  throw new Error(
    "Apply and verify require the stable UUID emitted by dry-run via --run-id=<uuid>.",
  );
}
if (profile) process.env.ALCHEMY_PROFILE = profile;

async function readManifest(): Promise<SiteManifest> {
  const candidates = [
    resolve(repoRoot, "sites", site, "site.manifest.json"),
    resolve(repoRoot, "site.manifest.json"),
  ];
  for (const path of candidates) {
    try {
      const manifest = siteManifestSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
      if (manifest.id === site) return manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
  throw new Error(`No checked-in site manifest exists for ${site}.`);
}

const manifest = await readManifest();
const origin = resolveDeploymentOrigin({
  stage,
  siteUrl: manifest.siteUrl,
  explicitOrigin,
});
const runId = notificationSmokeRunIdSchema.parse(
  requestedRunId ?? crypto.randomUUID(),
);
const idempotencyKey = notificationSmokeIdempotencyKey(runId);
const databaseName = `${manifest.infrastructure.d1Name}-${stage}`;

const cloudflareServices = Layer.mergeAll(
  BunServices.layer,
  BunHttpClient.layer,
  Layer.succeed(AuthProviders, {}),
);

async function resolveDatabase() {
  const operation = Effect.gen(function* () {
    const environment = yield* CloudflareEnvironment;
    const { accountId } = yield* environment;
    const pages = yield* d1.listDatabases
      .pages({ accountId, name: databaseName })
      .pipe(Stream.runCollect);
    const matches = Array.from(pages)
      .flatMap((page) => page.result ?? [])
      .filter(
        (database): database is typeof database & { uuid: string } =>
          database.name === databaseName && typeof database.uuid === "string",
      );
    const [database] = matches;
    if (matches.length !== 1 || !database) {
      throw new Error("Expected exactly one matching deployed D1 database.");
    }
    return { accountId, databaseId: database.uuid };
  }).pipe(
    Effect.provide(CloudflareApiLive()),
    Effect.provide(cloudflareServices),
  );

  try {
    return await Effect.runPromise(operation);
  } catch {
    throw new Error(
      "Cloudflare notification smoke could not resolve the manifest-owned D1 database. Provider identifiers and credentials were suppressed.",
    );
  }
}

const database = await resolveDatabase();

async function queryD1(sql: string, params: Array<string>) {
  const operation = d1.queryDatabase
    .items({
      accountId: database.accountId,
      databaseId: database.databaseId,
      sql,
      params,
    })
    .pipe(
      Stream.runCollect,
      Effect.map((items) =>
        Array.from(items).flatMap((item) => item.results ?? []),
      ),
      Effect.provide(CloudflareApiLive()),
      Effect.provide(cloudflareServices),
    );
  try {
    return await Effect.runPromise(operation);
  } catch {
    throw new Error(
      "Cloudflare notification smoke D1 query failed. Provider identifiers and credentials were suppressed.",
    );
  }
}

async function readHealth() {
  let response: Response;
  try {
    response = await fetch(`${origin}/api/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Staging health endpoint was unreachable.");
  }
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(
      `Staging health endpoint returned HTTP ${response.status}.`,
    );
  }
  return parseNotificationSmokeHealth(await response.json());
}

async function postSubmission(
  submission: ReturnType<typeof buildNotificationSmokePayload>,
) {
  let response: Response;
  try {
    response = await fetch(`${origin}/api/forms/submit`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "agency-cms-notification-smoke/1",
      },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(
      "Notification smoke request did not complete; rerun --verify with the same run ID before any new apply.",
    );
  }
  if (response.status !== 202) {
    throw new Error(
      `Notification smoke endpoint returned HTTP ${response.status}; provider response details were suppressed.`,
    );
  }
  return (await response.json()) as unknown;
}

const [health, definitionRows, beforeRows] = await Promise.all([
  readHealth(),
  queryD1(cloudflareNotificationDefinitionSql, ["contact"]),
  queryD1(cloudflareNotificationSubmissionSql, [idempotencyKey]),
]);
const definition = parseCloudflareNotificationDefinition(definitionRows);
const emailRuntimeConfigured = health.emailRuntimeConfigured;
const deploymentProvenanceExposed = health.deployment !== null;
const deploymentSiteMatched = health.deployment?.siteId === site;
const deploymentStageMatched = health.deployment?.stage === stage;
const deploymentReady =
  deploymentProvenanceExposed &&
  health.cleanDeployment &&
  deploymentSiteMatched &&
  deploymentStageMatched;
const readyToApply = emailRuntimeConfigured && deploymentReady;

if (!apply && !verify) {
  const dryRun = {
    schemaVersion: 1 as const,
    mode: "dry-run" as const,
    readyToApply,
    site,
    stage,
    origin,
    runId,
    prerequisites: {
      manifestDatabaseMatched: true as const,
      formActive: true as const,
      formEmailEnabled: true as const,
      providerConfigurationExposed: health.providerConfigurationExposed,
      emailRuntimeConfigured,
      deploymentProvenanceExposed,
      deploymentClean: health.cleanDeployment,
      deploymentSiteMatched,
      deploymentStageMatched,
      deploymentCommit: health.deployment?.commit ?? null,
      deploymentInputSha256: health.deployment?.inputSha256 ?? null,
    },
    plannedEffects: {
      leadRowsCreated: 1 as const,
      externalEmailsRequested: 1 as const,
      duplicateReplays: 1 as const,
    },
  };
  if (json) console.log(JSON.stringify(dryRun, null, 2));
  else {
    console.log(
      `Notification smoke dry-run: ${readyToApply ? "READY" : "NOT READY"}.`,
    );
    console.log(`Stable run ID: ${runId}`);
    console.log(
      !health.providerConfigurationExposed
        ? "The deployed health contract does not expose provider configuration; deploy the current build before smoke apply."
        : emailRuntimeConfigured
          ? "Email notification runtime is configured."
          : "Email notification runtime is not configured; no request was sent.",
    );
    console.log(
      `Deployment provenance: ${deploymentReady ? "clean and matched" : "blocked"}.`,
    );
    console.log(
      "Apply will create one synthetic admin-inbox lead, request one real email and replay the same idempotency key once.",
    );
  }
  if (!readyToApply) process.exitCode = 2;
} else {
  if (!readyToApply) {
    throw new Error(
      "Email notification runtime is not healthy; no smoke request was sent.",
    );
  }
  if (apply && confirmOrigin !== origin) {
    throw new Error(
      "Apply requires --confirm-origin=<exact resolved HTTPS origin>.",
    );
  }
  if (apply && beforeRows.length !== 0) {
    throw new Error(
      "This run ID already exists. Use --verify; a second apply was not sent.",
    );
  }
  if (verify && beforeRows.length !== 1) {
    throw new Error(
      "Verify requires exactly one existing smoke lead for this run ID; no replay was sent.",
    );
  }

  const submission = buildNotificationSmokePayload(definition, runId);
  const responses = apply
    ? [await postSubmission(submission), await postSubmission(submission)]
    : [await postSubmission(submission)];
  const afterRows = await queryD1(cloudflareNotificationSubmissionSql, [
    idempotencyKey,
  ]);
  const report = buildCloudflareNotificationSmokeReport({
    mode: apply ? "apply" : "verify",
    origin,
    runId,
    generatedAt: new Date(),
    beforeRows,
    afterRows,
    responses,
    receiptConfirmedAt,
  });
  const safeReport = { ...report, site, stage };

  if (json) console.log(JSON.stringify(safeReport, null, 2));
  else {
    console.log(
      `Notification smoke ${report.mode}: provider accepted exactly once; duplicate suppressed.`,
    );
    console.log(
      report.ready
        ? "Recipient receipt confirmed; release evidence is available in --json output."
        : "Recipient receipt remains unconfirmed; release evidence was withheld.",
    );
    if (!report.ready) {
      console.log(
        `After the recipient sees the email, rerun --verify --run-id=${runId} --receipt-confirmed-at=<ISO timestamp>.`,
      );
    }
  }
  if (verify && !report.ready) process.exitCode = 2;
}
