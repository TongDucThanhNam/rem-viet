import {
  createCmsVisualPreviewEnvelope,
  initialCmsVisualPreviewReplayState,
  validateCmsVisualPreviewEnvelope,
  type CmsVisualPreviewEnvelope,
  type CmsVisualPreviewIdentity,
  type CmsVisualPreviewPayload,
  type CmsVisualPreviewPeer,
  type CmsVisualPreviewReplayState,
  type CmsVisualPreviewValidationResult,
} from "./preview-security.js";

export type CmsVisualPreviewSessionSnapshot = Readonly<{
  identity: CmsVisualPreviewIdentity;
  outgoingSequence: number;
  pendingDocumentVersion: Readonly<{
    messageId: string;
    documentVersion: number;
  }> | null;
  replay: CmsVisualPreviewReplayState;
}>;

export type CmsVisualPreviewSession = Readonly<{
  create<TPayload extends CmsVisualPreviewPayload>(
    payload: TPayload,
    issuedAt?: number,
  ): CmsVisualPreviewEnvelope<TPayload>;
  createVersionedState<TState>(
    state: TState,
    documentVersion: number,
    issuedAt?: number,
  ): CmsVisualPreviewEnvelope<
    Readonly<{ type: "state"; state: TState }>
  > | null;
  acknowledgeDocumentVersion(
    acknowledgedMessageId: string,
    documentVersion: number,
    issuedAt?: number,
  ): CmsVisualPreviewEnvelope<
    Readonly<{ type: "ack"; acknowledgedMessageId: string }>
  >;
  receive(input: {
    value: unknown;
    origin: string;
    now?: number;
  }): CmsVisualPreviewValidationResult;
  setDocumentVersion(documentVersion: number): void;
  setConflictToken(conflictToken: string): void;
  reset(): void;
  snapshot(): CmsVisualPreviewSessionSnapshot;
}>;

function assertIdentity(identity: CmsVisualPreviewIdentity): void {
  createCmsVisualPreviewEnvelope({
    source: "host",
    messageId: "identity-check",
    sequence: 1,
    issuedAt: 0,
    identity,
    payload: { type: "ready" },
  });
}

export function createCmsVisualPreviewSession(input: {
  source: CmsVisualPreviewPeer;
  expectedSource: CmsVisualPreviewPeer;
  identity: CmsVisualPreviewIdentity;
  allowedOrigins: ReadonlySet<string>;
  messageIdFactory?: () => string;
  maxAgeMs?: number;
  maxRememberedMessages?: number;
}): CmsVisualPreviewSession {
  assertIdentity(input.identity);
  let identity = Object.freeze({ ...input.identity });
  let outgoingSequence = 0;
  let pendingDocumentVersion: Readonly<{
    messageId: string;
    documentVersion: number;
  }> | null = null;
  let replay = initialCmsVisualPreviewReplayState();
  const messageIdFactory =
    input.messageIdFactory ?? (() => crypto.randomUUID());

  const create = <TPayload extends CmsVisualPreviewPayload>(
    payload: TPayload,
    issuedAt?: number,
  ): CmsVisualPreviewEnvelope<TPayload> => {
    const nextSequence = outgoingSequence + 1;
    const envelope = createCmsVisualPreviewEnvelope({
      source: input.source,
      messageId: messageIdFactory(),
      sequence: nextSequence,
      issuedAt,
      identity,
      payload,
    });
    outgoingSequence = nextSequence;
    return envelope;
  };

  return Object.freeze({
    create,
    createVersionedState<TState>(
      state: TState,
      documentVersion: number,
      issuedAt?: number,
    ) {
      if (pendingDocumentVersion) return null;
      const nextIdentity = Object.freeze({ ...identity, documentVersion });
      assertIdentity(nextIdentity);
      const envelope = create({ type: "state", state }, issuedAt);
      if (identity.documentVersion !== documentVersion) {
        pendingDocumentVersion = Object.freeze({
          messageId: envelope.messageId,
          documentVersion,
        });
      }
      return envelope;
    },
    acknowledgeDocumentVersion(
      acknowledgedMessageId: string,
      documentVersion: number,
      issuedAt?: number,
    ) {
      const nextIdentity = Object.freeze({ ...identity, documentVersion });
      assertIdentity(nextIdentity);
      identity = nextIdentity;
      return create({ type: "ack", acknowledgedMessageId }, issuedAt);
    },
    receive({ value, origin, now }) {
      let result = validateCmsVisualPreviewEnvelope({
        value,
        origin,
        allowedOrigins: input.allowedOrigins,
        expectedSource: input.expectedSource,
        expectedIdentity: identity,
        replay,
        now,
        maxAgeMs: input.maxAgeMs,
        maxRememberedMessages: input.maxRememberedMessages,
      });
      const pending = pendingDocumentVersion;
      if (!result.accepted && result.reason === "identity" && pending) {
        const transitionResult = validateCmsVisualPreviewEnvelope({
          value,
          origin,
          allowedOrigins: input.allowedOrigins,
          expectedSource: input.expectedSource,
          expectedIdentity: {
            ...identity,
            documentVersion: pending.documentVersion,
          },
          replay,
          now,
          maxAgeMs: input.maxAgeMs,
          maxRememberedMessages: input.maxRememberedMessages,
        });
        if (
          transitionResult.accepted &&
          transitionResult.envelope.payload.type === "ack" &&
          transitionResult.envelope.payload.acknowledgedMessageId ===
            pending.messageId
        ) {
          result = transitionResult;
        }
      }
      if (result.accepted) {
        replay = result.replay;
        if (
          pending &&
          result.envelope.payload.type === "ack" &&
          result.envelope.payload.acknowledgedMessageId === pending.messageId
        ) {
          identity = Object.freeze({
            ...identity,
            documentVersion: pending.documentVersion,
          });
          pendingDocumentVersion = null;
        }
      }
      return result;
    },
    setDocumentVersion(documentVersion) {
      const nextIdentity = Object.freeze({ ...identity, documentVersion });
      assertIdentity(nextIdentity);
      identity = nextIdentity;
      pendingDocumentVersion = null;
    },
    setConflictToken(conflictToken) {
      const nextIdentity = Object.freeze({ ...identity, conflictToken });
      assertIdentity(nextIdentity);
      identity = nextIdentity;
      pendingDocumentVersion = null;
    },
    reset() {
      outgoingSequence = 0;
      pendingDocumentVersion = null;
      replay = initialCmsVisualPreviewReplayState();
    },
    snapshot() {
      return Object.freeze({
        identity,
        outgoingSequence,
        pendingDocumentVersion,
        replay,
      });
    },
  });
}
