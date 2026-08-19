export type CmsKitReleasePackage = Readonly<{
  name: string;
  version: string;
  artifact: string;
  sha256: string;
  size: number;
  artifactPolicy: Readonly<{
    status: "passed";
    fileCount: number;
    textFileCount: number;
  }>;
}>;

export type CmsKitReleaseProvenanceInput = {
  version: string;
  commit: string;
  sourceState: "clean" | "dirty" | "unknown";
  lockSha256: string;
  compatibilitySha256: string;
  changelogSha256: string;
  migrationNotesSha256: string;
  packages: readonly CmsKitReleasePackage[];
  generatedAt: string;
};

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const digestPattern = /^[0-9a-f]{64}$/;
export const cmsKitPackageNames = Object.freeze([
  "@agency/cms-admin",
  "@agency/cms-alchemy",
  "@agency/cms-cli",
  "@agency/cms-core",
  "@agency/cms-provider-cloudflare",
  "@agency/cms-react",
  "@agency/cms-runtime",
  "@agency/cms-template-atelier",
  "@agency/cms-template-factory",
  "@agency/cms-template-rem-viet",
  "@agency/cms-visual-editor",
] as const);
const neutralPackages = new Set([
  "@agency/cms-core",
  "@agency/cms-runtime",
  "@agency/cms-provider-cloudflare",
  "@agency/cms-react",
  "@agency/cms-admin",
  "@agency/cms-alchemy",
  "@agency/cms-cli",
  "@agency/cms-template-atelier",
  "@agency/cms-template-factory",
  "@agency/cms-visual-editor",
]);
const privateBrandPattern = /@rem-viet|rem-viet|Rèm Việt|terasumi/i;
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const assignedSecretPattern =
  /(?:^|\n)\s*(?:NPM_TOKEN|CMS_PRIVATE_REGISTRY_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_API_KEY)\s*=\s*[^\s$<{][^\r\n]{7,}/i;

export function assertCmsKitCompatibilityMatrix(
  value: unknown,
  releaseVersion: string,
) {
  const matrix = value as {
    schemaVersion?: unknown;
    current?: unknown;
    schemas?: Record<string, unknown>;
    validatedWith?: Record<string, unknown>;
    rehearsals?: unknown;
  };
  const requiredVersions = [
    "bun",
    "typescript",
    "react",
    "vite",
    "tanstackReactRouter",
    "tanstackReactStart",
    "alchemy",
  ];
  if (
    !matrix ||
    matrix.schemaVersion !== 1 ||
    matrix.current !== releaseVersion ||
    matrix.schemas?.remVietBlock !== 1 ||
    matrix.schemas?.cloudflareProvider !== 1 ||
    typeof matrix.schemas?.cloudflareMigrationsThrough !== "string" ||
    !Array.isArray(matrix.rehearsals) ||
    !requiredVersions.every(
      (key) =>
        typeof matrix.validatedWith?.[key] === "string" &&
        Boolean(String(matrix.validatedWith[key]).trim()),
    )
  ) {
    throw new Error(
      `CMS Kit compatibility matrix is incomplete or does not match ${releaseVersion}.`,
    );
  }
  return matrix;
}

export function assertCmsKitReleaseNotes(input: {
  releaseVersion: string;
  changelog: string;
  migrations: unknown;
}) {
  const migrationNotes = input.migrations as {
    schemaVersion?: unknown;
    current?: unknown;
    releases?: Array<Record<string, unknown>>;
  };
  const release = migrationNotes?.releases?.find(
    (entry) => entry.version === input.releaseVersion,
  );
  const escapedVersion = input.releaseVersion.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  if (
    !new RegExp(`^## ${escapedVersion}(?:\\s|$)`, "m").test(input.changelog) ||
    migrationNotes?.schemaVersion !== 1 ||
    migrationNotes.current !== input.releaseVersion ||
    !release ||
    typeof release.providerMigration !== "string" ||
    typeof release.rollback !== "string" ||
    !Array.isArray(release.verification) ||
    release.verification.length === 0
  ) {
    throw new Error(
      `CMS Kit changelog or migration notes do not cover ${input.releaseVersion}.`,
    );
  }
  return Object.freeze({ release });
}

export function assertCmsKitArtifactPolicy(input: {
  packageName: string;
  entries: readonly string[];
  textFiles: Readonly<Record<string, string>>;
}) {
  if (!input.packageName.startsWith("@agency/")) {
    throw new Error(`Invalid CMS Kit artifact package: ${input.packageName}.`);
  }
  const entries = input.entries.map((entry) =>
    entry.replaceAll("\\", "/").replace(/^\.\//, ""),
  );
  if (!entries.length || new Set(entries).size !== entries.length) {
    throw new Error(
      `${input.packageName} has an empty or duplicate file list.`,
    );
  }
  const allowed = entries.every(
    (entry) =>
      entry === "package/package.json" ||
      entry === "package/README.md" ||
      /^package\/LICENSE(?:\.[A-Za-z0-9]+)?$/.test(entry) ||
      /^package\/src\/(?!.*(?:^|\/)(?:tests?|fixtures?)(?:\/|$))(?!.*\.map$)[A-Za-z0-9_./-]+\.(?:ts|tsx|json|css|md)$/.test(
        entry,
      ),
  );
  if (!allowed || !entries.includes("package/package.json")) {
    throw new Error(
      `${input.packageName} contains a file outside the publish allowlist.`,
    );
  }
  let manifest: { private?: unknown; scripts?: Record<string, unknown> };
  try {
    manifest = JSON.parse(input.textFiles["package/package.json"] ?? "");
  } catch {
    throw new Error(`${input.packageName} has an invalid package manifest.`);
  }
  const lifecycleScripts = [
    "preinstall",
    "install",
    "postinstall",
    "prepublish",
    "prepublishOnly",
    "prepare",
    "postpublish",
  ];
  if (
    manifest.private === true ||
    lifecycleScripts.some(
      (name) => typeof manifest.scripts?.[name] === "string",
    )
  ) {
    throw new Error(
      `${input.packageName} is not a publishable lifecycle-safe artifact.`,
    );
  }
  for (const [entry, content] of Object.entries(input.textFiles)) {
    if (!entries.includes(entry)) {
      throw new Error(
        `${input.packageName} inspected an unknown file ${entry}.`,
      );
    }
    if (
      privateKeyPattern.test(content) ||
      assignedSecretPattern.test(content)
    ) {
      throw new Error(`${input.packageName} contains secret-like material.`);
    }
    if (
      neutralPackages.has(input.packageName) &&
      privateBrandPattern.test(content)
    ) {
      throw new Error(`${input.packageName} contains private brand coupling.`);
    }
  }
  return Object.freeze({
    status: "passed" as const,
    fileCount: entries.length,
    textFileCount: Object.keys(input.textFiles).length,
  });
}

/** Builds the deterministic metadata required before any private publish step. */
export function createCmsKitReleaseProvenance(
  input: CmsKitReleaseProvenanceInput,
) {
  if (!semverPattern.test(input.version)) {
    throw new Error("CMS Kit release version must be valid semver.");
  }
  if (!input.packages.length)
    throw new Error("CMS Kit release has no packages.");
  if (!(["clean", "dirty", "unknown"] as const).includes(input.sourceState)) {
    throw new Error("CMS Kit release source state is invalid.");
  }
  const names = new Set<string>();
  for (const entry of input.packages) {
    if (!entry.name.startsWith("@agency/") || names.has(entry.name)) {
      throw new Error(`Invalid or duplicate CMS Kit package: ${entry.name}.`);
    }
    names.add(entry.name);
    if (entry.version !== input.version) {
      throw new Error(`${entry.name} is not coordinated at ${input.version}.`);
    }
    if (
      !digestPattern.test(entry.sha256) ||
      entry.size <= 0 ||
      !/^artifacts\/[A-Za-z0-9_.-]+\.tgz$/.test(entry.artifact)
    ) {
      throw new Error(`${entry.name} has invalid artifact provenance.`);
    }
    if (
      entry.artifactPolicy.status !== "passed" ||
      entry.artifactPolicy.fileCount <= 0 ||
      entry.artifactPolicy.textFileCount <= 0 ||
      entry.artifactPolicy.textFileCount > entry.artifactPolicy.fileCount
    ) {
      throw new Error(`${entry.name} has invalid artifact policy evidence.`);
    }
  }
  for (const [label, digest] of [
    ["lockfile", input.lockSha256],
    ["compatibility matrix", input.compatibilitySha256],
    ["changelog", input.changelogSha256],
    ["migration notes", input.migrationNotesSha256],
  ]) {
    if (!digestPattern.test(digest)) {
      throw new Error(`Invalid ${label} digest.`);
    }
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    subject: `@agency/cms-kit@${input.version}`,
    version: input.version,
    source: Object.freeze({
      commit: input.commit,
      state: input.sourceState,
      lockSha256: input.lockSha256,
      compatibilitySha256: input.compatibilitySha256,
      changelogSha256: input.changelogSha256,
      migrationNotesSha256: input.migrationNotesSha256,
    }),
    packages: Object.freeze(
      [...input.packages]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => Object.freeze({ ...entry })),
    ),
    generatedAt: new Date(input.generatedAt).toISOString(),
    publishEligible:
      input.sourceState === "clean" && /^[0-9a-f]{40}$/i.test(input.commit),
  });
}

export function assertCmsKitPublishPackageSet(
  packages: readonly Pick<CmsKitReleasePackage, "name">[],
) {
  const actual = packages.map((entry) => entry.name).sort();
  if (
    actual.length !== cmsKitPackageNames.length ||
    actual.some((name, index) => name !== cmsKitPackageNames[index])
  ) {
    throw new Error(
      "CMS Kit publication requires the exact eleven-package set.",
    );
  }
  return packages;
}

export function assertCmsKitPreparedProvenance(value: unknown) {
  const candidate = value as {
    schemaVersion?: unknown;
    subject?: unknown;
    version?: unknown;
    source?: Record<string, unknown>;
    packages?: unknown;
    generatedAt?: unknown;
    publishEligible?: unknown;
  };
  if (
    !candidate ||
    candidate.schemaVersion !== 1 ||
    typeof candidate.version !== "string" ||
    !candidate.source ||
    !Array.isArray(candidate.packages) ||
    typeof candidate.generatedAt !== "string"
  ) {
    throw new Error("CMS Kit prepared provenance is malformed.");
  }
  const canonical = createCmsKitReleaseProvenance({
    version: candidate.version,
    commit: String(candidate.source.commit ?? ""),
    sourceState: candidate.source
      .state as CmsKitReleaseProvenanceInput["sourceState"],
    lockSha256: String(candidate.source.lockSha256 ?? ""),
    compatibilitySha256: String(candidate.source.compatibilitySha256 ?? ""),
    changelogSha256: String(candidate.source.changelogSha256 ?? ""),
    migrationNotesSha256: String(candidate.source.migrationNotesSha256 ?? ""),
    packages: candidate.packages as CmsKitReleasePackage[],
    generatedAt: candidate.generatedAt,
  });
  assertCmsKitPublishPackageSet(canonical.packages);
  if (JSON.stringify(canonical) !== JSON.stringify(value)) {
    throw new Error("CMS Kit prepared provenance is not canonical.");
  }
  return canonical;
}

export function assertCmsKitReleaseEligible(
  provenance: ReturnType<typeof createCmsKitReleaseProvenance>,
) {
  if (!provenance.publishEligible) {
    throw new Error(
      "Private publication requires a clean checkout with a full Git commit.",
    );
  }
  return provenance;
}

export function createCmsKitPublishRequest(
  provenance: ReturnType<typeof createCmsKitReleaseProvenance>,
  input: {
    registry: string;
    tokenPresent: boolean;
    confirmation: string;
  },
) {
  assertCmsKitReleaseEligible(provenance);
  let registry: URL;
  try {
    registry = new URL(input.registry);
  } catch {
    throw new Error("CMS Kit private registry must be a valid HTTPS URL.");
  }
  if (
    registry.protocol !== "https:" ||
    registry.username ||
    registry.password ||
    registry.search ||
    registry.hash
  ) {
    throw new Error(
      "CMS Kit private registry must be HTTPS without credentials, query, or fragment.",
    );
  }
  if (!input.tokenPresent) {
    throw new Error("CMS Kit private registry token is not configured.");
  }
  const confirmation = `PUBLISH CMS KIT ${provenance.version} ${provenance.source.commit}`;
  if (input.confirmation !== confirmation) {
    throw new Error("CMS Kit publication requires the exact confirmation.");
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    subject: provenance.subject,
    version: provenance.version,
    commit: provenance.source.commit,
    registry: registry.toString().replace(/\/$/, ""),
    confirmation,
    packages: provenance.packages,
  });
}

export type CmsKitRegistryPackageReceipt = Readonly<{
  name: string;
  version: string;
  sha256: string;
  publishedAt: string;
  verifiedAt: string;
}>;

export function createCmsKitPublicationReceipt(
  request: ReturnType<typeof createCmsKitPublishRequest>,
  packages: readonly CmsKitRegistryPackageReceipt[],
  completedAt: string,
) {
  const expected = new Map(
    request.packages.map((entry) => [entry.name, entry] as const),
  );
  if (packages.length !== expected.size) {
    throw new Error("CMS Kit publication receipt is missing packages.");
  }
  const seen = new Set<string>();
  for (const entry of packages) {
    const expectedEntry = expected.get(entry.name);
    if (
      !expectedEntry ||
      seen.has(entry.name) ||
      entry.version !== expectedEntry.version ||
      entry.sha256 !== expectedEntry.sha256 ||
      !Number.isFinite(Date.parse(entry.publishedAt)) ||
      !Number.isFinite(Date.parse(entry.verifiedAt)) ||
      Date.parse(entry.verifiedAt) < Date.parse(entry.publishedAt)
    ) {
      throw new Error(
        `CMS Kit publication receipt is invalid for ${entry.name}.`,
      );
    }
    seen.add(entry.name);
  }
  const completedTimestamp = Date.parse(completedAt);
  if (
    !Number.isFinite(completedTimestamp) ||
    packages.some((entry) => completedTimestamp < Date.parse(entry.verifiedAt))
  ) {
    throw new Error("CMS Kit publication completion time is invalid.");
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    subject: request.subject,
    version: request.version,
    commit: request.commit,
    registry: request.registry,
    access: "restricted" as const,
    status: "published-and-verified" as const,
    packages: Object.freeze(
      [...packages]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => Object.freeze({ ...entry })),
    ),
    completedAt: new Date(completedAt).toISOString(),
  });
}
