import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

import { repoRoot } from "./site-lib";

const migrationsDir = resolve(repoRoot, "packages/db/src/migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();
if (!files.length) throw new Error("Không tìm thấy migration.");
const sqlByFile = new Map(
  await Promise.all(
    files.map(async (file) => [
      file,
      await readFile(resolve(migrationsDir, file), "utf8"),
    ]),
  ),
);

function apply(db: Database, filesToApply: string[]) {
  for (const file of filesToApply) {
    const sql = sqlByFile.get(file);
    if (!sql) throw new Error(`Missing SQL for ${file}`);
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) db.run(statement);
    }
  }
}

function count(db: Database, table: string) {
  return (
    db.query(`SELECT count(*) AS value FROM ${table}`).get() as {
      value: number;
    }
  ).value;
}

const temp = await mkdtemp(resolve(tmpdir(), "rem-viet-cms-migrations-"));
try {
  const empty = new Database(resolve(temp, "empty.sqlite"));
  apply(empty, files);
  const requiredTables = [
    "pages",
    "page_revisions",
    "posts",
    "post_revisions",
    "staff_roles",
    "audit_events",
    "cms_review_events",
    "cms_collection_documents",
    "cms_collection_revisions",
    "redirects",
    "form_definitions",
    "form_submissions",
    "web_vitals",
  ];
  for (const table of requiredTables) {
    const row = empty
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    if (!row) throw new Error(`Empty migration thiếu bảng ${table}`);
  }
  if (count(empty, "form_definitions") !== 1)
    throw new Error("Default contact form seed không idempotent.");
  const reviewIndexes = empty
    .query(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='cms_review_events'",
    )
    .all() as { name: string }[];
  for (const index of [
    "cms_review_events_document_idx",
    "cms_review_events_action_unique",
  ]) {
    if (!reviewIndexes.some(({ name }) => name === index))
      throw new Error(`Editorial review migration thiếu index ${index}`);
  }
  empty.close();

  const upgraded = new Database(resolve(temp, "upgraded.sqlite"));
  const legacyFiles = files.filter((file) => file < "0006_");
  apply(upgraded, legacyFiles);
  upgraded.run(
    `INSERT INTO pages (id,slug,title,blocks,status,seo_title,seo_description)
     VALUES ('legacy-page','legacy-page','Legacy page',
       '[{"type":"richText","content":"Legacy body"}]','published','','')`,
  );
  upgraded.run(
    "INSERT INTO posts (id,slug,title,status) VALUES ('legacy-post','legacy-post','Legacy post','published')",
  );
  apply(
    upgraded,
    files.filter((file) => file >= "0006_"),
  );
  const page = upgraded
    .query(
      "SELECT published_revision_id AS revisionId FROM pages WHERE id='legacy-page'",
    )
    .get() as { revisionId: string | null };
  const post = upgraded
    .query(
      "SELECT published_revision_id AS revisionId FROM posts WHERE id='legacy-post'",
    )
    .get() as { revisionId: string | null };
  if (!page.revisionId || !post.revisionId)
    throw new Error("Legacy published content không được backfill revision.");
  if (count(upgraded, "page_revisions") !== 1)
    throw new Error("Page revision backfill sai số lượng.");
  const collectionPage = upgraded
    .query(
      `SELECT schema_version AS schemaVersion, locale, data
       FROM cms_collection_documents
       WHERE collection_slug = 'standard-pages' AND id = 'legacy-page'`,
    )
    .get() as { schemaVersion: number; locale: string; data: string } | null;
  const collectionData = collectionPage
    ? (JSON.parse(collectionPage.data) as Record<string, unknown>)
    : null;
  if (
    collectionPage?.schemaVersion !== 1 ||
    collectionPage.locale !== "" ||
    collectionData?.template !== "standard" ||
    !Array.isArray(collectionData.blocks) ||
    (collectionData.blocks[0] as { schemaVersion?: unknown } | undefined)
      ?.schemaVersion !== 1 ||
    typeof collectionData.robotsIndex !== "boolean"
  ) {
    throw new Error("Standard page collection backfill sai dữ liệu.");
  }
  if (count(upgraded, "cms_collection_revisions") !== 1)
    throw new Error("Collection revision backfill sai số lượng.");
  const localizedColumns = upgraded
    .query("PRAGMA table_info(cms_collection_documents)")
    .all() as { name: string; pk: number }[];
  const localeColumn = localizedColumns.find(({ name }) => name === "locale");
  if (!localeColumn || localeColumn.pk !== 3) {
    throw new Error(
      "Collection locale migration thiếu composite lifecycle key.",
    );
  }
  if (count(upgraded, "post_revisions") !== 1)
    throw new Error("Post revision backfill sai số lượng.");
  if (count(upgraded, "form_definitions") !== 1)
    throw new Error("Contact form seed trên upgraded DB sai số lượng.");
  const foreignKeys = upgraded.query("PRAGMA foreign_key_check").all();
  if (foreignKeys.length)
    throw new Error("Upgraded fixture vi phạm foreign key.");
  upgraded.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        migrations: files.length,
        emptyDatabase: requiredTables.length,
        upgradedFixture: {
          pageRevision: page.revisionId,
          collectionDocument: "standard-pages/legacy-page",
          postRevision: post.revisionId,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
