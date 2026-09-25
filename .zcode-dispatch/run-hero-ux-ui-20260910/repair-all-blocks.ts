// One-off local-dev repair: replace the stored homepage blocks (both the
// published revision snapshot and the draft working copy) with the current
// canonical defaults, in the same flat shape the seed writes. Only touches
// local dev D1 state under apps/web/.wrangler.
import { writeFileSync } from "node:fs";
import {
  defaultRemVietTemplateBlocks,
  toLegacyRemVietTemplateBlock,
  toRemVietTemplateBlock,
} from "@agency/cms-template-rem-viet";

const blocks =
  defaultRemVietTemplateBlocks.map(toLegacyRemVietTemplateBlock);

// Prove every replacement block passes the current schema before writing.
for (const block of blocks) {
  const parsed = toRemVietTemplateBlock(block);
  if (!parsed.success) {
    console.error("canonical block fails validation:", block.type);
    process.exit(1);
  }
}
console.log("all", blocks.length, "canonical blocks validate");

const sqlLiteral = JSON.stringify(blocks).replaceAll("'", "''");
const statements = [
  `UPDATE page_revisions SET snapshot = json_set(snapshot, '$.blocks', json('${sqlLiteral}')) WHERE id = 'seed-revision-page-home-v2';`,
  `UPDATE pages SET blocks = json('${sqlLiteral}') WHERE slug = 'home';`,
];
writeFileSync(
  "../../.zcode-dispatch/run-hero-ux-ui-20260910/repair-all-blocks.sql",
  statements.join("\n"),
  "utf8",
);
console.log("wrote repair-all-blocks.sql");
