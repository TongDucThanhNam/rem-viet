import { access, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { verifyCmsSiteArtifacts } from "@agency/cms-cli";

import {
  handoverChecklist,
  readSiteManifest,
  repoRoot,
  validateClientEnvExample,
} from "./site-lib";

export type SiteVerificationResult = {
  ok: true;
  site: string;
  preset: string;
  features: Record<string, boolean>;
  resources: Record<string, string>;
  checks: {
    manifest: "valid";
    envTemplate: "strict" | "checklist";
    handover: "complete";
    seedBrandIsolation: "valid";
    seedAssets: string;
    resourceNames: "unique";
  };
};

/** Callable implementation behind `bun run site:verify --site=<slug>`. */
export async function verifySite(
  site: string,
): Promise<SiteVerificationResult> {
  if (!site) throw new Error("Thiếu --site=<client-slug>.");
  const { manifest, path: manifestPath, source } = await readSiteManifest(site);
  const directory = resolve(repoRoot, "sites", site);
  const requiredPaths =
    source === "client"
      ? [
          manifestPath,
          resolve(directory, ".env.example"),
          resolve(directory, "seed.sql"),
          resolve(directory, "HANDOVER.md"),
        ]
      : [
          manifestPath,
          resolve(repoRoot, "apps/web/env.example"),
          resolve(repoRoot, "packages/db/seeds/home.sql"),
          resolve(repoRoot, "docs/client-manual-vi.md"),
          resolve(repoRoot, "docs/agency-operations-runbook.md"),
        ];
  for (const path of requiredPaths) await access(path);

  const envPath =
    source === "client"
      ? resolve(directory, ".env.example")
      : resolve(repoRoot, "apps/web/env.example");
  const seedPaths =
    source === "client"
      ? [resolve(directory, "seed.sql")]
      : [
          ...(manifest.features.blog
            ? [resolve(repoRoot, "packages/db/seeds/posts.sql")]
            : []),
          resolve(repoRoot, "packages/db/seeds/home.sql"),
        ];
  const envFile = await readFile(envPath, "utf8");
  const seedFile = (
    await Promise.all(seedPaths.map((path) => readFile(path, "utf8")))
  ).join("\n");
  let verifiedAssetCount = 0;

  if (source === "client") {
    validateClientEnvExample(manifest, envFile);
    const handover = await readFile(resolve(directory, "HANDOVER.md"), "utf8");
    for (const marker of handoverChecklist(manifest)
      .split("\n")
      .filter((line) => line.startsWith("- [ ]"))) {
      if (!handover.includes(marker)) {
        throw new Error(`Missing handover checklist item: ${marker}`);
      }
    }

    const publicDirectory = resolve(repoRoot, "apps/web/public");
    const assetReferences = new Set(
      [
        manifest.brand.logo,
        ...[
          ...seedFile.matchAll(
            /"(\/[^"\s]+\.(?:avif|gif|jpe?g|png|svg|webp))"/gi,
          ),
        ].map((match) => match[1]),
      ].filter((reference) => reference.startsWith("/")),
    );
    for (const reference of assetReferences) {
      const assetPath = resolve(publicDirectory, reference.slice(1));
      const assetRelativePath = relative(publicDirectory, assetPath);
      if (
        assetRelativePath.startsWith("..") ||
        assetRelativePath.includes(":")
      ) {
        throw new Error(`Seed asset escapes public directory: ${reference}`);
      }
      try {
        await access(assetPath);
      } catch (error) {
        throw new Error(`Missing client seed asset: ${reference}`, {
          cause: error,
        });
      }
    }
    verifiedAssetCount = assetReferences.size;
  } else {
    for (const secret of [
      "BETTER_AUTH_SECRET",
      "ADMIN_EMAILS",
      "CMS_BOOTSTRAP_PASSWORD",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
    ]) {
      if (!envFile.includes(`${secret}=`)) {
        throw new Error(`Missing ${secret} checklist`);
      }
    }
  }

  verifyCmsSiteArtifacts({
    siteId: manifest.id,
    files: requiredPaths.map((path) => relative(repoRoot, path)),
    requiredFiles: requiredPaths.map((path) => relative(repoRoot, path)),
    resources: manifest.infrastructure,
    forbiddenContent:
      manifest.id === "rem-viet"
        ? []
        : [/Rèm Vina|Rèm Việt|rem-viet-(?:web|db|media)/i],
    content: seedFile,
  });

  return {
    ok: true,
    site: manifest.id,
    preset: manifest.preset,
    features: manifest.features,
    resources: manifest.infrastructure,
    checks: {
      manifest: "valid",
      envTemplate: source === "client" ? "strict" : "checklist",
      handover: "complete",
      seedBrandIsolation: "valid",
      seedAssets:
        source === "client"
          ? `${verifiedAssetCount} present`
          : "not-applicable",
      resourceNames: "unique",
    },
  };
}
