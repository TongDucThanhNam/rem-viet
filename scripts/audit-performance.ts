import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { repoRoot } from "./site-lib";

const clientAssets = resolve(repoRoot, "apps/web/dist/client/assets");
const publicAssets = resolve(repoRoot, "apps/web/public/assets");
const kib = 1024;

if (!existsSync(clientAssets)) {
  throw new Error(
    "Missing apps/web/dist/client/assets. Run the production web build first.",
  );
}

type ChunkBudget = {
  label: string;
  match: RegExp;
  maxGzipKib: number;
};

const chunkBudgets: ChunkBudget[] = [
  {
    label: "shared application entry",
    match: /^index-[\w-]+\.js$/,
    maxGzipKib: 300,
  },
  {
    label: "about/3D route",
    match: /^gioi-thieu-[\w-]+\.js$/,
    maxGzipKib: 300,
  },
  {
    label: "application stylesheet",
    match: /^index-[\w-]+\.css$/,
    maxGzipKib: 32,
  },
];

const assetFiles = readdirSync(clientAssets, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
const failures: string[] = [];
const chunkResults: string[] = [];

for (const budget of chunkBudgets) {
  const matches = assetFiles.filter((name) => budget.match.test(name));
  if (matches.length !== 1) {
    failures.push(
      `${budget.label}: expected one production artifact, found ${matches.length}`,
    );
    continue;
  }

  const name = matches[0]!;
  const raw = readFileSync(join(clientAssets, name));
  const gzipKib = gzipSync(raw).byteLength / kib;
  chunkResults.push(
    `${budget.label}: ${gzipKib.toFixed(1)} KiB gzip / ${budget.maxGzipKib} KiB`,
  );
  if (gzipKib > budget.maxGzipKib) {
    failures.push(
      `${budget.label} is ${gzipKib.toFixed(1)} KiB gzip (limit ${budget.maxGzipKib} KiB)`,
    );
  }
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const rasterPattern = /\.(?:avif|jpe?g|png|webp)$/i;
const rasterAssets = walk(publicAssets)
  .filter((path) => rasterPattern.test(path))
  .map((path) => ({ path, bytes: statSync(path).size }))
  .sort((left, right) => right.bytes - left.bytes);
const imageHardLimit = 2 * 1024 * 1024;
const imageReviewTarget = 500 * kib;
const reviewImages = rasterAssets.filter(
  (asset) => asset.bytes > imageReviewTarget,
);
const largestRasterKib = (rasterAssets[0]?.bytes ?? 0) / kib;

for (const asset of rasterAssets) {
  if (asset.bytes > imageHardLimit) {
    failures.push(
      `${relative(publicAssets, asset.path)} is ${(asset.bytes / kib).toFixed(0)} KiB (hard limit 2048 KiB)`,
    );
  }
}

console.log("Performance budget audit");
for (const result of chunkResults) console.log(`- ${result}`);
console.log(
  `- public raster assets: ${rasterAssets.length}; largest ${largestRasterKib.toFixed(0)} KiB; hard limit 2048 KiB`,
);

if (reviewImages.length > 0) {
  console.warn(
    `- review queue (>500 KiB): ${reviewImages
      .map(
        (asset) =>
          `${relative(publicAssets, asset.path)} ${(asset.bytes / kib).toFixed(0)} KiB`,
      )
      .join(", ")}`,
  );
}

if (failures.length > 0) {
  throw new Error(`Performance budget failed:\n- ${failures.join("\n- ")}`);
}

console.log("Performance budget PASS");
