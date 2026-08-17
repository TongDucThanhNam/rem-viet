import { resolve } from "node:path";

import {
  argument,
  flag,
  readSiteManifest,
  repoRoot,
  seedSql,
  writeIfAbsent,
} from "./site-lib";

const site = argument("site") ?? "";
if (!site) throw new Error("Thiếu --site=<client-slug>.");
const { manifest } = await readSiteManifest(site);
const target = resolve(repoRoot, "sites", site, "seed.sql");
const content = seedSql(manifest);
const refresh = flag("refresh");
const result = refresh
  ? flag("dry-run")
    ? "would-refresh"
    : (await Bun.write(target, content), "refreshed")
  : await writeIfAbsent(target, content, flag("dry-run"));
console.log(`${result}: ${target}`);
console.log(
  `Apply after migrations with: wrangler d1 execute ${manifest.infrastructure.d1Name}-<stage> --file ${target}`,
);
