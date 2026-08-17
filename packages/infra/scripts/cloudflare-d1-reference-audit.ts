import * as d1 from "@distilled.cloud/cloudflare/d1";
import * as workers from "@distilled.cloud/cloudflare/workers";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as BunServices from "@effect/platform-bun/BunServices";
import { AuthProviders } from "alchemy/Auth/AuthProvider";
import { CloudflareApiLive, CloudflareEnvironment } from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import {
  buildD1ReferenceReport,
  buildZeroTableReferenceReport,
  parseD1Inventory,
  parseWorkerD1References,
  parseWorkerNames,
} from "../src/cloudflare-d1-references";

const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const json = process.argv.includes("--json");
const all = process.argv.includes("--all");
const profile = argument("profile");
if (profile) process.env.ALCHEMY_PROFILE = profile;

const inventory = Effect.gen(function* () {
  const environment = yield* CloudflareEnvironment;
  const { accountId } = yield* environment;
  const [databasePages, workerPages] = yield* Effect.all(
    [
      d1.listDatabases.pages({ accountId }).pipe(Stream.runCollect),
      workers.listScripts.pages({ accountId }).pipe(Stream.runCollect),
    ],
    { concurrency: 2 },
  );
  const listedDatabases = Array.from(databasePages).flatMap((page) =>
    (page.result ?? []).filter(
      (database): database is (typeof page.result)[number] & { uuid: string } =>
        database.uuid != null,
    ),
  );
  const databaseDetails = yield* Effect.forEach(
    listedDatabases,
    (database) =>
      d1.getDatabase({ accountId, databaseId: database.uuid }).pipe(
        Effect.map((detail) => ({
          ...detail,
          uuid: database.uuid,
          name: detail.name ?? database.name ?? database.uuid,
        })),
      ),
    { concurrency: 4 },
  );
  const workerNames = parseWorkerNames(
    Array.from(workerPages).flatMap((page) => page.result ?? []),
  );
  const references = yield* Effect.forEach(
    workerNames,
    (worker) =>
      workers
        .getScriptScriptAndVersionSetting({ accountId, scriptName: worker })
        .pipe(
          Effect.map((settings) => parseWorkerD1References(worker, settings)),
        ),
    { concurrency: 4 },
  );
  return {
    databases: parseD1Inventory(databaseDetails),
    workerNames,
    references: references.flat(),
  };
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

const { databases, workerNames, references } =
  await Effect.runPromise(inventory);
const candidates = all
  ? buildD1ReferenceReport({ databases, references })
  : buildZeroTableReferenceReport({ databases, references });
const report = {
  checkedAt: new Date().toISOString(),
  databasesInspected: databases.length,
  workersInspected: workerNames.length,
  scope: all ? "all" : "zero-table",
  zeroTableDatabases: databases.filter((database) => database.numTables === 0)
    .length,
  candidates,
  deletionAuthorized: false,
  note: "A zero-table, unbound database still requires owner identity confirmation and explicit deletion approval.",
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Inspected ${report.databasesInspected} D1 databases and ${report.workersInspected} Workers; reporting ${candidates.length} ${all ? "total" : "zero-table"} database(s).`,
  );
  console.table(
    candidates.map((candidate) => ({
      name: candidate.name,
      id: candidate.idPrefix,
      tables: candidate.numTables ?? "unknown",
      workerBindings:
        candidate.workerBindings
          .map(({ worker, binding }) => `${worker}:${binding}`)
          .join(", ") || "none",
      reviewState: candidate.reviewState,
      created: candidate.createdAt ?? "unknown",
    })),
  );
  console.log(report.note);
  console.log("Deletion authorized: NO");
}
