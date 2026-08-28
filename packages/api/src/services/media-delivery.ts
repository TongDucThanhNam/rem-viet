import type { CloudflareD1Database } from "@agency/cms-provider-cloudflare";

const privateDeliveryVersion = "cms-private-media-v1";
const maximumPrivateDeliveryLifetimeMs = 3_600_000;

function signingPayload(key: string, expiresAt: number) {
  return `${privateDeliveryVersion}\n${key}\n${expiresAt}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=";
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usages: KeyUsage[]) {
  if (!secret.trim())
    throw new Error("Private media signing is not configured");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

export async function signPrivateMediaDelivery(input: {
  key: string;
  url: string;
  expiresAt: Date;
  secret: string;
}) {
  const expiresAt = input.expiresAt.getTime();
  if (!Number.isSafeInteger(expiresAt)) {
    throw new Error("Private media delivery expiry is invalid");
  }
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(input.secret, ["sign"]),
      new TextEncoder().encode(signingPayload(input.key, expiresAt)),
    ),
  );
  const separator = input.url.includes("?") ? "&" : "?";
  return `${input.url}${separator}expires=${expiresAt}&signature=${bytesToBase64Url(signature)}`;
}

export async function verifyPrivateMediaDelivery(input: {
  key: string;
  expires: string | null;
  signature: string | null;
  secret: string;
  now?: Date;
}) {
  if (!input.expires || !/^\d{13}$/.test(input.expires) || !input.signature) {
    return false;
  }
  const expiresAt = Number(input.expires);
  const now = (input.now ?? new Date()).getTime();
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt - now > maximumPrivateDeliveryLifetimeMs
  ) {
    return false;
  }
  const signature = base64UrlToBytes(input.signature);
  if (!signature) return false;
  try {
    return crypto.subtle.verify(
      "HMAC",
      await hmacKey(input.secret, ["verify"]),
      signature,
      new TextEncoder().encode(signingPayload(input.key, expiresAt)),
    );
  } catch {
    return false;
  }
}

export type MediaDeliveryPolicy = Readonly<{
  visibility: "public" | "private";
  status: "active" | "trashed";
  expiresAt: number | null;
}>;

export async function getMediaDeliveryPolicy(
  key: string,
  database: CloudflareD1Database,
): Promise<MediaDeliveryPolicy | null> {
  const row = await database
    .prepare(
      `SELECT visibility, asset_status AS status, expires_at AS expiresAt
       FROM media WHERE key = ? LIMIT 1`,
    )
    .bind(key)
    .first<{
      visibility: "public" | "private";
      status: "active" | "trashed";
      expiresAt: number | null;
    }>();
  if (!row) return null;
  return {
    visibility: row.visibility,
    status: row.status,
    expiresAt: row.expiresAt === null ? null : Number(row.expiresAt),
  };
}
