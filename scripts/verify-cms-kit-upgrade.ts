import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const runRoot = join(repositoryRoot, ".tmp", `cms-kit-upgrade-${Date.now()}`);
const baselineArtifacts = join(runRoot, "artifacts", "baseline");
const nextArtifacts = join(runRoot, "artifacts", "next");
const stagedPackages = join(runRoot, "staged-packages");
const consumerDirectory = join(runRoot, "consumer");
const baselineVersion = "0.1.0";
const nextVersion = "0.2.0-rehearsal.1";
const rootManifest = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
) as { workspaces: { catalog: Record<string, string> } };
const catalog = rootManifest.workspaces.catalog;
const packageDirectories = [
  "cms-core",
  "cms-runtime",
  "cms-provider-cloudflare",
  "cms-react",
  "cms-admin",
  "cms-alchemy",
  "cms-cli",
  "cms-template-factory",
  "cms-template-rem-viet",
  "cms-visual-editor",
] as const;

for (const directory of [
  baselineArtifacts,
  nextArtifacts,
  stagedPackages,
  consumerDirectory,
]) {
  mkdirSync(directory, { recursive: true });
}
cpSync(
  join(repositoryRoot, "fixtures", "cms-kit-upgrade-consumer"),
  consumerDirectory,
  { recursive: true },
);

function run(command: string[], cwd: string, env: Record<string, string> = {}) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...env },
    stderr: "inherit",
    stdout: "pipe",
  });
  const output = result.stdout.toString().trim();
  if (output) console.log(output);
  if (!result.success) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
  return output;
}

function artifactFilename(packageDirectory: string, version: string) {
  return `agency-${packageDirectory}-${version}.tgz`;
}

for (const packageDirectory of packageDirectories) {
  run(
    ["bun", "pm", "pack", `--destination=${baselineArtifacts}`],
    join(repositoryRoot, "packages", packageDirectory),
  );

  const stagedDirectory = join(stagedPackages, packageDirectory);
  cpSync(join(repositoryRoot, "packages", packageDirectory), stagedDirectory, {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });
  const manifestPath = join(stagedDirectory, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    version: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  manifest.version = nextVersion;
  for (const dependencyMap of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
  ]) {
    if (!dependencyMap) continue;
    for (const [name, version] of Object.entries(dependencyMap)) {
      if (version === "catalog:") {
        const concrete = catalog[name];
        if (!concrete)
          throw new Error(`Missing root catalog version for ${name}.`);
        dependencyMap[name] = concrete;
      } else if (
        name.startsWith("@agency/") &&
        (version === baselineVersion || version === "workspace:*")
      ) {
        dependencyMap[name] = nextVersion;
      } else if (version === "workspace:*") {
        dependencyMap[name] = "0.0.0";
      }
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run(["bun", "pm", "pack", `--destination=${nextArtifacts}`], stagedDirectory);
}

function artifactPath(
  packageDirectory: string,
  version: string,
  directory: string,
) {
  return `file:${relative(
    consumerDirectory,
    join(directory, artifactFilename(packageDirectory, version)),
  ).replaceAll("\\", "/")}`;
}

function installVersion(version: string, directory: string) {
  const dependencies = Object.fromEntries(
    packageDirectories.map((packageDirectory) => [
      `@agency/${packageDirectory}`,
      artifactPath(packageDirectory, version, directory),
    ]),
  );
  writeFileSync(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "cms-kit-upgrade-consumer",
        version: "0.0.0",
        private: true,
        type: "module",
        dependencies: {
          ...dependencies,
          "@libsql/client": "0.15.15",
          react: "^19.2.3",
          zod: "^4.1.13",
        },
      },
      null,
      2,
    )}\n`,
  );
  run(["bun", "install", "--force"], consumerDirectory);
}

function verify(packageVersion: string, schemaVersion: number) {
  return JSON.parse(
    run(["bun", "verify.ts"], consumerDirectory, {
      EXPECTED_PACKAGE_VERSION: packageVersion,
      EXPECTED_SCHEMA_VERSION: String(schemaVersion),
    }),
  ) as Record<string, unknown>;
}

installVersion(baselineVersion, baselineArtifacts);
const baseline = verify(baselineVersion, 1);
const providerBaseline = JSON.parse(
  run(["bun", "bootstrap-provider.ts"], consumerDirectory),
) as Record<string, unknown>;

installVersion(nextVersion, nextArtifacts);
const upgrade = JSON.parse(
  run(["bun", "upgrade.ts"], consumerDirectory),
) as Record<string, unknown>;
const upgraded = verify(nextVersion, 2);
const providerUpgraded = JSON.parse(
  run(["bun", "verify-provider.ts"], consumerDirectory),
) as Record<string, unknown>;

const rollback = JSON.parse(
  run(["bun", "rollback.ts"], consumerDirectory),
) as Record<string, unknown>;
const migrationReceipt = JSON.parse(
  readFileSync(join(consumerDirectory, "migration.receipt.json"), "utf8"),
) as {
  status?: unknown;
  backupCompletedAt?: unknown;
  migrationStartedAt?: unknown;
  backup?: { sha256?: unknown };
};
const backupCompletedAt = Date.parse(
  String(migrationReceipt.backupCompletedAt),
);
const migrationStartedAt = Date.parse(
  String(migrationReceipt.migrationStartedAt),
);
if (
  migrationReceipt.status !== "applied" ||
  typeof migrationReceipt.backupCompletedAt !== "string" ||
  typeof migrationReceipt.migrationStartedAt !== "string" ||
  !Number.isFinite(backupCompletedAt) ||
  !Number.isFinite(migrationStartedAt) ||
  backupCompletedAt > migrationStartedAt ||
  migrationReceipt.backup?.sha256 !== upgrade.backupSha256 ||
  rollback.backupSha256 !== upgrade.backupSha256
) {
  throw new Error(
    "Upgrade receipt does not prove backup-before-migrate and receipt-bound rollback.",
  );
}
installVersion(baselineVersion, baselineArtifacts);
const rolledBack = verify(baselineVersion, 1);
const providerRolledBack = JSON.parse(
  run(["bun", "verify-provider.ts"], consumerDirectory),
) as Record<string, unknown>;

function artifactDigests(directory: string, version: string) {
  return Object.fromEntries(
    packageDirectories.map((packageDirectory) => {
      const filename = artifactFilename(packageDirectory, version);
      return [
        `@agency/${packageDirectory}@${version}`,
        createHash("sha256")
          .update(readFileSync(join(directory, filename)))
          .digest("hex"),
      ];
    }),
  );
}

const receipt = {
  ok: true,
  consumer: "independent-upgrade-fixture",
  baseline,
  providerBaseline,
  upgrade,
  migrationReceipt,
  upgraded,
  providerUpgraded,
  rollback,
  rolledBack,
  providerRolledBack,
  artifacts: {
    baseline: artifactDigests(baselineArtifacts, baselineVersion),
    next: artifactDigests(nextArtifacts, nextVersion),
  },
};
const receiptPath = join(runRoot, "upgrade-rehearsal.receipt.json");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
