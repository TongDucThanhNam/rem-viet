import { access, readFile } from "node:fs/promises";

import "./load-env";

const sqlFiles = [
  {
    label: "Mongo",
    path: process.env.D1_IMPORT_SQL_PATH ?? "mongo-d1-import.sql",
    allowMissing: process.env.D1_ALLOW_MISSING_MONGO_SQL === "true",
  },
  {
    label: "Notion",
    path: process.env.D1_NOTION_IMPORT_SQL_PATH ?? "notion-d1-import.sql",
    allowMissing: process.env.D1_ALLOW_MISSING_NOTION_SQL === "true",
  },
];

const expectedTables = [
  "categories",
  "products",
  "variants",
  "promotions",
  "carts",
  "orders",
  "logs",
  "posts",
] as const;

async function canRead(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function countInserts(sql: string) {
  const counts = new Map<string, number>();
  const insertPattern = /INSERT\s+OR\s+REPLACE\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = insertPattern.exec(sql))) {
    const tableName = match[1];
    if (!tableName) {
      continue;
    }
    counts.set(tableName, (counts.get(tableName) ?? 0) + 1);
  }

  return counts;
}

function mergeCounts(target: Map<string, number>, source: Map<string, number>) {
  for (const [tableName, count] of source) {
    target.set(tableName, (target.get(tableName) ?? 0) + count);
  }
}

async function main() {
  const combinedCounts = new Map<string, number>();
  let readableFiles = 0;

  for (const file of sqlFiles) {
    if (!(await canRead(file.path))) {
      if (!file.allowMissing) {
        throw new Error(`${file.label}: missing SQL file at ${file.path}`);
      }
      console.warn(`${file.label}: skipped missing SQL file at ${file.path}`);
      continue;
    }

    const sql = await readFile(file.path, "utf8");
    if (!sql.trim()) {
      if (!file.allowMissing) {
        throw new Error(`${file.label}: empty SQL file at ${file.path}`);
      }
      console.warn(`${file.label}: skipped empty SQL file at ${file.path}`);
      continue;
    }
    readableFiles += 1;
    const counts = countInserts(sql);
    mergeCounts(combinedCounts, counts);

    console.log(`${file.label}: ${file.path}`);
    for (const [tableName, count] of [...counts.entries()].sort()) {
      console.log(`  ${tableName}: ${count}`);
    }
  }

  if (readableFiles === 0) {
    throw new Error("No migration SQL files found. Generate Mongo/Notion SQL first.");
  }

  console.log("Combined:");
  for (const tableName of expectedTables) {
    console.log(`  ${tableName}: ${combinedCounts.get(tableName) ?? 0}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
