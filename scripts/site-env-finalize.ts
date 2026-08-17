import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  argument,
  flag,
  readSiteManifest,
  removePrivateEnvBinding,
  repoRoot,
} from "./site-lib";

const site = argument("site") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
const credentialStored = flag("credential-stored");
if (!site) throw new Error("Missing --site=<client-slug>.");
if (dryRun === apply) {
  throw new Error("Pass exactly one of --dry-run or --apply.");
}

const { manifest } = await readSiteManifest(site);
const relativeTarget = `sites/${manifest.id}/.env`;
const target = resolve(repoRoot, relativeTarget);
if (!existsSync(target)) {
  throw new Error(`Private site env does not exist: ${relativeTarget}`);
}

const ignored = Bun.spawnSync(
  ["git", "check-ignore", "--quiet", relativeTarget],
  { cwd: repoRoot, stdout: "ignore", stderr: "ignore" },
);
if (ignored.exitCode !== 0) {
  throw new Error("Refusing to edit a private env that is not Git-ignored.");
}

const current = readFileSync(target, "utf8");
const finalized = removePrivateEnvBinding(current, "CMS_BOOTSTRAP_PASSWORD");
const safeReceipt = {
  ok: true,
  mode: dryRun ? "dry-run" : "apply",
  site: manifest.id,
  target: relativeTarget,
  bootstrapCredentialPresent: finalized.removed,
  bootstrapCredentialRemoved: apply && finalized.removed,
  credentialStorageConfirmed: credentialStored,
  targetIgnoredByGit: true,
  valuesPrinted: false,
};

if (dryRun) {
  console.log(JSON.stringify(safeReceipt, null, 2));
  process.exit(0);
}
if (argument("confirm-site") !== manifest.id) {
  throw new Error("--confirm-site must exactly match --site before --apply.");
}
if (finalized.removed && !credentialStored) {
  throw new Error(
    "Pass --credential-stored only after the Owner password is saved outside the site env.",
  );
}
if (finalized.removed) {
  await Bun.write(target, finalized.contents);
}
console.log(JSON.stringify(safeReceipt, null, 2));
