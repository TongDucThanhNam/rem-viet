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
  buildCloudflareVitalsAuditReport,
  cloudflareVitalsEvidenceSql,
  cloudflareVitalsEvidenceWindow,
} from "../src/cloudflare-vitals";

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
const json = flag("json");

if (!/^[a-z][a-z0-9-]{1,62}$/.test(site)) {
  throw new Error("Pass a safe manifest site ID with --site=<client-slug>.");
}
if (!stage) throw new Error("Pass the deployed stage with --stage=<stage>.");
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
const databaseName = `${manifest.infrastructure.d1Name}-${stage}`;
const generatedAt = new Date();
const window = cloudflareVitalsEvidenceWindow(generatedAt);

const remoteRows = Effect.gen(function* () {
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

  const items = yield* d1.queryDatabase
    .items({
      accountId,
      databaseId: database.uuid,
      sql: cloudflareVitalsEvidenceSql,
      params: [...window.params],
    })
    .pipe(Stream.runCollect);
  return Array.from(items).flatMap((item) => item.results ?? []);
}).pipe(
  Effect.provide(CloudflareApiLive()),
  Effect.provide(
    Layer.mergeAll(
      BunServices.layer,
      BunHttpClient.layer,
      Layer.succeed(AuthProviders, {}),
    ),
  ),
);

let rows: unknown[];
try {
  rows = await Effect.runPromise(remoteRows);
} catch {
  throw new Error(
    "Cloudflare D1 Web Vitals audit failed. Provider identifiers and credentials were suppressed; verify the profile, site deployment and D1 read permission.",
  );
}

const report = buildCloudflareVitalsAuditReport({
  origin,
  generatedAt,
  rows,
});
const safeReport = {
  ...report,
  site,
  stage,
};

if (json) {
  console.log(JSON.stringify(safeReport, null, 2));
} else {
  console.log(
    `Field Web Vitals: ${report.ready ? "READY" : "NOT READY"}; ${report.window.days}-day window ending ${report.window.to}.`,
  );
  for (const [name, metric] of Object.entries(report.metrics)) {
    const p75 = metric.p75 === null ? "no p75" : `${metric.p75} ${metric.unit}`;
    console.log(
      `${name}: ${metric.status}; ${metric.samples}/${report.minimumSamples} samples; p75 ${p75}; target <= ${metric.target} ${metric.unit}.`,
    );
  }
  console.log(
    report.releaseEvidence
      ? "Release evidence emitted in --json output."
      : "Release evidence withheld until all three metrics meet sample and p75 gates.",
  );
}

if (!report.ready) process.exitCode = 2;
