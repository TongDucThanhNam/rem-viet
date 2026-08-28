import { normalizeCmsCliRelativePath } from "./index";

export const CMS_INTEGRATION_RECEIPT_PATH =
  ".agency-cms/integration.receipt.json" as const;

export type CmsIntegrationFramework = "tanstack-start";
export type CmsIntegrationManagedFile = Readonly<{
  path: string;
  content: string;
  sha256: string;
}>;
export type CmsIntegrationPackageEntry = Readonly<{
  section: "dependencies" | "devDependencies" | "scripts";
  name: string;
  value: string;
}>;
export type CmsIntegrationProviderCapabilities = Readonly<{
  schedule: boolean;
  media: boolean;
  webhook: boolean;
  release: boolean;
  localization: boolean;
  transaction: boolean;
  search: boolean;
}>;
export type CmsIntegrationProviderDefinition = Readonly<{
  schemaVersion: 1;
  id: string;
  packageName: string;
  packageVersion: string;
  capabilities: CmsIntegrationProviderCapabilities;
  diagnostics: Readonly<{
    databaseBinding: string | null;
    databaseConfigFiles: readonly string[];
    authenticationEnvironment: string | null;
  }>;
  files: readonly Readonly<{ path: string; content: string }>[];
}>;
export type CmsIntegrationReceipt = Readonly<{
  schemaVersion: 1;
  operation: "agency-cms-integration";
  framework: CmsIntegrationFramework;
  provider: string;
  providerPackage: Readonly<{ name: string; version: string }>;
  capabilities: CmsIntegrationProviderCapabilities;
  diagnostics: CmsIntegrationProviderDefinition["diagnostics"];
  packageJsonPath: "package.json";
  routeRoot: "src/routes";
  managedFiles: readonly Readonly<{ path: string; sha256: string }>[];
  packageEntries: readonly CmsIntegrationPackageEntry[];
}>;

const integrationDependencies = Object.freeze({
  "@agency/cms-admin": "0.1.0",
  "@agency/cms-core": "0.1.0",
  "@agency/cms-runtime": "0.1.0",
  "@agency/cms-visual-editor": "0.1.0",
});
const integrationDevDependencies = Object.freeze({
  "@agency/cms-cli": "0.1.0",
});
const integrationScripts = Object.freeze({
  "cms:diagnose": "agency-cms diagnose",
});
const providerIdPattern = /^[a-z][a-z0-9-]{1,62}$/;
const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

const sha256Constants = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotateRight = (value: number, count: number) =>
  (value >>> count) | (value << (32 - count));

/** Runtime-neutral SHA-256 keeps CLI receipts usable in browser TS projects. */
export function cmsIntegrationSha256(content: string) {
  const message = new TextEncoder().encode(content);
  const bitLength = message.byteLength * 8;
  const paddedLength = Math.ceil((message.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.byteLength] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(
    paddedLength - 8,
    Math.floor(bitLength / 0x1_0000_0000),
    false,
  );
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15]!;
      const previous2 = words[index - 2]!;
      const sigma0 =
        rotateRight(previous15, 7) ^
        rotateRight(previous15, 18) ^
        (previous15 >>> 3);
      const sigma1 =
        rotateRight(previous2, 17) ^
        rotateRight(previous2, 19) ^
        (previous2 >>> 10);
      words[index] =
        (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 =
        rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const temporary1 =
        (h! + sum1 + choose + sha256Constants[index]! + words[index]!) >>> 0;
      const sum0 =
        rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0]! + a!) >>> 0;
    hash[1] = (hash[1]! + b!) >>> 0;
    hash[2] = (hash[2]! + c!) >>> 0;
    hash[3] = (hash[3]! + d!) >>> 0;
    hash[4] = (hash[4]! + e!) >>> 0;
    hash[5] = (hash[5]! + f!) >>> 0;
    hash[6] = (hash[6]! + g!) >>> 0;
    hash[7] = (hash[7]! + h!) >>> 0;
  }
  return [...hash].map((value) => value.toString(16).padStart(8, "0")).join("");
}

/**
 * Managed integration files are text. Git may rewrite LF to CRLF during a
 * Windows checkout, so receipts compare canonical line endings while every
 * other whitespace or content change remains protected.
 */
export function cmsIntegrationTextSha256(content: string) {
  return cmsIntegrationSha256(content.replace(/\r\n/g, "\n"));
}

function objectRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function parseCmsIntegrationProvider(
  value: unknown,
): CmsIntegrationProviderDefinition {
  const module = objectRecord(value, "CMS integration provider module");
  const input = objectRecord(
    module.cmsIntegrationProvider ?? module.default,
    "CMS integration provider",
  );
  const diagnostics = objectRecord(
    input.diagnostics,
    "CMS integration provider diagnostics",
  );
  const capabilities = objectRecord(
    input.capabilities,
    "CMS integration provider capabilities",
  );
  const capabilityNames = [
    "schedule",
    "media",
    "webhook",
    "release",
    "localization",
    "transaction",
    "search",
  ] as const;
  if (
    input.schemaVersion !== 1 ||
    typeof input.id !== "string" ||
    !providerIdPattern.test(input.id) ||
    input.packageName !== `@agency/cms-provider-${input.id}` ||
    typeof input.packageVersion !== "string" ||
    !semanticVersionPattern.test(input.packageVersion) ||
    Object.keys(capabilities).length !== capabilityNames.length ||
    capabilityNames.some((name) => typeof capabilities[name] !== "boolean") ||
    (diagnostics.databaseBinding !== null &&
      (typeof diagnostics.databaseBinding !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,63}$/.test(diagnostics.databaseBinding))) ||
    (diagnostics.authenticationEnvironment !== null &&
      (typeof diagnostics.authenticationEnvironment !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,63}$/.test(
          diagnostics.authenticationEnvironment,
        ))) ||
    !Array.isArray(diagnostics.databaseConfigFiles) ||
    diagnostics.databaseConfigFiles.some((path) => typeof path !== "string") ||
    !Array.isArray(input.files) ||
    input.files.length === 0
  ) {
    throw new Error("CMS integration provider shape is invalid.");
  }
  const paths = new Set<string>();
  const files = input.files.map((value) => {
    const file = objectRecord(value, "CMS integration provider file");
    if (typeof file.path !== "string" || typeof file.content !== "string") {
      throw new Error("CMS integration provider file is invalid.");
    }
    const path = normalizeCmsCliRelativePath(file.path);
    if (paths.has(path)) {
      throw new Error(`Duplicate CMS integration file: ${path}.`);
    }
    paths.add(path);
    return Object.freeze({ path, content: file.content });
  });
  return Object.freeze({
    schemaVersion: 1,
    id: input.id,
    packageName: input.packageName as string,
    packageVersion: input.packageVersion,
    capabilities: Object.freeze(
      Object.fromEntries(
        capabilityNames.map((name) => [name, capabilities[name]]),
      ),
    ) as CmsIntegrationProviderCapabilities,
    diagnostics: Object.freeze({
      databaseBinding: diagnostics.databaseBinding as string | null,
      authenticationEnvironment: diagnostics.authenticationEnvironment as
        string | null,
      databaseConfigFiles: Object.freeze(
        (diagnostics.databaseConfigFiles as string[]).map(
          normalizeCmsCliRelativePath,
        ),
      ),
    }),
    files: Object.freeze(files),
  });
}

type PackageJson = Record<string, unknown> & {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

export function parseCmsIntegrationPackageJson(source: string): PackageJson {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error("package.json is not valid JSON.", { cause: error });
  }
  const manifest = objectRecord(value, "package.json") as PackageJson;
  for (const section of [
    "dependencies",
    "devDependencies",
    "scripts",
  ] as const) {
    const entry = manifest[section];
    if (
      entry !== undefined &&
      (!entry || typeof entry !== "object" || Array.isArray(entry))
    ) {
      throw new Error(`package.json ${section} must contain an object.`);
    }
  }
  return manifest;
}

function hasPackage(manifest: PackageJson, name: string) {
  return (
    typeof manifest.dependencies?.[name] === "string" ||
    typeof manifest.devDependencies?.[name] === "string"
  );
}

export function assertTanStackStartPackage(manifest: PackageJson) {
  if (!hasPackage(manifest, "@tanstack/react-start")) {
    throw new Error(
      "TanStack Start was not found in package.json dependencies or devDependencies.",
    );
  }
  if (!hasPackage(manifest, "@tanstack/react-router")) {
    throw new Error(
      "TanStack Router was not found in package.json dependencies or devDependencies.",
    );
  }
}

function desiredDependencies(provider: CmsIntegrationProviderDefinition) {
  return Object.freeze({
    ...integrationDependencies,
    [provider.packageName]: provider.packageVersion,
  });
}

function missingEntries(
  manifest: PackageJson,
  provider: CmsIntegrationProviderDefinition,
): readonly CmsIntegrationPackageEntry[] {
  const entries: CmsIntegrationPackageEntry[] = [];
  for (const [name, value] of Object.entries(desiredDependencies(provider))) {
    if (!hasPackage(manifest, name)) {
      entries.push({ section: "dependencies", name, value });
    }
  }
  for (const [name, value] of Object.entries(integrationDevDependencies)) {
    if (!hasPackage(manifest, name)) {
      entries.push({ section: "devDependencies", name, value });
    }
  }
  for (const [name, value] of Object.entries(integrationScripts)) {
    const current = manifest.scripts?.[name];
    if (current === undefined) {
      entries.push({ section: "scripts", name, value });
    } else if (current !== value) {
      throw new Error(
        `Refusing to replace existing package.json script "${name}".`,
      );
    }
  }
  return Object.freeze(entries);
}

export function createCmsIntegration(input: {
  packageJsonSource: string;
  framework: CmsIntegrationFramework;
  provider: CmsIntegrationProviderDefinition;
}) {
  const manifest = parseCmsIntegrationPackageJson(input.packageJsonSource);
  assertTanStackStartPackage(manifest);
  const managedFiles = Object.freeze(
    input.provider.files.map(({ path, content }) =>
      Object.freeze({
        path,
        content,
        sha256: cmsIntegrationTextSha256(content),
      }),
    ),
  );
  const packageEntries = missingEntries(manifest, input.provider);
  const receipt: CmsIntegrationReceipt = Object.freeze({
    schemaVersion: 1,
    operation: "agency-cms-integration",
    framework: input.framework,
    provider: input.provider.id,
    providerPackage: Object.freeze({
      name: input.provider.packageName,
      version: input.provider.packageVersion,
    }),
    capabilities: input.provider.capabilities,
    diagnostics: input.provider.diagnostics,
    packageJsonPath: "package.json",
    routeRoot: "src/routes",
    managedFiles: Object.freeze(
      managedFiles.map(({ path, sha256 }) => Object.freeze({ path, sha256 })),
    ),
    packageEntries,
  });
  return Object.freeze({ manifest, managedFiles, packageEntries, receipt });
}

export function applyCmsIntegrationPackageEntries(
  manifest: PackageJson,
  entries: readonly CmsIntegrationPackageEntry[],
) {
  const output = structuredClone(manifest);
  for (const entry of entries) {
    const section = (output[entry.section] ??= {}) as Record<string, string>;
    const current = section[entry.name];
    if (current !== undefined && current !== entry.value) {
      throw new Error(
        `Refusing to replace package.json ${entry.section}.${entry.name}.`,
      );
    }
    section[entry.name] = entry.value;
  }
  return `${JSON.stringify(output, null, 2)}\n`;
}

export function removeCmsIntegrationPackageEntries(
  manifest: PackageJson,
  entries: readonly CmsIntegrationPackageEntry[],
) {
  const output = structuredClone(manifest);
  for (const entry of entries) {
    const section = output[entry.section] as Record<string, string> | undefined;
    const current = section?.[entry.name];
    if (current === undefined) continue;
    if (current !== entry.value) {
      throw new Error(
        `Refusing to remove modified package.json ${entry.section}.${entry.name}.`,
      );
    }
    delete section![entry.name];
    if (Object.keys(section!).length === 0) delete output[entry.section];
  }
  return `${JSON.stringify(output, null, 2)}\n`;
}

export function parseCmsIntegrationReceipt(
  value: unknown,
): CmsIntegrationReceipt {
  const input = objectRecord(value, "CMS integration receipt");
  const providerPackage = objectRecord(
    input.providerPackage,
    "CMS integration provider package receipt",
  );
  const diagnostics = objectRecord(
    input.diagnostics,
    "CMS integration diagnostics receipt",
  );
  const capabilities = objectRecord(
    input.capabilities,
    "CMS integration capability receipt",
  );
  const capabilityNames = [
    "schedule",
    "media",
    "webhook",
    "release",
    "localization",
    "transaction",
    "search",
  ] as const;
  if (
    input.schemaVersion !== 1 ||
    input.operation !== "agency-cms-integration" ||
    input.framework !== "tanstack-start" ||
    typeof input.provider !== "string" ||
    !providerIdPattern.test(input.provider) ||
    providerPackage.name !== `@agency/cms-provider-${input.provider}` ||
    typeof providerPackage.version !== "string" ||
    !semanticVersionPattern.test(providerPackage.version) ||
    Object.keys(capabilities).length !== capabilityNames.length ||
    capabilityNames.some((name) => typeof capabilities[name] !== "boolean") ||
    input.packageJsonPath !== "package.json" ||
    input.routeRoot !== "src/routes" ||
    (diagnostics.databaseBinding !== null &&
      (typeof diagnostics.databaseBinding !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,63}$/.test(diagnostics.databaseBinding))) ||
    (diagnostics.authenticationEnvironment !== null &&
      (typeof diagnostics.authenticationEnvironment !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,63}$/.test(
          diagnostics.authenticationEnvironment,
        ))) ||
    !Array.isArray(diagnostics.databaseConfigFiles) ||
    diagnostics.databaseConfigFiles.some((path) => typeof path !== "string") ||
    !Array.isArray(input.managedFiles) ||
    !Array.isArray(input.packageEntries)
  ) {
    throw new Error("CMS integration receipt shape is invalid.");
  }
  const managedFiles = input.managedFiles.map((value) => {
    const file = objectRecord(value, "CMS integration managed-file receipt");
    if (
      typeof file.path !== "string" ||
      typeof file.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(file.sha256)
    ) {
      throw new Error("CMS integration managed-file receipt is invalid.");
    }
    return Object.freeze({
      path: normalizeCmsCliRelativePath(file.path),
      sha256: file.sha256,
    });
  });
  if (
    new Set(managedFiles.map(({ path }) => path)).size !== managedFiles.length
  ) {
    throw new Error("CMS integration receipt has duplicate managed files.");
  }
  const packageEntries = input.packageEntries.map((value) => {
    const entry = objectRecord(value, "CMS integration package receipt");
    if (
      (entry.section !== "dependencies" &&
        entry.section !== "devDependencies" &&
        entry.section !== "scripts") ||
      typeof entry.name !== "string" ||
      !/^(?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z][a-z0-9:._-]*)$/i.test(
        entry.name,
      ) ||
      typeof entry.value !== "string" ||
      !entry.value
    ) {
      throw new Error("CMS integration package receipt is invalid.");
    }
    return Object.freeze({
      section: entry.section,
      name: entry.name,
      value: entry.value,
    }) as CmsIntegrationPackageEntry;
  });
  return Object.freeze({
    schemaVersion: 1,
    operation: "agency-cms-integration",
    framework: "tanstack-start",
    provider: input.provider,
    providerPackage: Object.freeze({
      name: providerPackage.name as string,
      version: providerPackage.version,
    }),
    capabilities: Object.freeze(
      Object.fromEntries(
        capabilityNames.map((name) => [name, capabilities[name]]),
      ),
    ) as CmsIntegrationProviderCapabilities,
    diagnostics: Object.freeze({
      databaseBinding: diagnostics.databaseBinding as string | null,
      authenticationEnvironment: diagnostics.authenticationEnvironment as
        string | null,
      databaseConfigFiles: Object.freeze(
        (diagnostics.databaseConfigFiles as string[]).map(
          normalizeCmsCliRelativePath,
        ),
      ),
    }),
    packageJsonPath: "package.json",
    routeRoot: "src/routes",
    managedFiles: Object.freeze(managedFiles),
    packageEntries: Object.freeze(packageEntries),
  });
}

export function cmsIntegrationRequiredPackages(providerPackageName: string) {
  return Object.freeze([
    ...Object.keys(integrationDependencies),
    ...Object.keys(integrationDevDependencies),
    providerPackageName,
  ]);
}
