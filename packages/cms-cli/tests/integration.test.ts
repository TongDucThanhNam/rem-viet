import { describe, expect, test } from "bun:test";

import {
  CMS_INTEGRATION_RECEIPT_PATH,
  cmsIntegrationSha256,
  cmsIntegrationTextSha256,
  parseCmsIntegrationReceipt,
} from "../src";
import { runCmsCli, type CmsCliCommandPorts } from "../src/command";

const integrationFiles = [
  "agency-cms.config.json",
  ".env.cms.example",
  "src/cms/collections.ts",
  "src/cms/provider.server.ts",
  "src/cms/integration.server.ts",
  "src/cms/handler.server.ts",
  "src/cms/migrate.server.ts",
  "src/routes/api/cms/$.ts",
  "src/routes/api/cms/health.ts",
  "src/routes/admin/cms.tsx",
  "cms/migrations/README.md",
] as const;

const fixtureProvider = Object.freeze({
  cmsIntegrationProvider: Object.freeze({
    schemaVersion: 1,
    id: "fixture",
    packageName: "@agency/cms-provider-fixture",
    packageVersion: "0.1.0",
    capabilities: Object.freeze({
      schedule: true,
      media: false,
      webhook: false,
      release: false,
      localization: true,
      transaction: true,
      search: false,
    }),
    diagnostics: Object.freeze({
      databaseBinding: "CMS_DB",
      authenticationEnvironment: null,
      databaseConfigFiles: Object.freeze(["wrangler.jsonc"]),
    }),
    files: Object.freeze(
      integrationFiles.map((path) =>
        Object.freeze({ path, content: `// generated fixture: ${path}\n` }),
      ),
    ),
  }),
});

function fixture() {
  const originalPackage = {
    name: "existing-tanstack-app",
    private: true,
    scripts: { dev: "vite dev", build: "vite build" },
    dependencies: {
      "@tanstack/react-router": "^1.168.22",
      "@tanstack/react-start": "^1.167.41",
      "better-auth": "1.6.27",
      react: "^19.2.0",
    },
  };
  const files = new Map<string, string>([
    ["package.json", `${JSON.stringify(originalPackage, null, 2)}\n`],
    [
      "src/routes/__root.tsx",
      'import { createRootRoute } from "@tanstack/react-router";\n',
    ],
    [
      "wrangler.jsonc",
      '{ "d1_databases": [{ "binding": "CMS_DB", "database_name": "fixture" }] }\n',
    ],
  ]);
  const output: string[] = [];
  let installs = 0;
  const ports: CmsCliCommandPorts = {
    read: async (path) => files.get(path) ?? null,
    write: async (path, content) => {
      if (files.has(path)) throw new Error(`exists: ${path}`);
      files.set(path, content);
    },
    replace: async (path, content) => {
      if (!files.has(path)) throw new Error(`missing: ${path}`);
      files.set(path, content);
    },
    remove: async (path) => {
      if (!files.delete(path)) throw new Error(`missing: ${path}`);
    },
    install: async () => {
      installs += 1;
      for (const name of [
        "@agency/cms-admin",
        "@agency/cms-cli",
        "@agency/cms-core",
        "@agency/cms-provider-fixture",
        "@agency/cms-runtime",
        "@agency/cms-visual-editor",
      ]) {
        files.set(`node_modules/${name}/package.json`, "{}\n");
      }
    },
    importIntegrationProvider: async () => fixtureProvider,
    importTemplateInitializer: async () => ({}),
    importMigrationDriver: async () => ({}),
    output: (value) => output.push(value),
  };
  return {
    files,
    get installs() {
      return installs;
    },
    originalPackage,
    output,
    ports,
  };
}

describe("TanStack Start CMS integration", () => {
  test("hashes receipt content with the standard SHA-256 algorithm", () => {
    expect(cmsIntegrationSha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("normalizes only Git line-ending rewrites for managed text receipts", () => {
    expect(cmsIntegrationTextSha256("first\r\nsecond\r\n")).toBe(
      cmsIntegrationTextSha256("first\nsecond\n"),
    );
    expect(cmsIntegrationTextSha256("first\nchanged\n")).not.toBe(
      cmsIntegrationTextSha256("first\nsecond\n"),
    );
  });

  test("dry-runs, applies, diagnoses, reruns, and removes without replacing app code", async () => {
    const state = fixture();
    const args = [
      "add",
      "--framework=tanstack-start",
      "--provider=fixture",
    ] as const;

    const dryRun = await runCmsCli([...args, "--dry-run"], state.ports);
    expect(dryRun).toMatchObject({
      ok: true,
      command: "add",
      dryRun: true,
      packageJson: "would-update",
      install: "would-run",
    });
    expect(state.files.has(CMS_INTEGRATION_RECEIPT_PATH)).toBe(false);
    expect(state.files.has("src/cms/collections.ts")).toBe(false);

    const applied = await runCmsCli(args, state.ports);
    expect(applied).toMatchObject({
      ok: true,
      command: "add",
      dryRun: false,
      packageJson: "updated",
      install: "completed",
    });
    expect(state.installs).toBe(1);
    const receipt = parseCmsIntegrationReceipt(
      JSON.parse(state.files.get(CMS_INTEGRATION_RECEIPT_PATH)!),
    );
    expect(receipt.managedFiles.length).toBe(11);
    expect(
      receipt.managedFiles.every(({ path, sha256 }) => {
        const source = state.files.get(path);
        return (
          source !== undefined && cmsIntegrationTextSha256(source) === sha256
        );
      }),
    ).toBe(true);

    const manifest = JSON.parse(state.files.get("package.json")!);
    expect(manifest.scripts).toMatchObject({
      dev: "vite dev",
      build: "vite build",
      "cms:diagnose": "agency-cms diagnose",
    });
    expect(manifest.dependencies).toMatchObject({
      "@agency/cms-core": "0.1.0",
      "@agency/cms-provider-fixture": "0.1.0",
    });
    expect(JSON.stringify([...state.files.values()])).not.toContain("@sanity/");
    expect(JSON.stringify([...state.files.values()])).not.toContain("SANITY_");

    for (const { path } of receipt.managedFiles) {
      state.files.set(path, state.files.get(path)!.replace(/\n/g, "\r\n"));
    }

    await expect(runCmsCli(args, state.ports)).resolves.toMatchObject({
      packageJson: "unchanged",
      install: "not-needed",
    });
    expect(state.installs).toBe(1);
    await expect(runCmsCli(["diagnose"], state.ports)).resolves.toMatchObject({
      ok: true,
      ready: true,
      command: "diagnose",
    });

    state.files.set(
      "package.json",
      `${JSON.stringify(
        {
          ...JSON.parse(state.files.get("package.json")!),
          dependencies: {
            ...JSON.parse(state.files.get("package.json")!).dependencies,
            "consumer-owned": "1.0.0",
          },
        },
        null,
        2,
      )}\n`,
    );
    await expect(
      runCmsCli(["remove", "--dry-run"], state.ports),
    ).resolves.toMatchObject({
      ok: true,
      dryRun: true,
      packageJson: "would-update",
      install: "would-run",
    });
    expect(state.files.has("src/cms/collections.ts")).toBe(true);

    await expect(runCmsCli(["remove"], state.ports)).resolves.toMatchObject({
      ok: true,
      dryRun: false,
      packageJson: "updated",
      install: "completed",
    });
    expect(state.installs).toBe(2);
    expect(state.files.has(CMS_INTEGRATION_RECEIPT_PATH)).toBe(false);
    expect(state.files.has("src/cms/collections.ts")).toBe(false);
    const removedManifest = JSON.parse(state.files.get("package.json")!);
    expect(removedManifest.dependencies).toMatchObject({
      ...state.originalPackage.dependencies,
      "consumer-owned": "1.0.0",
    });
    expect(removedManifest.dependencies["@agency/cms-core"]).toBeUndefined();
    expect(removedManifest.scripts).toEqual(state.originalPackage.scripts);
  });

  test("fails closed for the wrong framework, divergent files, and modified removal targets", async () => {
    const state = fixture();
    await expect(
      runCmsCli(
        ["add", "--framework=react", "--provider=fixture"],
        state.ports,
      ),
    ).rejects.toThrow(/only --framework=tanstack-start/i);

    state.files.set("src/cms/collections.ts", "consumer owned\n");
    await expect(
      runCmsCli(
        ["add", "--framework=tanstack-start", "--provider=fixture"],
        state.ports,
      ),
    ).rejects.toThrow(/refusing to overwrite divergent file/i);
    expect(state.files.has(CMS_INTEGRATION_RECEIPT_PATH)).toBe(false);

    state.files.delete("src/cms/collections.ts");
    await runCmsCli(
      ["add", "--framework=tanstack-start", "--provider=fixture"],
      state.ports,
    );
    state.files.set("src/cms/collections.ts", "customized\n");
    await expect(runCmsCli(["remove"], state.ports)).rejects.toThrow(
      /refusing to remove modified cms file/i,
    );
    expect(state.files.has(CMS_INTEGRATION_RECEIPT_PATH)).toBe(true);
  });

  test("reports missing auth and D1 binding as actionable diagnostics", async () => {
    const state = fixture();
    const manifest = JSON.parse(state.files.get("package.json")!);
    delete manifest.dependencies["better-auth"];
    state.files.set("package.json", `${JSON.stringify(manifest, null, 2)}\n`);
    state.files.delete("wrangler.jsonc");
    await runCmsCli(
      ["add", "--framework=tanstack-start", "--provider=fixture"],
      state.ports,
    );
    const result = await runCmsCli(["diagnose"], state.ports);
    expect(result).toMatchObject({ ok: true, ready: false });
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "authentication", status: "attention" }),
        expect.objectContaining({
          id: "database-binding",
          status: "attention",
        }),
      ]),
    );
  });
});
