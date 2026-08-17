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
  parseD1Inventory,
  parseWorkerD1References,
  parseWorkerNames,
  selectEmptyUnboundD1ForDeletion,
} from "../src/cloudflare-d1-references";

const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};

const requestedName = argument("name") ?? "";
const confirmation = argument("confirm") ?? "";
const profile = argument("profile");
if (profile) process.env.ALCHEMY_PROFILE = profile;

const retirement = Effect.gen(function* () {
  const environment = yield* CloudflareEnvironment;
  const { accountId } = yield* environment;
  const [databasePages, workerPages] = yield* Effect.all(
    [
      d1.listDatabases.pages({ accountId }).pipe(Stream.runCollect),
      workers.listScripts.pages({ accountId }).pipe(Stream.runCollect),
    ],
    { concurrency: 2 },
  );
  const matchingDatabases = Array.from(databasePages)
    .flatMap((page) => page.result ?? [])
    .filter(
      (database): database is typeof database & { uuid: string } =>
        database.name === requestedName && database.uuid != null,
    );
  const databaseDetails = yield* Effect.forEach(
    matchingDatabases,
    (database) =>
      d1.getDatabase({ accountId, databaseId: database.uuid }).pipe(
        Effect.map((detail) => ({
          ...detail,
          uuid: database.uuid,
          name: detail.name ?? database.name ?? database.uuid,
        })),
      ),
    { concurrency: 1 },
  );
  const workerNames = parseWorkerNames(
    Array.from(workerPages).flatMap((page) => page.result ?? []),
  );
  const workerReferences = yield* Effect.forEach(
    workerNames,
    (worker) =>
      workers
        .getScriptScriptAndVersionSetting({ accountId, scriptName: worker })
        .pipe(
          Effect.map((settings) => parseWorkerD1References(worker, settings)),
        ),
    { concurrency: 4 },
  );
  const candidate = selectEmptyUnboundD1ForDeletion({
    requestedName,
    confirmation,
    databases: parseD1Inventory(databaseDetails),
    references: workerReferences.flat(),
  });

  yield* d1.deleteDatabase({ accountId, databaseId: candidate.id });
  return {
    deleted: true as const,
    name: candidate.name,
    idPrefix: candidate.id.slice(0, 8),
    verifiedTableCount: candidate.numTables,
    verifiedWorkerBindings: 0,
    deletedAt: new Date().toISOString(),
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

const result = await Effect.runPromise(retirement);
console.log(JSON.stringify(result, null, 2));
