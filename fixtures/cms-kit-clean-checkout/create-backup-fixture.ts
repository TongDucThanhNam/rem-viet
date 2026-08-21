import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { Database } from "bun:sqlite";

const repositoryRoot = resolve(import.meta.dir, "..", "..");
const requested = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--output="))
  ?.slice("--output=".length);
if (!requested) throw new Error("Missing --output for clean backup fixture.");
const output = resolve(repositoryRoot, requested);
const relativeOutput = relative(repositoryRoot, output);
if (
  relativeOutput.startsWith("..") ||
  isAbsolute(relativeOutput) ||
  !relativeOutput.replaceAll("\\", "/").startsWith(".tmp/") ||
  !output.endsWith(".sqlite")
) {
  throw new Error("Clean backup fixture output must be a .tmp SQLite file.");
}
mkdirSync(dirname(output), { recursive: true });
const database = new Database(output, { create: true });
try {
  for (const table of [
    "pages",
    "page_revisions",
    "audit_events",
    "posts",
    "media",
    "form_submissions",
    "web_vitals",
  ]) {
    database.exec(
      `CREATE TABLE ${table} (id TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    database
      .query(`INSERT INTO ${table} (id, value) VALUES (?, ?)`)
      .run(`${table}-proof`, "clean-checkout-proof");
  }
} finally {
  database.close();
}
console.log(JSON.stringify({ output: relativeOutput.replaceAll("\\", "/") }));
