import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { Database } from "bun:sqlite";

import {
  assertEmptyRemoteRestoreTarget,
  buildBackupEvidence,
  buildRemoteRestorePlan,
  buildSiteBackupPlan,
  normalizeD1ExportForRemoteImport,
  readVerifiedBackupEvidence,
  sanitizeBackupProviderOutput,
  verifyBackupArtifact,
  verifyRemoteRestoreOutput,
} from "./cms-backup-lib";
import { manifestFor, repoRoot } from "./site-lib";

const testDirectory = await mkdtemp(join(tmpdir(), "rem-viet-backup-"));

afterAll(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

function createCmsFixture(path: string, includeVitals = true) {
  const database = new Database(path, { create: true });
  const tables = [
    "pages",
    "page_revisions",
    "posts",
    "media",
    "audit_events",
    "form_submissions",
    ...(includeVitals ? ["web_vitals"] : []),
  ];
  for (const table of tables) {
    database.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY);`);
  }
  database.exec("INSERT INTO pages (id) VALUES ('home');");
  database.close();
}

describe("manifest-aware D1 backup", () => {
  test("builds a stage-isolated, ignored backup plan", () => {
    const plan = buildSiteBackupPlan({
      manifest: manifestFor("acme-studio", "showcase"),
      stage: "Staging",
      now: new Date("2026-08-14T12:34:56.789Z"),
    });

    expect(plan.database).toBe("acme-studio-db-staging");
    expect(relative(repoRoot, plan.output).replaceAll("\\", "/")).toBe(
      "backups/acme-studio-staging-20260814T123456Z.sql",
    );
    expect(plan.metadataOutput).toBe(`${plan.output}.evidence.json`);
  });

  test("rejects unsafe stages and outputs outside backups", () => {
    const manifest = manifestFor("acme-studio", "showcase");

    expect(() => buildSiteBackupPlan({ manifest, stage: "../prod" })).toThrow(
      /safe deployment slug/,
    );
    expect(() =>
      buildSiteBackupPlan({
        manifest,
        stage: "staging",
        output: "outside.sql",
      }),
    ).toThrow(/inside the ignored backups/);
    expect(() =>
      buildSiteBackupPlan({
        manifest,
        stage: "staging",
        output: "backups/not-sql.txt",
      }),
    ).toThrow(/\.sql extension/);
    expect(() =>
      buildSiteBackupPlan({
        manifest,
        stage: "staging",
        output: "backups/nested/backup.sql",
      }),
    ).toThrow(/directly inside.*backups/);
  });

  test("redacts provider URLs before surfacing command failures", () => {
    const output = sanitizeBackupProviderOutput(
      "Download https://storage.example/export.sql?X-Amz-Signature=secret then retry.",
    );

    expect(output).toBe("Download [redacted provider URL] then retry.");
    expect(output).not.toContain("X-Amz");
    expect(output).not.toContain("secret");
  });

  test("normalizes interleaved D1 exports without splitting quoted semicolons", () => {
    const normalized = normalizeD1ExportForRemoteImport(
      [
        "PRAGMA defer_foreign_keys=TRUE;",
        "CREATE TABLE child (id TEXT, parent_id TEXT REFERENCES parent(id));",
        "INSERT INTO child VALUES ('child;one', 'parent-one');",
        "CREATE TABLE parent (id TEXT PRIMARY KEY);",
        "INSERT INTO parent VALUES ('parent-one');",
        "CREATE INDEX child_parent_idx ON child(parent_id);",
      ].join("\n"),
    );

    expect(normalized.match(/PRAGMA defer_foreign_keys/gi)).toHaveLength(1);
    expect(normalized.indexOf("CREATE TABLE child")).toBeLessThan(
      normalized.indexOf("INSERT INTO child"),
    );
    expect(normalized.indexOf("CREATE TABLE parent")).toBeLessThan(
      normalized.indexOf("INSERT INTO child"),
    );
    expect(normalized.indexOf("INSERT INTO parent")).toBeLessThan(
      normalized.indexOf("INSERT INTO child"),
    );
    expect(normalized).toContain("'child;one'");
    expect(normalized.indexOf("INSERT INTO child")).toBeLessThan(
      normalized.indexOf("CREATE INDEX child_parent_idx"),
    );

    const database = new Database(":memory:");
    try {
      database.exec("PRAGMA foreign_keys=ON;");
      database.exec(normalized);
      expect(database.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  test("fails closed on malformed or schema-free remote imports", () => {
    expect(() =>
      normalizeD1ExportForRemoteImport("INSERT INTO pages VALUES ('open);"),
    ).toThrow("unterminated");
    expect(() =>
      normalizeD1ExportForRemoteImport("PRAGMA defer_foreign_keys=TRUE;"),
    ).toThrow("does not contain any CREATE TABLE");
  });

  test("restores into an isolated database and emits hashable evidence", async () => {
    const fixture = join(testDirectory, "complete.sqlite");
    createCmsFixture(fixture);
    const restoreDrill = await verifyBackupArtifact(fixture);

    expect(restoreDrill).toMatchObject({
      integrityCheck: "ok",
      isolatedRestore: true,
      counts: { pages: 1, web_vitals: 0 },
    });

    const ignoredFixture = join(
      repoRoot,
      "backups",
      `test-evidence-${basename(testDirectory)}.sql`,
    );
    const plan = buildSiteBackupPlan({
      manifest: manifestFor("acme-studio", "showcase"),
      stage: "staging",
      now: new Date("2026-08-14T12:34:56.789Z"),
      output: relative(repoRoot, ignoredFixture),
    });
    // Evidence accepts an already-created artifact only when it is inside the
    // ignored backup directory, so use a test copy there for the hash contract.
    await Bun.write(ignoredFixture, await Bun.file(fixture).arrayBuffer());
    try {
      const evidence = await buildBackupEvidence(plan, restoreDrill);
      expect(evidence.artifact).toMatchObject({
        path: `backups/test-evidence-${basename(testDirectory)}.sql`,
        immutable: false,
      });
      expect(typeof evidence.artifact.sizeBytes).toBe("number");
      expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
      await Bun.write(
        `${ignoredFixture}.evidence.json`,
        JSON.stringify(evidence),
      );
      expect(
        (await readVerifiedBackupEvidence(ignoredFixture)).evidence,
      ).toEqual(evidence);
    } finally {
      await rm(ignoredFixture, { force: true });
      await rm(`${ignoredFixture}.evidence.json`, { force: true });
    }
  });

  test("fails closed when a release-critical table is missing", async () => {
    const fixture = join(testDirectory, "incomplete.sqlite");
    createCmsFixture(fixture, false);

    await expect(verifyBackupArtifact(fixture)).rejects.toThrow(
      /missing required table web_vitals/,
    );
  });

  test("requires a prefixed isolated remote target", async () => {
    const fixture = join(testDirectory, "remote-source.sqlite");
    createCmsFixture(fixture);
    const ignoredFixture = join(
      repoRoot,
      "backups",
      `remote-source-${basename(testDirectory)}.sql`,
    );
    await Bun.write(ignoredFixture, await Bun.file(fixture).arrayBuffer());
    const evidence = await buildBackupEvidence(
      buildSiteBackupPlan({
        manifest: manifestFor("acme-studio", "showcase"),
        stage: "staging",
        output: relative(repoRoot, ignoredFixture),
      }),
      await verifyBackupArtifact(fixture),
    );
    try {
      const plan = buildRemoteRestorePlan({
        evidence,
        targetDatabase: "acme-studio-restore-drill-20260814",
      });
      expect(plan).toMatchObject({
        sourceDatabase: "acme-studio-db-staging",
        targetDatabase: "acme-studio-restore-drill-20260814",
        expectedTables: 7,
        expectedCounts: { pages: 1 },
      });
      expect(() =>
        buildRemoteRestorePlan({
          evidence,
          targetDatabase: "acme-studio-db-staging",
        }),
      ).toThrow(/isolated prefix/);
      expect(() =>
        buildRemoteRestorePlan({
          evidence,
          targetDatabase: "other-restore-drill-20260814",
        }),
      ).toThrow(/isolated prefix/);
    } finally {
      await rm(ignoredFixture, { force: true });
    }
  });

  test("rejects non-empty targets and partial remote restores", () => {
    const d1Output = (rows: unknown[]) =>
      JSON.stringify([{ results: rows, success: true }]);
    assertEmptyRemoteRestoreTarget(d1Output([{ table_count: 0 }]));
    expect(() =>
      assertEmptyRemoteRestoreTarget(d1Output([{ table_count: 1 }])),
    ).toThrow(/not empty/);

    const expectedCounts = {
      pages: 1,
      page_revisions: 4,
      posts: 4,
      media: 0,
      form_submissions: 4,
      web_vitals: 0,
    };
    const plan = {
      siteId: "rem-viet",
      sourceStage: "staging",
      sourceDatabase: "rem-viet-db-staging",
      sourceArtifact: "backups/source.sql",
      sourceSha256: "a".repeat(64),
      targetDatabase: "rem-viet-restore-drill-20260814",
      expectedTables: 26,
      expectedCounts,
    };
    const rows = [
      { name: "__tables__", row_count: 26 },
      ...Object.entries(expectedCounts).map(([name, row_count]) => ({
        name,
        row_count,
      })),
    ];

    expect(
      verifyRemoteRestoreOutput({
        plan,
        countsOutput: d1Output(rows),
        quickCheckOutput: d1Output([{ quick_check: "ok" }]),
      }),
    ).toEqual({ quickCheck: "ok", tables: 26, counts: expectedCounts });
    expect(() =>
      verifyRemoteRestoreOutput({
        plan,
        countsOutput: d1Output(
          rows.map((row) =>
            row.name === "pages" ? { ...row, row_count: 0 } : row,
          ),
        ),
        quickCheckOutput: d1Output([{ quick_check: "ok" }]),
      }),
    ).toThrow(/row count mismatch for pages/);
    expect(() =>
      verifyRemoteRestoreOutput({
        plan,
        countsOutput: d1Output(rows),
        quickCheckOutput: d1Output([{ quick_check: "corrupt" }]),
      }),
    ).toThrow(/quick_check/);
    expect(() =>
      verifyRemoteRestoreOutput({
        plan,
        countsOutput: d1Output([...rows, rows[0]]),
        quickCheckOutput: d1Output([{ quick_check: "ok" }]),
      }),
    ).toThrow(/duplicate or unexpected/);
  });

  test("CLI dry-run validates a real artifact and apply requires exact confirmation", async () => {
    const ignoredFixture = join(
      repoRoot,
      "backups",
      `remote-cli-${basename(testDirectory)}.sql`,
    );
    const sql = `${[
      "pages",
      "page_revisions",
      "posts",
      "media",
      "audit_events",
      "form_submissions",
      "web_vitals",
    ]
      .map((table) => `CREATE TABLE ${table} (id TEXT PRIMARY KEY);`)
      .join("\n")}\nINSERT INTO pages (id) VALUES ('home');\n`;
    await Bun.write(ignoredFixture, sql);
    const plan = buildSiteBackupPlan({
      manifest: manifestFor("acme-demo", "showcase"),
      stage: "staging",
      output: relative(repoRoot, ignoredFixture),
    });
    const evidence = await buildBackupEvidence(
      plan,
      await verifyBackupArtifact(ignoredFixture),
    );
    await Bun.write(
      `${ignoredFixture}.evidence.json`,
      JSON.stringify(evidence),
    );
    const commonArguments = [
      process.execPath,
      "scripts/site-restore-remote.ts",
      "--site=acme-demo",
      "--stage=staging",
      `--file=${relative(repoRoot, ignoredFixture)}`,
      "--target=acme-demo-restore-drill-test",
    ];

    try {
      const dryRun = Bun.spawnSync([...commonArguments, "--dry-run"], {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.stdout.toString()).toContain(
        '"targetDatabase": "acme-demo-restore-drill-test"',
      );

      const unconfirmed = Bun.spawnSync([...commonArguments, "--apply"], {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(unconfirmed.exitCode).not.toBe(0);
      expect(unconfirmed.stderr.toString()).toContain(
        "--confirm-target must exactly match --target",
      );

      const missingStartedAt = Bun.spawnSync(
        [
          ...commonArguments,
          "--verify-only",
          "--confirm-target=acme-demo-restore-drill-test",
        ],
        {
          cwd: repoRoot,
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(missingStartedAt.exitCode).not.toBe(0);
      expect(missingStartedAt.stderr.toString()).toContain(
        "--restore-started-at",
      );
    } finally {
      await rm(ignoredFixture, { force: true });
      await rm(`${ignoredFixture}.evidence.json`, { force: true });
    }
  });
});
