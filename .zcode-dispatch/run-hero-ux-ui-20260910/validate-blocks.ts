// One-off diagnostic: find which stored homepage block fails current schema.
import { readFileSync } from "node:fs";
import { toRemVietTemplateBlock } from "@agency/cms-template-rem-viet";

const raw = JSON.parse(
  readFileSync(
    "C:/Users/terasumi/Documents/source_code/rem-viet/.zcode-dispatch/run-hero-ux-ui-20260910/d1-snapshot.json",
    "utf8",
  ),
);
const snapshot = JSON.parse(raw[0].results[0].snapshot);
const blocks = snapshot.blocks;
console.log("block count:", blocks.length);

for (const block of blocks) {
  const parsed = toRemVietTemplateBlock(block);
  if (parsed.success) {
    console.log("OK  ", block.type, block.id ?? "");
  } else {
    console.log("FAIL", block.type, block.id ?? "");
    console.log(JSON.stringify(JSON.parse(parsed.error.message), null, 2).slice(0, 2000));
  }
}
