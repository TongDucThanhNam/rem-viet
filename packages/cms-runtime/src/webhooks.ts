export type CmsWebhookReplayStore = Readonly<{
  claim: (input: {
    deliveryId: string;
    timestamp: number;
    expiresAt: Date;
  }) => Promise<boolean>;
}>;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function rawSignature(input: {
  secret: string;
  timestamp: number;
  deliveryId: string;
  body: string;
}) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(
        `${input.timestamp}.${input.deliveryId}.${input.body}`,
      ),
    ),
  );
}

export async function signCmsWebhookPayload(input: {
  secret: string;
  timestamp: number;
  deliveryId: string;
  body: string;
}) {
  return `v1=${bytesToHex(await rawSignature(input))}`;
}

function parseSignature(value: string) {
  const match = /^v1=([a-f0-9]{64})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  return Uint8Array.from(match[1].match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function verifyCmsWebhookRequest(input: {
  body: string;
  deliveryId: string;
  signature: string;
  timestamp: string | number;
  secrets: readonly string[];
  replayStore: CmsWebhookReplayStore;
  now?: Date;
  toleranceSeconds?: number;
}) {
  const now = input.now ?? new Date();
  const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
  const timestamp = Number(input.timestamp);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    return { ok: false as const, reason: "invalid_timestamp" as const };
  }
  if (
    Math.abs(Math.floor(now.getTime() / 1000) - timestamp) > toleranceSeconds
  ) {
    return { ok: false as const, reason: "stale_timestamp" as const };
  }
  const provided = parseSignature(input.signature);
  if (!provided || !input.secrets.length) {
    return { ok: false as const, reason: "invalid_signature" as const };
  }
  let valid = false;
  for (const secret of input.secrets) {
    const expected = await rawSignature({
      secret,
      timestamp,
      deliveryId: input.deliveryId,
      body: input.body,
    });
    valid = constantTimeEqual(provided, expected) || valid;
  }
  if (!valid) {
    return { ok: false as const, reason: "invalid_signature" as const };
  }
  const claimed = await input.replayStore.claim({
    deliveryId: input.deliveryId,
    timestamp,
    expiresAt: new Date((timestamp + toleranceSeconds) * 1000),
  });
  return claimed
    ? { ok: true as const, deliveryId: input.deliveryId, timestamp }
    : { ok: false as const, reason: "replayed_delivery" as const };
}
