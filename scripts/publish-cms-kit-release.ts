import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCmsKitPreparedProvenance,
  createCmsKitPublicationReceipt,
  createCmsKitPublishRequest,
} from "./cms-kit-release-lib";
import { buildCmsKitPublishArtifact } from "./cms-kit-package-artifact";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(repositoryRoot, ".tmp", "cms-kit-release");
const bundleArgument =
  process.argv
    .find((value) => value.startsWith("--bundle="))
    ?.slice("--bundle=".length) ?? "";
const confirmation =
  process.argv
    .find((value) => value.startsWith("--confirm="))
    ?.slice("--confirm=".length) ?? "";
if (!bundleArgument) throw new Error("Missing --bundle=<prepared-bundle>.");

const bundle = resolve(repositoryRoot, bundleArgument);
const relativeBundle = relative(releaseRoot, bundle);
if (
  !relativeBundle ||
  relativeBundle.startsWith("..") ||
  isAbsolute(relativeBundle)
) {
  throw new Error(
    "CMS Kit publication bundle must be under .tmp/cms-kit-release.",
  );
}

function readJson<T>(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function digest(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function git(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error("Could not verify the CMS Kit release checkout.");
  }
  return result.stdout.trim();
}

const provenancePath = join(bundle, "provenance.json");
const publishPlanPath = join(bundle, "publish-plan.json");
const provenance = assertCmsKitPreparedProvenance(
  readJson<unknown>(provenancePath),
);
const publishPlan = readJson<{
  schemaVersion?: unknown;
  registry?: unknown;
  access?: unknown;
  tokenEnvironmentVariable?: unknown;
  publishEligible?: unknown;
  requiredConfirmation?: unknown;
  commands?: unknown[];
  publisher?: unknown;
}>(publishPlanPath);
const expectedConfirmation = `PUBLISH CMS KIT ${provenance.version} ${provenance.source.commit}`;
const expectedCommands = provenance.packages.map(
  (entry) =>
    `npm publish ${entry.artifact} --registry \"$CMS_PRIVATE_REGISTRY_URL\" --access restricted --ignore-scripts`,
);
if (
  publishPlan.schemaVersion !== 1 ||
  publishPlan.registry !== "${CMS_PRIVATE_REGISTRY_URL}" ||
  publishPlan.access !== "restricted" ||
  publishPlan.tokenEnvironmentVariable !== "CMS_PRIVATE_REGISTRY_TOKEN" ||
  publishPlan.publishEligible !== true ||
  publishPlan.requiredConfirmation !== expectedConfirmation ||
  !Array.isArray(publishPlan.commands) ||
  JSON.stringify(publishPlan.commands) !== JSON.stringify(expectedCommands) ||
  publishPlan.publisher !==
    "bun run cms:kit:release:publish --bundle=<prepared-bundle> --confirm=<requiredConfirmation>"
) {
  throw new Error("CMS Kit publish plan is incomplete or non-publishable.");
}

const head = git(["rev-parse", "HEAD"]);
const checkoutState = git([
  "status",
  "--porcelain",
  "--untracked-files=normal",
]);
if (head !== provenance.source.commit || checkoutState) {
  throw new Error(
    "CMS Kit publication requires the exact clean prepared checkout.",
  );
}

for (const [path, expected] of [
  [join(repositoryRoot, "bun.lock"), provenance.source.lockSha256],
  [
    join(repositoryRoot, "docs", "releases", "cms-kit-compatibility.json"),
    provenance.source.compatibilitySha256,
  ],
  [
    join(repositoryRoot, "docs", "releases", "cms-kit-changelog.md"),
    provenance.source.changelogSha256,
  ],
  [
    join(repositoryRoot, "docs", "releases", "cms-kit-migrations.json"),
    provenance.source.migrationNotesSha256,
  ],
] as const) {
  if (digest(path) !== expected) {
    throw new Error("CMS Kit release inputs changed after preparation.");
  }
}

for (const entry of provenance.packages) {
  const artifactPath = join(bundle, entry.artifact);
  if (
    statSync(artifactPath).size !== entry.size ||
    digest(artifactPath) !== entry.sha256
  ) {
    throw new Error(
      `CMS Kit artifact changed after preparation: ${entry.name}.`,
    );
  }
}

const sourceVerificationDirectory = join(bundle, ".source-pack-verification");
if (existsSync(sourceVerificationDirectory)) {
  throw new Error(
    "CMS Kit bundle contains stale source-pack verification state.",
  );
}
mkdirSync(sourceVerificationDirectory);
try {
  for (const entry of provenance.packages) {
    const rebuilt = buildCmsKitPublishArtifact({
      packageDirectory: join(
        repositoryRoot,
        "packages",
        entry.name.slice("@agency/".length),
      ),
      destinationDirectory: sourceVerificationDirectory,
    });
    if (
      rebuilt.artifactName !== entry.artifact.slice("artifacts/".length) ||
      statSync(rebuilt.artifactPath).size !== entry.size ||
      digest(rebuilt.artifactPath) !== entry.sha256
    ) {
      throw new Error(
        `CMS Kit artifact does not reproduce from the clean source: ${entry.name}.`,
      );
    }
  }
} finally {
  rmSync(sourceVerificationDirectory, { force: true, recursive: true });
}

const registry = process.env.CMS_PRIVATE_REGISTRY_URL ?? "";
const token = process.env.CMS_PRIVATE_REGISTRY_TOKEN ?? "";
const request = createCmsKitPublishRequest(provenance, {
  registry,
  tokenPresent: Boolean(token),
  confirmation,
});
const registryUrl = new URL(request.registry);
const registryPath = registryUrl.pathname.endsWith("/")
  ? registryUrl.pathname
  : `${registryUrl.pathname}/`;
const userConfigPath = join(bundle, ".npmrc.publish");
const partialReceiptPath = join(bundle, "publication-receipt.partial.json");
const receiptPath = join(bundle, "publication-receipt.json");
if (
  existsSync(userConfigPath) ||
  existsSync(partialReceiptPath) ||
  existsSync(receiptPath)
) {
  throw new Error(
    "CMS Kit bundle already contains publication state; reconcile it before continuing.",
  );
}
writeFileSync(
  userConfigPath,
  `//${registryUrl.host}${registryPath}:_authToken=\${CMS_PRIVATE_REGISTRY_TOKEN}\nalways-auth=true\n`,
  { flag: "wx" },
);

const childEnvironment = {
  ...process.env,
  CMS_PRIVATE_REGISTRY_TOKEN: token,
  NPM_CONFIG_USERCONFIG: userConfigPath,
};

function npm(args: string[]) {
  return spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: bundle,
    env: childEnvironment,
    encoding: "utf8",
    windowsHide: true,
  });
}

function packageSpec(name: string, version: string) {
  return `${name}@${version}`;
}

const published: Array<{
  name: string;
  version: string;
  sha256: string;
  publishedAt: string;
  verifiedAt: string;
}> = [];

try {
  for (const entry of request.packages) {
    const result = npm([
      "view",
      packageSpec(entry.name, entry.version),
      "version",
      "--json",
      "--registry",
      request.registry,
    ]);
    if (result.status === 0) {
      throw new Error(
        `${entry.name}@${entry.version} already exists in the private registry.`,
      );
    }
    const errorText = result.stderr ?? "";
    if (!/E404|404 Not Found/i.test(errorText)) {
      throw new Error(
        `Private registry preflight failed for ${entry.name}; no packages were published.`,
      );
    }
  }

  for (const entry of request.packages) {
    const artifactPath = join(bundle, entry.artifact);
    const result = npm([
      "publish",
      artifactPath,
      "--registry",
      request.registry,
      "--access",
      "restricted",
      "--ignore-scripts",
    ]);
    if (result.status !== 0) {
      throw new Error(
        `Private registry publication failed for ${entry.name}; retain the partial receipt and do not retry blindly.`,
      );
    }
    const partial = {
      schemaVersion: 1,
      subject: request.subject,
      status: "published-unverified",
      registry: request.registry,
      packages: [
        ...published,
        {
          name: entry.name,
          version: entry.version,
          sha256: entry.sha256,
          publishedAt: new Date().toISOString(),
          verifiedAt: "",
        },
      ],
    };
    writeFileSync(partialReceiptPath, `${JSON.stringify(partial, null, 2)}\n`);

    const verification = npm([
      "view",
      packageSpec(entry.name, entry.version),
      "version",
      "--json",
      "--registry",
      request.registry,
    ]);
    if (verification.status !== 0) {
      throw new Error(
        `Published package could not be verified: ${entry.name}@${entry.version}.`,
      );
    }
    let verifiedVersion: unknown;
    try {
      verifiedVersion = JSON.parse(verification.stdout ?? "");
    } catch {
      throw new Error(
        `Private registry returned invalid verification data for ${entry.name}.`,
      );
    }
    if (verifiedVersion !== entry.version) {
      throw new Error(
        `Private registry version mismatch for ${entry.name}@${entry.version}.`,
      );
    }
    published.push({
      name: entry.name,
      version: entry.version,
      sha256: entry.sha256,
      publishedAt: partial.packages.at(-1)!.publishedAt,
      verifiedAt: new Date().toISOString(),
    });
    writeFileSync(
      partialReceiptPath,
      `${JSON.stringify(
        {
          ...partial,
          status: "publishing",
          packages: published,
        },
        null,
        2,
      )}\n`,
    );
  }

  const receipt = createCmsKitPublicationReceipt(
    request,
    published,
    new Date().toISOString(),
  );
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx",
  });
  rmSync(partialReceiptPath, { force: true });
  console.log(
    JSON.stringify(
      {
        ok: true,
        subject: receipt.subject,
        packageCount: receipt.packages.length,
        receipt: relative(repositoryRoot, receiptPath).replaceAll("\\", "/"),
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(userConfigPath, { force: true });
}
