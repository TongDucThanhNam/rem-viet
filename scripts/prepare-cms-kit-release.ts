import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  assertCmsKitArtifactPolicy,
  assertCmsKitCompatibilityMatrix,
  assertCmsKitReleaseNotes,
  createCmsKitReleaseProvenance,
} from "./cms-kit-release-lib";
import { buildCmsKitPublishArtifact } from "./cms-kit-package-artifact";

const repositoryRoot = resolve(import.meta.dir, "..");
const version =
  process.argv
    .find((value) => value.startsWith("--version="))
    ?.slice("--version=".length) ?? "";
const allowDirty = process.argv.includes("--allow-dirty");
if (!version) throw new Error("Missing --version=<semver>.");

const packageDirectories = [
  "cms-core",
  "cms-runtime",
  "cms-provider-cloudflare",
  "cms-react",
  "cms-admin",
  "cms-alchemy",
  "cms-cli",
  "cms-template-atelier",
  "cms-template-factory",
  "cms-template-rem-viet",
  "cms-visual-editor",
] as const;
const runRoot = join(
  repositoryRoot,
  ".tmp",
  "cms-kit-release",
  `${version}-${Date.now()}`,
);
const artifactDirectory = join(runRoot, "artifacts");
mkdirSync(artifactDirectory, { recursive: true });

function git(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

const commit = git(["rev-parse", "HEAD"]) || "unknown";
const status = git(["status", "--porcelain", "--untracked-files=normal"]);
const sourceState =
  commit === "unknown" ? "unknown" : status ? "dirty" : "clean";
if (sourceState !== "clean" && !allowDirty) {
  throw new Error(
    "Release preparation requires a clean checkout; use --allow-dirty only for a non-publishable local rehearsal.",
  );
}

const compatibilityPath = join(
  repositoryRoot,
  "docs",
  "releases",
  "cms-kit-compatibility.json",
);
assertCmsKitCompatibilityMatrix(
  JSON.parse(readFileSync(compatibilityPath, "utf8")),
  version,
);
const changelogPath = join(
  repositoryRoot,
  "docs",
  "releases",
  "cms-kit-changelog.md",
);
const migrationNotesPath = join(
  repositoryRoot,
  "docs",
  "releases",
  "cms-kit-migrations.json",
);
assertCmsKitReleaseNotes({
  releaseVersion: version,
  changelog: readFileSync(changelogPath, "utf8"),
  migrations: JSON.parse(readFileSync(migrationNotesPath, "utf8")),
});

function digest(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function inspectArtifact(packageName: string, artifactPath: string) {
  const listed = Bun.spawnSync(["tar", "-tzf", artifactPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!listed.success) {
    throw new Error(`Could not inspect ${packageName} artifact entries.`);
  }
  const entries = listed.stdout
    .toString()
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const textFiles = Object.fromEntries(
    entries.map((entry) => {
      const extracted = Bun.spawnSync(["tar", "-xOzf", artifactPath, entry], {
        stdout: "pipe",
        stderr: "pipe",
      });
      if (!extracted.success) {
        throw new Error(`Could not inspect ${packageName} file ${entry}.`);
      }
      return [entry, extracted.stdout.toString()];
    }),
  );
  return assertCmsKitArtifactPolicy({ packageName, entries, textFiles });
}

const packages = packageDirectories.map((directory) => {
  const packageDirectory = join(repositoryRoot, "packages", directory);
  const manifest = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  ) as { name: string; version: string };
  if (manifest.version !== version) {
    throw new Error(
      `${manifest.name} is ${manifest.version}; expected coordinated ${version}.`,
    );
  }
  const built = buildCmsKitPublishArtifact({
    packageDirectory,
    destinationDirectory: artifactDirectory,
  });
  if (built.name !== manifest.name || built.version !== manifest.version) {
    throw new Error(`Packed identity changed for ${manifest.name}.`);
  }
  return {
    name: manifest.name,
    version: manifest.version,
    artifact: `artifacts/${built.artifactName}`,
    sha256: digest(built.artifactPath),
    size: statSync(built.artifactPath).size,
    artifactPolicy: inspectArtifact(manifest.name, built.artifactPath),
  };
});

const provenance = createCmsKitReleaseProvenance({
  version,
  commit,
  sourceState,
  lockSha256: digest(join(repositoryRoot, "bun.lock")),
  compatibilitySha256: digest(compatibilityPath),
  changelogSha256: digest(changelogPath),
  migrationNotesSha256: digest(migrationNotesPath),
  packages,
  generatedAt: new Date().toISOString(),
});
const publishPlan = {
  schemaVersion: 1,
  registry: "${CMS_PRIVATE_REGISTRY_URL}",
  access: "restricted",
  tokenEnvironmentVariable: "CMS_PRIVATE_REGISTRY_TOKEN",
  publishEligible: provenance.publishEligible,
  requiredConfirmation: `PUBLISH CMS KIT ${provenance.version} ${provenance.source.commit}`,
  commands: provenance.packages.map(
    (entry) =>
      `npm publish ${entry.artifact} --registry \"$CMS_PRIVATE_REGISTRY_URL\" --access restricted --ignore-scripts`,
  ),
  publisher:
    "bun run cms:kit:release:publish --bundle=<prepared-bundle> --confirm=<requiredConfirmation>",
  note: "Preparation never publishes. The separate publisher revalidates clean provenance and writes a verification receipt.",
};
writeFileSync(
  join(runRoot, "provenance.json"),
  `${JSON.stringify(provenance, null, 2)}\n`,
);
writeFileSync(
  join(runRoot, "publish-plan.json"),
  `${JSON.stringify(publishPlan, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      ok: true,
      bundle: relative(repositoryRoot, runRoot).replaceAll("\\", "/"),
      publishEligible: provenance.publishEligible,
      packageCount: provenance.packages.length,
      sourceState,
    },
    null,
    2,
  ),
);
