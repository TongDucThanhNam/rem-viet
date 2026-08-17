import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { z } from "zod";

import type { SiteManifest } from "../packages/cms/src/site-manifest";

import { repoRoot } from "./site-lib";

const requiredCmsTables = [
  "pages",
  "page_revisions",
  "audit_events",
  "form_submissions",
  "web_vitals",
] as const;

const countedCmsTables = [
  "pages",
  "page_revisions",
  "posts",
  "media",
  "form_submissions",
  "web_vitals",
] as const;

const safeResourceName = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const isoTimestamp = z.string().refine((value) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && value.includes("T");
}, "Must be an ISO-8601 timestamp");

const restoreCountsSchema = z
  .object({
    pages: z.number().int().nonnegative(),
    page_revisions: z.number().int().nonnegative(),
    posts: z.number().int().nonnegative(),
    media: z.number().int().nonnegative(),
    form_submissions: z.number().int().nonnegative(),
    web_vitals: z.number().int().nonnegative(),
  })
  .strict();

export const backupEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    siteId: safeResourceName,
    stage: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    database: safeResourceName,
    createdAt: isoTimestamp,
    artifact: z
      .object({
        path: z.string().regex(/^backups\/[^/]+\.sql$/),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        sizeBytes: z.number().int().positive(),
        immutable: z.boolean(),
      })
      .strict(),
    restoreDrill: z
      .object({
        integrityCheck: z.literal("ok"),
        tables: z.number().int().positive(),
        counts: restoreCountsSchema,
        isolatedRestore: z.literal(true),
      })
      .strict(),
  })
  .strict();

export type BackupEvidence = z.infer<typeof backupEvidenceSchema>;

export type SiteBackupPlan = {
  siteId: string;
  stage: string;
  database: string;
  createdAt: string;
  output: string;
  metadataOutput: string;
};

export type RestoreDrillResult = {
  integrityCheck: "ok";
  tables: number;
  counts: Record<(typeof countedCmsTables)[number], number>;
  isolatedRestore: true;
};

export type RemoteRestorePlan = {
  siteId: string;
  sourceStage: string;
  sourceDatabase: string;
  sourceArtifact: string;
  sourceSha256: string;
  targetDatabase: string;
  expectedTables: number;
  expectedCounts: RestoreDrillResult["counts"];
};

/** Provider CLIs can print short-lived signed download URLs; never forward them. */
export function sanitizeBackupProviderOutput(value: string) {
  return value.replace(/https?:\/\/[^\s]+/gi, "[redacted provider URL]");
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | "]" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]!;
    const next = sql[index + 1];
    current += character;

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      const closing = quote === "]" ? "]" : quote;
      if (character === closing) {
        if (quote !== "]" && next === closing) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "-" && next === "-") {
      current += next;
      index += 1;
      lineComment = true;
      continue;
    }
    if (character === "/" && next === "*") {
      current += next;
      index += 1;
      blockComment = true;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") {
      quote = "]";
      continue;
    }
    if (character === ";") {
      statements.push(current.trim());
      current = "";
    }
  }

  if (quote || blockComment) {
    throw new Error("Backup SQL contains an unterminated quote or comment.");
  }
  if (current.trim()) {
    throw new Error("Backup SQL contains a statement without a semicolon.");
  }
  return statements.filter(Boolean);
}

function statementBody(statement: string) {
  return statement
    .replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, "")
    .trim();
}

function capturedSqlIdentifier(match: RegExpMatchArray) {
  const identifier = match.slice(1).find((value) => value !== undefined);
  return identifier?.replaceAll('""', '"').replaceAll("``", "`") ?? "";
}

function createTableMetadata(statement: string) {
  const body = statementBody(statement);
  const tableMatch = body.match(
    /^CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"((?:""|[^"])*)"|`((?:``|[^`])*)`|\[([^\]]+)\]|([^\s(]+))/i,
  );
  if (!tableMatch) {
    throw new Error(
      "Backup SQL contains an unparseable CREATE TABLE statement.",
    );
  }
  const dependencies = new Set<string>();
  const referencePattern =
    /\bREFERENCES\s+(?:"((?:""|[^"])*)"|`((?:``|[^`])*)`|\[([^\]]+)\]|([^\s(]+))\s*\(/gi;
  for (const match of body.matchAll(referencePattern)) {
    dependencies.add(capturedSqlIdentifier(match).toLowerCase());
  }
  return {
    name: capturedSqlIdentifier(tableMatch),
    statement,
    dependencies,
  };
}

function insertedTable(statement: string) {
  const match = statementBody(statement).match(
    /^(?:INSERT|REPLACE)\s+INTO\s+(?:"((?:""|[^"])*)"|`((?:``|[^`])*)`|\[([^\]]+)\]|([^\s(]+))/i,
  );
  return match ? capturedSqlIdentifier(match) : null;
}

function orderTablesByDependencies(
  tables: ReturnType<typeof createTableMetadata>[],
) {
  const known = new Set(tables.map((table) => table.name.toLowerCase()));
  const ordered: typeof tables = [];
  const remaining = [...tables];

  while (remaining.length > 0) {
    const readyIndex = remaining.findIndex((table) =>
      [...table.dependencies].every(
        (dependency) =>
          dependency === table.name.toLowerCase() ||
          !known.has(dependency) ||
          ordered.some(
            (candidate) => candidate.name.toLowerCase() === dependency,
          ),
      ),
    );
    if (readyIndex === -1) {
      // Cyclic schemas still require deferred FK checks. Keep their source order.
      ordered.push(...remaining);
      break;
    }
    ordered.push(remaining.splice(readyIndex, 1)[0]!);
  }
  return ordered;
}

/**
 * Cloudflare's export currently interleaves each CREATE TABLE with its rows.
 * Remote D1 requires every referenced table to exist before dependent inserts.
 * Move only CREATE TABLE statements ahead of the remaining dump while keeping
 * row, index and trigger order intact; never mutate the immutable source file.
 */
export function normalizeD1ExportForRemoteImport(sql: string) {
  const statements = splitSqlStatements(sql);
  const tableStatements: ReturnType<typeof createTableMetadata>[] = [];
  const dataStatements = new Map<string, string[]>();
  const remainingStatements: string[] = [];

  for (const statement of statements) {
    const body = statementBody(statement);
    if (/^PRAGMA\s+defer_foreign_keys\s*=/i.test(body)) continue;
    if (
      /^(?:BEGIN(?:\s+TRANSACTION)?|COMMIT|END(?:\s+TRANSACTION)?)\s*;/i.test(
        body,
      )
    ) {
      continue;
    }
    if (/^CREATE\s+(?:VIRTUAL\s+)?TABLE\b/i.test(body)) {
      tableStatements.push(createTableMetadata(statement));
      continue;
    }
    const table = insertedTable(statement);
    if (table) {
      const key = table.toLowerCase();
      dataStatements.set(key, [...(dataStatements.get(key) ?? []), statement]);
      continue;
    }
    remainingStatements.push(statement);
  }

  if (tableStatements.length === 0) {
    throw new Error("Backup SQL does not contain any CREATE TABLE statements.");
  }
  const orderedTables = orderTablesByDependencies(tableStatements);
  const orderedData = orderedTables.flatMap(
    (table) => dataStatements.get(table.name.toLowerCase()) ?? [],
  );
  const knownDataStatements = new Set(orderedData);
  const unmatchedData = [...dataStatements.values()]
    .flat()
    .filter((statement) => !knownDataStatements.has(statement));
  return [
    "PRAGMA defer_foreign_keys=TRUE;",
    ...orderedTables.map((table) => table.statement),
    ...orderedData,
    ...unmatchedData,
    ...remainingStatements,
  ]
    .join("\n")
    .concat("\n");
}

export async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function assertDirectBackupPath(path: string) {
  const backupRoot = resolve(repoRoot, "backups");
  const relativePath = relative(backupRoot, path);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath) ||
    dirname(path) !== backupRoot
  ) {
    throw new Error("Backup artifact must be directly inside backups/.");
  }
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function backupTimestamp(now: Date) {
  if (Number.isNaN(now.getTime())) throw new Error("Backup time is invalid.");
  return now
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildSiteBackupPlan(input: {
  manifest: SiteManifest;
  stage: string;
  now?: Date;
  output?: string;
}): SiteBackupPlan {
  const stage = input.stage.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(stage)) {
    throw new Error("Stage must be a safe deployment slug.");
  }

  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const backupRoot = resolve(repoRoot, "backups");
  const output = input.output
    ? resolve(repoRoot, input.output)
    : resolve(
        backupRoot,
        `${input.manifest.id}-${stage}-${backupTimestamp(now)}.sql`,
      );
  try {
    assertDirectBackupPath(output);
  } catch {
    throw new Error(
      "Backup output must be a file directly inside the ignored backups/ directory.",
    );
  }
  if (extname(output).toLowerCase() !== ".sql") {
    throw new Error("Backup output must use the .sql extension.");
  }

  return {
    siteId: input.manifest.id,
    stage,
    database: `${input.manifest.infrastructure.d1Name}-${stage}`,
    createdAt,
    output,
    metadataOutput: `${output}.evidence.json`,
  };
}

export async function verifyBackupArtifact(
  source: string,
): Promise<RestoreDrillResult> {
  const absoluteSource = resolve(repoRoot, source);
  const temporaryRoot = resolve(repoRoot, ".tmp");
  await mkdir(temporaryRoot, { recursive: true });
  const drillDirectory = await mkdtemp(
    resolve(temporaryRoot, "cms-restore-drill-"),
  );
  const target = resolve(drillDirectory, "restored.sqlite");

  try {
    if (extname(absoluteSource).toLowerCase() === ".sql") {
      const restored = new Database(target, { create: true });
      try {
        restored.exec(await readFile(absoluteSource, "utf8"));
      } finally {
        restored.close();
      }
    } else {
      await copyFile(absoluteSource, target);
    }

    const database = new Database(target, { readonly: true });
    try {
      const integrity = database.query("PRAGMA integrity_check").get() as
        Record<string, unknown> | undefined;
      const integrityCheck = String(Object.values(integrity ?? {})[0] ?? "");
      if (integrityCheck !== "ok") {
        throw new Error(
          `Restore integrity check failed: ${integrityCheck || "unknown"}`,
        );
      }

      const tables = database
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      const tableNames = new Set(tables.map((table) => table.name));
      for (const required of requiredCmsTables) {
        if (!tableNames.has(required)) {
          throw new Error(`Restore is missing required table ${required}.`);
        }
      }
      for (const counted of countedCmsTables) {
        if (!tableNames.has(counted)) {
          throw new Error(`Restore is missing counted table ${counted}.`);
        }
      }

      const counts = Object.fromEntries(
        countedCmsTables.map((table) => [
          table,
          (
            database.query(`SELECT count(*) AS count FROM ${table}`).get() as {
              count: number;
            }
          ).count,
        ]),
      ) as RestoreDrillResult["counts"];

      return {
        integrityCheck: "ok",
        tables: tables.length,
        counts,
        isolatedRestore: true,
      };
    } finally {
      database.close();
    }
  } finally {
    await rm(drillDirectory, { recursive: true, force: true });
  }
}

export async function buildBackupEvidence(
  plan: SiteBackupPlan,
  restoreDrill: RestoreDrillResult,
) {
  const details = await stat(plan.output);

  return backupEvidenceSchema.parse({
    schemaVersion: 1,
    siteId: plan.siteId,
    stage: plan.stage,
    database: plan.database,
    createdAt: plan.createdAt,
    artifact: {
      path: relative(repoRoot, plan.output).replaceAll("\\", "/"),
      sha256: await sha256File(plan.output),
      sizeBytes: details.size,
      immutable: false,
    },
    restoreDrill,
  });
}

export async function readVerifiedBackupEvidence(
  source: string,
): Promise<{ source: string; evidence: BackupEvidence }> {
  const absoluteSource = resolve(repoRoot, source);
  const artifactPath = assertDirectBackupPath(absoluteSource);
  if (extname(absoluteSource).toLowerCase() !== ".sql") {
    throw new Error("Remote restore requires a .sql backup artifact.");
  }

  const rawEvidence = JSON.parse(
    await readFile(`${absoluteSource}.evidence.json`, "utf8"),
  );
  const evidence = backupEvidenceSchema.parse(rawEvidence);
  if (evidence.artifact.path !== artifactPath) {
    throw new Error("Backup metadata artifact path does not match --file.");
  }
  const details = await stat(absoluteSource);
  if (details.size !== evidence.artifact.sizeBytes) {
    throw new Error(
      "Backup artifact size does not match its evidence metadata.",
    );
  }
  if ((await sha256File(absoluteSource)) !== evidence.artifact.sha256) {
    throw new Error(
      "Backup artifact SHA-256 does not match its evidence metadata.",
    );
  }

  return { source: absoluteSource, evidence };
}

export function buildRemoteRestorePlan(input: {
  evidence: BackupEvidence;
  targetDatabase: string;
}): RemoteRestorePlan {
  const targetDatabase = safeResourceName.parse(input.targetDatabase);
  const requiredPrefix = `${input.evidence.siteId}-restore-drill-`;
  if (!targetDatabase.startsWith(requiredPrefix)) {
    throw new Error(
      `Restore target must use the isolated prefix ${requiredPrefix}`,
    );
  }
  if (targetDatabase === input.evidence.database) {
    throw new Error("Restore target cannot be the source database.");
  }

  return {
    siteId: input.evidence.siteId,
    sourceStage: input.evidence.stage,
    sourceDatabase: input.evidence.database,
    sourceArtifact: input.evidence.artifact.path,
    sourceSha256: input.evidence.artifact.sha256,
    targetDatabase,
    expectedTables: input.evidence.restoreDrill.tables,
    expectedCounts: input.evidence.restoreDrill.counts,
  };
}

type D1ExecuteResult = {
  success?: unknown;
  results?: unknown;
};

export function parseD1ExecuteResults(value: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Wrangler D1 returned invalid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Wrangler D1 returned no statement results.");
  }

  return parsed.flatMap((entry) => {
    const result = entry as D1ExecuteResult;
    if (result.success !== true || !Array.isArray(result.results)) {
      throw new Error("Wrangler D1 reported an unsuccessful statement.");
    }
    return result.results;
  });
}

export function assertEmptyRemoteRestoreTarget(output: string) {
  const rows = parseD1ExecuteResults(output) as Array<{
    table_count?: unknown;
  }>;
  const tableCount = rows[0]?.table_count;
  if (typeof tableCount !== "number" || !Number.isSafeInteger(tableCount)) {
    throw new Error("Remote target inspection did not return a table count.");
  }
  if (tableCount !== 0) {
    throw new Error(
      `Remote restore target is not empty (${tableCount} application tables).`,
    );
  }
}

export function verifyRemoteRestoreOutput(input: {
  plan: RemoteRestorePlan;
  countsOutput: string;
  quickCheckOutput: string;
}) {
  const countRows = parseD1ExecuteResults(input.countsOutput) as Array<{
    name?: unknown;
    row_count?: unknown;
  }>;
  const actual = new Map<string, number>();
  const expectedNames = new Set(["__tables__", ...countedCmsTables]);
  for (const row of countRows) {
    if (
      typeof row.name !== "string" ||
      typeof row.row_count !== "number" ||
      !Number.isSafeInteger(row.row_count)
    ) {
      throw new Error(
        "Remote restore count verification returned an invalid row.",
      );
    }
    if (!expectedNames.has(row.name) || actual.has(row.name)) {
      throw new Error(
        "Remote restore count verification returned duplicate or unexpected rows.",
      );
    }
    actual.set(row.name, row.row_count);
  }
  if (actual.size !== expectedNames.size) {
    throw new Error("Remote restore count verification is incomplete.");
  }
  if (actual.get("__tables__") !== input.plan.expectedTables) {
    throw new Error("Remote restore table count does not match the backup.");
  }
  for (const [table, expected] of Object.entries(input.plan.expectedCounts)) {
    if (actual.get(table) !== expected) {
      throw new Error(
        `Remote restore row count mismatch for ${table}: expected ${expected}, received ${actual.get(table) ?? "missing"}.`,
      );
    }
  }

  const quickRows = parseD1ExecuteResults(input.quickCheckOutput) as Array<{
    quick_check?: unknown;
  }>;
  if (quickRows[0]?.quick_check !== "ok") {
    throw new Error("Remote D1 PRAGMA quick_check did not return ok.");
  }

  return {
    quickCheck: "ok" as const,
    tables: input.plan.expectedTables,
    counts: input.plan.expectedCounts,
  };
}
