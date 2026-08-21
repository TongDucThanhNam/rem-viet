import { z } from "zod";

import {
  cmsCapabilitySchema,
  CmsError,
  type CmsCapability,
} from "./primitives.js";

const extensionIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(96)
  .regex(/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/);
const exactSemverSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
const packageNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(214)
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const environmentNameSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,127}$/);
const routePathSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^\/(?!\/)(?!.*(?:^|\/)\.\.?\/)[^?#]*$/);

export const cmsExtensionHttpMethodSchema = z.enum([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
export const cmsExtensionRouteAuthorizationSchema = z.enum([
  "public",
  "session",
  "api-key",
  "signature",
]);
export const cmsExtensionMutationProtectionSchema = z.enum([
  "none",
  "same-origin",
  "api-key",
  "signature",
  "rate-limit-idempotency",
]);
export const cmsExtensionAdminSlotSchema = z.enum([
  "navigation",
  "dashboard",
  "list",
  "edit",
  "document",
  "root",
]);
export const cmsExtensionRuntimeSchema = z.enum(["server", "client", "shared"]);

const permissionSchema = z
  .object({
    id: extensionIdSchema,
    capability: cmsCapabilitySchema,
    description: z.string().trim().min(1).max(500),
  })
  .strict();
const secretSchema = z
  .object({
    name: environmentNameSchema,
    required: z.boolean(),
    description: z.string().trim().min(1).max(500),
    exposure: z.literal("server-only"),
  })
  .strict();
const routeSchema = z
  .object({
    id: extensionIdSchema,
    path: routePathSchema,
    methods: z.array(cmsExtensionHttpMethodSchema).min(1),
    authorization: cmsExtensionRouteAuthorizationSchema,
    mutationProtection: cmsExtensionMutationProtectionSchema,
  })
  .strict();
const adminContributionSchema = z
  .object({
    id: extensionIdSchema,
    slot: cmsExtensionAdminSlotSchema,
    label: z.string().trim().min(1).max(160),
    requiredCapability: cmsCapabilitySchema.optional(),
  })
  .strict();
const entrypointSchema = z
  .object({
    id: extensionIdSchema,
    export: z.string().trim().min(1).max(300),
    runtime: cmsExtensionRuntimeSchema,
    capabilities: z.array(cmsCapabilitySchema).default([]),
  })
  .strict();
const migrationDeclarationSchema = z
  .object({
    id: extensionIdSchema,
    from: z.number().int().nonnegative(),
    to: z.number().int().positive(),
    reversible: z.boolean(),
  })
  .strict();

export const cmsExtensionPackageManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: extensionIdSchema,
    packageName: packageNameSchema,
    version: exactSemverSchema,
    classification: z.enum(["official", "private", "community"]),
    cmsCompatibility: z
      .object({
        minimum: exactSemverSchema,
        maximumExclusive: exactSemverSchema.optional(),
      })
      .strict(),
    permissions: z.array(permissionSchema).default([]),
    secrets: z.array(secretSchema).default([]),
    routes: z.array(routeSchema).default([]),
    admin: z.array(adminContributionSchema).default([]),
    entrypoints: z.array(entrypointSchema).min(1),
    data: z
      .object({
        schemaVersion: z.number().int().nonnegative(),
        migrations: z.array(migrationDeclarationSchema).default([]),
        uninstall: z
          .object({
            policy: z.enum(["retain", "delete", "export-then-delete"]),
            description: z.string().trim().min(1).max(500),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type CmsExtensionPackageManifest = z.infer<
  typeof cmsExtensionPackageManifestSchema
>;

export const cmsExtensionProvenanceSchema = z
  .object({
    schemaVersion: z.literal(1),
    subject: z
      .object({
        packageName: packageNameSchema,
        version: exactSemverSchema,
      })
      .strict(),
    manifestSha256: sha256Schema,
    artifactSha256: sha256Schema,
    sbomSha256: sha256Schema,
    source: z
      .object({
        repository: z
          .string()
          .url()
          .refine((value) => value.startsWith("https://")),
        commit: z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/),
      })
      .strict(),
    signature: z
      .object({
        algorithm: z.literal("ed25519"),
        keyId: z.string().trim().min(1).max(300),
        value: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict(),
  })
  .strict();
export type CmsExtensionProvenance = z.infer<
  typeof cmsExtensionProvenanceSchema
>;

function duplicate(values: readonly string[]) {
  return values.find((value, index) => values.indexOf(value) !== index);
}

function assertUnique(values: readonly string[], subject: string) {
  const value = duplicate(values);
  if (!value) return;
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message: `Duplicate ${subject} "${value}".`,
    retryable: false,
    details: { subject, value },
  });
}

function semverParts(value: string) {
  const [core, prerelease] = value.split("-", 2);
  return {
    core: core!.split(".").map(Number) as [number, number, number],
    prerelease: prerelease?.split(".") ?? [],
  };
}

function compareSemver(left: string, right: string) {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  for (let index = 0; index < leftParts.core.length; index += 1) {
    const difference = leftParts.core[index]! - rightParts.core[index]!;
    if (difference) return difference;
  }
  if (!leftParts.prerelease.length && !rightParts.prerelease.length) return 0;
  if (!leftParts.prerelease.length) return 1;
  if (!rightParts.prerelease.length) return -1;
  const length = Math.max(
    leftParts.prerelease.length,
    rightParts.prerelease.length,
  );
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftParts.prerelease[index];
    const rightIdentifier = rightParts.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return Number(leftIdentifier) - Number(rightIdentifier);
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier.localeCompare(rightIdentifier);
  }
  return 0;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function canonicalizeCmsExtensionValue(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: Uint8Array | string) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function provenancePayload(provenance: CmsExtensionProvenance) {
  const { signature: _signature, ...unsigned } = provenance;
  return new TextEncoder().encode(canonicalizeCmsExtensionValue(unsigned));
}

function assertSbomIdentity(
  sbomBytes: Uint8Array,
  manifest: CmsExtensionPackageManifest,
) {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(sbomBytes));
  } catch {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Extension SBOM must be valid JSON.",
      retryable: false,
    });
  }
  const sbom = value as {
    packages?: { name?: unknown; versionInfo?: unknown }[];
    metadata?: { component?: { name?: unknown; version?: unknown } };
  };
  const hasSpdxIdentity = sbom.packages?.some(
    (entry) =>
      entry.name === manifest.packageName &&
      entry.versionInfo === manifest.version,
  );
  const hasCycloneDxIdentity =
    sbom.metadata?.component?.name === manifest.packageName &&
    sbom.metadata.component.version === manifest.version;
  if (!hasSpdxIdentity && !hasCycloneDxIdentity) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Extension SBOM does not identify the manifest package/version.",
      retryable: false,
    });
  }
}

export function defineCmsExtensionPackageManifest(
  input: CmsExtensionPackageManifest,
) {
  const parsed = cmsExtensionPackageManifestSchema.safeParse(input);
  if (!parsed.success) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Invalid extension package manifest for "${input.packageName}".`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }
  const manifest = parsed.data;
  const { minimum, maximumExclusive } = manifest.cmsCompatibility;
  if (maximumExclusive && compareSemver(minimum, maximumExclusive) >= 0) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Extension compatibility maximum must exceed its minimum.",
      retryable: false,
    });
  }
  assertUnique(
    manifest.permissions.map(({ id }) => id),
    "permission id",
  );
  assertUnique(
    manifest.secrets.map(({ name }) => name),
    "secret name",
  );
  assertUnique(
    manifest.routes.map(({ id }) => id),
    "route id",
  );
  assertUnique(
    manifest.admin.map(({ id }) => id),
    "admin contribution id",
  );
  assertUnique(
    manifest.entrypoints.map(({ id }) => id),
    "entrypoint id",
  );
  assertUnique(
    manifest.entrypoints.map(({ export: value }) => value),
    "entrypoint export",
  );
  assertUnique(
    manifest.data.migrations.map(({ id }) => id),
    "migration id",
  );
  for (const route of manifest.routes) {
    assertUnique(route.methods, `HTTP method for route ${route.id}`);
    const mutates = route.methods.some(
      (method) => !["GET", "HEAD"].includes(method),
    );
    if (mutates && route.mutationProtection === "none") {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Mutation route "${route.id}" must declare protection.`,
        retryable: false,
      });
    }
  }
  const orderedMigrations = [...manifest.data.migrations].sort(
    (left, right) => left.from - right.from,
  );
  let version = 0;
  for (const migration of orderedMigrations) {
    if (migration.from !== version || migration.to !== version + 1) {
      throw new CmsError({
        code: "MIGRATION_FAILED",
        message: `Extension migration "${migration.id}" is not contiguous from schema ${version}.`,
        retryable: false,
      });
    }
    version = migration.to;
  }
  if (version !== manifest.data.schemaVersion) {
    throw new CmsError({
      code: "MIGRATION_FAILED",
      message: `Extension data schema ${manifest.data.schemaVersion} does not match its migration chain ending at ${version}.`,
      retryable: false,
    });
  }
  return Object.freeze(manifest);
}

export type CmsExtensionSignatureVerifier = (input: {
  algorithm: "ed25519";
  keyId: string;
  signature: string;
  payload: Uint8Array;
}) => boolean | Promise<boolean>;

function base64Bytes(value: string) {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function copiedBuffer(value: Uint8Array) {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

export function createCmsExtensionEd25519Verifier(input: {
  trustedKeys: Readonly<Record<string, CryptoKey | Uint8Array>>;
}): CmsExtensionSignatureVerifier {
  return async ({ algorithm, keyId, signature, payload }) => {
    if (algorithm !== "ed25519") return false;
    const trusted = input.trustedKeys[keyId];
    const signatureBytes = base64Bytes(signature);
    if (!trusted || !signatureBytes) return false;
    try {
      const key =
        trusted instanceof CryptoKey
          ? trusted
          : await crypto.subtle.importKey(
              "raw",
              copiedBuffer(trusted),
              { name: "Ed25519" },
              false,
              ["verify"],
            );
      return crypto.subtle.verify(
        { name: "Ed25519" },
        key,
        copiedBuffer(signatureBytes),
        copiedBuffer(payload),
      );
    } catch {
      return false;
    }
  };
}

export type CmsVerifiedExtensionPackage = Readonly<{
  manifest: CmsExtensionPackageManifest;
  provenance: CmsExtensionProvenance;
  manifestSha256: string;
  artifactSha256: string;
  sbomSha256: string;
}>;

export async function verifyCmsExtensionPackage(input: {
  manifest: CmsExtensionPackageManifest;
  provenance: CmsExtensionProvenance;
  artifact: Uint8Array;
  sbom: Uint8Array;
  verifySignature: CmsExtensionSignatureVerifier;
}): Promise<CmsVerifiedExtensionPackage> {
  const manifest = defineCmsExtensionPackageManifest(input.manifest);
  const provenance = cmsExtensionProvenanceSchema.parse(input.provenance);
  const [manifestSha256, artifactSha256, sbomSha256] = await Promise.all([
    sha256(canonicalizeCmsExtensionValue(manifest)),
    sha256(input.artifact),
    sha256(input.sbom),
  ]);
  if (
    provenance.subject.packageName !== manifest.packageName ||
    provenance.subject.version !== manifest.version ||
    provenance.manifestSha256 !== manifestSha256 ||
    provenance.artifactSha256 !== artifactSha256 ||
    provenance.sbomSha256 !== sbomSha256
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message:
        "Extension provenance does not match its manifest, artifact, and SBOM.",
      retryable: false,
    });
  }
  assertSbomIdentity(input.sbom, manifest);
  const signatureValid = await input.verifySignature({
    algorithm: provenance.signature.algorithm,
    keyId: provenance.signature.keyId,
    signature: provenance.signature.value,
    payload: provenancePayload(provenance),
  });
  if (!signatureValid) {
    throw new CmsError({
      code: "FORBIDDEN",
      message: "Extension provenance signature is invalid or untrusted.",
      retryable: false,
    });
  }
  return Object.freeze({
    manifest,
    provenance,
    manifestSha256,
    artifactSha256,
    sbomSha256,
  });
}

export function inspectCmsExtensionCompatibility(input: {
  manifest: CmsExtensionPackageManifest;
  cmsVersion: string;
  hostCapabilities: readonly CmsCapability[];
  configuredSecrets: readonly string[];
}) {
  const manifest = defineCmsExtensionPackageManifest(input.manifest);
  exactSemverSchema.parse(input.cmsVersion);
  const reasons: string[] = [];
  const { minimum, maximumExclusive } = manifest.cmsCompatibility;
  if (compareSemver(input.cmsVersion, minimum) < 0) {
    reasons.push(`CMS ${input.cmsVersion} is below minimum ${minimum}.`);
  }
  if (
    maximumExclusive &&
    compareSemver(input.cmsVersion, maximumExclusive) >= 0
  ) {
    reasons.push(`CMS ${input.cmsVersion} is not below ${maximumExclusive}.`);
  }
  const hostCapabilities = new Set(input.hostCapabilities);
  const requiredCapabilities = new Set([
    ...manifest.permissions.map(({ capability }) => capability),
    ...manifest.entrypoints.flatMap(({ capabilities }) => capabilities),
  ]);
  const missingCapabilities = [...requiredCapabilities]
    .filter((capability) => !hostCapabilities.has(capability))
    .sort();
  const configuredSecrets = new Set(input.configuredSecrets);
  const missingSecrets = manifest.secrets
    .filter(({ required, name }) => required && !configuredSecrets.has(name))
    .map(({ name }) => name)
    .sort();
  if (missingCapabilities.length) {
    reasons.push(`Missing capabilities: ${missingCapabilities.join(", ")}.`);
  }
  if (missingSecrets.length) {
    reasons.push(`Missing server secrets: ${missingSecrets.join(", ")}.`);
  }
  return Object.freeze({
    compatible: reasons.length === 0,
    missingCapabilities: Object.freeze(missingCapabilities),
    missingSecrets: Object.freeze(missingSecrets),
    reasons: Object.freeze(reasons),
  });
}

export function assertCmsExtensionClientBoundary(input: {
  manifest: CmsExtensionPackageManifest;
  entrypointIds: readonly string[];
  bundledEnvironmentNames: readonly string[];
  requestedCapabilities?: readonly CmsCapability[];
}) {
  const manifest = defineCmsExtensionPackageManifest(input.manifest);
  const entrypoints = new Map(
    manifest.entrypoints.map((entrypoint) => [entrypoint.id, entrypoint]),
  );
  for (const id of input.entrypointIds) {
    const entrypoint = entrypoints.get(id);
    if (!entrypoint) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Client bundle requested undeclared entrypoint "${id}".`,
        retryable: false,
      });
    }
    if (entrypoint.runtime === "server") {
      throw new CmsError({
        code: "FORBIDDEN",
        message: `Server-only entrypoint "${id}" cannot enter a client bundle.`,
        retryable: false,
      });
    }
  }
  const declaredSecrets = new Set(manifest.secrets.map(({ name }) => name));
  const exposedSecrets = input.bundledEnvironmentNames.filter((name) =>
    declaredSecrets.has(name),
  );
  if (exposedSecrets.length) {
    throw new CmsError({
      code: "FORBIDDEN",
      message: `Client bundle exposes server-only extension secrets: ${exposedSecrets.join(", ")}.`,
      retryable: false,
    });
  }
  const allowedCapabilities = new Set(
    input.entrypointIds.flatMap(
      (id) => entrypoints.get(id)?.capabilities ?? [],
    ),
  );
  const undeclaredCapabilities = (input.requestedCapabilities ?? []).filter(
    (capability) => !allowedCapabilities.has(capability),
  );
  if (undeclaredCapabilities.length) {
    throw new CmsError({
      code: "FORBIDDEN",
      message: `Client entrypoints requested undeclared capabilities: ${undeclaredCapabilities.join(", ")}.`,
      retryable: false,
    });
  }
  return true;
}

export type CmsExtensionMigrationContext<TContext> = Readonly<{
  extensionId: string;
  packageName: string;
  context: TContext;
}>;

export type CmsExtensionMigration<TContext> = Readonly<{
  id: string;
  from: number;
  to: number;
  up: (input: CmsExtensionMigrationContext<TContext>) => void | Promise<void>;
  down?: (
    input: CmsExtensionMigrationContext<TContext>,
  ) => void | Promise<void>;
}>;

export type CmsExtensionPackage<TContext> = Readonly<{
  verified: CmsVerifiedExtensionPackage;
  migrations: readonly CmsExtensionMigration<TContext>[];
  exportData?: (context: TContext) => Promise<{ receiptId: string }>;
  deleteData?: (context: TContext) => void | Promise<void>;
}>;

export type CmsExtensionInstallationState = Readonly<{
  extensionId: string;
  packageName: string;
  version: string;
  dataSchemaVersion: number;
  manifestSha256: string;
  status: "enabled" | "disabled";
  installedAt: string;
  updatedAt: string;
}>;

export type CmsExtensionLifecycleTransaction<TContext> = {
  readonly context: TContext;
  getState(): CmsExtensionInstallationState | null;
  setState(state: CmsExtensionInstallationState | null): void | Promise<void>;
};

export type CmsExtensionLifecycleDriver<TContext> = {
  transaction<TResult>(
    extensionId: string,
    run: (
      transaction: CmsExtensionLifecycleTransaction<TContext>,
    ) => Promise<TResult>,
  ): Promise<TResult>;
};

export type CmsExtensionLifecycleReceipt = Readonly<{
  schemaVersion: 1;
  receiptId: string;
  extensionId: string;
  operation:
    "install" | "upgrade" | "enable" | "disable" | "uninstall" | "rollback";
  before: CmsExtensionInstallationState | null;
  after: CmsExtensionInstallationState | null;
  migrationIds: readonly string[];
  exportReceiptId: string | null;
  createdAt: string;
}>;

function assertMigrationImplementations<TContext>(
  extension: CmsExtensionPackage<TContext>,
) {
  const declarations = extension.verified.manifest.data.migrations;
  const implementations = new Map(
    extension.migrations.map((migration) => [migration.id, migration]),
  );
  assertUnique(
    extension.migrations.map(({ id }) => id),
    "migration implementation id",
  );
  if (implementations.size !== declarations.length) {
    throw new CmsError({
      code: "MIGRATION_FAILED",
      message: "Extension migration implementations do not match the manifest.",
      retryable: false,
    });
  }
  for (const declaration of declarations) {
    const implementation = implementations.get(declaration.id);
    if (
      !implementation ||
      implementation.from !== declaration.from ||
      implementation.to !== declaration.to ||
      (declaration.reversible && !implementation.down)
    ) {
      throw new CmsError({
        code: "MIGRATION_FAILED",
        message: `Migration implementation "${declaration.id}" does not match its declaration.`,
        retryable: false,
      });
    }
  }
}

function migrationRange<TContext>(
  extension: CmsExtensionPackage<TContext>,
  from: number,
  to: number,
) {
  return [...extension.migrations]
    .sort((left, right) => left.from - right.from)
    .filter((migration) => migration.from >= from && migration.to <= to);
}

export function createCmsExtensionLifecycleManager<TContext>(input: {
  cmsVersion: string;
  hostCapabilities: readonly CmsCapability[];
  configuredSecrets: readonly string[];
  driver: CmsExtensionLifecycleDriver<TContext>;
  now?: () => Date;
  createReceiptId?: () => string;
}) {
  const now = input.now ?? (() => new Date());
  const createReceiptId = input.createReceiptId ?? (() => crypto.randomUUID());

  function receipt(
    operation: CmsExtensionLifecycleReceipt["operation"],
    before: CmsExtensionInstallationState | null,
    after: CmsExtensionInstallationState | null,
    migrationIds: readonly string[] = [],
    exportReceiptId: string | null = null,
  ): CmsExtensionLifecycleReceipt {
    return Object.freeze({
      schemaVersion: 1,
      receiptId: createReceiptId(),
      extensionId: (after ?? before)!.extensionId,
      operation,
      before,
      after,
      migrationIds: Object.freeze([...migrationIds]),
      exportReceiptId,
      createdAt: now().toISOString(),
    });
  }

  function assertReady<T>(extension: CmsExtensionPackage<T>) {
    const compatibility = inspectCmsExtensionCompatibility({
      manifest: extension.verified.manifest,
      cmsVersion: input.cmsVersion,
      hostCapabilities: input.hostCapabilities,
      configuredSecrets: input.configuredSecrets,
    });
    if (!compatibility.compatible) {
      throw new CmsError({
        code: "CAPABILITY_UNAVAILABLE",
        message: `Extension "${extension.verified.manifest.id}" is not ready: ${compatibility.reasons.join(" ")}`,
        retryable: false,
        details: { compatibility },
      });
    }
    assertMigrationImplementations(extension);
  }

  async function setStatus(
    extensionId: string,
    status: "enabled" | "disabled",
  ) {
    return input.driver.transaction(extensionId, async (transaction) => {
      const before = transaction.getState();
      if (!before) {
        throw new CmsError({
          code: "NOT_FOUND",
          message: `Extension "${extensionId}" is not installed.`,
          retryable: false,
        });
      }
      if (before.status === status) {
        return receipt(
          status === "enabled" ? "enable" : "disable",
          before,
          before,
        );
      }
      const after = Object.freeze({
        ...before,
        status,
        updatedAt: now().toISOString(),
      });
      await transaction.setState(after);
      return receipt(
        status === "enabled" ? "enable" : "disable",
        before,
        after,
      );
    });
  }

  return Object.freeze({
    async install(extension: CmsExtensionPackage<TContext>) {
      assertReady(extension);
      const manifest = extension.verified.manifest;
      return input.driver.transaction(manifest.id, async (transaction) => {
        const before = transaction.getState();
        if (before && before.packageName !== manifest.packageName) {
          throw new CmsError({
            code: "CONFLICT",
            message: `Extension id "${manifest.id}" is owned by ${before.packageName}.`,
            retryable: false,
          });
        }
        if (before && compareSemver(manifest.version, before.version) < 0) {
          throw new CmsError({
            code: "CONFLICT",
            message: "Extension downgrades require a receipt-bound rollback.",
            retryable: false,
          });
        }
        if (
          before &&
          before.version === manifest.version &&
          before.manifestSha256 === extension.verified.manifestSha256
        ) {
          return receipt("install", before, before);
        }
        const currentSchema = before?.dataSchemaVersion ?? 0;
        if (currentSchema > manifest.data.schemaVersion) {
          throw new CmsError({
            code: "MIGRATION_FAILED",
            message: "Extension schema downgrade requires a rollback receipt.",
            retryable: false,
          });
        }
        const migrations = migrationRange(
          extension,
          currentSchema,
          manifest.data.schemaVersion,
        );
        let observed = currentSchema;
        for (const migration of migrations) {
          if (migration.from !== observed) {
            throw new CmsError({
              code: "MIGRATION_FAILED",
              message: `Missing extension migration from schema ${observed}.`,
              retryable: false,
            });
          }
          await migration.up({
            extensionId: manifest.id,
            packageName: manifest.packageName,
            context: transaction.context,
          });
          observed = migration.to;
        }
        if (observed !== manifest.data.schemaVersion) {
          throw new CmsError({
            code: "MIGRATION_FAILED",
            message: `Extension migration stopped at schema ${observed}.`,
            retryable: false,
          });
        }
        const timestamp = now().toISOString();
        const after = Object.freeze({
          extensionId: manifest.id,
          packageName: manifest.packageName,
          version: manifest.version,
          dataSchemaVersion: manifest.data.schemaVersion,
          manifestSha256: extension.verified.manifestSha256,
          status: before?.status ?? ("enabled" as const),
          installedAt: before?.installedAt ?? timestamp,
          updatedAt: timestamp,
        });
        await transaction.setState(after);
        return receipt(
          before ? "upgrade" : "install",
          before,
          after,
          migrations.map(({ id }) => id),
        );
      });
    },
    enable(extensionId: string) {
      return setStatus(extensionId, "enabled");
    },
    disable(extensionId: string) {
      return setStatus(extensionId, "disabled");
    },
    async rollbackUpgrade(
      extension: CmsExtensionPackage<TContext>,
      upgradeReceipt: CmsExtensionLifecycleReceipt,
    ) {
      assertReady(extension);
      if (
        upgradeReceipt.operation !== "upgrade" ||
        !upgradeReceipt.before ||
        !upgradeReceipt.after
      ) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: "Rollback requires a completed upgrade receipt.",
          retryable: false,
        });
      }
      const beforeState = upgradeReceipt.before;
      const afterState = upgradeReceipt.after;
      const manifest = extension.verified.manifest;
      if (
        upgradeReceipt.extensionId !== manifest.id ||
        afterState.manifestSha256 !== extension.verified.manifestSha256
      ) {
        throw new CmsError({
          code: "CONFLICT",
          message:
            "Rollback receipt does not belong to this extension artifact.",
          retryable: false,
        });
      }
      return input.driver.transaction(manifest.id, async (transaction) => {
        const current = transaction.getState();
        if (
          !current ||
          current.version !== afterState.version ||
          current.manifestSha256 !== afterState.manifestSha256 ||
          current.dataSchemaVersion !== afterState.dataSchemaVersion
        ) {
          throw new CmsError({
            code: "CONFLICT",
            message:
              "Installed extension no longer matches the upgrade receipt.",
            retryable: false,
          });
        }
        const byId = new Map(
          extension.migrations.map((item) => [item.id, item]),
        );
        const migrations = [...upgradeReceipt.migrationIds]
          .reverse()
          .map((id) => byId.get(id));
        for (const migration of migrations) {
          if (!migration?.down) {
            throw new CmsError({
              code: "MIGRATION_FAILED",
              message: `Migration "${migration?.id ?? "unknown"}" is not reversible.`,
              retryable: false,
            });
          }
          await migration.down({
            extensionId: manifest.id,
            packageName: manifest.packageName,
            context: transaction.context,
          });
        }
        const after = Object.freeze({
          ...beforeState,
          updatedAt: now().toISOString(),
        });
        await transaction.setState(after);
        return receipt(
          "rollback",
          current,
          after,
          migrations.map((migration) => migration!.id),
        );
      });
    },
    async uninstall(extension: CmsExtensionPackage<TContext>) {
      assertReady(extension);
      const manifest = extension.verified.manifest;
      return input.driver.transaction(manifest.id, async (transaction) => {
        const before = transaction.getState();
        if (!before) {
          throw new CmsError({
            code: "NOT_FOUND",
            message: `Extension "${manifest.id}" is not installed.`,
            retryable: false,
          });
        }
        if (
          before.packageName !== manifest.packageName ||
          before.manifestSha256 !== extension.verified.manifestSha256
        ) {
          throw new CmsError({
            code: "CONFLICT",
            message:
              "Uninstall requires the exact installed extension artifact.",
            retryable: false,
          });
        }
        const policy = manifest.data.uninstall.policy;
        let exportReceiptId: string | null = null;
        if (policy === "export-then-delete") {
          if (!extension.exportData || !extension.deleteData) {
            throw new CmsError({
              code: "VALIDATION_FAILED",
              message:
                "Export-then-delete requires export and delete handlers.",
              retryable: false,
            });
          }
          exportReceiptId = (await extension.exportData(transaction.context))
            .receiptId;
          if (!exportReceiptId.trim()) {
            throw new CmsError({
              code: "VALIDATION_FAILED",
              message: "Extension data export returned an empty receipt id.",
              retryable: false,
            });
          }
          await extension.deleteData(transaction.context);
        } else if (policy === "delete") {
          if (!extension.deleteData) {
            throw new CmsError({
              code: "VALIDATION_FAILED",
              message: "Delete uninstall policy requires a delete handler.",
              retryable: false,
            });
          }
          await extension.deleteData(transaction.context);
        }
        await transaction.setState(null);
        return receipt("uninstall", before, null, [], exportReceiptId);
      });
    },
  });
}

export function createCmsExtensionCatalog(
  manifests: readonly CmsExtensionPackageManifest[],
) {
  const entries = manifests.map(defineCmsExtensionPackageManifest);
  assertUnique(
    entries.map(({ id }) => id),
    "extension catalog id",
  );
  assertUnique(
    entries.map(({ packageName }) => packageName),
    "extension catalog package",
  );
  const byId = new Map(entries.map((manifest) => [manifest.id, manifest]));
  return Object.freeze({
    entries: Object.freeze(
      [...entries].sort((left, right) => left.id.localeCompare(right.id)),
    ),
    get(id: string) {
      return byId.get(id) ?? null;
    },
    compatible(input: {
      cmsVersion: string;
      hostCapabilities: readonly CmsCapability[];
      configuredSecrets: readonly string[];
    }) {
      return entries.filter(
        (manifest) =>
          inspectCmsExtensionCompatibility({ manifest, ...input }).compatible,
      );
    },
  });
}

export type CmsExtensionLifecycleManager<TContext> = ReturnType<
  typeof createCmsExtensionLifecycleManager<TContext>
>;

/**
 * Runs the destructive lifecycle against a caller-provided disposable driver.
 * Provider packages use this as a shared compatibility kit; production state
 * must never be supplied to the conformance runner.
 */
export async function runCmsExtensionLifecycleConformance<TContext>(input: {
  manager: CmsExtensionLifecycleManager<TContext>;
  candidate: CmsExtensionPackage<TContext>;
  previous?: CmsExtensionPackage<TContext>;
}) {
  const receipts: CmsExtensionLifecycleReceipt[] = [];
  if (input.previous) {
    receipts.push(await input.manager.install(input.previous));
    const upgrade = await input.manager.install(input.candidate);
    if (upgrade.operation !== "upgrade") {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "Extension conformance expected an upgrade receipt.",
        retryable: false,
      });
    }
    receipts.push(upgrade);
    receipts.push(
      await input.manager.rollbackUpgrade(input.candidate, upgrade),
    );
    receipts.push(await input.manager.install(input.candidate));
  } else {
    receipts.push(await input.manager.install(input.candidate));
  }
  const repeated = await input.manager.install(input.candidate);
  if (
    !repeated.before ||
    !repeated.after ||
    repeated.before.manifestSha256 !== repeated.after.manifestSha256 ||
    repeated.migrationIds.length
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Extension installation is not idempotent.",
      retryable: false,
    });
  }
  receipts.push(repeated);
  receipts.push(
    await input.manager.disable(input.candidate.verified.manifest.id),
  );
  receipts.push(
    await input.manager.enable(input.candidate.verified.manifest.id),
  );
  receipts.push(await input.manager.uninstall(input.candidate));
  return Object.freeze({
    passed: true as const,
    extensionId: input.candidate.verified.manifest.id,
    version: input.candidate.verified.manifest.version,
    operations: Object.freeze(receipts.map(({ operation }) => operation)),
    receipts: Object.freeze(receipts),
  });
}
