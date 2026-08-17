import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Database } from "bun:sqlite";

import { argument, repoRoot } from "./site-lib";

async function sqliteFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sqliteFiles(path)));
    else if (entry.name.endsWith(".sqlite")) files.push(path);
  }
  return files;
}

const store = argument("store") ?? "wrangler";
const root =
  store === "alchemy"
    ? resolve(repoRoot, ".alchemy", "miniflare")
    : store === "wrangler"
      ? resolve(repoRoot, "apps", "web", ".wrangler", "state")
      : "";
if (!root) throw new Error("--store phải là wrangler hoặc alchemy.");
const candidates = (
  await Promise.all(
    (await sqliteFiles(root)).map(async (path) => {
      const database = new Database(path, { readonly: true });
      try {
        const hasCms = database
          .query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pages'",
          )
          .get();
        return hasCms ? { path, modifiedAt: (await stat(path)).mtimeMs } : null;
      } finally {
        database.close();
      }
    }),
  )
).filter((candidate): candidate is { path: string; modifiedAt: number } =>
  Boolean(candidate),
);
const source = candidates.sort(
  (left, right) => right.modifiedAt - left.modifiedAt,
)[0]?.path;
if (!source) throw new Error(`Không tìm thấy D1 SQLite trong ${root}`);
const timestamp = new Date().toISOString().replaceAll(":", "-");
const destination = resolve(
  repoRoot,
  "backups",
  `${store}-${timestamp}-${basename(source)}`,
);
await mkdir(resolve(repoRoot, "backups"), { recursive: true });
const database = new Database(source, { readonly: true });
try {
  await Bun.write(destination, database.serialize());
} finally {
  database.close();
}
console.log(JSON.stringify({ source, destination, store }, null, 2));
