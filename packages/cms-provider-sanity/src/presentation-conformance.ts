import { SANITY_HOSTED_RECEIPT_SCHEMA_VERSION } from "./hosted-conformance";

export const SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION = 1;

export const sanityPresentationBrowserCheckNames = [
  "authenticatedStudio",
  "previewSecretHandshake",
  "secureIframeCookies",
  "partitionedIframeCookies",
  "embeddedPreview",
  "stegaOverlay",
  "clickToEdit",
  "liveMutationNoReload",
  "publishedPerspective",
  "draftPerspective",
  "responsiveViewport",
] as const;

export type SanityPresentationBrowserCheck =
  (typeof sanityPresentationBrowserCheckNames)[number];

export type SanityPresentationObservation = Readonly<{
  schemaVersion: 1;
  status: "complete";
  projectId: string;
  dataset: string;
  documentId: string;
  startedAt: string;
  completedAt: string;
  studioOrigin: string;
  previewOrigin: string;
  browserProject: "desktop-chrome";
  checks: Readonly<Record<SanityPresentationBrowserCheck, true>>;
}>;

export type SanityPresentationReceipt = Readonly<{
  schemaVersion: typeof SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION;
  status: "complete";
  provider: "sanity";
  proof: "presentation";
  projectId: string;
  dataset: string;
  documentId: string;
  startedAt: string;
  completedAt: string;
  gitCommit: string;
  studioOrigin: string;
  previewOrigin: string;
  browserProject: "desktop-chrome";
  hostedReceipt: Readonly<{
    schemaVersion: typeof SANITY_HOSTED_RECEIPT_SCHEMA_VERSION;
    path: string;
    sha256: string;
    gitCommit: string;
  }>;
  checks: Readonly<
    Record<SanityPresentationBrowserCheck, true> & {
      cleanPreflight: true;
      sourceDocumentsCleaned: true;
      previewSecretsCleaned: true;
    }
  >;
  artifacts: ReadonlyArray<
    Readonly<{
      kind: "playwright-report" | "screenshot";
      path: string;
      sha256: string;
    }>
  >;
}>;

const receiptCheckNames = [
  "cleanPreflight",
  ...sanityPresentationBrowserCheckNames,
  "sourceDocumentsCleaned",
  "previewSecretsCleaned",
] as const;

export const sanityPresentationReceiptJsonSchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  properties: {
    schemaVersion: { const: SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION },
    status: { const: "complete" },
    provider: { const: "sanity" },
    proof: { const: "presentation" },
    projectId: { type: "string", minLength: 1 },
    dataset: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time" },
    gitCommit: { type: "string", pattern: "^[a-f0-9]{40}$" },
    studioOrigin: { type: "string", format: "uri" },
    previewOrigin: { type: "string", format: "uri" },
    browserProject: { const: "desktop-chrome" },
    hostedReceipt: {
      additionalProperties: false,
      properties: {
        schemaVersion: { const: SANITY_HOSTED_RECEIPT_SCHEMA_VERSION },
        path: { type: "string", minLength: 1 },
        sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        gitCommit: { type: "string", pattern: "^[a-f0-9]{40}$" },
      },
      required: ["schemaVersion", "path", "sha256", "gitCommit"],
      type: "object",
    },
    checks: {
      additionalProperties: false,
      properties: Object.fromEntries(
        receiptCheckNames.map((name) => [name, { const: true }]),
      ),
      required: receiptCheckNames,
      type: "object",
    },
    artifacts: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      allOf: [
        {
          contains: {
            properties: { kind: { const: "playwright-report" } },
            required: ["kind"],
          },
        },
        {
          contains: {
            properties: { kind: { const: "screenshot" } },
            required: ["kind"],
          },
        },
      ],
      items: {
        additionalProperties: false,
        properties: {
          kind: { enum: ["playwright-report", "screenshot"] },
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
    "documentId",
    "startedAt",
    "completedAt",
    "gitCommit",
    "studioOrigin",
    "previewOrigin",
    "browserProject",
    "hostedReceipt",
    "checks",
    "artifacts",
  ],
  type: "object",
} as const);

export function requiredSanityPresentationConfirmation(input: {
  projectId: string;
  dataset: string;
  documentId: string;
  allowProduction?: boolean;
}) {
  const scope = normalizePresentationScope(input);
  return `VERIFY SANITY PRESENTATION ${scope.projectId}/${scope.dataset} ${scope.documentId}${
    scope.dataset === "production" ? " PRODUCTION" : ""
  }`;
}

export function parseSanityPresentationObservation(
  value: unknown,
  expected: {
    projectId: string;
    dataset: string;
    documentId: string;
    studioUrl: string;
    previewUrl: string;
    allowProduction?: boolean;
  },
): SanityPresentationObservation {
  if (!isRecord(value))
    validation("Presentation observation is not an object.");
  const scope = normalizePresentationScope(expected);
  assert(
    value.schemaVersion === 1,
    "Presentation observation schema is invalid.",
  );
  assert(
    value.status === "complete",
    "Presentation observation is incomplete.",
  );
  assert(
    value.projectId === scope.projectId,
    "Observation project does not match.",
  );
  assert(
    value.dataset === scope.dataset,
    "Observation dataset does not match.",
  );
  assert(
    value.documentId === scope.documentId,
    "Observation document does not match.",
  );
  assert(
    value.studioOrigin === scope.studioOrigin,
    "Observation Studio origin does not match.",
  );
  assert(
    value.previewOrigin === scope.previewOrigin,
    "Observation preview origin does not match.",
  );
  assert(
    value.browserProject === "desktop-chrome",
    "Observation browser is invalid.",
  );
  assertIsoRange(value.startedAt, value.completedAt);
  assertExactChecks(value.checks, sanityPresentationBrowserCheckNames);
  return value as SanityPresentationObservation;
}

export function createSanityPresentationReceipt(input: {
  observation: SanityPresentationObservation;
  gitCommit: string;
  hostedReceiptPath: string;
  hostedReceiptSha256: string;
  hostedReceiptGitCommit: string;
  artifacts: SanityPresentationReceipt["artifacts"];
}): SanityPresentationReceipt {
  const receipt: SanityPresentationReceipt = {
    schemaVersion: SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION,
    status: "complete",
    provider: "sanity",
    proof: "presentation",
    projectId: input.observation.projectId,
    dataset: input.observation.dataset,
    documentId: input.observation.documentId,
    startedAt: input.observation.startedAt,
    completedAt: input.observation.completedAt,
    gitCommit: input.gitCommit,
    studioOrigin: input.observation.studioOrigin,
    previewOrigin: input.observation.previewOrigin,
    browserProject: input.observation.browserProject,
    hostedReceipt: {
      schemaVersion: SANITY_HOSTED_RECEIPT_SCHEMA_VERSION,
      path: input.hostedReceiptPath,
      sha256: input.hostedReceiptSha256,
      gitCommit: input.hostedReceiptGitCommit,
    },
    checks: {
      cleanPreflight: true,
      ...input.observation.checks,
      sourceDocumentsCleaned: true,
      previewSecretsCleaned: true,
    },
    artifacts: input.artifacts,
  };
  return parseSanityPresentationReceipt(receipt);
}

export function parseSanityPresentationReceipt(
  value: unknown,
): SanityPresentationReceipt {
  assert(isRecord(value), "Presentation receipt is not an object.");
  assertExactKeys(value, [
    "schemaVersion",
    "status",
    "provider",
    "proof",
    "projectId",
    "dataset",
    "documentId",
    "startedAt",
    "completedAt",
    "gitCommit",
    "studioOrigin",
    "previewOrigin",
    "browserProject",
    "hostedReceipt",
    "checks",
    "artifacts",
  ]);
  assert(
    value.schemaVersion === SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION,
    "Presentation receipt schema is invalid.",
  );
  assert(value.status === "complete", "Presentation receipt is incomplete.");
  assert(
    value.provider === "sanity",
    "Presentation receipt provider is invalid.",
  );
  assert(
    value.proof === "presentation",
    "Presentation receipt proof is invalid.",
  );
  assert(
    typeof value.projectId === "string",
    "Presentation project is invalid.",
  );
  assert(typeof value.dataset === "string", "Presentation dataset is invalid.");
  assert(
    typeof value.documentId === "string",
    "Presentation document is invalid.",
  );
  assert(
    typeof value.studioOrigin === "string",
    "Presentation Studio origin is invalid.",
  );
  assert(
    typeof value.previewOrigin === "string",
    "Presentation preview origin is invalid.",
  );
  const scope = normalizePresentationScope({
    projectId: value.projectId,
    dataset: value.dataset,
    documentId: value.documentId,
    studioUrl: value.studioOrigin,
    previewUrl: value.previewOrigin,
    allowProduction: value.dataset === "production",
  });
  assert(
    value.projectId === scope.projectId,
    "Presentation project is not normalized.",
  );
  assert(
    value.dataset === scope.dataset,
    "Presentation dataset is not normalized.",
  );
  assert(
    value.documentId === scope.documentId,
    "Presentation document is not normalized.",
  );
  assert(
    value.studioOrigin === scope.studioOrigin,
    "Presentation Studio origin is not normalized.",
  );
  assert(
    value.previewOrigin === scope.previewOrigin,
    "Presentation preview origin is not normalized.",
  );
  assertIsoRange(value.startedAt, value.completedAt);
  assert(
    typeof value.gitCommit === "string" &&
      /^[a-f0-9]{40}$/.test(value.gitCommit),
    "Git commit must be a full SHA.",
  );
  assert(
    value.browserProject === "desktop-chrome",
    "Presentation browser is invalid.",
  );

  assert(isRecord(value.hostedReceipt), "Hosted receipt binding is missing.");
  assertExactKeys(value.hostedReceipt, [
    "schemaVersion",
    "path",
    "sha256",
    "gitCommit",
  ]);
  assert(
    value.hostedReceipt.schemaVersion === SANITY_HOSTED_RECEIPT_SCHEMA_VERSION,
    "Hosted receipt schema binding is invalid.",
  );
  assert(
    typeof value.hostedReceipt.path === "string",
    "Hosted receipt path is invalid.",
  );
  assert(
    typeof value.hostedReceipt.sha256 === "string",
    "Hosted receipt digest is invalid.",
  );
  assert(
    typeof value.hostedReceipt.gitCommit === "string" &&
      /^[a-f0-9]{40}$/.test(value.hostedReceipt.gitCommit),
    "Hosted receipt Git commit is invalid.",
  );
  assertSafeEvidencePath(value.hostedReceipt.path, "Hosted receipt");
  assertDigest(value.hostedReceipt.sha256, "Hosted receipt");
  assertExactChecks(value.checks, receiptCheckNames);

  assert(
    Array.isArray(value.artifacts) && value.artifacts.length === 2,
    "Presentation receipt requires two artifacts.",
  );
  const artifactKinds = new Set<string>();
  const artifactPaths = new Set<string>();
  for (const artifact of value.artifacts) {
    assert(isRecord(artifact), "Presentation artifact is invalid.");
    assertExactKeys(artifact, ["kind", "path", "sha256"]);
    assert(
      artifact.kind === "playwright-report" || artifact.kind === "screenshot",
      "Presentation artifact kind is invalid.",
    );
    assert(
      typeof artifact.path === "string",
      "Presentation artifact path is invalid.",
    );
    assert(
      typeof artifact.sha256 === "string",
      "Presentation artifact digest is invalid.",
    );
    assertSafeEvidencePath(artifact.path, "Presentation artifact");
    assertDigest(artifact.sha256, "Presentation artifact");
    artifactKinds.add(artifact.kind);
    artifactPaths.add(artifact.path);
  }
  assert(
    artifactKinds.has("playwright-report") && artifactKinds.has("screenshot"),
    "Presentation artifacts must include one report and one screenshot.",
  );
  assert(
    artifactPaths.size === 2,
    "Presentation artifact paths must be distinct.",
  );
  return Object.freeze(value as unknown as SanityPresentationReceipt);
}

function normalizePresentationScope(input: {
  projectId: string;
  dataset: string;
  documentId: string;
  studioUrl?: string;
  previewUrl?: string;
  allowProduction?: boolean;
}) {
  const projectId = identifier(input.projectId, "projectId");
  const dataset = identifier(input.dataset, "dataset");
  const documentId = identifier(input.documentId, "documentId");
  if (dataset === "production" && !input.allowProduction) {
    validation(
      "Presentation proof is staging-only unless production is explicit.",
    );
  }
  const studioOrigin = input.studioUrl
    ? httpsOrigin(input.studioUrl, "studioUrl")
    : undefined;
  const previewOrigin = input.previewUrl
    ? httpsOrigin(input.previewUrl, "previewUrl")
    : undefined;
  if (studioOrigin && previewOrigin && studioOrigin === previewOrigin) {
    validation("Studio and preview must use distinct origins for CHIPS proof.");
  }
  return { projectId, dataset, documentId, studioOrigin, previewOrigin };
}

function assertExactChecks(value: unknown, names: readonly string[]) {
  assert(isRecord(value), "Presentation checks are missing.");
  assert(
    Object.keys(value).length === names.length,
    "Presentation checks contain missing or unknown entries.",
  );
  for (const name of names) {
    assert(value[name] === true, `Presentation check ${name} did not pass.`);
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
    "Presentation receipt contains missing or unknown fields.",
  );
}

function assertIsoRange(startedAt: unknown, completedAt: unknown) {
  assert(typeof startedAt === "string", "Presentation start time is invalid.");
  assert(
    typeof completedAt === "string",
    "Presentation completion time is invalid.",
  );
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  assert(
    Number.isFinite(start) && Number.isFinite(end),
    "Presentation timestamps are invalid.",
  );
  assert(end >= start, "Presentation completion precedes its start.");
}

function assertSafeEvidencePath(value: string, label: string) {
  assert(
    value.startsWith("docs/releases/evidence/") &&
      !value.includes("..") &&
      !value.includes("\\"),
    `${label} path must stay below docs/releases/evidence/.`,
  );
}

function assertDigest(value: string, label: string) {
  assert(/^[a-f0-9]{64}$/.test(value), `${label} SHA-256 is invalid.`);
}

function httpsOrigin(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    validation(`${name} must be an absolute HTTPS URL.`);
  }
  if (url.protocol !== "https:") validation(`${name} must use HTTPS.`);
  return url.origin;
}

function identifier(value: string, name: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(normalized)) {
    validation(`Invalid Presentation ${name}.`);
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
