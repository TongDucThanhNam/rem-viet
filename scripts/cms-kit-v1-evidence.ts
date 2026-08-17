import { z } from "zod";

import { cmsKitPackageNames } from "./cms-kit-release-lib";

const isoTimestamp = z.string().refine((value) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && value.includes("T");
}, "Must be an ISO-8601 timestamp");
const gitSha = z.string().regex(/^[0-9a-f]{40}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const safeId = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const evidencePath = z
  .string()
  .regex(/^docs\/releases\/evidence\/[A-Za-z0-9][A-Za-z0-9._/-]*\.json$/)
  .refine((value) => !value.includes(".."), "Path traversal is not allowed");
const httpsUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Must be an HTTPS URL without credentials");
const httpsOrigin = httpsUrl.refine((value) => {
  const url = new URL(value);
  return url.pathname === "/" && !url.search && !url.hash;
}, "Must be an HTTPS origin");

const packageReceiptSchema = z
  .object({
    name: z.string().min(1),
    version: semver,
    sha256,
    publishedAt: isoTimestamp,
    verifiedAt: isoTimestamp,
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.verifiedAt) < Date.parse(value.publishedAt)) {
      context.addIssue({
        code: "custom",
        path: ["verifiedAt"],
        message: "Registry verification must follow publication",
      });
    }
  });

export const cmsKitPublicationReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    subject: z.literal("agency-cms-platform-kit"),
    version: semver,
    commit: gitSha,
    registry: httpsUrl,
    access: z.literal("restricted"),
    status: z.literal("published-and-verified"),
    packages: z.array(packageReceiptSchema),
    completedAt: isoTimestamp,
  })
  .strict()
  .superRefine((receipt, context) => {
    const expected = [...cmsKitPackageNames].sort();
    const actual = receipt.packages.map(({ name }) => name).sort();
    if (actual.join("\n") !== expected.join("\n")) {
      context.addIssue({
        code: "custom",
        path: ["packages"],
        message:
          "Publication must contain each coordinated package exactly once",
      });
    }
    for (const [index, entry] of receipt.packages.entries()) {
      if (entry.version !== receipt.version) {
        context.addIssue({
          code: "custom",
          path: ["packages", index, "version"],
          message: "Package version must match the coordinated release",
        });
      }
      if (Date.parse(receipt.completedAt) < Date.parse(entry.verifiedAt)) {
        context.addIssue({
          code: "custom",
          path: ["completedAt"],
          message: "Publication completion must follow package verification",
        });
      }
    }
  });

const adoptionChecksSchema = z
  .object({
    paidEngagement: z.literal(true),
    cleanCheckout: z.literal(true),
    independentRepository: z.literal(true),
    publicPackageExportsOnly: z.literal(true),
    noCopiedPackageSource: z.literal(true),
    providerConformance: z.literal(true),
    productionLikeRestore: z.literal(true),
    adminWorkflow: z.literal(true),
    coreFixAbsentBefore: z.literal(true),
    coreFixPresentAfter: z.literal(true),
    upgradedWithoutCopiedPatch: z.literal(true),
    clientHandover: z.literal(true),
  })
  .strict();

export const cmsKitAdoptionReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    status: z.literal("complete"),
    siteId: safeId,
    repositoryFingerprint: sha256,
    paidEngagementProofSha256: sha256,
    supportAgreementSha256: sha256,
    origin: httpsOrigin,
    provider: z.literal("cloudflare"),
    fromVersion: semver,
    toVersion: semver,
    initialPublicationReceiptSha256: sha256,
    targetPublicationReceiptSha256: sha256,
    coreFixId: z.string().regex(/^[A-Z][A-Z0-9]+-[1-9]\d*$/),
    deployedAt: isoTimestamp,
    upgradedAt: isoTimestamp,
    verifiedAt: isoTimestamp,
    checks: adoptionChecksSchema,
    clientApproval: z
      .object({
        role: z.literal("client-owner"),
        approvedAt: isoTimestamp,
      })
      .strict(),
  })
  .strict()
  .superRefine((receipt, context) => {
    const deployed = Date.parse(receipt.deployedAt);
    const upgraded = Date.parse(receipt.upgradedAt);
    const verified = Date.parse(receipt.verifiedAt);
    const approved = Date.parse(receipt.clientApproval.approvedAt);
    if (receipt.fromVersion === receipt.toVersion) {
      context.addIssue({
        code: "custom",
        path: ["toVersion"],
        message: "Adoption must prove an actual coordinated upgrade",
      });
    }
    if (!(
      deployed < upgraded &&
      upgraded <= verified &&
      verified <= approved
    )) {
      context.addIssue({
        code: "custom",
        path: ["clientApproval", "approvedAt"],
        message:
          "Deployment, upgrade, verification and approval chronology is invalid",
      });
    }
  });

const receiptReferenceSchema = z
  .object({ path: evidencePath, sha256 })
  .strict();

const localChecksSchema = z
  .object({
    cleanCheckout: z.literal(true),
    tests: z.literal(true),
    typecheck: z.literal(true),
    productionBuilds: z.literal(true),
    migrations: z.literal(true),
    packageBoundaries: z.literal(true),
    packedConsumer: z.literal(true),
    upgradeRollback: z.literal(true),
    compatibilityMatrix: z.literal(true),
    changelogAndMigrationNotes: z.literal(true),
    installationDocumentation: z.literal(true),
    templateDocumentation: z.literal(true),
    upgradeDocumentation: z.literal(true),
    incidentDocumentation: z.literal(true),
    handoverDocumentation: z.literal(true),
  })
  .strict();

export const cmsKitV1EvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    releaseTag: z.literal("cms-kit-v1.0.0"),
    assembledAt: isoTimestamp,
    releaseSourceCommit: gitSha,
    sourceState: z.literal("clean"),
    coreFix: z
      .object({
        id: z.string().regex(/^[A-Z][A-Z0-9]+-[1-9]\d*$/),
        fromVersion: semver,
        toVersion: z.literal("1.0.0"),
        sourceCommit: gitSha,
        changelogSha256: sha256,
      })
      .strict(),
    publications: z
      .object({
        initial: receiptReferenceSchema,
        target: receiptReferenceSchema,
      })
      .strict(),
    adoptions: z.array(receiptReferenceSchema).min(2).max(20),
    localChecks: localChecksSchema,
    commercialBoundary: z
      .object({
        installationTierDefined: z.literal(true),
        recurringSupportScopeDefined: z.literal(true),
        upgradeSlaDefined: z.literal(true),
        deprecationPolicyDefined: z.literal(true),
      })
      .strict(),
    agencyApproval: z
      .object({
        role: z.literal("agency-owner"),
        approvedAt: isoTimestamp,
        statement: z.literal(
          "I approve Agency CMS Platform Kit v1.0.0 for restricted commercial use.",
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.releaseSourceCommit !== record.coreFix.sourceCommit) {
      context.addIssue({
        code: "custom",
        path: ["releaseSourceCommit"],
        message: "Release and core-fix source commits must match",
      });
    }
    if (record.coreFix.fromVersion === record.coreFix.toVersion) {
      context.addIssue({
        code: "custom",
        path: ["coreFix", "fromVersion"],
        message: "Core-fix proof requires two different releases",
      });
    }
    const references = [
      record.publications.initial.path,
      record.publications.target.path,
      ...record.adoptions.map(({ path }) => path),
    ];
    if (new Set(references).size !== references.length) {
      context.addIssue({
        code: "custom",
        path: ["adoptions"],
        message: "Every evidence reference must be unique",
      });
    }
    if (
      Date.parse(record.agencyApproval.approvedAt) <
      Date.parse(record.assembledAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["agencyApproval", "approvedAt"],
        message: "Agency approval must follow evidence assembly",
      });
    }
  });

export type CmsKitPublicationReceipt = z.infer<
  typeof cmsKitPublicationReceiptSchema
>;
export type CmsKitAdoptionReceipt = z.infer<typeof cmsKitAdoptionReceiptSchema>;
export type CmsKitV1Evidence = z.infer<typeof cmsKitV1EvidenceSchema>;

export function parseCmsKitPublicationReceipt(value: unknown) {
  return cmsKitPublicationReceiptSchema.parse(value);
}

export function parseCmsKitAdoptionReceipt(value: unknown) {
  return cmsKitAdoptionReceiptSchema.parse(value);
}

export function parseCmsKitV1Evidence(value: unknown) {
  return cmsKitV1EvidenceSchema.parse(value);
}

export function verifyCmsKitV1EvidenceGraph(input: {
  record: CmsKitV1Evidence;
  initialPublication: {
    receipt: CmsKitPublicationReceipt;
    sha256: string;
  };
  targetPublication: {
    receipt: CmsKitPublicationReceipt;
    sha256: string;
  };
  adoptions: readonly {
    receipt: CmsKitAdoptionReceipt;
    sha256: string;
  }[];
  changelog: { sha256: string; text: string };
}) {
  const { record, initialPublication, targetPublication } = input;
  const initial = initialPublication.receipt;
  const target = targetPublication.receipt;
  if (
    initialPublication.sha256 !== record.publications.initial.sha256 ||
    targetPublication.sha256 !== record.publications.target.sha256 ||
    initial.version !== record.coreFix.fromVersion ||
    target.version !== record.coreFix.toVersion ||
    target.version !== "1.0.0" ||
    target.commit !== record.releaseSourceCommit ||
    initial.registry !== target.registry ||
    Date.parse(initial.completedAt) >= Date.parse(target.completedAt)
  ) {
    throw new Error(
      "Publication receipts do not match the declared coordinated core upgrade.",
    );
  }
  if (
    input.adoptions.length !== record.adoptions.length ||
    !sameValues(
      input.adoptions.map(({ sha256 }) => sha256),
      record.adoptions.map(({ sha256 }) => sha256),
    )
  ) {
    throw new Error(
      "Loaded adoption receipts do not match the final evidence references.",
    );
  }
  const adoptions = input.adoptions.map(({ receipt }) => receipt);
  assertUnique(
    adoptions.map(({ siteId }) => siteId),
    "site ids",
  );
  assertUnique(
    adoptions.map(({ repositoryFingerprint }) => repositoryFingerprint),
    "repository fingerprints",
  );
  assertUnique(
    adoptions.map(({ paidEngagementProofSha256 }) => paidEngagementProofSha256),
    "paid-engagement proofs",
  );
  assertUnique(
    adoptions.map(({ supportAgreementSha256 }) => supportAgreementSha256),
    "support agreements",
  );
  assertUnique(
    adoptions.map(({ origin }) => origin),
    "deployment origins",
  );
  for (const adoption of adoptions) {
    if (
      adoption.fromVersion !== initial.version ||
      adoption.toVersion !== target.version ||
      adoption.initialPublicationReceiptSha256 !== initialPublication.sha256 ||
      adoption.targetPublicationReceiptSha256 !== targetPublication.sha256 ||
      adoption.coreFixId !== record.coreFix.id
    ) {
      throw new Error(
        `Adoption receipt ${adoption.siteId} is not bound to both releases and the core fix.`,
      );
    }
    if (
      Date.parse(adoption.deployedAt) < Date.parse(initial.completedAt) ||
      Date.parse(adoption.upgradedAt) < Date.parse(target.completedAt)
    ) {
      throw new Error(
        `Adoption receipt ${adoption.siteId} predates its registry publication.`,
      );
    }
  }
  const latestClientApproval = Math.max(
    ...adoptions.map((receipt) =>
      Date.parse(receipt.clientApproval.approvedAt),
    ),
  );
  if (Date.parse(record.assembledAt) < latestClientApproval) {
    throw new Error(
      "CMS Kit evidence was assembled before all client approvals.",
    );
  }
  if (
    input.changelog.sha256 !== record.coreFix.changelogSha256 ||
    !input.changelog.text.includes(record.coreFix.id) ||
    !input.changelog.text.includes(record.coreFix.toVersion)
  ) {
    throw new Error(
      "CMS Kit changelog must match and name the proven core fix and target version.",
    );
  }
  return Object.freeze({
    registry: target.registry,
    version: target.version,
    coreFix: record.coreFix.id,
    paidSites: Object.freeze(adoptions.map(({ siteId }) => siteId).sort()),
  });
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`CMS Kit adoption ${label} must be unique.`);
  }
}

function sameValues(left: readonly string[], right: readonly string[]) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}
