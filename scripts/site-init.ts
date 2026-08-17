import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { applyCmsFilePlan, createCmsSiteInitPlan } from "@agency/cms-cli";

import {
  argument,
  envExample,
  flag,
  handoverChecklist,
  logoPlaceholderSvg,
  manifestFor,
  repoRoot,
  seedSql,
} from "./site-lib";

const id = argument("id") ?? "";
const preset = argument("preset") ?? "showcase";
const dryRun = flag("dry-run");
if (!id) throw new Error("Thiếu --id=<client-slug>.");
if (!(["showcase", "catalog", "portfolio"] as const).includes(preset as never))
  throw new Error("Preset phải là showcase, catalog hoặc portfolio.");
const manifest = manifestFor(
  id,
  preset as "showcase" | "catalog" | "portfolio",
);
const plan = createCmsSiteInitPlan({
  siteId: manifest.id,
  files: [
    {
      path: `sites/${manifest.id}/site.manifest.json`,
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      mode: "json-exact",
    },
    {
      path: `sites/${manifest.id}/.env.example`,
      content: envExample(manifest),
      mode: "preserve",
    },
    {
      path: `sites/${manifest.id}/seed.sql`,
      content: seedSql(manifest),
      mode: "preserve",
    },
    {
      path: `sites/${manifest.id}/HANDOVER.md`,
      content: handoverChecklist(manifest),
      mode: "preserve",
    },
    {
      path: `apps/web/public/assets/${manifest.id}-logo.svg`,
      content: logoPlaceholderSvg(manifest),
      mode: "preserve",
    },
  ],
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
console.log(
  "Secrets còn thiếu: BETTER_AUTH_SECRET, ADMIN_EMAILS, CMS_BOOTSTRAP_PASSWORD, Cloudflare credentials, notification credentials.",
);
