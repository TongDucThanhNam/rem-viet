import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { migrateCmsValue } from "@agency/cms-cli";

const expectedPackageVersion = process.env.EXPECTED_PACKAGE_VERSION ?? "";
const expectedSchemaVersion = Number(
  process.env.EXPECTED_SCHEMA_VERSION ?? "0",
);
if (!expectedPackageVersion || !expectedSchemaVersion) {
  throw new Error("Expected package and schema versions are required.");
}

const packageNames = [
  "cms-core",
  "cms-runtime",
  "cms-provider-cloudflare",
  "cms-react",
  "cms-admin",
  "cms-alchemy",
  "cms-cli",
  "cms-template-rem-viet",
] as const;
const installedVersions: Record<string, string> = {};
for (const packageName of packageNames) {
  const manifest = JSON.parse(
    await readFile(
      resolve(
        import.meta.dir,
        "node_modules",
        "@agency",
        packageName,
        "package.json",
      ),
      "utf8",
    ),
  ) as { version: string };
  if (manifest.version !== expectedPackageVersion) {
    throw new Error(
      `${packageName} is ${manifest.version}; expected ${expectedPackageVersion}.`,
    );
  }
  installedVersions[packageName] = manifest.version;
}

const content = JSON.parse(
  await readFile(resolve(import.meta.dir, "content.json"), "utf8"),
) as { schemaVersion: number; title: string; summary?: string };
if (content.schemaVersion !== expectedSchemaVersion) {
  throw new Error(
    `Content schema is ${content.schemaVersion}; expected ${expectedSchemaVersion}.`,
  );
}
if (expectedSchemaVersion === 2 && content.summary !== "Migrated safely") {
  throw new Error("Version 2 content is missing its migrated summary.");
}
if (expectedSchemaVersion === 1 && "summary" in content) {
  throw new Error("Rollback did not restore the version 1 content snapshot.");
}

const noOp = migrateCmsValue({
  value: content,
  currentVersion: content.schemaVersion,
  targetVersion: content.schemaVersion,
  migrations: [],
});
if (noOp.version !== expectedSchemaVersion) {
  throw new Error("Installed CLI failed the no-op compatibility check.");
}

console.log(
  JSON.stringify({
    ok: true,
    installedVersions,
    schemaVersion: content.schemaVersion,
    title: content.title,
  }),
);
