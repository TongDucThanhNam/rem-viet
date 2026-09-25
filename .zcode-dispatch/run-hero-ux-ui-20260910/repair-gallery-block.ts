// One-off local-dev repair: bring the stored homepage horizontalGallery block
// up to the current seed shape (adds id/enabled/cursorLabel, webp assets).
// Emits SQL for wrangler d1 execute --local; touches only local dev D1 state.
import { readFileSync, writeFileSync } from "node:fs";
import { toRemVietTemplateBlock } from "@agency/cms-template-rem-viet";

const raw = JSON.parse(
  readFileSync("../../.zcode-dispatch/run-hero-ux-ui-20260910/d1-snapshot.json", "utf8"),
);
const result = raw[0].results[0];
const revisionId = result.id as string;
const snapshotText = result.snapshot as string;
const snapshot = JSON.parse(snapshotText);
const blocks = snapshot.blocks as Array<Record<string, unknown>>;

// Corrected block mirrors packages/db/seeds/home.sql (current shape).
const fixed = {
  id: "home-horizontal-gallery",
  enabled: true,
  type: "horizontalGallery",
  eyebrow: "(05) Lối sống",
  cursorLabel: "Xem",
  titleLines: ["Không Gian", "Tuyệt Đỉnh"],
  items: [
    {
      id: "living",
      title: "Phòng khách mở sáng",
      meta: "Cửa sổ lớn",
      image: { src: "/assets/gallery_1.webp", alt: "Phòng khách mở sáng" },
    },
    {
      id: "rest",
      title: "Góc nghỉ yên tĩnh",
      meta: "Lưới gần như vô hình",
      image: { src: "/assets/gallery_2.webp", alt: "Góc nghỉ yên tĩnh" },
    },
    {
      id: "kitchen",
      title: "Không gian bếp sạch",
      meta: "Hạn chế côn trùng",
      image: { src: "/assets/gallery_3.webp", alt: "Không gian bếp sạch" },
    },
    {
      id: "breeze",
      title: "Đón gió tự nhiên",
      meta: "Không che tầm nhìn",
      image: { src: "/assets/lifestyle_breeze.webp", alt: "Đón gió tự nhiên" },
    },
  ],
};

const parsed = toRemVietTemplateBlock(fixed);
if (!parsed.success) {
  console.error("replacement block itself fails validation:", parsed.error.message);
  process.exit(1);
}

const index = blocks.findIndex((b) => b.type === "horizontalGallery");
if (index < 0) {
  console.error("horizontalGallery not found in snapshot");
  process.exit(1);
}
console.log("revision:", revisionId, "block index:", index);

const sqlLiteral = JSON.stringify(fixed).replaceAll("'", "''");
const statements = [
  `UPDATE page_revisions SET snapshot = json_set(snapshot, '$.blocks[${index}]', json('${sqlLiteral}')) WHERE id = '${revisionId}';`,
  `UPDATE pages SET blocks = json_set(blocks, '$[${index}]', json('${sqlLiteral}')) WHERE slug = 'home';`,
];
writeFileSync(
  "../../.zcode-dispatch/run-hero-ux-ui-20260910/repair-gallery-block.sql",
  statements.join("\n"),
  "utf8",
);
console.log("wrote repair-gallery-block.sql");
