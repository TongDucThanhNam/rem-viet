import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { config, parse } from "dotenv";
import { z } from "zod";

import {
  addPrivateBindingIfMissing,
  assertSyntheticE2eEmail,
  AuthCookieJar,
  extractTotpSecret,
  generateTotp,
  replacePrivateBinding,
  stagingE2eEmail,
} from "./site-e2e-identity-lib";
import {
  argument,
  flag,
  privateSiteEnvPaths,
  readSiteManifest,
  repoRoot,
} from "./site-lib";

type D1QueryResponse = Array<{
  results?: Array<Record<string, unknown>>;
  success?: boolean;
}>;

const site = argument("site") ?? "";
const stage = (argument("stage") ?? "staging").trim().toLowerCase();
const explicitOrigin = argument("origin") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
if (!site) throw new Error("Missing --site=<client-slug>.");
if (stage !== "staging") {
  throw new Error("The automated E2E identity may only target staging.");
}
if (dryRun === apply) {
  throw new Error("Pass exactly one of --dry-run or --apply.");
}

const { manifest, source } = await readSiteManifest(site);
const { relativeTarget: relativeEnvPath } = privateSiteEnvPaths({
  siteId: manifest.id,
  source,
});
const envPath = resolve(repoRoot, relativeEnvPath);
if (!existsSync(envPath)) {
  throw new Error(`Private site env does not exist: ${relativeEnvPath}.`);
}
const ignored = Bun.spawnSync(
  ["git", "check-ignore", "--quiet", relativeEnvPath],
  { cwd: repoRoot, stdout: "ignore", stderr: "ignore" },
);
if (ignored.exitCode !== 0) {
  throw new Error("Private site env must remain Git-ignored.");
}

function validateOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--origin must be an absolute staging URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "--origin must be an HTTPS origin without credentials, path, query or hash.",
    );
  }
  return url.origin;
}

const origin = validateOrigin(explicitOrigin);
const originalPrivateContents = readFileSync(envPath, "utf8");
const privateEnv = parse(originalPrivateContents);
const expectedEmail = stagingE2eEmail(manifest.id, stage);
const email = assertSyntheticE2eEmail(
  privateEnv.CMS_E2E_EMAIL?.trim() || expectedEmail,
);
if (email !== expectedEmail) {
  throw new Error(
    "The private staging E2E email does not match this site/stage.",
  );
}
const configuredPassword = privateEnv.CMS_E2E_PASSWORD?.trim() ?? "";
if (configuredPassword && configuredPassword.length < 20) {
  throw new Error("CMS_E2E_PASSWORD must contain at least 20 characters.");
}
const configuredTotpSecret = privateEnv.CMS_E2E_TOTP_SECRET?.trim() ?? "";
if (configuredTotpSecret) generateTotp(configuredTotpSecret);

const safePlan = {
  ok: true,
  mode: dryRun ? "dry-run" : "apply",
  site: manifest.id,
  stage,
  origin,
  database: `${manifest.infrastructure.d1Name}-${stage}`,
  identity: "reserved-example.com-staging-admin",
  privateEnvIgnored: true,
  emailBindingReady: Boolean(privateEnv.CMS_E2E_EMAIL?.trim()),
  passwordBindingReady: Boolean(configuredPassword),
  totpBindingReady: Boolean(configuredTotpSecret),
  secretsPrinted: false,
  backupCodesPrinted: false,
};
if (dryRun) {
  console.log(JSON.stringify(safePlan, null, 2));
  process.exit(0);
}
if (argument("confirm-site") !== manifest.id) {
  throw new Error("--confirm-site must exactly match --site before --apply.");
}
if (argument("confirm-origin") !== origin) {
  throw new Error(
    "--confirm-origin must exactly match --origin before --apply.",
  );
}
if (argument("confirm-email") !== email) {
  throw new Error(
    "--confirm-email must exactly match the reserved synthetic identity before --apply.",
  );
}

function gitOutput(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error("Unable to inspect the local Git checkout.");
  }
  return result.stdout.toString().trim();
}

const localCommit = gitOutput(["rev-parse", "HEAD"]);
if (!/^[0-9a-f]{40}$/iu.test(localCommit)) {
  throw new Error("Local Git HEAD is not a full commit SHA.");
}
if (gitOutput(["status", "--porcelain", "--untracked-files=all"]) !== "") {
  throw new Error("Staging E2E provisioning requires a clean checkout.");
}

const healthResponse = await fetch(`${origin}/api/health`, {
  headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  redirect: "error",
  signal: AbortSignal.timeout(10_000),
});
if (![200, 503].includes(healthResponse.status)) {
  throw new Error(`Staging health returned HTTP ${healthResponse.status}.`);
}
const health = z
  .object({
    checks: z.object({ database: z.literal("ok") }).passthrough(),
    deployment: z.object({
      siteId: z.string(),
      stage: z.string(),
      commit: z.string(),
      sourceState: z.literal("clean"),
    }),
  })
  .passthrough()
  .parse(await healthResponse.json());
if (
  health.deployment.siteId !== manifest.id ||
  health.deployment.stage !== stage ||
  health.deployment.commit !== localCommit
) {
  throw new Error(
    "Live staging provenance must match this clean checkout before E2E provisioning.",
  );
}

let privateContents = originalPrivateContents;
const password = configuredPassword || randomBytes(24).toString("base64url");
const emailBinding = addPrivateBindingIfMissing(
  privateContents,
  "CMS_E2E_EMAIL",
  email,
);
privateContents = emailBinding.contents;
const passwordBinding = addPrivateBindingIfMissing(
  privateContents,
  "CMS_E2E_PASSWORD",
  password,
);
privateContents = passwordBinding.contents;
if (privateContents !== originalPrivateContents) {
  await writeFile(envPath, privateContents, { encoding: "utf8", mode: 0o600 });
}

config({ path: resolve(repoRoot, ".env"), quiet: true });
const inheritedCloudflareToken =
  process.env.CLOUDFLARE_API_TOKEN?.trim() ||
  process.env.CLOUDFLARE_D1_TOKEN?.trim() ||
  "";
if (source === "client") {
  config({ path: envPath, override: true, quiet: true });
}
const cloudflareToken =
  process.env.CLOUDFLARE_API_TOKEN?.trim() ||
  process.env.CLOUDFLARE_D1_TOKEN?.trim() ||
  inheritedCloudflareToken;
if (!cloudflareToken) {
  throw new Error(
    `Missing Cloudflare D1 credential in ${relativeEnvPath} or the process environment.`,
  );
}
const database = `${manifest.infrastructure.d1Name}-${stage}`;
const wranglerEnv = { CLOUDFLARE_API_TOKEN: cloudflareToken };

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
  const [exitCode, stdout] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error("A guarded staging identity provider operation failed.");
  }
  return stdout.trim();
}

function sqlEscape(value: string) {
  return value.replaceAll("'", "''");
}

async function queryIdentity() {
  const query = `SELECT u.id AS user_id, u.two_factor_enabled AS two_factor_enabled, COALESCE((SELECT role FROM staff_roles WHERE user_id=u.id), '') AS role, (SELECT COUNT(*) FROM account WHERE user_id=u.id AND provider_id='credential') AS credential_count, (SELECT COUNT(*) FROM two_factor WHERE user_id=u.id) AS two_factor_count FROM user u WHERE lower(u.email)='${sqlEscape(email)}' LIMIT 1;`;
  const payload = JSON.parse(
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
  return payload[0]?.results?.[0];
}

let identity = await queryIdentity();
let identityCreated = false;
if (!identity) {
  const hash = await run(
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
  const userId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const after = sqlEscape(
    JSON.stringify({ role: "admin", source: "site-e2e-identity" }),
  );
  const sql = `
INSERT INTO user (id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES ('${userId}','CMS Staging E2E','${sqlEscape(email)}',1,0,cast(unixepoch('subsecond') * 1000 as integer),cast(unixepoch('subsecond') * 1000 as integer));
INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('${accountId}','${userId}','credential','${userId}','${sqlEscape(hash)}',cast(unixepoch('subsecond') * 1000 as integer),cast(unixepoch('subsecond') * 1000 as integer));
INSERT INTO staff_roles (user_id,role,assigned_by,created_at,updated_at) VALUES ('${userId}','admin','site-e2e-identity',cast(unixepoch('subsecond') * 1000 as integer),cast(unixepoch('subsecond') * 1000 as integer));
INSERT INTO audit_events (id,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,before,after,request_id,created_at) VALUES ('${auditId}','${userId}','${sqlEscape(email)}','admin','staff.e2e_provision','staff','${userId}',NULL,'${after}','site-e2e-identity',cast(unixepoch('subsecond') * 1000 as integer));
`;
  const directory = await mkdtemp(join(tmpdir(), "cms-staging-e2e-"));
  const sqlPath = join(directory, "provision.sql");
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
  identityCreated = true;
  identity = await queryIdentity();
}

if (
  identity?.role !== "admin" ||
  Number(identity.credential_count) !== 1 ||
  ![0, 1].includes(Number(identity.two_factor_enabled)) ||
  ![0, 1].includes(Number(identity.two_factor_count))
) {
  throw new Error(
    "The reserved staging E2E identity exists but does not match the guarded Admin contract.",
  );
}

const jar = new AuthCookieJar();
async function authRequest(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
) {
  const method = options.method ?? "POST";
  const response = await fetch(`${origin}/api/auth${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Origin: origin,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(jar.size > 0 ? { Cookie: jar.header() } : {}),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  jar.absorb(response.headers);
  return response;
}

async function requireJson(response: Response, operation: string) {
  if (!response.ok) {
    const suffix =
      response.status === 429 ? " Retry after the rate-limit window." : "";
    await response.body?.cancel();
    throw new Error(
      `${operation} failed with HTTP ${response.status}.${suffix}`,
    );
  }
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`${operation} returned invalid JSON.`);
  }
}

const signIn = await requireJson(
  await authRequest("/sign-in/email", {
    body: { email, password, rememberMe: false },
  }),
  "Staging E2E sign-in",
);
let totpSecret = configuredTotpSecret;
let totpEnrolled = false;
const mfaEnabled = Number(identity.two_factor_enabled) === 1;
if (mfaEnabled) {
  if (!totpSecret) {
    throw new Error(
      "The staging E2E identity has MFA enabled but its private TOTP binding is missing.",
    );
  }
  if (signIn.twoFactorRedirect !== true) {
    throw new Error("MFA-enabled staging E2E sign-in did not request TOTP.");
  }
} else {
  if (signIn.twoFactorRedirect === true) {
    throw new Error(
      "The provider requested TOTP for an unenrolled E2E identity.",
    );
  }
  if (!totpSecret) {
    const enabled = await requireJson(
      await authRequest("/two-factor/enable", {
        body: { password, issuer: `${manifest.name} staging E2E` },
      }),
      "Staging E2E TOTP enrollment",
    );
    totpSecret = extractTotpSecret(String(enabled.totpURI ?? "")).secret;
    const secretBinding = addPrivateBindingIfMissing(
      privateContents,
      "CMS_E2E_TOTP_SECRET",
      totpSecret,
    );
    privateContents = secretBinding.contents;
    if (!secretBinding.added) {
      throw new Error("Private TOTP binding changed during enrollment.");
    }
    await writeFile(envPath, privateContents, {
      encoding: "utf8",
      mode: 0o600,
    });
    totpEnrolled = true;
  } else {
    const existing = await requireJson(
      await authRequest("/two-factor/get-totp-uri", {
        body: { password },
      }),
      "Staging E2E TOTP recovery",
    );
    const providerTotp = extractTotpSecret(String(existing.totpURI ?? ""));
    if (providerTotp.secret !== totpSecret) {
      if (providerTotp.encodedSecret !== totpSecret) {
        throw new Error("Private TOTP binding does not match the provider.");
      }
      privateContents = replacePrivateBinding(
        privateContents,
        "CMS_E2E_TOTP_SECRET",
        totpSecret,
        providerTotp.secret,
      );
      totpSecret = providerTotp.secret;
      await writeFile(envPath, privateContents, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
  }
}

await requireJson(
  await authRequest("/two-factor/verify-totp", {
    body: { code: generateTotp(totpSecret), trustDevice: true },
  }),
  "Staging E2E TOTP verification",
);
const session = await requireJson(
  await authRequest("/get-session", { method: "GET" }),
  "Staging E2E session verification",
);
const sessionUser = session.user as
  { email?: unknown; twoFactorEnabled?: unknown } | undefined;
if (sessionUser?.email !== email || sessionUser.twoFactorEnabled !== true) {
  throw new Error("The verified staging E2E session is incomplete.");
}

identity = await queryIdentity();
if (
  identity?.role !== "admin" ||
  Number(identity.two_factor_enabled) !== 1 ||
  Number(identity.two_factor_count) !== 1
) {
  throw new Error(
    "The staging E2E Admin/TOTP state failed final verification.",
  );
}

console.log(
  JSON.stringify(
    {
      ...safePlan,
      identityCreated,
      identityRole: "admin",
      emailVerified: true,
      totpEnrolled,
      totpVerified: true,
      sessionVerified: true,
      privateBindingsReady: true,
      backupCodesRetained: false,
      secretsPrinted: false,
      backupCodesPrinted: false,
    },
    null,
    2,
  ),
);
