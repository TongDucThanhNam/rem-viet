import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, relative } from "node:path";

import {
  buildBackupEvidence,
  buildSiteBackupPlan,
  sanitizeBackupProviderOutput,
  verifyBackupArtifact,
} from "./cms-backup-lib";
import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

const site = argument("site") ?? "";
const stage = argument("stage") ?? "staging";
const dryRun = flag("dry-run");
if (!site) throw new Error("Missing --site=<client-slug>.");
if (!dryRun && !flag("remote")) {
  throw new Error(
    "Remote D1 export requires the explicit --remote flag. Use --dry-run to inspect the plan.",
  );
}

const { manifest } = await readSiteManifest(site);
const plan = buildSiteBackupPlan({
  manifest,
  stage,
  output: argument("output"),
});
const safePlan = {
  mode: dryRun ? "dry-run" : "remote-export",
  site: plan.siteId,
  stage: plan.stage,
  database: plan.database,
  output: relative(repoRoot, plan.output).replaceAll("\\", "/"),
  metadataOutput: relative(repoRoot, plan.metadataOutput).replaceAll("\\", "/"),
  verifyIsolatedLocalRestore: true,
};

if (dryRun) {
  console.log(JSON.stringify(safePlan, null, 2));
  process.exit(0);
}
if (existsSync(plan.output) || existsSync(plan.metadataOutput)) {
  throw new Error(
    "Refusing to overwrite an existing backup or evidence artifact.",
  );
}

await mkdir(dirname(plan.output), { recursive: true });
const child = Bun.spawn(
  [
    "bun",
    "x",
    "wrangler",
    "d1",
    "export",
    plan.database,
    "--remote",
    "--skip-confirmation",
    "--output",
    plan.output,
  ],
  {
    cwd: repoRoot,
    env: Bun.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  },
);
const [exitCode, stdout, stderr] = await Promise.all([
  child.exited,
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
]);
if (exitCode !== 0) {
  const detail = sanitizeBackupProviderOutput(`${stdout}\n${stderr}`).trim();
  throw new Error(
    `Wrangler D1 export failed with exit code ${exitCode}.${detail ? `\n${detail}` : ""}`,
  );
}

const restoreDrill = await verifyBackupArtifact(plan.output);
const evidence = await buildBackupEvidence(plan, restoreDrill);
await Bun.write(plan.metadataOutput, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, ...safePlan, evidence }, null, 2));
