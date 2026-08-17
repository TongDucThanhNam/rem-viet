import { describe, expect, test } from "bun:test";

import {
  applyCmsFilePlan,
  CmsCliMigrationExecutionError,
  createCmsBlockScaffoldPlan,
  createCmsMigrationPlan,
  createCmsSiteBootstrapPlan,
  createCmsSiteInitPlan,
  executeCmsMigrationPlan,
  migrateCmsValue,
  parseCmsSiteInitPlan,
  rollbackCmsMigration,
  verifyCmsSiteArtifacts,
} from "../src";
import { runCmsCli } from "../src/command";

function canonicalManifest(siteId = "acme-demo") {
  return {
    schemaVersion: 1,
    id: siteId,
    name: "Acme Demo",
    siteUrl: "https://acme.example",
    kit: {
      version: "0.1.0",
      template: "@agency/template-showcase",
      provider: "edge-native",
      contentSchemaVersion: 1,
    },
    defaultLocale: "vi-VN",
    locales: ["vi-VN"],
    preset: "showcase",
    brand: {
      logo: "/logo.svg",
      colors: { primary: "#111111" },
      fonts: ["Inter"],
    },
    features: { blog: true, media: true },
    infrastructure: {
      adapter: "edge-composition",
      alchemyApp: siteId,
      workerName: `${siteId}-web`,
      d1Name: `${siteId}-db`,
      r2BucketName: `${siteId}-media`,
      backupBucketName: `${siteId}-backups`,
    },
  };
}

function templateBootstrapPlan(input: {
  siteId: string;
  name: string;
  siteUrl: string;
  preset: string;
  provider: string;
  defaultLocale: string;
  features: readonly string[] | undefined;
}) {
  const base = canonicalManifest(input.siteId);
  const manifest = {
    ...base,
    name: input.name,
    siteUrl: input.siteUrl,
    kit: {
      ...base.kit,
      template: "@agency/template-showcase",
      provider: input.provider,
    },
    defaultLocale: input.defaultLocale,
    locales: [input.defaultLocale],
    preset: input.preset,
    features: Object.fromEntries(
      (input.features ?? ["blog", "media"]).map((feature) => [feature, true]),
    ),
  };
  return createCmsSiteBootstrapPlan({
    siteId: input.siteId,
    requiredSecrets: ["BETTER_AUTH_SECRET", "ADMIN_EMAILS"],
    files: [
      {
        path: "site.manifest.json",
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        mode: "json-exact",
      },
      {
        path: "HANDOVER.md",
        content: "# Handover\n",
        mode: "preserve",
      },
    ],
  });
}

describe("CMS CLI library", () => {
  test("applies init plans idempotently and preserves client customization", async () => {
    const files = new Map<string, string>();
    const plan = createCmsSiteInitPlan({
      siteId: "acme-demo",
      files: [
        {
          path: "sites/acme-demo/site.manifest.json",
          content: '{"id":"acme-demo"}\n',
          mode: "json-exact",
        },
        {
          path: "sites/acme-demo/HANDOVER.md",
          content: "generated\n",
          mode: "preserve",
        },
      ],
    });
    const filesystem = {
      read: async (path: string) => files.get(path) ?? null,
      write: async (path: string, content: string) => {
        files.set(path, content);
      },
    };
    expect(await applyCmsFilePlan(plan, filesystem)).toEqual([
      { path: "sites/acme-demo/site.manifest.json", status: "created" },
      { path: "sites/acme-demo/HANDOVER.md", status: "created" },
    ]);
    files.set("sites/acme-demo/HANDOVER.md", "customized\n");
    expect(await applyCmsFilePlan(plan, filesystem)).toEqual([
      { path: "sites/acme-demo/site.manifest.json", status: "unchanged" },
      { path: "sites/acme-demo/HANDOVER.md", status: "preserved" },
    ]);
  });

  test("binds a canonical manifest and secret checklist in bootstrap plans", () => {
    const manifest = canonicalManifest();
    const plan = createCmsSiteBootstrapPlan({
      siteId: "acme-demo",
      requiredSecrets: ["BETTER_AUTH_SECRET", "ADMIN_EMAILS"],
      files: [
        {
          path: "site.manifest.json",
          content: `${JSON.stringify(manifest, null, 2)}\n`,
          mode: "json-exact",
        },
      ],
    });
    expect(plan).toMatchObject({
      schemaVersion: 2,
      operation: "init",
      siteId: "acme-demo",
      manifest,
      requiredSecrets: ["BETTER_AUTH_SECRET", "ADMIN_EMAILS"],
    });
    expect(() =>
      createCmsSiteBootstrapPlan({
        siteId: "other-site",
        requiredSecrets: [],
        files: plan.files,
      }),
    ).toThrow(/manifest id must match/i);
    expect(() =>
      parseCmsSiteInitPlan({
        ...plan,
        manifest: { ...manifest, kit: { ...manifest.kit, version: "latest" } },
      }),
    ).toThrow();
    expect(() =>
      createCmsSiteBootstrapPlan({
        siteId: "acme-demo",
        requiredSecrets: ["bad-secret"],
        files: plan.files,
      }),
    ).toThrow(/secret name is invalid/i);
  });

  test("creates safe block scaffolds and applies contiguous migrations", () => {
    const plan = createCmsBlockScaffoldPlan({
      siteId: "acme-demo",
      directory: "src/blocks",
      type: "testimonialGrid",
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      "src/blocks/testimonialGrid/contract.ts",
      "src/blocks/testimonialGrid/defaults.ts",
      "src/blocks/testimonialGrid/migrations.ts",
      "src/blocks/testimonialGrid/seed.ts",
      "src/blocks/testimonialGrid/renderer.tsx",
      "src/blocks/testimonialGrid/editor.tsx",
      "src/blocks/testimonialGrid/registry.ts",
      "src/blocks/testimonialGrid/index.ts",
      "src/blocks/testimonialGrid/block.manifest.json",
      "src/blocks/testimonialGrid/REGISTER.md",
    ]);
    expect(plan.files[0]?.content).toContain(
      "createCmsBlockSchema(\n  TESTIMONIAL_GRID_BLOCK_TYPE",
    );
    expect(plan.files[2]?.content).toContain("testimonialGridBlockMigrations");
    expect(plan.files[3]?.content).toContain("createTestimonialGridSeedBlock");
    expect(plan.files[6]?.content).toContain(
      "testimonialGridBlockEditorDefinition",
    );
    expect(() =>
      createCmsBlockScaffoldPlan({
        siteId: "acme-demo",
        directory: "../outside",
        type: "hero",
      }),
    ).toThrow(/safe and relative/);

    const migrated = migrateCmsValue({
      value: { title: "Before" },
      currentVersion: 1,
      targetVersion: 3,
      migrations: [
        { from: 1, to: 2, migrate: (value) => ({ ...value, title: "Two" }) },
        { from: 2, to: 3, migrate: (value) => ({ ...value, title: "Three" }) },
      ],
    });
    expect(migrated).toEqual({
      value: { title: "Three" },
      version: 3,
      applied: [2, 3],
    });
  });

  test("verifies required artifacts, unique resources, and brand isolation", () => {
    expect(
      verifyCmsSiteArtifacts({
        siteId: "acme-demo",
        files: ["site.manifest.json", "seed.sql"],
        requiredFiles: ["site.manifest.json", "seed.sql"],
        resources: { worker: "acme-web", database: "acme-db" },
        forbiddenContent: [/Legacy Brand/i],
        content: "Acme Demo",
      }),
    ).toEqual({
      ok: true,
      siteId: "acme-demo",
      fileCount: 2,
      resourceCount: 2,
    });
  });

  test("runs init, add-block, verify, migrate and rollback as a packaged command surface", async () => {
    const files = new Map<string, string>();
    const output: string[] = [];
    let version = 1;
    const migrationDriver = {
      inspectVersion: async () => version,
      createBackup: async () => ({
        locator: "memory:acme-v1",
        sha256: "a".repeat(64),
        bytes: 64,
      }),
      applyStep: async (step: { to: number }) => {
        version = step.to;
      },
      restoreBackup: async () => {
        version = 1;
      },
    };
    const ports = {
      read: async (path: string) => files.get(path) ?? null,
      write: async (path: string, content: string) => {
        if (files.has(path)) throw new Error(`exists: ${path}`);
        files.set(path, content);
      },
      importTemplateInitializer: async () => ({
        cmsTemplateInitializer: {
          schemaVersion: 1,
          id: "@agency/template-showcase",
          version: "0.1.0",
          createPlan: templateBootstrapPlan,
        },
      }),
      importMigrationDriver: async () => ({ migrationDriver }),
      environment: { BETTER_AUTH_SECRET: "configured" },
      output: (value: string) => output.push(value),
    };
    const planInitArgs = [
      "plan-init",
      "--template=@agency/template-showcase",
      "--site=acme-demo",
      "--name=Acme Demo",
      "--site-url=https://acme.example",
      "--preset=showcase",
      "--provider=edge-native",
      "--features=blog,media",
      "--output=plans/init.json",
    ] as const;
    const planDryRun = await runCmsCli([...planInitArgs, "--dry-run"], ports);
    expect(planDryRun).toMatchObject({
      command: "plan-init",
      status: "would-create",
      template: "@agency/template-showcase",
      templateVersion: "0.1.0",
      fileCount: 2,
    });
    expect(files.has("plans/init.json")).toBe(false);
    await expect(runCmsCli(planInitArgs, ports)).resolves.toMatchObject({
      status: "created",
    });
    await expect(runCmsCli(planInitArgs, ports)).resolves.toMatchObject({
      status: "unchanged",
    });
    const generatedPlan = files.get("plans/init.json") ?? "";
    files.set("plans/init.json", '{"divergent":true}\n');
    await expect(runCmsCli(planInitArgs, ports)).rejects.toThrow(
      /Refusing to overwrite divergent file/,
    );
    files.set("plans/init.json", generatedPlan);
    await expect(
      runCmsCli(
        planInitArgs.map((value) =>
          value === "--features=blog,media" ? "--features=blog,blog" : value,
        ),
        ports,
      ),
    ).rejects.toThrow(/unique comma-separated identifier list/);
    await expect(
      runCmsCli(
        planInitArgs.map((value) =>
          value === "--output=plans/init.json"
            ? "--output=plans/mismatch.json"
            : value,
        ),
        {
          ...ports,
          importTemplateInitializer: async () => ({
            cmsTemplateInitializer: {
              schemaVersion: 1,
              id: "@agency/template-showcase",
              version: "0.1.0",
              createPlan: (
                input: Parameters<typeof templateBootstrapPlan>[0],
              ) => templateBootstrapPlan({ ...input, name: "Wrong Client" }),
            },
          }),
        },
      ),
    ).rejects.toThrow(/does not match the requested bootstrap inputs/);
    const initDryRun = await runCmsCli(
      ["init", "--plan=plans/init.json", "--dry-run"],
      ports,
    );
    expect(initDryRun).toMatchObject({
      planSchemaVersion: 2,
      requiredSecrets: ["BETTER_AUTH_SECRET", "ADMIN_EMAILS"],
      missingSecrets: ["ADMIN_EMAILS"],
    });
    expect(files.has("site.manifest.json")).toBe(false);
    await runCmsCli(["init", "--plan=plans/init.json"], ports);
    const addResult = await runCmsCli(
      [
        "add-block",
        "--site=acme-demo",
        "--type=testimonialGrid",
        "--directory=src/blocks",
      ],
      ports,
    );
    expect(addResult).toMatchObject({
      ok: true,
      command: "add-block",
      siteId: "acme-demo",
    });
    expect(files.has("src/blocks/testimonialGrid/contract.ts")).toBe(true);
    expect(files.has("src/blocks/testimonialGrid/defaults.ts")).toBe(true);
    expect(files.has("src/blocks/testimonialGrid/migrations.ts")).toBe(true);
    expect(files.has("src/blocks/testimonialGrid/seed.ts")).toBe(true);
    expect(files.has("src/blocks/testimonialGrid/registry.ts")).toBe(true);
    expect(files.has("src/blocks/testimonialGrid/block.manifest.json")).toBe(
      true,
    );
    const repeatedAdd = await runCmsCli(
      [
        "add-block",
        "--site=acme-demo",
        "--type=testimonialGrid",
        "--directory=src/blocks",
      ],
      ports,
    );
    expect(
      repeatedAdd.results.every((result) => result.status === "unchanged"),
    ).toBe(true);
    files.set(
      "src/blocks/testimonialGrid/renderer.tsx",
      "// client-owned divergent renderer\n",
    );
    await expect(
      runCmsCli(
        [
          "add-block",
          "--site=acme-demo",
          "--type=testimonialGrid",
          "--directory=src/blocks",
        ],
        ports,
      ),
    ).rejects.toThrow(/Refusing to overwrite divergent file/);

    files.set(
      "plans/verify.json",
      JSON.stringify({
        schemaVersion: 1,
        operation: "verify",
        siteId: "acme-demo",
        requiredFiles: ["site.manifest.json", "HANDOVER.md"],
        resources: { worker: "acme-web", database: "acme-db" },
        forbiddenLiterals: ["Legacy Brand"],
      }),
    );
    await expect(
      runCmsCli(["verify", "--spec=plans/verify.json"], ports),
    ).resolves.toMatchObject({ ok: true, command: "verify" });

    const migrationPlan = createCmsMigrationPlan({
      siteId: "acme-demo",
      stage: "production",
      target: "acme-db-production",
      currentVersion: 1,
      targetVersion: 2,
      steps: [{ id: "0002-content", from: 1, to: 2 }],
    });
    files.set("plans/migration.json", JSON.stringify(migrationPlan));
    await runCmsCli(
      [
        "migrate",
        "--plan=plans/migration.json",
        "--driver=project/migration-driver.ts",
        "--receipt=evidence/migration.json",
        "--recovery=evidence/migration-recovery.json",
        `--confirm=${migrationPlan.applyConfirmation}`,
      ],
      ports,
    );
    expect(version).toBe(2);
    expect(
      JSON.parse(files.get("evidence/migration.json") ?? ""),
    ).toMatchObject({ status: "applied", targetVersion: 2 });
    await runCmsCli(
      [
        "rollback",
        "--plan=plans/migration.json",
        "--driver=project/migration-driver.ts",
        "--recovery=evidence/migration.json",
        "--receipt=evidence/rollback.json",
        `--confirm=${migrationPlan.rollbackConfirmation}`,
      ],
      ports,
    );
    expect(version).toBe(1);
    expect(output.some((value) => value.includes('"command": "migrate"'))).toBe(
      true,
    );
  });

  test("persists a recovery point when an executable migration fails", async () => {
    const plan = createCmsMigrationPlan({
      siteId: "failed-site",
      stage: "staging",
      target: "failed-site-db",
      currentVersion: 1,
      targetVersion: 2,
      steps: [{ id: "0002-fail", from: 1, to: 2 }],
    });
    const files = new Map<string, string>([
      ["plan.json", JSON.stringify(plan)],
    ]);
    await expect(
      runCmsCli(
        [
          "migrate",
          "--plan=plan.json",
          "--driver=driver.ts",
          "--receipt=receipt.json",
          "--recovery=recovery.json",
          `--confirm=${plan.applyConfirmation}`,
        ],
        {
          read: async (path) => files.get(path) ?? null,
          write: async (path, content) => {
            files.set(path, content);
          },
          importTemplateInitializer: async () => ({}),
          importMigrationDriver: async () => ({
            default: {
              inspectVersion: async () => 1,
              createBackup: async () => ({
                locator: "memory:failed-v1",
                sha256: "b".repeat(64),
                bytes: 64,
              }),
              applyStep: async () => {
                throw new Error("provider failure");
              },
              restoreBackup: async () => {},
            },
          }),
          output: () => {},
        },
      ),
    ).rejects.toThrow(/recovery saved at recovery\.json/i);
    expect(JSON.parse(files.get("recovery.json") ?? "")).toMatchObject({
      siteId: "failed-site",
      appliedStepIds: [],
    });
    expect(files.has("receipt.json")).toBe(false);
  });

  test("backs up, applies, verifies, and rolls back an exact-confirmation migration", async () => {
    const plan = createCmsMigrationPlan({
      siteId: "acme-demo",
      stage: "production",
      target: "acme-demo-db-production",
      currentVersion: 1,
      targetVersion: 3,
      steps: [
        { id: "0002-content-envelope", from: 1, to: 2 },
        { id: "0003-media-index", from: 2, to: 3 },
      ],
    });
    let version = 1;
    const events: string[] = [];
    const driver = {
      inspectVersion: async () => {
        events.push(`inspect:${version}`);
        return version;
      },
      createBackup: async () => {
        events.push("backup");
        return {
          locator: "r2://acme-backups/pre-migration.sqlite",
          sha256: "a".repeat(64),
          bytes: 128,
        };
      },
      applyStep: async (step: { id: string; to: number }) => {
        events.push(`apply:${step.id}`);
        version = step.to;
      },
      restoreBackup: async () => {
        events.push("restore");
        version = 1;
      },
    };
    const dates = [0, 1, 2, 3, 4].map(
      (seconds) => new Date(`2026-08-16T00:00:0${seconds}.000Z`),
    );
    const receipt = await executeCmsMigrationPlan(plan, driver, {
      confirmation: plan.applyConfirmation,
      clock: () => dates.shift()!,
    });
    expect(receipt).toMatchObject({
      status: "applied",
      appliedStepIds: ["0002-content-envelope", "0003-media-index"],
      backupCompletedAt: "2026-08-16T00:00:01.000Z",
      migrationStartedAt: "2026-08-16T00:00:02.000Z",
    });
    expect(events).toEqual([
      "inspect:1",
      "backup",
      "apply:0002-content-envelope",
      "inspect:2",
      "apply:0003-media-index",
      "inspect:3",
    ]);

    const rollback = await rollbackCmsMigration(plan, receipt, driver, {
      confirmation: plan.rollbackConfirmation,
    });
    expect(rollback).toMatchObject({ status: "restored", restoredVersion: 1 });
    expect(events.slice(-3)).toEqual(["inspect:3", "restore", "inspect:1"]);
  });

  test("fails closed and exposes a recovery point only after backup succeeds", async () => {
    const plan = createCmsMigrationPlan({
      siteId: "acme-demo",
      stage: "staging",
      target: "acme-demo-db-staging",
      currentVersion: 1,
      targetVersion: 2,
      steps: [{ id: "0002-envelope", from: 1, to: 2 }],
    });
    let called = false;
    const driver = {
      inspectVersion: async () => 1,
      createBackup: async () => ({
        locator: "r2://acme-backups/staging.sqlite",
        sha256: "b".repeat(64),
        bytes: 64,
      }),
      applyStep: async () => {
        called = true;
        throw new Error("provider failure");
      },
      restoreBackup: async () => {},
    };
    await expect(
      executeCmsMigrationPlan(plan, driver, { confirmation: "wrong" }),
    ).rejects.toThrow(/exact apply confirmation/);
    expect(called).toBe(false);
    try {
      await executeCmsMigrationPlan(plan, driver, {
        confirmation: plan.applyConfirmation,
      });
      throw new Error("Expected migration failure");
    } catch (error) {
      expect(error).toBeInstanceOf(CmsCliMigrationExecutionError);
      expect((error as CmsCliMigrationExecutionError).recovery).toMatchObject({
        currentVersion: 1,
        targetVersion: 2,
        appliedStepIds: [],
      });
    }
  });
});
