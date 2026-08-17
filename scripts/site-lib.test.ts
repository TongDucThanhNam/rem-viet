import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { resolveDeploymentOrigin } from "../packages/cms/src/site-manifest";

import {
  alchemySiteCommand,
  envExample,
  handoverChecklist,
  logoPlaceholderSvg,
  manifestFor,
  readSiteManifest,
  removePrivateEnvBinding,
  seedSql,
  validateClientEnvExample,
  validateSiteDeployModeFlags,
  writeIfAbsent,
  writeJsonIfAbsent,
  writePreservingExisting,
} from "./site-lib";

const testDirectory = await mkdtemp(join(tmpdir(), "rem-viet-site-lib-"));

afterAll(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

describe("site provisioning contracts", () => {
  test("removes one private bootstrap binding without reading or rewriting others", () => {
    expect(
      removePrivateEnvBinding(
        "BETTER_AUTH_SECRET=keep\r\nCMS_BOOTSTRAP_PASSWORD=remove\r\nADMIN_EMAILS=keep\r\n",
        "CMS_BOOTSTRAP_PASSWORD",
      ),
    ).toEqual({
      contents: "BETTER_AUTH_SECRET=keep\r\nADMIN_EMAILS=keep\r\n",
      removed: true,
    });
    expect(
      removePrivateEnvBinding(
        "BETTER_AUTH_SECRET=keep\n",
        "CMS_BOOTSTRAP_PASSWORD",
      ),
    ).toEqual({ contents: "BETTER_AUTH_SECRET=keep\n", removed: false });
    expect(() =>
      removePrivateEnvBinding(
        "CMS_BOOTSTRAP_PASSWORD=first\nCMS_BOOTSTRAP_PASSWORD=second\n",
        "CMS_BOOTSTRAP_PASSWORD",
      ),
    ).toThrow(/duplicate private env binding/);
  });

  test("builds explicit plan and non-interactive deploy commands", () => {
    expect(
      alchemySiteCommand({ stage: "staging", plan: true, yes: true }),
    ).toEqual([
      "bun",
      "run",
      "--cwd",
      "packages/infra",
      "plan",
      "--stage",
      "staging",
    ]);
    expect(
      alchemySiteCommand({ stage: "production", plan: false, yes: true }),
    ).toEqual([
      "bun",
      "run",
      "--cwd",
      "packages/infra",
      "deploy",
      "--stage",
      "production",
      "--yes",
    ]);
  });

  test("rejects ambiguous deployment inspection modes", () => {
    expect(() =>
      validateSiteDeployModeFlags({
        dryRun: true,
        plan: true,
        preflight: false,
      }),
    ).toThrow(/--dry-run, --plan.*--preflight/);
    expect(() =>
      validateSiteDeployModeFlags({
        dryRun: false,
        plan: false,
        preflight: false,
      }),
    ).not.toThrow();
  });

  test("rejects path traversal before reading a site manifest", async () => {
    await expect(readSiteManifest("../unsafe")).rejects.toThrow(
      /safe client slug/,
    );
  });

  test("builds an isolated manifest and rejects unsafe client ids", () => {
    const manifest = manifestFor("acme-studio", "catalog");

    expect(manifest.infrastructure).toEqual({
      alchemyApp: "acme-studio",
      workerName: "acme-studio-web",
      d1Name: "acme-studio-db",
      r2BucketName: "acme-studio-media",
      backupBucketName: "acme-studio-backups",
    });
    expect(manifest.features).toMatchObject({
      blog: true,
      catalog: true,
      orders: true,
      leads: true,
    });
    expect(manifest.brand.logo).toBe("/assets/acme-studio-logo.svg");
    expect(() => manifestFor("../unsafe", "showcase")).toThrow();
  });

  test("generates an idempotent, client-branded demo seed", () => {
    const manifest = manifestFor("acme-studio", "showcase");
    const sql = seedSql(manifest);
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE pages (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        template TEXT NOT NULL,
        blocks TEXT NOT NULL,
        status TEXT NOT NULL,
        seo_title TEXT,
        seo_description TEXT,
        canonical_url TEXT,
        og_image TEXT,
        version INTEGER NOT NULL,
        updated_by TEXT,
        published_revision_id TEXT,
        published_at INTEGER
      );
      CREATE TABLE page_revisions (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        note TEXT,
        created_by TEXT
      );
      CREATE TABLE form_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        fields TEXT NOT NULL,
        notification_settings TEXT NOT NULL,
        active INTEGER NOT NULL,
        retention_days INTEGER NOT NULL
      );
    `);

    database.exec(sql);
    database.exec(sql);

    expect(database.query("SELECT COUNT(*) AS total FROM pages").get()).toEqual(
      { total: 1 },
    );
    expect(
      database.query("SELECT COUNT(*) AS total FROM page_revisions").get(),
    ).toEqual({ total: 1 });
    expect(
      database.query("SELECT COUNT(*) AS total FROM form_definitions").get(),
    ).toEqual({ total: 1 });
    expect(sql).toContain("Acme Studio");
    expect(sql).not.toMatch(/Rèm Vina|Rèm Việt|rem-viet-(?:web|db|media)/i);
    database.close();
  });

  test("does not write during dry-run or overwrite divergent files", async () => {
    const target = join(testDirectory, "site", "site.manifest.json");

    expect(await writeIfAbsent(target, "first\n", true)).toBe("created");
    expect(existsSync(target)).toBe(false);
    expect(await writeIfAbsent(target, "first\n", false)).toBe("created");
    expect(await readFile(target, "utf8")).toBe("first\n");
    expect(await writeIfAbsent(target, "first\n", false)).toBe("unchanged");
    await expect(writeIfAbsent(target, "second\n", false)).rejects.toThrow(
      /Refusing to overwrite/,
    );

    expect(await writePreservingExisting(target, "second\n", false)).toBe(
      "preserved",
    );
    expect(await readFile(target, "utf8")).toBe("first\n");

    const jsonTarget = join(testDirectory, "site", "site.manifest.json");
    await Bun.write(jsonTarget, '{\n  "name": "Acme",\n  "items": [1, 2]\n}\n');
    expect(
      await writeJsonIfAbsent(
        jsonTarget,
        '{"name":"Acme","items":[1,2]}\n',
        false,
      ),
    ).toBe("unchanged");
    await expect(
      writeJsonIfAbsent(jsonTarget, '{"name":"Other","items":[1,2]}\n', false),
    ).rejects.toThrow(/different content/);
  });

  test("emits the complete per-site private environment checklist", () => {
    const example = envExample(manifestFor("acme-studio", "portfolio"));

    for (const key of [
      "CORS_ORIGIN",
      "BETTER_AUTH_URL",
      "BETTER_AUTH_SECRET",
      "ADMIN_EMAILS",
      "CMS_BOOTSTRAP_PASSWORD",
      "RESEND_API_KEY",
      "LEAD_NOTIFICATION_EMAIL",
      "EMAIL_FROM",
      "JSONLINK_API_KEY",
      "RUM_SAMPLE_RATE",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_DATABASE_ID",
      "CLOUDFLARE_D1_TOKEN",
    ]) {
      expect(example).toContain(`${key}=`);
    }
    expect(() =>
      validateClientEnvExample(
        manifestFor("acme-studio", "portfolio"),
        example,
      ),
    ).not.toThrow();
  });

  test("rejects unsafe, divergent or ambiguous client env templates", () => {
    const manifest = manifestFor("acme-studio", "portfolio");
    const example = envExample(manifest);

    expect(() =>
      validateClientEnvExample(
        manifest,
        example.replace("BETTER_AUTH_SECRET=", "BETTER_AUTH_SECRET=committed"),
      ),
    ).toThrow(/must remain empty/);
    expect(() =>
      validateClientEnvExample(
        manifest,
        example.replace(
          "BETTER_AUTH_URL=https://acme-studio.example.com",
          "BETTER_AUTH_URL=https://other.example.com",
        ),
      ),
    ).toThrow(/must match manifest/);
    expect(() =>
      validateClientEnvExample(
        manifest,
        `${example}RESEND_API_KEY=duplicate\n`,
      ),
    ).toThrow(/Duplicate RESEND_API_KEY/);
    expect(() =>
      validateClientEnvExample(
        manifest,
        example.replace(/^JSONLINK_API_KEY=\r?\n/m, ""),
      ),
    ).toThrow(/Missing .env.example keys: JSONLINK_API_KEY/);
    expect(() =>
      validateClientEnvExample(manifest, `${example}UNREVIEWED_SECRET=value\n`),
    ).toThrow(/Unexpected .env.example keys: UNREVIEWED_SECRET/);
  });

  test("keeps the checked-in manifest, env and handover generator-converged", async () => {
    const manifest = manifestFor("acme-demo", "showcase");
    const directory = join(import.meta.dir, "..", "sites", "acme-demo");

    expect(
      JSON.parse(await readFile(join(directory, "site.manifest.json"), "utf8")),
    ).toEqual(manifest);
    expect(await readFile(join(directory, ".env.example"), "utf8")).toBe(
      envExample(manifest),
    );
    expect(await readFile(join(directory, "HANDOVER.md"), "utf8")).toBe(
      handoverChecklist(manifest),
    );
    expect(
      await readFile(
        join(
          import.meta.dir,
          "..",
          "apps",
          "web",
          "public",
          "assets",
          "acme-demo-logo.svg",
        ),
        "utf8",
      ),
    ).toBe(logoPlaceholderSvg(manifest));
  });

  test("requires an explicit, origin-only HTTPS URL for staging", () => {
    expect(() =>
      resolveDeploymentOrigin({
        stage: "staging",
        siteUrl: "https://acme.example.com",
      }),
    ).toThrow(/explicit HTTPS origin/);
    expect(
      resolveDeploymentOrigin({
        stage: "staging",
        siteUrl: "https://acme.example.com",
        explicitOrigin: "https://acme-web-staging.example.workers.dev/",
      }),
    ).toBe("https://acme-web-staging.example.workers.dev");
    expect(() =>
      resolveDeploymentOrigin({
        stage: "staging",
        siteUrl: "https://acme.example.com",
        explicitOrigin: "https://example.com/admin?unsafe=1",
      }),
    ).toThrow(/must not include/);
    expect(() =>
      resolveDeploymentOrigin({
        stage: "staging",
        siteUrl: "https://acme.example.com",
        explicitOrigin: "http://acme.test",
      }),
    ).toThrow(/must use HTTPS/);
  });

  test("locks production auth origin to the manifest domain", () => {
    expect(
      resolveDeploymentOrigin({
        stage: "production",
        siteUrl: "https://acme.example.com/",
      }),
    ).toBe("https://acme.example.com");
    expect(() =>
      resolveDeploymentOrigin({
        stage: "production",
        siteUrl: "https://acme.example.com",
        explicitOrigin: "https://other.example.com",
      }),
    ).toThrow(/must match manifest siteUrl/);
  });
});
