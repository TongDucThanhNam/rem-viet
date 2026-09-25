// Simulate the exact SSR loader read+parse against the local dev D1 file.
import { createClient } from "@libsql/client";
import { parseRemVietHomeContent } from "@rem-viet/api/services/home-page-runtime";

async function main() {
  const client = createClient({
    url: "file:./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/160ca9ed640e893b18ba5dd2ef193049e9159aed575ae988b107586817c7bfb5.sqlite",
  });
  const row = await client.execute(
    `SELECT p.id AS documentId, r.snapshot
     FROM pages p INNER JOIN page_revisions r ON r.id = p.published_revision_id
     WHERE p.status = 'published' AND json_extract(r.snapshot, '$.slug') = 'home'
     LIMIT 1`,
  );
  if (!row.rows.length) {
    console.log("getPublished would return null → 'Published homepage is unavailable.'");
    return;
  }
  console.log("found revision for page:", row.rows[0].documentId);
  try {
    const content = parseRemVietHomeContent(JSON.parse(row.rows[0].snapshot as string));
    console.log("parse OK — blocks:", content.blocks.length, "title:", content.title);
  } catch (error) {
    console.log("parse FAILED:", (error as Error).message.slice(0, 500));
  }
}
main();
