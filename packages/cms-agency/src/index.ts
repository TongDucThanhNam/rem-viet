import {
  canonicalizeCmsExtensionValue,
  type CmsExtensionSignatureVerifier,
} from "@agency/cms-core";
import { z } from "zod";

const semverSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const siteIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const stageSchema = z.enum(["development", "staging", "production"]);
const timestampSchema = z.iso.datetime({ offset: true });
const opaqueReceiptIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const healthCheckSchema = z
  .object({
    id: z
      .string()
      .min(2)
      .max(100)
      .regex(/^[a-z][a-z0-9-]*$/),
    status: z.enum(["pass", "warning", "fail"]),
    observedAt: timestampSchema,
  })
  .strict();

export const cmsAgencySiteReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    site: z
      .object({
        id: siteIdSchema,
        stage: stageSchema,
        origin: z
          .string()
          .url()
          .refine((value) => value.startsWith("https://")),
        repositorySha256: sha256Schema,
      })
      .strict(),
    deployment: z
      .object({
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        deployedAt: timestampSchema,
        kitVersion: semverSchema,
        template: z
          .object({
            packageName: z
              .string()
              .regex(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/),
            version: semverSchema,
          })
          .strict(),
        provider: z
          .object({
            id: z
              .string()
              .min(2)
              .max(80)
              .regex(/^[a-z][a-z0-9-]*$/),
            version: semverSchema,
          })
          .strict(),
        contentSchemaVersion: z.number().int().positive(),
      })
      .strict(),
    health: z
      .object({
        status: z.enum(["healthy", "degraded", "unreachable"]),
        observedAt: timestampSchema,
        checks: z.array(healthCheckSchema).min(1).max(100),
      })
      .strict(),
    operations: z
      .object({
        migrations: z
          .object({
            currentSchemaVersion: z.number().int().nonnegative(),
            targetSchemaVersion: z.number().int().nonnegative(),
            pendingIds: z
              .array(
                z
                  .string()
                  .min(2)
                  .max(120)
                  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
              )
              .max(500),
          })
          .strict(),
        backup: z
          .object({
            latestReceiptId: opaqueReceiptIdSchema.nullable(),
            verifiedAt: timestampSchema.nullable(),
          })
          .strict(),
        audit: z
          .object({
            eventCount24h: z.number().int().nonnegative(),
            latestEventAt: timestampSchema.nullable(),
          })
          .strict(),
        alerts: z
          .object({
            criticalOpen: z.number().int().nonnegative(),
            warningOpen: z.number().int().nonnegative(),
            evaluatedAt: timestampSchema,
          })
          .strict(),
        jobs: z
          .object({
            running: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            deadLetter: z.number().int().nonnegative(),
          })
          .strict(),
        webhooks: z
          .object({
            pending: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            deadLetter: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    handover: z
      .object({
        status: z.enum(["not-started", "in-progress", "signed"]),
        receiptId: opaqueReceiptIdSchema.nullable(),
        ownerKeySha256: sha256Schema.nullable(),
      })
      .strict(),
    generatedAt: timestampSchema,
  })
  .strict();
export type CmsAgencySiteReceipt = z.infer<typeof cmsAgencySiteReceiptSchema>;

export const cmsAgencySiteReceiptEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    subject: z.object({ siteId: siteIdSchema, stage: stageSchema }).strict(),
    receiptSha256: sha256Schema,
    signature: z
      .object({
        algorithm: z.literal("ed25519"),
        keyId: z.string().trim().min(1).max(300),
        value: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict(),
  })
  .strict();
export type CmsAgencySiteReceiptEnvelope = z.infer<
  typeof cmsAgencySiteReceiptEnvelopeSchema
>;

function unique(values: readonly string[], subject: string) {
  const duplicate = values.find(
    (value, index) => values.indexOf(value) !== index,
  );
  if (duplicate) throw new Error(`Duplicate ${subject}: ${duplicate}.`);
}

function parseTimestamp(value: string) {
  return Date.parse(value);
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

function bytes(value: Uint8Array | string) {
  if (typeof value === "string") return new TextEncoder().encode(value);
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

async function sha256(value: Uint8Array | string) {
  const digest = await crypto.subtle.digest("SHA-256", bytes(value).buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function defineCmsAgencySiteReceipt(input: CmsAgencySiteReceipt) {
  const receipt = cmsAgencySiteReceiptSchema.parse(input);
  const origin = new URL(receipt.site.origin);
  if (receipt.site.origin !== origin.origin) {
    throw new Error(
      "Site receipt origin must be an exact HTTPS origin without credentials, path, query, or fragment.",
    );
  }
  unique(
    receipt.health.checks.map(({ id }) => id),
    "health check id",
  );
  unique(receipt.operations.migrations.pendingIds, "pending migration id");
  const migrations = receipt.operations.migrations;
  if (migrations.currentSchemaVersion > migrations.targetSchemaVersion) {
    throw new Error(
      "Site receipt target schema cannot precede current schema.",
    );
  }
  if (
    (migrations.currentSchemaVersion === migrations.targetSchemaVersion) !==
    (migrations.pendingIds.length === 0)
  ) {
    throw new Error(
      "Pending migration ids must exactly reflect current/target schema drift.",
    );
  }
  const backup = receipt.operations.backup;
  if (Boolean(backup.latestReceiptId) !== Boolean(backup.verifiedAt)) {
    throw new Error(
      "Backup receipt id and verification time must appear together.",
    );
  }
  if (
    receipt.health.status === "healthy" &&
    receipt.health.checks.some(({ status }) => status !== "pass")
  ) {
    throw new Error(
      "A healthy receipt cannot contain warning or failed checks.",
    );
  }
  if (
    receipt.health.status === "unreachable" &&
    !receipt.health.checks.some(({ status }) => status === "fail")
  ) {
    throw new Error("An unreachable receipt must contain a failed check.");
  }
  if (
    receipt.handover.status === "signed" &&
    (!receipt.handover.receiptId || !receipt.handover.ownerKeySha256)
  ) {
    throw new Error(
      "Signed handover requires receipt and owner-key fingerprints.",
    );
  }
  if (
    receipt.handover.status !== "signed" &&
    (receipt.handover.receiptId || receipt.handover.ownerKeySha256)
  ) {
    throw new Error(
      "Unsigned handover cannot claim receipt or owner fingerprints.",
    );
  }
  for (const observedAt of [
    receipt.deployment.deployedAt,
    receipt.health.observedAt,
    receipt.operations.backup.verifiedAt,
    receipt.operations.audit.latestEventAt,
    receipt.operations.alerts.evaluatedAt,
    ...receipt.health.checks.map(({ observedAt }) => observedAt),
  ].filter((value): value is string => value !== null)) {
    if (parseTimestamp(observedAt) > parseTimestamp(receipt.generatedAt)) {
      throw new Error(
        "Site receipt events and observations cannot occur after generation.",
      );
    }
  }
  return Object.freeze(receipt);
}

function envelopePayload(envelope: CmsAgencySiteReceiptEnvelope) {
  const { signature: _signature, ...unsigned } = envelope;
  return bytes(canonicalizeCmsExtensionValue(unsigned));
}

export async function createCmsAgencySiteReceiptEnvelope(input: {
  receipt: CmsAgencySiteReceipt;
  keyId: string;
  sign: (payload: Uint8Array) => string | Promise<string>;
}) {
  const receipt = defineCmsAgencySiteReceipt(input.receipt);
  const unsigned = {
    schemaVersion: 1 as const,
    subject: { siteId: receipt.site.id, stage: receipt.site.stage },
    receiptSha256: await sha256(canonicalizeCmsExtensionValue(receipt)),
  };
  const placeholder = cmsAgencySiteReceiptEnvelopeSchema.parse({
    ...unsigned,
    signature: {
      algorithm: "ed25519",
      keyId: input.keyId,
      value: "AA==",
    },
  });
  return cmsAgencySiteReceiptEnvelopeSchema.parse({
    ...unsigned,
    signature: {
      algorithm: "ed25519",
      keyId: input.keyId,
      value: await input.sign(envelopePayload(placeholder)),
    },
  });
}

export type CmsVerifiedAgencySiteReceipt = Readonly<{
  receipt: CmsAgencySiteReceipt;
  envelope: CmsAgencySiteReceiptEnvelope;
}>;

export async function verifyCmsAgencySiteReceipt(input: {
  receipt: CmsAgencySiteReceipt;
  envelope: CmsAgencySiteReceiptEnvelope;
  verifySignature: CmsExtensionSignatureVerifier;
}): Promise<CmsVerifiedAgencySiteReceipt> {
  const receipt = defineCmsAgencySiteReceipt(input.receipt);
  const envelope = cmsAgencySiteReceiptEnvelopeSchema.parse(input.envelope);
  const digest = await sha256(canonicalizeCmsExtensionValue(receipt));
  if (
    envelope.subject.siteId !== receipt.site.id ||
    envelope.subject.stage !== receipt.site.stage ||
    envelope.receiptSha256 !== digest
  ) {
    throw new Error("Agency site receipt envelope does not match its receipt.");
  }
  if (
    !(await input.verifySignature({
      algorithm: envelope.signature.algorithm,
      keyId: envelope.signature.keyId,
      signature: envelope.signature.value,
      payload: envelopePayload(envelope),
    }))
  ) {
    throw new Error("Agency site receipt signature is invalid or untrusted.");
  }
  return Object.freeze({ receipt, envelope });
}

export function createCmsAgencyFleet(
  sites: readonly CmsVerifiedAgencySiteReceipt[],
) {
  const keys = sites.map(
    ({ receipt }) => `${receipt.site.id}:${receipt.site.stage}`,
  );
  unique(keys, "site/stage receipt");
  const ordered = [...sites].sort((left, right) =>
    `${left.receipt.site.id}:${left.receipt.site.stage}`.localeCompare(
      `${right.receipt.site.id}:${right.receipt.site.stage}`,
    ),
  );
  const byKey = new Map(
    ordered.map((site) => [
      `${site.receipt.site.id}:${site.receipt.site.stage}`,
      site,
    ]),
  );
  return Object.freeze({
    sites: Object.freeze(ordered),
    get(siteId: string, stage: z.infer<typeof stageSchema>) {
      return byKey.get(`${siteId}:${stage}`) ?? null;
    },
  });
}

export type CmsAgencyFleetIssue = Readonly<{
  code:
    | "receipt-stale"
    | "health"
    | "kit-drift"
    | "provider-drift"
    | "migration-pending"
    | "backup-missing"
    | "backup-stale"
    | "handover-open"
    | "critical-alert"
    | "dead-letter";
  severity: "warning" | "critical";
}>;

export function inspectCmsAgencyFleet(input: {
  fleet: ReturnType<typeof createCmsAgencyFleet>;
  expectedKitVersion: string;
  expectedProviderVersions?: Readonly<Record<string, string>>;
  now?: Date;
  maximumReceiptAgeMs?: number;
  maximumProductionBackupAgeMs?: number;
}) {
  semverSchema.parse(input.expectedKitVersion);
  const now = input.now ?? new Date();
  const maximumReceiptAgeMs = input.maximumReceiptAgeMs ?? 15 * 60_000;
  const maximumProductionBackupAgeMs =
    input.maximumProductionBackupAgeMs ?? 24 * 60 * 60_000;
  const sites = input.fleet.sites.map(({ receipt, envelope }) => {
    const issues: CmsAgencyFleetIssue[] = [];
    const add = (
      code: CmsAgencyFleetIssue["code"],
      severity: CmsAgencyFleetIssue["severity"],
    ) => issues.push(Object.freeze({ code, severity }));
    if (
      now.getTime() - parseTimestamp(receipt.generatedAt) >
      maximumReceiptAgeMs
    )
      add("receipt-stale", "critical");
    if (receipt.health.status !== "healthy") add("health", "critical");
    if (receipt.deployment.kitVersion !== input.expectedKitVersion)
      add("kit-drift", "warning");
    const expectedProvider =
      input.expectedProviderVersions?.[receipt.deployment.provider.id];
    if (
      expectedProvider &&
      expectedProvider !== receipt.deployment.provider.version
    )
      add("provider-drift", "warning");
    if (receipt.operations.migrations.pendingIds.length)
      add("migration-pending", "warning");
    if (receipt.operations.alerts.criticalOpen)
      add("critical-alert", "critical");
    if (
      receipt.operations.jobs.deadLetter ||
      receipt.operations.webhooks.deadLetter
    )
      add("dead-letter", "critical");
    if (receipt.site.stage === "production") {
      const verifiedAt = receipt.operations.backup.verifiedAt;
      if (!verifiedAt) add("backup-missing", "critical");
      else if (
        now.getTime() - parseTimestamp(verifiedAt) >
        maximumProductionBackupAgeMs
      )
        add("backup-stale", "critical");
      if (receipt.handover.status !== "signed") add("handover-open", "warning");
    }
    return Object.freeze({
      site: receipt.site,
      receiptSha256: envelope.receiptSha256,
      issues: Object.freeze(issues),
      ready: issues.length === 0,
    });
  });
  return Object.freeze({
    sites: Object.freeze(sites),
    summary: Object.freeze({
      total: sites.length,
      ready: sites.filter(({ ready }) => ready).length,
      critical: sites.filter(({ issues }) =>
        issues.some(({ severity }) => severity === "critical"),
      ).length,
      warningOnly: sites.filter(
        ({ issues }) =>
          issues.length > 0 &&
          issues.every(({ severity }) => severity === "warning"),
      ).length,
    }),
  });
}

export const cmsAgencyOperationSchema = z.enum([
  "backup",
  "upgrade",
  "handover-export",
  "rotate-owner",
]);
export type CmsAgencyOperation = z.infer<typeof cmsAgencyOperationSchema>;

export const cmsAgencyOperationPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    planId: opaqueReceiptIdSchema,
    site: z.object({ id: siteIdSchema, stage: stageSchema }).strict(),
    sourceReceiptSha256: sha256Schema,
    operation: cmsAgencyOperationSchema,
    targetKitVersion: semverSchema.nullable(),
    migrationIds: z.array(z.string().min(2).max(120)).max(500),
    newOwnerKeySha256: sha256Schema.nullable(),
    requiresFreshBackup: z.boolean(),
    confirmation: z.string().min(20).max(500),
    createdAt: timestampSchema,
  })
  .strict();
export type CmsAgencyOperationPlan = z.infer<
  typeof cmsAgencyOperationPlanSchema
>;

export function createCmsAgencyOperationPlan(input: {
  site: CmsVerifiedAgencySiteReceipt;
  operation: CmsAgencyOperation;
  targetKitVersion?: string;
  newOwnerKeySha256?: string;
  planId: string;
  createdAt?: Date;
}) {
  const { receipt, envelope } = input.site;
  const targetKitVersion = input.targetKitVersion ?? null;
  const newOwnerKeySha256 = input.newOwnerKeySha256 ?? null;
  if (input.operation === "upgrade" && !targetKitVersion) {
    throw new Error("Upgrade plans require a target kit version.");
  }
  if (
    input.operation === "upgrade" &&
    targetKitVersion &&
    compareSemver(
      semverSchema.parse(targetKitVersion),
      receipt.deployment.kitVersion,
    ) <= 0
  ) {
    throw new Error(
      "Upgrade target kit version must be newer than the verified site version.",
    );
  }
  if (input.operation !== "upgrade" && targetKitVersion) {
    throw new Error("Only upgrade plans may declare a target kit version.");
  }
  if (input.operation === "rotate-owner" && !newOwnerKeySha256) {
    throw new Error("Owner rotation requires the new owner-key fingerprint.");
  }
  if (input.operation !== "rotate-owner" && newOwnerKeySha256) {
    throw new Error(
      "Only owner rotation may declare an owner-key fingerprint.",
    );
  }
  const operationLabel = input.operation.toUpperCase().replaceAll("-", "_");
  const confirmation = `APPLY AGENCY ${operationLabel} ${receipt.site.id} ${receipt.site.stage} ${envelope.receiptSha256}`;
  return cmsAgencyOperationPlanSchema.parse({
    schemaVersion: 1,
    planId: input.planId,
    site: { id: receipt.site.id, stage: receipt.site.stage },
    sourceReceiptSha256: envelope.receiptSha256,
    operation: input.operation,
    targetKitVersion,
    migrationIds:
      input.operation === "upgrade"
        ? receipt.operations.migrations.pendingIds
        : [],
    newOwnerKeySha256,
    requiresFreshBackup:
      input.operation === "upgrade" && receipt.site.stage === "production",
    confirmation,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
  });
}

export type CmsAgencyOperationExecutionReceipt = Readonly<{
  schemaVersion: 1;
  planId: string;
  site: Readonly<{ id: string; stage: z.infer<typeof stageSchema> }>;
  operation: CmsAgencyOperation;
  actorId: string;
  backupReceiptId: string | null;
  status: "accepted";
  acceptedAt: string;
}>;

export async function dispatchCmsAgencyOperation<TResult>(input: {
  plan: CmsAgencyOperationPlan;
  confirmation: string;
  actorId: string;
  backup?: Readonly<{
    receiptId: string;
    siteId: string;
    stage: z.infer<typeof stageSchema>;
    verifiedAt: string;
  }>;
  dispatch: (plan: CmsAgencyOperationPlan) => TResult | Promise<TResult>;
  now?: Date;
}) {
  const plan = cmsAgencyOperationPlanSchema.parse(input.plan);
  const now = input.now ?? new Date();
  if (parseTimestamp(plan.createdAt) > now.getTime()) {
    throw new Error("Agency operation plan cannot be created in the future.");
  }
  if (input.confirmation !== plan.confirmation) {
    throw new Error("Agency operation requires the exact plan confirmation.");
  }
  const actorId = input.actorId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(actorId)) {
    throw new Error("Agency operation requires a stable actor id.");
  }
  if (plan.requiresFreshBackup) {
    const backup = z
      .object({
        receiptId: opaqueReceiptIdSchema,
        siteId: siteIdSchema,
        stage: stageSchema,
        verifiedAt: timestampSchema,
      })
      .strict()
      .nullable()
      .parse(input.backup ?? null);
    if (
      !backup ||
      backup.siteId !== plan.site.id ||
      backup.stage !== plan.site.stage ||
      parseTimestamp(backup.verifiedAt) < parseTimestamp(plan.createdAt) ||
      parseTimestamp(backup.verifiedAt) > now.getTime()
    ) {
      throw new Error(
        "Production upgrade requires a fresh, verified, site-bound backup receipt.",
      );
    }
  }
  const result = await input.dispatch(plan);
  return Object.freeze({
    result,
    receipt: Object.freeze({
      schemaVersion: 1 as const,
      planId: plan.planId,
      site: plan.site,
      operation: plan.operation,
      actorId,
      backupReceiptId: input.backup?.receiptId ?? null,
      status: "accepted" as const,
      acceptedAt: now.toISOString(),
    }) satisfies CmsAgencyOperationExecutionReceipt,
  });
}

export const cmsAgencyHandoverItemIds = Object.freeze([
  "least-privilege-accounts",
  "preview-publish-restore",
  "media-seo-redirect-forms",
  "backup-restore-owner",
  "incident-contact",
  "bootstrap-credentials-removed",
  "registry-secrets-hidden",
  "editable-scope-signed",
] as const);

export function verifyCmsAgencyHandoverChecklist(input: {
  siteId: string;
  items: readonly Readonly<{
    id: (typeof cmsAgencyHandoverItemIds)[number];
    completed: boolean;
  }>[];
  clientOwnerKeySha256: string;
  receiptId: string;
  signedAt: string;
}) {
  siteIdSchema.parse(input.siteId);
  sha256Schema.parse(input.clientOwnerKeySha256);
  opaqueReceiptIdSchema.parse(input.receiptId);
  timestampSchema.parse(input.signedAt);
  unique(
    input.items.map(({ id }) => id),
    "handover checklist item",
  );
  const byId = new Map(input.items.map((item) => [item.id, item.completed]));
  const incomplete = cmsAgencyHandoverItemIds.filter((id) => !byId.get(id));
  if (incomplete.length) {
    throw new Error(
      `Handover checklist is incomplete: ${incomplete.join(", ")}.`,
    );
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    siteId: input.siteId,
    receiptId: input.receiptId,
    clientOwnerKeySha256: input.clientOwnerKeySha256,
    signedAt: new Date(input.signedAt).toISOString(),
    completedItemIds: cmsAgencyHandoverItemIds,
  });
}
