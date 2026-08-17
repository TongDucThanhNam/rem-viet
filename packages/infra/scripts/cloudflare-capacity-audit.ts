import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as d1 from "@distilled.cloud/cloudflare/d1";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as BunServices from "@effect/platform-bun/BunServices";
import { siteManifestSchema } from "@rem-viet/cms";
import { AuthProviders } from "alchemy/Auth/AuthProvider";
import { CloudflareApiLive, CloudflareEnvironment } from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import {
  buildCapacityReport,
  type CapacityManifest,
} from "../src/cloudflare-capacity";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const profile = argument("profile");
const requiredSlots = Number.parseInt(argument("required-slots") ?? "2", 10);
const json = flag("json");

if (!Number.isSafeInteger(requiredSlots) || requiredSlots < 0) {
  throw new Error("--required-slots must be a non-negative integer.");
}
if (profile) {
  process.env.ALCHEMY_PROFILE = profile;
}

async function readManifests(): Promise<CapacityManifest[]> {
  const paths = [resolve(repoRoot, "site.manifest.json")];
  const sitesDirectory = resolve(repoRoot, "sites");

  try {
    for (const entry of await readdir(sitesDirectory, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) {
        paths.push(resolve(sitesDirectory, entry.name, "site.manifest.json"));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const manifests: CapacityManifest[] = [];
  for (const path of paths) {
    try {
      const manifest = siteManifestSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
      manifests.push({
        id: manifest.id,
        d1Name: manifest.infrastructure.d1Name,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
  return manifests;
}

const inventory = Effect.gen(function* () {
  const environment = yield* CloudflareEnvironment;
  const { accountId } = yield* environment;
  const pages = yield* d1.listDatabases
    .pages({ accountId })
    .pipe(Stream.runCollect);

  const listed = Array.from(pages).flatMap((page) =>
    (page.result ?? [])
      .filter(
        (
          database,
        ): database is (typeof page.result)[number] & {
          uuid: string;
        } => database.uuid != null,
      )
      .map((database) => database),
  );

  return yield* Effect.forEach(
    listed,
    (database) =>
      d1.getDatabase({ accountId, databaseId: database.uuid }).pipe(
        Effect.map((detail) => ({
          id: database.uuid,
          name: detail.name ?? database.name ?? database.uuid,
          createdAt: detail.createdAt ?? database.createdAt ?? undefined,
          fileSize: detail.fileSize ?? undefined,
          numTables: detail.numTables ?? undefined,
        })),
      ),
    { concurrency: 4 },
  );
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

const databases = await Effect.runPromise(inventory);
const report = buildCapacityReport({
  databases,
  manifests: await readManifests(),
  requiredSlots,
});

const formatBytes = (bytes: number | undefined) => {
  if (bytes === undefined) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `D1 capacity: ${report.used}/${report.limit} used; ${report.remaining} remaining; ${report.requiredSlots} required; deficit ${report.slotDeficit}.`,
  );
  console.table(
    report.databases.map((database) => ({
      name: database.name,
      id: database.id.slice(0, 8),
      owner: database.manifestId ?? "UNRECOGNIZED",
      stage: database.stage ?? "-",
      size: formatBytes(database.fileSize),
      tables: database.numTables ?? "unknown",
      created: database.createdAt ?? "unknown",
    })),
  );
  if (report.unrecognized > 0) {
    console.log(
      `${report.unrecognized} database(s) are unrecognized by checked-in manifests. Unrecognized does not mean safe to delete; verify ownership and backups manually.`,
    );
  }
}

if (report.slotDeficit > 0) {
  process.exitCode = 2;
}
