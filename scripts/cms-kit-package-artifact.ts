import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `CMS Kit artifact command failed: ${command} ${args[0] ?? ""}.`,
    );
  }
}

/** Produces the exact publishable tarball without mutating the private workspace manifest. */
export function buildCmsKitPublishArtifact(input: {
  packageDirectory: string;
  destinationDirectory: string;
}) {
  const sourceManifest = JSON.parse(
    readFileSync(join(input.packageDirectory, "package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown };
  if (
    typeof sourceManifest.name !== "string" ||
    !sourceManifest.name.startsWith("@agency/") ||
    typeof sourceManifest.version !== "string"
  ) {
    throw new Error("CMS Kit source package manifest is invalid.");
  }
  mkdirSync(input.destinationDirectory, { recursive: true });
  const workspace = mkdtempSync(join(tmpdir(), "cms-kit-publish-artifact-"));
  const rawDirectory = join(workspace, "raw");
  const extractedDirectory = join(workspace, "extracted");
  mkdirSync(rawDirectory);
  mkdirSync(extractedDirectory);
  const artifactName = `${sourceManifest.name.slice(1).replace("/", "-")}-${sourceManifest.version}.tgz`;

  try {
    run(
      "bun",
      ["pm", "pack", `--destination=${rawDirectory}`],
      input.packageDirectory,
    );
    const rawArtifact = join(rawDirectory, artifactName);
    run("tar", ["-xzf", rawArtifact, "-C", extractedDirectory], workspace);
    const stagedPackage = join(extractedDirectory, "package");
    const stagedManifestPath = join(stagedPackage, "package.json");
    const stagedManifest = JSON.parse(
      readFileSync(stagedManifestPath, "utf8"),
    ) as Record<string, unknown>;
    delete stagedManifest.private;
    writeFileSync(
      stagedManifestPath,
      `${JSON.stringify(stagedManifest, null, 2)}\n`,
    );
    run(
      process.platform === "win32" ? "npm.cmd" : "npm",
      [
        "pack",
        "--ignore-scripts",
        `--pack-destination=${input.destinationDirectory}`,
      ],
      stagedPackage,
    );
    return Object.freeze({
      name: sourceManifest.name,
      version: sourceManifest.version,
      artifactName,
      artifactPath: join(input.destinationDirectory, artifactName),
    });
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
}
