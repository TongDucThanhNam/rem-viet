import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pageRevisionSnapshotSchema } from "../packages/cms/src";

import {
  assertSafeE2eStateDirectory,
  e2eStateDirectoryPrefix,
  localE2ePlaywrightRuns,
  localE2eResourceNames,
  localE2eWranglerConfig,
  parseLocalE2eInvocation,
} from "./e2e-local-lib";
import { readSiteManifest, repoRoot } from "./site-lib";

const webRoot = resolve(repoRoot, "apps/web");
const wranglerBin = resolve(repoRoot, "node_modules/wrangler/bin/wrangler.js");
const invocation = parseLocalE2eInvocation(process.argv.slice(2));
const { manifest, source } = await readSiteManifest(invocation.site);
const resources = localE2eResourceNames(manifest);
const adminId = "cms-e2e-local";
const editorId = "cms-e2e-editor";
const ownerId = "cms-e2e-owner";
const managedId = "cms-e2e-managed";
const adminEmail = "cms-e2e-local@example.invalid";
const editorEmail = "cms-e2e-editor@example.invalid";
const ownerEmail = "cms-e2e-owner@example.invalid";
const managedEmail = "cms-e2e-managed@example.invalid";
const adminPassword = `${crypto.randomUUID()}Aa1!`;
const editorPassword = `${crypto.randomUUID()}Aa1!`;
const ownerPassword = `${crypto.randomUUID()}Aa1!`;
const adminTotpSecret = crypto.randomUUID().replaceAll("-", "");
const ownerTotpSecret = crypto.randomUUID().replaceAll("-", "");
const e2eAuthSecret = "e2e-only-secret-never-use-in-production";

async function run(
  command: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    capture?: boolean;
  } = {},
) {
  const child = Bun.spawn(command, {
    cwd: options.cwd ?? repoRoot,
    env: { ...Bun.env, ...options.env },
    stderr: options.capture ? "pipe" : "inherit",
    stdout: options.capture ? "pipe" : "inherit",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.capture ? new Response(child.stdout).text() : Promise.resolve(""),
    options.capture ? new Response(child.stderr).text() : Promise.resolve(""),
  ]);
  if (exitCode !== 0)
    throw new Error(
      `${command[0]} failed (${exitCode}): ${stderr.slice(0, 1000)}`,
    );
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
      capture: true,
      cwd: webRoot,
      env: { CMS_TEMP_PASSWORD: password },
    },
  );
}

async function twoFactorFixture(secret: string) {
  const output = await run(
    [
      "bun",
      "-e",
      'import { symmetricEncrypt } from "better-auth/crypto"; const key = process.env.CMS_TEMP_AUTH_SECRET; const secret = await symmetricEncrypt({ key, data: process.env.CMS_TEMP_TOTP_SECRET }); const backupCodes = await symmetricEncrypt({ key, data: JSON.stringify([process.env.CMS_TEMP_BACKUP_CODE]) }); console.log(JSON.stringify({ secret, backupCodes }));',
    ],
    {
      capture: true,
      cwd: webRoot,
      env: {
        CMS_TEMP_AUTH_SECRET: e2eAuthSecret,
        CMS_TEMP_BACKUP_CODE: `${crypto.randomUUID()}-backup`,
        CMS_TEMP_TOTP_SECRET: secret,
      },
    },
  );
  return JSON.parse(output) as { backupCodes: string; secret: string };
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''");
}

async function executeSql(
  sql: string,
  persistenceDirectory: string,
  configPath: string,
) {
  const directory = await mkdtemp(join(tmpdir(), "rem-viet-e2e-sql-"));
  const path = join(directory, "commands.sql");
  try {
    await writeFile(path, sql, "utf8");
    await run(
      [
        "bunx",
        "wrangler",
        "d1",
        "execute",
        resources.database,
        "--local",
        "--persist-to",
        persistenceDirectory,
        "--file",
        path,
        "--config",
        configPath,
      ],
      { capture: true, cwd: repoRoot },
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function executeSqlFile(
  path: string,
  persistenceDirectory: string,
  configPath: string,
) {
  await run(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      resources.database,
      "--local",
      "--persist-to",
      persistenceDirectory,
      "--file",
      path,
      "--config",
      configPath,
    ],
    { capture: true, cwd: repoRoot },
  );
}

async function querySql(
  sql: string,
  persistenceDirectory: string,
  configPath: string,
) {
  const output = await run(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      resources.database,
      "--local",
      "--persist-to",
      persistenceDirectory,
      "--command",
      sql,
      "--config",
      configPath,
      "--json",
    ],
    { capture: true, cwd: repoRoot },
  );
  const payload = JSON.parse(output) as Array<{
    results?: Array<Record<string, unknown>>;
    success?: boolean;
  }>;
  const result = payload[0];
  if (!result?.success || !Array.isArray(result.results)) {
    throw new Error("Local D1 query returned an invalid result.");
  }
  return result.results;
}

async function verifyFreshHomepageSeed(
  persistenceDirectory: string,
  configPath: string,
) {
  const [row] = await querySql(
    `SELECT page_revisions.snapshot AS snapshot
     FROM pages
     INNER JOIN page_revisions
       ON page_revisions.id = pages.published_revision_id
     WHERE pages.slug = 'home' AND pages.status = 'published'
     LIMIT 1;`,
    persistenceDirectory,
    configPath,
  );
  if (typeof row?.snapshot !== "string") {
    throw new Error("Fresh E2E seed has no published homepage snapshot.");
  }
  const parsed = pageRevisionSnapshotSchema.safeParse(JSON.parse(row.snapshot));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Fresh E2E homepage seed is invalid: ${issues}`);
  }
}

async function waitForServer(server: ReturnType<typeof Bun.spawn>) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const state = await Promise.race([
      fetch("http://127.0.0.1:3020/api/health")
        .then((response) => (response.ok ? "ready" : "waiting"))
        .catch(() => "waiting"),
      server.exited.then((code) => `exited:${code}`),
    ]);
    if (state === "ready") return;
    if (state.startsWith("exited:")) {
      throw new Error(`E2E worker ${state}.`);
    }
    await Bun.sleep(250);
  }
  throw new Error("E2E worker did not become healthy within 120 seconds.");
}

const cleanupSql = `
DELETE FROM form_submissions WHERE json_extract(payload, '$.email') LIKE 'e2e%@example.com';
DELETE FROM web_vitals WHERE path LIKE '/__synthetic__/%';
DELETE FROM session WHERE user_id IN (SELECT id FROM user WHERE email = '${managedEmail}');
DELETE FROM two_factor WHERE user_id IN (SELECT id FROM user WHERE email = '${managedEmail}');
DELETE FROM staff_roles WHERE user_id IN (SELECT id FROM user WHERE email = '${managedEmail}');
DELETE FROM account WHERE user_id IN (SELECT id FROM user WHERE email = '${managedEmail}');
DELETE FROM user WHERE email = '${managedEmail}';
DELETE FROM session WHERE user_id IN ('${adminId}', '${editorId}', '${ownerId}', '${managedId}');
DELETE FROM two_factor WHERE user_id IN ('${adminId}', '${editorId}', '${ownerId}', '${managedId}');
DELETE FROM staff_roles WHERE user_id IN ('${adminId}', '${editorId}', '${ownerId}', '${managedId}');
DELETE FROM account WHERE user_id IN ('${adminId}', '${editorId}', '${ownerId}', '${managedId}');
DELETE FROM user WHERE id IN ('${adminId}', '${editorId}', '${ownerId}', '${managedId}');`;

let server: ReturnType<typeof Bun.spawn> | undefined;
const temporaryDirectory = tmpdir();
const persistenceDirectory = assertSafeE2eStateDirectory(
  await mkdtemp(join(temporaryDirectory, e2eStateDirectoryPrefix)),
  temporaryDirectory,
);
const wranglerConfigPath = join(persistenceDirectory, "wrangler.e2e.json");

async function startServer() {
  server = Bun.spawn(
    [
      "node",
      wranglerBin,
      "dev",
      "--config",
      wranglerConfigPath,
      "--port",
      "3020",
      "--persist-to",
      persistenceDirectory,
      "--var",
      "CORS_ORIGIN:http://127.0.0.1:3020",
      "--var",
      "BETTER_AUTH_URL:http://127.0.0.1:3020",
      "--var",
      `BETTER_AUTH_SECRET:${e2eAuthSecret}`,
    ],
    { cwd: repoRoot, env: Bun.env, stderr: "inherit", stdout: "inherit" },
  );
  await waitForServer(server);
}

async function stopServer() {
  if (!server) return;
  if (server.exitCode === null) server.kill();
  await server.exited;
  server = undefined;
}

async function runPlaywright(
  playwrightArguments: string[],
  environment: Record<string, string | undefined>,
) {
  const maxInfrastructureAttempts = process.platform === "win32" ? 3 : 1;
  for (let attempt = 1; attempt <= maxInfrastructureAttempts; attempt += 1) {
    try {
      await run(["bun", "run", "test:e2e", ...playwrightArguments], {
        cwd: webRoot,
        env: environment,
      });
      return;
    } catch (error) {
      const workerExited = server !== undefined && server.exitCode !== null;
      if (!workerExited || attempt === maxInfrastructureAttempts) throw error;
      console.warn(
        `Wrangler exited during Playwright batch; restarting local runtime (attempt ${attempt + 1}/${maxInfrastructureAttempts}).`,
      );
      await stopServer();
      await startServer();
    }
  }
}

async function isolatedWindowsPlaywrightRuns(
  playwrightArguments: string[],
  environment: Record<string, string | undefined>,
) {
  if (
    process.platform !== "win32" ||
    invocation.playwrightArguments.length > 0
  ) {
    return [playwrightArguments];
  }
  const output = await run(
    ["bun", "run", "test:e2e", ...playwrightArguments, "--list"],
    { capture: true, cwd: webRoot, env: environment },
  );
  const tests = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\[[^\]]+\]\s*[>›]/u.test(line));
  if (tests.length === 0) {
    throw new Error("Playwright did not report any tests for local isolation.");
  }
  return Promise.all(
    tests.map(async (testName, index) => {
      const path = join(
        persistenceDirectory,
        `playwright-test-${index + 1}.list.txt`,
      );
      await writeFile(path, `${testName}\n`, "utf8");
      return [...playwrightArguments, `--test-list=${path}`];
    }),
  );
}

try {
  await run(["bun", "run", "--cwd", "apps/web", "build:e2e"], {
    env: { SITE_ID: source === "root" ? "" : manifest.id },
  });
  await writeFile(
    wranglerConfigPath,
    JSON.stringify(
      localE2eWranglerConfig(manifest, {
        assets: resolve(webRoot, "dist/client"),
        main: resolve(webRoot, "dist/server/index.js"),
        migrations: resolve(repoRoot, "packages/db/src/migrations"),
      }),
      null,
      2,
    ),
    "utf8",
  );
  await run(
    [
      "node",
      wranglerBin,
      "d1",
      "migrations",
      "apply",
      resources.database,
      "--local",
      "--persist-to",
      persistenceDirectory,
      "--config",
      wranglerConfigPath,
    ],
    { capture: true, cwd: repoRoot },
  );
  const seedFiles =
    source === "root"
      ? ["packages/db/seeds/posts.sql", "packages/db/seeds/home.sql"]
      : [`sites/${manifest.id}/seed.sql`];
  for (const seedFile of seedFiles) {
    await executeSqlFile(seedFile, persistenceDirectory, wranglerConfigPath);
  }
  await verifyFreshHomepageSeed(persistenceDirectory, wranglerConfigPath);
  const [adminHash, editorHash, ownerHash, adminTwoFactor, ownerTwoFactor] =
    await Promise.all([
      passwordHash(adminPassword),
      passwordHash(editorPassword),
      passwordHash(ownerPassword),
      twoFactorFixture(adminTotpSecret),
      twoFactorFixture(ownerTotpSecret),
    ]);
  await executeSql(
    `${cleanupSql}
INSERT INTO user (id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES ('${adminId}','CMS E2E','${adminEmail}',1,1,unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('cms-e2e-account','${adminId}','credential','${adminId}','${escapeSql(adminHash)}',unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO two_factor (id,secret,backup_codes,user_id,verified,failed_verification_count) VALUES ('cms-e2e-two-factor','${escapeSql(adminTwoFactor.secret)}','${escapeSql(adminTwoFactor.backupCodes)}','${adminId}',1,0);
INSERT INTO staff_roles (user_id,role,assigned_by,created_at,updated_at) VALUES ('${adminId}','admin','e2e-bootstrap',unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('${editorId}','CMS E2E Editor','${editorEmail}',1,unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('cms-e2e-editor-account','${editorId}','credential','${editorId}','${escapeSql(editorHash)}',unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO staff_roles (user_id,role,assigned_by,created_at,updated_at) VALUES ('${editorId}','editor','e2e-bootstrap',unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO user (id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES ('${ownerId}','CMS E2E Owner','${ownerEmail}',1,1,unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('cms-e2e-owner-account','${ownerId}','credential','${ownerId}','${escapeSql(ownerHash)}',unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);
INSERT INTO two_factor (id,secret,backup_codes,user_id,verified,failed_verification_count) VALUES ('cms-e2e-owner-two-factor','${escapeSql(ownerTwoFactor.secret)}','${escapeSql(ownerTwoFactor.backupCodes)}','${ownerId}',1,0);
INSERT INTO staff_roles (user_id,role,assigned_by,created_at,updated_at) VALUES ('${ownerId}','owner','e2e-bootstrap',unixepoch('subsecond')*1000,unixepoch('subsecond')*1000);`,
    persistenceDirectory,
    wranglerConfigPath,
  );

  await startServer();
  await run(["bun", "run", "smoke:migration"], {
    cwd: repoRoot,
    env: {
      SMOKE_BASE_URL: "http://127.0.0.1:3020",
    },
  });
  const playwrightRuns = localE2ePlaywrightRuns(invocation.playwrightArguments);
  const playwrightEnvironment = {
    CMS_E2E_EMAIL: adminEmail,
    CMS_E2E_PASSWORD: adminPassword,
    CMS_E2E_TOTP_SECRET: adminTotpSecret,
    CMS_E2E_EDITOR_EMAIL: editorEmail,
    CMS_E2E_EDITOR_PASSWORD: editorPassword,
    CMS_E2E_OWNER_EMAIL: ownerEmail,
    CMS_E2E_OWNER_PASSWORD: ownerPassword,
    CMS_E2E_OWNER_TOTP_SECRET: ownerTotpSecret,
    CMS_E2E_MANAGED_EMAIL: managedEmail,
    CMS_E2E_BASE_URL: "http://127.0.0.1:3020",
    CMS_E2E_EXPECTED_SITE_ID: manifest.id,
    CMS_E2E_EXPECTED_SITE_NAME: manifest.name,
    CMS_E2E_AUTH_STATE_DIR: persistenceDirectory,
  };
  let runIndex = 0;
  for (const playwrightArguments of playwrightRuns) {
    const batches = await isolatedWindowsPlaywrightRuns(
      playwrightArguments,
      playwrightEnvironment,
    );
    for (const batch of batches) {
      if (runIndex > 0) {
        await stopServer();
        await startServer();
      }
      await runPlaywright(batch, playwrightEnvironment);
      runIndex += 1;
    }
  }
} finally {
  await stopServer();
  await rm(
    assertSafeE2eStateDirectory(persistenceDirectory, temporaryDirectory),
    {
      force: true,
      maxRetries: 10,
      recursive: true,
      retryDelay: 100,
    },
  );
}
