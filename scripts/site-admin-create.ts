import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { config } from "dotenv";

import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

type D1QueryResponse = Array<{
  results?: Array<Record<string, unknown>>;
  success?: boolean;
}>;

function sqlEscape(value: string) {
  return value.replaceAll("'", "''");
}

function validateStage(value: string) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(value)) {
    throw new Error("Stage must be a safe deployment slug.");
  }
  return value;
}

function validateEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Owner email is invalid.");
  }
  return normalized;
}

async function run(
  command: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
) {
  const child = Bun.spawn(command, {
    cwd: options.cwd ?? repoRoot,
    env: { ...Bun.env, ...options.env },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `${command.slice(0, 4).join(" ")} failed (${exitCode}): ${stderr.slice(0, 1200)}`,
    );
  }
  return stdout.trim();
}

async function passwordHash(password: string) {
  return run(
    [
      "bun",
      "-e",
      'import { hashPassword } from "better-auth/crypto"; console.log(await hashPassword(process.env.CMS_TEMP_PASSWORD));',
    ],
    {
      cwd: resolve(repoRoot, "apps/web"),
      env: { CMS_TEMP_PASSWORD: password },
    },
  );
}

const site = argument("site") ?? "";
const stage = validateStage((argument("stage") ?? "staging").toLowerCase());
const dryRun = flag("dry-run");
if (!site) throw new Error("Missing --site=<client-slug>.");

const { manifest, source } = await readSiteManifest(site);
const siteEnvPath =
  source === "root"
    ? resolve(repoRoot, "apps/web/.env")
    : resolve(repoRoot, "sites", site, ".env");

config({ path: resolve(repoRoot, ".env") });
const inheritedCloudflareToken =
  process.env.CLOUDFLARE_API_TOKEN?.trim() ||
  process.env.CLOUDFLARE_D1_TOKEN?.trim() ||
  "";
config({ path: siteEnvPath, override: source === "client" });

const allowlist = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const email = validateEmail(argument("email") ?? [...allowlist][0] ?? "");
if (!allowlist.has(email)) {
  throw new Error("Owner email must be present in ADMIN_EMAILS.");
}

const name = (argument("name") ?? `${manifest.name} Owner`).trim();
if (name.length < 2 || name.length > 80) {
  throw new Error("Owner name must contain 2-80 characters.");
}

const database = `${manifest.infrastructure.d1Name}-${stage}`;
const passwordEnv = argument("password-env") ?? "CMS_BOOTSTRAP_PASSWORD";
if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(passwordEnv)) {
  throw new Error(
    "--password-env must name a safe uppercase environment variable.",
  );
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "dry-run",
        site: manifest.id,
        stage,
        database,
        emailConfigured: true,
        name,
        passwordEnv,
        mutation: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const cloudflareToken =
  process.env.CLOUDFLARE_API_TOKEN?.trim() ||
  process.env.CLOUDFLARE_D1_TOKEN?.trim() ||
  inheritedCloudflareToken;
if (!cloudflareToken) {
  throw new Error(
    `Missing CLOUDFLARE_API_TOKEN (or CLOUDFLARE_D1_TOKEN) in ${siteEnvPath} or the process environment.`,
  );
}
const wranglerEnv = { CLOUDFLARE_API_TOKEN: cloudflareToken };
const query = `SELECT u.id AS user_id, COALESCE((SELECT role FROM staff_roles WHERE user_id=u.id), '') AS role, (SELECT COUNT(*) FROM account WHERE user_id=u.id AND provider_id='credential') AS credential_count FROM user u WHERE lower(u.email)='${sqlEscape(email)}' LIMIT 1;`;
const existingPayload = JSON.parse(
  await run(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      "--command",
      query,
    ],
    { env: wranglerEnv },
  ),
) as D1QueryResponse;
const existing = existingPayload[0]?.results?.[0];

if (existing) {
  if (existing.role !== "owner" || Number(existing.credential_count) < 1) {
    throw new Error(
      "The allowlisted user already exists but is not a complete credential Owner; repair it explicitly instead of overwriting authentication data.",
    );
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "unchanged",
        site: manifest.id,
        stage,
        database,
        emailConfigured: true,
        role: "owner",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const password = process.env[passwordEnv]?.trim() ?? "";
if (password.length < 12 || password.length > 128) {
  throw new Error(`${passwordEnv} must contain 12-128 characters.`);
}
if (password.toLowerCase().includes(email.split("@")[0] ?? email)) {
  throw new Error(
    `${passwordEnv} must not contain the owner email local-part.`,
  );
}

const userId = crypto.randomUUID();
const accountId = crypto.randomUUID();
const auditId = crypto.randomUUID();
const hash = await passwordHash(password);
const after = sqlEscape(
  JSON.stringify({ role: "owner", source: "site-admin-create" }),
);
const sql = `
INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('${userId}','${sqlEscape(name)}','${sqlEscape(email)}',1,cast(unixepoch('subsecond') * 1000 as integer),cast(unixepoch('subsecond') * 1000 as integer));
INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('${accountId}','${userId}','credential','${userId}','${sqlEscape(hash)}',cast(unixepoch('subsecond') * 1000 as integer),cast(unixepoch('subsecond') * 1000 as integer));
INSERT INTO staff_roles (user_id,role,assigned_by,created_at,updated_at) VALUES ('${userId}','owner','site-admin-create',cast(unixepoch('subsecond') * 1000 as integer),cast(unixepoch('subsecond') * 1000 as integer));
INSERT INTO audit_events (id,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,before,after,request_id,created_at) VALUES ('${auditId}','${userId}','${sqlEscape(email)}','owner','staff.bootstrap','staff','${userId}',NULL,'${after}','site-admin-create',cast(unixepoch('subsecond') * 1000 as integer));
`;
const directory = await mkdtemp(join(tmpdir(), "agency-cms-owner-"));
const sqlPath = join(directory, "bootstrap.sql");
try {
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  await run(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      database,
      "--remote",
      "--yes",
      "--file",
      sqlPath,
    ],
    { env: wranglerEnv },
  );
} finally {
  await rm(directory, { force: true, recursive: true });
}

const verificationPayload = JSON.parse(
  await run(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      "--command",
      query,
    ],
    { env: wranglerEnv },
  ),
) as D1QueryResponse;
const verification = verificationPayload[0]?.results?.[0];
if (
  verification?.role !== "owner" ||
  Number(verification.credential_count) !== 1
) {
  throw new Error("Owner bootstrap could not be verified after the D1 write.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "created",
      site: manifest.id,
      stage,
      database,
      emailConfigured: true,
      role: "owner",
      auditAction: "staff.bootstrap",
    },
    null,
    2,
  ),
);
