// Re-check: does the CURRENT published snapshot pass full content parse?
import { toRemVietTemplateBlock } from "@agency/cms-template-rem-viet";
import type { CloudflareD1Database } from "@agency/cms-provider-cloudflare";

// Read straight from local dev D1 via libsql to avoid needing the server.
import { createClient } from "@libsql/client";

async function main() {
  const client = createClient({
    url: "file:./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/160ca9ed640e893b18ba5dd2ef193049e9159aed575ae988b107586817c7bfb5.sqlite",
  });
  const row = await client.execute(
    "SELECT snapshot FROM page_revisions WHERE id = 'seed-revision-page-home-v2'",
  );
  const snapshot = JSON.parse(row.rows[0].snapshot as string);
  let failures = 0;
  for (const block of snapshot.blocks) {
    const parsed = toRemVietTemplateBlock(block);
    if (!parsed.success) {
      failures++;
      console.log("FAIL", block.type);
      try {
        const details = JSON.parse(parsed.error.message);
        for (const alt of details[0]?.errors ?? []) {
          for (const issue of alt) {
            if (issue.path?.length) {
              console.log("   path:", issue.path.join("."), "-", issue.message);
            }
          }
        }
      } catch {
        console.log(parsed.error.message.slice(0, 300));
      }
    }
  }
  console.log(failures === 0 ? "ALL BLOCKS PASS" : `${failures} failing blocks`);
}
main();
