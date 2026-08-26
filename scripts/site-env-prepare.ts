import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  argument,
  flag,
  privateSiteEnvPaths,
  readSiteManifest,
  repoRoot,
} from "./site-lib";

const site = argument("site") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
if (!site) throw new Error("Missing --site=<client-slug>.");
if (dryRun === apply) {
  throw new Error("Pass exactly one of --dry-run or --apply.");
}

const { manifest, source } = await readSiteManifest(site);
const { relativeTarget, relativeTemplate } = privateSiteEnvPaths({
  siteId: manifest.id,
  source,
});
const target = resolve(repoRoot, relativeTarget);
const template = resolve(repoRoot, relativeTemplate);
if (existsSync(target)) {
  throw new Error(`Private site env already exists: ${relativeTarget}`);
}
if (!existsSync(template)) {
  throw new Error(`Site env template does not exist: ${relativeTemplate}`);
}

const ignored = Bun.spawnSync(
  ["git", "check-ignore", "--quiet", relativeTarget],
  { cwd: repoRoot, stdout: "ignore", stderr: "ignore" },
);
if (ignored.exitCode !== 0) {
  throw new Error(`Refusing to create a private env that is not Git-ignored.`);
}

const whoami = Bun.spawnSync(["bun", "x", "wrangler", "whoami"], {
  cwd: repoRoot,
  env: Bun.env,
  stdout: "pipe",
  stderr: "pipe",
});
if (whoami.exitCode !== 0) {
  throw new Error("Unable to resolve the authenticated Cloudflare account.");
}
const profileOutput = `${whoami.stdout.toString()}\n${whoami.stderr.toString()}`
  .replace(/\u001b\[[0-9;]*m/g, "")
  .replace(/\r/g, "");
const ownerMatch = profileOutput.match(
  /associated with the email\s+([^\s]+@[^\s]+)\./i,
);
const ownerEmail = ownerMatch?.[1]?.trim() ?? "";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
  throw new Error(
    "Cloudflare profile did not expose one valid account email for ADMIN_EMAILS.",
  );
}

const values = new Map([
  ["CORS_ORIGIN", manifest.siteUrl],
  ["BETTER_AUTH_URL", manifest.siteUrl],
  ["BETTER_AUTH_SECRET", randomBytes(48).toString("base64url")],
  ["ADMIN_EMAILS", ownerEmail.toLowerCase()],
  ["CMS_BOOTSTRAP_PASSWORD", randomBytes(24).toString("base64url")],
]);
const seen = new Set<string>();
const contents = readFileSync(template, "utf8")
  .replace(/\r\n/g, "\n")
  .split("\n")
  .map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    const key = match?.[1];
    if (!key || !values.has(key)) return line;
    seen.add(key);
    return `${key}=${values.get(key)}`;
  })
  .join("\n");
if (seen.size !== values.size) {
  throw new Error("Site env template is missing a required private binding.");
}

const safeReceipt = {
  ok: true,
  mode: dryRun ? "dry-run" : "apply",
  site: manifest.id,
  target: relativeTarget,
  ownerSource: "authenticated-cloudflare-profile",
  authSecretGenerated: true,
  bootstrapPasswordGenerated: true,
  targetIgnoredByGit: true,
  overwritten: false,
  valuesPrinted: false,
};
if (dryRun) {
  console.log(JSON.stringify(safeReceipt, null, 2));
  process.exit(0);
}
if (argument("confirm-site") !== manifest.id) {
  throw new Error("--confirm-site must exactly match --site before --apply.");
}

await Bun.write(target, contents);
console.log(JSON.stringify(safeReceipt, null, 2));
