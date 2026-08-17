import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

import sharp from "sharp";

import { repoRoot } from "./site-lib";

const assetDir = resolve(repoRoot, "apps/web/public/assets");
const targets = [
  {
    input: "7c9323bc-888a-4cba-b876-f0aa79b35158.png",
    output: "rem-vina-hero.webp",
    width: 1920,
    quality: 82,
  },
  {
    input: "gallery_1.png",
    output: "gallery_1.webp",
    width: 1600,
    quality: 80,
  },
  {
    input: "gallery_2.png",
    output: "gallery_2.webp",
    width: 1600,
    quality: 80,
  },
  {
    input: "gallery_3.png",
    output: "gallery_3.webp",
    width: 1600,
    quality: 80,
  },
  {
    input: "lifestyle_breeze.png",
    output: "lifestyle_breeze.webp",
    width: 1600,
    quality: 80,
  },
  {
    input: "window-mosquito-net-hero.png",
    output: "window-mosquito-net-hero.webp",
    width: 1600,
    quality: 80,
  },
  {
    input: "fiberglass-mesh.png",
    output: "fiberglass-mesh.webp",
    width: 1400,
    quality: 80,
  },
] as const;

const results = [];
for (const target of targets) {
  const input = resolve(assetDir, target.input);
  const output = resolve(assetDir, target.output);
  const metadata = await sharp(input).metadata();
  const width = Math.min(metadata.width ?? target.width, target.width);
  await sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ effort: 6, quality: target.quality, smartSubsample: true })
    .toFile(output);
  const [before, after] = await Promise.all([stat(input), stat(output)]);
  results.push({
    input: basename(input),
    output: basename(output),
    width,
    height: metadata.height,
    beforeBytes: before.size,
    afterBytes: after.size,
    savedPercent: Math.round((1 - after.size / before.size) * 100),
  });
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
