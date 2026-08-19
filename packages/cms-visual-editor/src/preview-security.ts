export const CMS_VISUAL_PREVIEW_CHANNEL =
  "@agency/cms-visual-editor/preview/v2";
export const CMS_VISUAL_PREVIEW_PROTOCOL_VERSION = 2 as const;

export type CmsVisualPreviewPeer = "host" | "preview";
export type CmsVisualPreviewIdentity = Readonly<{
  siteId: string;
  documentId: string;
  documentType: string;
  sessionId: string;
  sessionBinding: string;
  documentVersion: number;
  conflictToken: string;
}>;
export type CmsVisualPreviewPayload =
  | Readonly<{ type: "ready" }>
  | Readonly<{ type: "state"; state: unknown }>
  | Readonly<{ type: "select"; nodeId: string; fieldPath?: string }>
  | Readonly<{ type: "command"; command: unknown }>
  | Readonly<{ type: "conflict"; latestVersion: number; conflictToken: string }>
  | Readonly<{ type: "ack"; acknowledgedMessageId: string }>;

export type CmsVisualPreviewEnvelope<
  TPayload extends CmsVisualPreviewPayload = CmsVisualPreviewPayload,
> = Readonly<{
  channel: typeof CMS_VISUAL_PREVIEW_CHANNEL;
  protocolVersion: typeof CMS_VISUAL_PREVIEW_PROTOCOL_VERSION;
  source: CmsVisualPreviewPeer;
  messageId: string;
  sequence: number;
  issuedAt: number;
  identity: CmsVisualPreviewIdentity;
  payload: TPayload;
}>;

export type CmsVisualPreviewReplayState = Readonly<{
  lastSequence: number;
  messageIds: readonly string[];
}>;

export type CmsVisualPreviewValidationResult =
  | Readonly<{
      accepted: true;
      envelope: CmsVisualPreviewEnvelope;
      replay: CmsVisualPreviewReplayState;
    }>
  | Readonly<{
      accepted: false;
      reason: "origin" | "source" | "shape" | "identity" | "stale" | "replay";
      replay: CmsVisualPreviewReplayState;
    }>;

const boundedToken = (value: unknown, max = 256): value is string =>
  typeof value === "string" &&
  value.length >= 8 &&
  value.length <= max &&
  !/[\u0000-\u001f]/.test(value);
const boundedIdentity = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

function isIdentity(value: unknown): value is CmsVisualPreviewIdentity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    boundedIdentity(candidate.siteId) &&
    boundedIdentity(candidate.documentId) &&
    boundedIdentity(candidate.documentType) &&
    boundedToken(candidate.sessionId) &&
    boundedToken(candidate.sessionBinding) &&
    Number.isSafeInteger(candidate.documentVersion) &&
    Number(candidate.documentVersion) >= 0 &&
    boundedToken(candidate.conflictToken)
  );
}

function identitiesMatch(
  actual: CmsVisualPreviewIdentity,
  expected: CmsVisualPreviewIdentity,
): boolean {
  return (
    actual.siteId === expected.siteId &&
    actual.documentId === expected.documentId &&
    actual.documentType === expected.documentType &&
    actual.sessionId === expected.sessionId &&
    actual.sessionBinding === expected.sessionBinding &&
    actual.documentVersion === expected.documentVersion &&
    actual.conflictToken === expected.conflictToken
  );
}

function isPayload(value: unknown): value is CmsVisualPreviewPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "ready") return true;
  if (candidate.type === "state") return "state" in candidate;
  if (candidate.type === "command") return "command" in candidate;
  if (candidate.type === "select") {
    return (
      boundedIdentity(candidate.nodeId) &&
      (candidate.fieldPath === undefined ||
        (typeof candidate.fieldPath === "string" &&
          candidate.fieldPath.length > 0 &&
          candidate.fieldPath.length <= 256))
    );
  }
  if (candidate.type === "conflict") {
    return (
      Number.isSafeInteger(candidate.latestVersion) &&
      Number(candidate.latestVersion) >= 0 &&
      boundedToken(candidate.conflictToken)
    );
  }
  return (
    candidate.type === "ack" && boundedToken(candidate.acknowledgedMessageId)
  );
}

export function createCmsVisualPreviewEnvelope<
  TPayload extends CmsVisualPreviewPayload,
>(input: {
  source: CmsVisualPreviewPeer;
  messageId: string;
  sequence: number;
  issuedAt?: number;
  identity: CmsVisualPreviewIdentity;
  payload: TPayload;
}): CmsVisualPreviewEnvelope<TPayload> {
  if (
    !boundedToken(input.messageId) ||
    !Number.isSafeInteger(input.sequence) ||
    input.sequence < 1
  ) {
    throw new Error("Visual preview message identity is invalid.");
  }
  if (!isIdentity(input.identity) || !isPayload(input.payload)) {
    throw new Error("Visual preview envelope identity or payload is invalid.");
  }
  return Object.freeze({
    channel: CMS_VISUAL_PREVIEW_CHANNEL,
    protocolVersion: CMS_VISUAL_PREVIEW_PROTOCOL_VERSION,
    source: input.source,
    messageId: input.messageId,
    sequence: input.sequence,
    issuedAt: input.issuedAt ?? Date.now(),
    identity: Object.freeze({ ...input.identity }),
    payload: Object.freeze({ ...input.payload }),
  });
}

export function initialCmsVisualPreviewReplayState(): CmsVisualPreviewReplayState {
  return Object.freeze({ lastSequence: 0, messageIds: Object.freeze([]) });
}

export function validateCmsVisualPreviewEnvelope(input: {
  value: unknown;
  origin: string;
  allowedOrigins: ReadonlySet<string>;
  expectedSource: CmsVisualPreviewPeer;
  expectedIdentity: CmsVisualPreviewIdentity;
  replay: CmsVisualPreviewReplayState;
  now?: number;
  maxAgeMs?: number;
  maxRememberedMessages?: number;
}): CmsVisualPreviewValidationResult {
  if (!input.allowedOrigins.has(input.origin)) {
    return { accepted: false, reason: "origin", replay: input.replay };
  }
  if (!input.value || typeof input.value !== "object") {
    return { accepted: false, reason: "shape", replay: input.replay };
  }
  const envelope = input.value as Partial<CmsVisualPreviewEnvelope>;
  if (
    envelope.channel !== CMS_VISUAL_PREVIEW_CHANNEL ||
    envelope.protocolVersion !== CMS_VISUAL_PREVIEW_PROTOCOL_VERSION ||
    !boundedToken(envelope.messageId) ||
    !Number.isSafeInteger(envelope.sequence) ||
    Number(envelope.sequence) < 1 ||
    !Number.isSafeInteger(envelope.issuedAt) ||
    !isIdentity(envelope.identity) ||
    !isPayload(envelope.payload)
  ) {
    return { accepted: false, reason: "shape", replay: input.replay };
  }
  if (envelope.source !== input.expectedSource) {
    return { accepted: false, reason: "source", replay: input.replay };
  }
  if (!identitiesMatch(envelope.identity, input.expectedIdentity)) {
    return { accepted: false, reason: "identity", replay: input.replay };
  }
  const now = input.now ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? 30_000;
  if (
    Number(envelope.issuedAt) < now - maxAgeMs ||
    Number(envelope.issuedAt) > now + 5_000
  ) {
    return { accepted: false, reason: "stale", replay: input.replay };
  }
  if (
    Number(envelope.sequence) <= input.replay.lastSequence ||
    input.replay.messageIds.includes(envelope.messageId)
  ) {
    return { accepted: false, reason: "replay", replay: input.replay };
  }
  const limit = Math.max(1, input.maxRememberedMessages ?? 128);
  const replay = Object.freeze({
    lastSequence: Number(envelope.sequence),
    messageIds: Object.freeze(
      [...input.replay.messageIds, envelope.messageId].slice(-limit),
    ),
  });
  return {
    accepted: true,
    envelope: envelope as CmsVisualPreviewEnvelope,
    replay,
  };
}

export function createCmsVisualPreviewResponseHeaders(input: {
  frameAncestors: readonly string[];
}): Readonly<Record<string, string>> {
  if (
    input.frameAncestors.length === 0 ||
    input.frameAncestors.some((value) => !/^https:\/\//.test(value))
  ) {
    throw new Error(
      "Visual preview requires an explicit HTTPS frame-ancestor allowlist.",
    );
  }
  return Object.freeze({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Security-Policy": `frame-ancestors ${input.frameAncestors.join(" ")}`,
    "Referrer-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
}
