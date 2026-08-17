import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import {
  buildAlchemyAlertProfile,
  isAlchemyAlertCredentialReady,
} from "./alchemy-alert-profile-lib";
import { argument, flag } from "./site-lib";

const dryRun = flag("dry-run");
const apply = flag("apply");
if (dryRun === apply)
  throw new Error("Pass exactly one of --dry-run or --apply.");
const sourceProfile = argument("source-profile") ?? "default";
const targetProfile = argument("target-profile") ?? "alerts";
const configPath = resolve(homedir(), ".alchemy", "profiles.json");
const credentialPath = resolve(
  homedir(),
  ".alchemy",
  "credentials",
  targetProfile,
  "cf-oauth.json",
);
if (!existsSync(configPath))
  throw new Error("Alchemy profile config does not exist. Run login first.");

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(configPath, "utf8"));
} catch (error) {
  throw new Error("Alchemy profile config is not valid JSON.", {
    cause: error,
  });
}
const prepared = buildAlchemyAlertProfile(raw, sourceProfile, targetProfile);
let credential: unknown;
if (existsSync(credentialPath)) {
  try {
    credential = JSON.parse(readFileSync(credentialPath, "utf8"));
  } catch {
    credential = undefined;
  }
}
const safeReceipt = {
  ok: true,
  mode: dryRun ? "dry-run" : "apply",
  sourceProfile,
  targetProfile,
  status: dryRun && prepared.status === "created" ? "planned" : prepared.status,
  method: "oauth",
  scopes: [
    "account:read",
    "user:read",
    "notification:read",
    "notification:write",
  ],
  credentialsReady: isAlchemyAlertCredentialReady(credential),
  credentialFileChanged: false,
  accountIdPrinted: false,
  credentialsPrinted: false,
};
if (dryRun) {
  console.log(JSON.stringify(safeReceipt, null, 2));
  process.exit(0);
}
if (argument("confirm-profile") !== targetProfile)
  throw new Error(
    "--confirm-profile must exactly match --target-profile before --apply.",
  );
if (prepared.status === "created")
  await Bun.write(configPath, `${JSON.stringify(prepared.config, null, 2)}\n`);
console.log(JSON.stringify(safeReceipt, null, 2));
