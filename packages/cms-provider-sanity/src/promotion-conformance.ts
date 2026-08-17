import {
  SANITY_HOSTED_RECEIPT_SCHEMA_VERSION,
  parseSanityHostedConformanceReceipt,
  type SanityHostedConformanceReceipt,
} from "./hosted-conformance";
import {
  SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION,
  parseSanityPresentationReceipt,
  type SanityPresentationReceipt,
} from "./presentation-conformance";

export const SANITY_PROMOTION_RECEIPT_SCHEMA_VERSION = 1;

export const sanityPromotionCheckNames = [
  "cleanCheckout",
  "hostedReceiptValid",
  "presentationReceiptValid",
  "scopeMatches",
  "hostedBindingMatches",
  "artifactDigestsMatch",
  "proofCommitsReachable",
  "evidenceOnlySincePresentationProof",
  "chronologyValid",
  "cleanupProven",
] as const;

export type SanityPromotionEvidenceKind =
  | "hosted-receipt"
  | "presentation-receipt"
  | "playwright-report"
  | "screenshot";

export type SanityPromotionReceipt = Readonly<{
  schemaVersion: typeof SANITY_PROMOTION_RECEIPT_SCHEMA_VERSION;
  status: "complete";
  provider: "sanity";
  proof: "promotion-readiness";
  projectId: string;
  dataset: string;
  generatedAt: string;
  gitCommit: string;
  studioOrigin: string;
  previewOrigin: string;
  hosted: Readonly<{
    schemaVersion: typeof SANITY_HOSTED_RECEIPT_SCHEMA_VERSION;
    documentId: string;
    completedAt: string;
    gitCommit: string;
  }>;
  presentation: Readonly<{
    schemaVersion: typeof SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION;
    documentId: string;
    completedAt: string;
    gitCommit: string;
  }>;
  checks: Readonly<Record<(typeof sanityPromotionCheckNames)[number], true>>;
  evidence: ReadonlyArray<
    Readonly<{
      kind: SanityPromotionEvidenceKind;
      path: string;
      sha256: string;
    }>
  >;
}>;

const promotionEvidenceKinds = [
  "hosted-receipt",
  "presentation-receipt",
  "playwright-report",
  "screenshot",
] as const;

export const sanityPromotionReceiptJsonSchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  properties: {
    schemaVersion: { const: SANITY_PROMOTION_RECEIPT_SCHEMA_VERSION },
    status: { const: "complete" },
    provider: { const: "sanity" },
    proof: { const: "promotion-readiness" },
    projectId: { type: "string", minLength: 1 },
    dataset: { type: "string", minLength: 1 },
    generatedAt: { type: "string", format: "date-time" },
    gitCommit: { type: "string", pattern: "^[a-f0-9]{40}$" },
    studioOrigin: { type: "string", format: "uri" },
    previewOrigin: { type: "string", format: "uri" },
    hosted: {
      additionalProperties: false,
      properties: {
        schemaVersion: { const: SANITY_HOSTED_RECEIPT_SCHEMA_VERSION },
        documentId: { type: "string", minLength: 1 },
        completedAt: { type: "string", format: "date-time" },
        gitCommit: { type: "string", pattern: "^[a-f0-9]{40}$" },
      },
      required: ["schemaVersion", "documentId", "completedAt", "gitCommit"],
      type: "object",
    },
    presentation: {
      additionalProperties: false,
      properties: {
        schemaVersion: { const: SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION },
        documentId: { type: "string", minLength: 1 },
        completedAt: { type: "string", format: "date-time" },
        gitCommit: { type: "string", pattern: "^[a-f0-9]{40}$" },
      },
      required: ["schemaVersion", "documentId", "completedAt", "gitCommit"],
      type: "object",
    },
    checks: {
      additionalProperties: false,
      properties: Object.fromEntries(
        sanityPromotionCheckNames.map((name) => [name, { const: true }]),
      ),
      required: sanityPromotionCheckNames,
      type: "object",
    },
    evidence: {
      type: "array",
      minItems: promotionEvidenceKinds.length,
      maxItems: promotionEvidenceKinds.length,
      items: {
        additionalProperties: false,
        properties: {
          kind: { enum: promotionEvidenceKinds },
          path: { type: "string", minLength: 1 },
          sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        },
        required: ["kind", "path", "sha256"],
        type: "object",
      },
    },
  },
  required: [
    "schemaVersion",
    "status",
    "provider",
    "proof",
    "projectId",
    "dataset",
    "generatedAt",
    "gitCommit",
    "studioOrigin",
    "previewOrigin",
    "hosted",
    "presentation",
    "checks",
    "evidence",
  ],
  type: "object",
} as const);

export function requiredSanityPromotionConfirmation(input: {
  projectId: string;
  dataset: string;
  hostedDocumentId: string;
  presentationDocumentId: string;
  allowProduction?: boolean;
}) {
  const projectId = identifier(input.projectId, "projectId");
  const dataset = identifier(input.dataset, "dataset");
  const hostedDocumentId = identifier(
    input.hostedDocumentId,
    "hostedDocumentId",
  );
  const presentationDocumentId = identifier(
    input.presentationDocumentId,
    "presentationDocumentId",
  );
  if (dataset === "production" && !input.allowProduction) {
    validation("Sanity promotion verification is staging-only by default.");
  }
  return `VERIFY SANITY PROMOTION ${projectId}/${dataset} ${hostedDocumentId} ${presentationDocumentId}${
    dataset === "production" ? " PRODUCTION" : ""
  }`;
}

export function createSanityPromotionReceipt(input: {
  hostedReceipt: SanityHostedConformanceReceipt;
  presentationReceipt: SanityPresentationReceipt;
  generatedAt: string;
  gitCommit: string;
  provenance: Readonly<{
    cleanCheckout: true;
    proofCommitsReachable: true;
    evidenceOnlySincePresentationProof: true;
  }>;
  evidence: SanityPromotionReceipt["evidence"];
}): SanityPromotionReceipt {
  const hosted = parseSanityHostedConformanceReceipt(input.hostedReceipt);
  const presentation = parseSanityPresentationReceipt(
    input.presentationReceipt,
  );
  assertReceiptChain(hosted, presentation, input.generatedAt);
  assert(
    input.provenance.cleanCheckout === true,
    "Clean checkout was not proven.",
  );
  assert(
    input.provenance.proofCommitsReachable === true,
    "Proof commit ancestry was not proven.",
  );
  assert(
    input.provenance.evidenceOnlySincePresentationProof === true,
    "Post-proof source immutability was not proven.",
  );
  assertCommit(input.gitCommit, "Promotion");
  assertPromotionEvidence(input.evidence);
  assertEvidenceChain(presentation, input.evidence);

  return parseSanityPromotionReceipt({
    schemaVersion: SANITY_PROMOTION_RECEIPT_SCHEMA_VERSION,
    status: "complete",
    provider: "sanity",
    proof: "promotion-readiness",
    projectId: hosted.projectId,
    dataset: hosted.dataset,
    generatedAt: input.generatedAt,
    gitCommit: input.gitCommit,
    studioOrigin: hosted.visualEditing.studioOrigin,
    previewOrigin: hosted.visualEditing.previewOrigin,
    hosted: {
      schemaVersion: hosted.schemaVersion,
      documentId: hosted.documentId,
      completedAt: hosted.completedAt,
      gitCommit: hosted.gitCommit,
    },
    presentation: {
      schemaVersion: presentation.schemaVersion,
      documentId: presentation.documentId,
      completedAt: presentation.completedAt,
      gitCommit: presentation.gitCommit,
    },
    checks: Object.fromEntries(
      sanityPromotionCheckNames.map((name) => [name, true]),
    ),
    evidence: input.evidence,
  });
}

export function parseSanityPromotionReceipt(
  value: unknown,
): SanityPromotionReceipt {
  assert(isRecord(value), "Sanity promotion receipt is not an object.");
  assertExactKeys(value, sanityPromotionReceiptJsonSchema.required);
  assert(
    value.schemaVersion === SANITY_PROMOTION_RECEIPT_SCHEMA_VERSION,
    "Sanity promotion receipt schema is invalid.",
  );
  assert(
    value.status === "complete",
    "Sanity promotion receipt is incomplete.",
  );
  assert(value.provider === "sanity", "Sanity promotion provider is invalid.");
  assert(
    value.proof === "promotion-readiness",
    "Sanity promotion proof is invalid.",
  );
  for (const [name, field] of [
    ["projectId", value.projectId],
    ["dataset", value.dataset],
  ] as const) {
    assert(typeof field === "string", `Sanity promotion ${name} is invalid.`);
    assert(
      field === identifier(field, name),
      `Sanity promotion ${name} is not normalized.`,
    );
  }
  assertIso(value.generatedAt, "Promotion generation time");
  assertCommit(value.gitCommit, "Promotion");
  assertHttpsOrigin(value.studioOrigin, "Studio");
  assertHttpsOrigin(value.previewOrigin, "Preview");
  assert(
    value.studioOrigin !== value.previewOrigin,
    "Promotion origins must differ.",
  );
  assertProofBinding(
    value.hosted,
    "hosted",
    SANITY_HOSTED_RECEIPT_SCHEMA_VERSION,
  );
  assertProofBinding(
    value.presentation,
    "presentation",
    SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION,
  );
  assertExactTrueChecks(value.checks, sanityPromotionCheckNames);
  assertPromotionEvidence(value.evidence);
  return Object.freeze(value as unknown as SanityPromotionReceipt);
}

function assertReceiptChain(
  hosted: SanityHostedConformanceReceipt,
  presentation: SanityPresentationReceipt,
  generatedAt: string,
) {
  assert(
    hosted.projectId === presentation.projectId &&
      hosted.dataset === presentation.dataset,
    "Hosted and Presentation scopes do not match.",
  );
  assert(
    hosted.visualEditing.studioOrigin === presentation.studioOrigin &&
      hosted.visualEditing.previewOrigin === presentation.previewOrigin,
    "Hosted and Presentation origins do not match.",
  );
  assert(
    presentation.hostedReceipt.schemaVersion === hosted.schemaVersion &&
      presentation.hostedReceipt.gitCommit === hosted.gitCommit,
    "Presentation hosted-receipt provenance does not match.",
  );
  assert(
    Date.parse(hosted.completedAt) <= Date.parse(presentation.startedAt),
    "Presentation proof predates hosted conformance.",
  );
  assertIso(generatedAt, "Promotion generation time");
  assert(
    Date.parse(presentation.completedAt) <= Date.parse(generatedAt),
    "Promotion receipt predates Presentation proof.",
  );
}

function assertEvidenceChain(
  presentation: SanityPresentationReceipt,
  evidence: SanityPromotionReceipt["evidence"],
) {
  const byKind = new Map(evidence.map((item) => [item.kind, item]));
  const hosted = byKind.get("hosted-receipt");
  assert(
    hosted?.path === presentation.hostedReceipt.path &&
      hosted.sha256 === presentation.hostedReceipt.sha256,
    "Promotion evidence does not match the hosted receipt binding.",
  );
  for (const artifact of presentation.artifacts) {
    const bound = byKind.get(artifact.kind);
    assert(
      bound?.path === artifact.path && bound.sha256 === artifact.sha256,
      `Promotion evidence does not match the ${artifact.kind} binding.`,
    );
  }
}

function assertProofBinding(
  value: unknown,
  label: string,
  schemaVersion: number,
) {
  assert(isRecord(value), `Sanity ${label} proof binding is missing.`);
  assertExactKeys(value, [
    "schemaVersion",
    "documentId",
    "completedAt",
    "gitCommit",
  ]);
  assert(
    value.schemaVersion === schemaVersion,
    `Sanity ${label} schema is invalid.`,
  );
  assert(
    typeof value.documentId === "string" &&
      value.documentId === identifier(value.documentId, `${label}DocumentId`),
    `Sanity ${label} document is invalid.`,
  );
  assertIso(value.completedAt, `Sanity ${label} completion time`);
  assertCommit(value.gitCommit, `Sanity ${label}`);
}

function assertPromotionEvidence(value: unknown) {
  assert(
    Array.isArray(value) && value.length === promotionEvidenceKinds.length,
    "Sanity promotion requires four evidence files.",
  );
  const kinds = new Set<string>();
  const paths = new Set<string>();
  for (const item of value) {
    assert(isRecord(item), "Sanity promotion evidence is invalid.");
    assertExactKeys(item, ["kind", "path", "sha256"]);
    assert(
      typeof item.kind === "string" &&
        promotionEvidenceKinds.includes(
          item.kind as SanityPromotionEvidenceKind,
        ),
      "Sanity promotion evidence kind is invalid.",
    );
    assert(
      typeof item.path === "string",
      "Sanity promotion evidence path is invalid.",
    );
    assertSafeEvidencePath(item.path);
    assert(
      typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256),
      "Sanity promotion evidence digest is invalid.",
    );
    kinds.add(item.kind);
    paths.add(item.path);
  }
  assert(
    kinds.size === promotionEvidenceKinds.length,
    "Sanity promotion evidence kinds are incomplete.",
  );
  assert(
    paths.size === promotionEvidenceKinds.length,
    "Sanity promotion evidence paths must be distinct.",
  );
}

function assertExactTrueChecks(value: unknown, names: readonly string[]) {
  assert(isRecord(value), "Sanity promotion checks are missing.");
  assertExactKeys(value, names);
  for (const name of names) {
    assert(
      value[name] === true,
      `Sanity promotion check ${name} did not pass.`,
    );
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  names: readonly string[],
) {
  const expected = new Set(names);
  assert(
    Object.keys(value).length === expected.size &&
      Object.keys(value).every((name) => expected.has(name)),
    "Sanity promotion receipt contains missing or unknown fields.",
  );
}

function assertSafeEvidencePath(value: string) {
  assert(
    value.startsWith("docs/releases/evidence/") &&
      !value.includes("..") &&
      !value.includes("\\"),
    "Sanity promotion evidence must stay below docs/releases/evidence/.",
  );
}

function assertCommit(value: unknown, label: string) {
  assert(
    typeof value === "string" && /^[a-f0-9]{40}$/.test(value),
    `${label} Git commit is invalid.`,
  );
}

function assertIso(value: unknown, label: string) {
  assert(
    typeof value === "string" && Number.isFinite(Date.parse(value)),
    `${label} is invalid.`,
  );
}

function assertHttpsOrigin(value: unknown, label: string) {
  assert(typeof value === "string", `${label} origin is invalid.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    validation(`${label} origin is invalid.`);
  }
  assert(
    url.protocol === "https:" && url.origin === value,
    `${label} origin must be normalized HTTPS.`,
  );
}

function identifier(value: string, name: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(normalized)) {
    validation(`Invalid Sanity promotion ${name}.`);
  }
  return normalized;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) validation(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validation(message: string): never {
  throw new Error(message);
}
