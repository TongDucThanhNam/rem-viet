import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { applyCmsFilePlan, createCmsBlockScaffoldPlan } from "@agency/cms-cli";

import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

const site = argument("site") ?? "";
const type = argument("type") ?? "";
if (!site) throw new Error("Missing --site=<client-slug>.");
if (!type) throw new Error("Missing --type=<lowerCamelBlockType>.");
const { manifest } = await readSiteManifest(site);
const directory = argument("directory") ?? `sites/${manifest.id}/blocks`;
const dryRun = flag("dry-run");
const plan = createCmsBlockScaffoldPlan({
  siteId: manifest.id,
  directory,
  type,
});
const results = await applyCmsFilePlan(
  plan,
  {
    read: async (path) => {
      try {
        return await readFile(resolve(repoRoot, path), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    write: async (path, content) => {
      const target = resolve(repoRoot, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    },
  },
  { dryRun },
);
for (const result of results) {
  console.log(
    `${dryRun ? "DRY-RUN" : "OK"} ${result.status} ${resolve(repoRoot, result.path)}`,
  );
}
