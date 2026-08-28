import { createHmac } from "node:crypto";

export const stagingE2eEnvironmentKeys = [
  "CMS_E2E_EMAIL",
  "CMS_E2E_PASSWORD",
  "CMS_E2E_TOTP_SECRET",
] as const;

export type StagingE2eEnvironmentKey =
  (typeof stagingE2eEnvironmentKeys)[number];

function validateBinding(key: string, value: string) {
  if (!stagingE2eEnvironmentKeys.includes(key as StagingE2eEnvironmentKey)) {
    throw new Error("Unsupported staging E2E environment binding.");
  }
  if (!value || /[\r\n]/u.test(value)) {
    throw new Error(`Invalid private staging E2E binding: ${key}.`);
  }
}

/**
 * Adds one private binding without changing an existing value. Duplicate keys
 * fail closed so a dotenv parser cannot silently select a different secret.
 */
export function addPrivateBindingIfMissing(
  contents: string,
  key: StagingE2eEnvironmentKey,
  value: string,
) {
  validateBinding(key, value);
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/u);
  const matches = lines.filter((line) => line.startsWith(`${key}=`));
  if (matches.length > 1) {
    throw new Error(`Duplicate private staging E2E binding: ${key}.`);
  }
  if (matches.length === 1) {
    return { contents, added: false } as const;
  }
  const suffix =
    contents.endsWith("\n") || contents.endsWith("\r\n") ? "" : newline;
  return {
    contents: `${contents}${suffix}${key}=${value}${newline}`,
    added: true,
  } as const;
}

export function replacePrivateBinding(
  contents: string,
  key: StagingE2eEnvironmentKey,
  expectedValue: string,
  replacementValue: string,
) {
  validateBinding(key, expectedValue);
  validateBinding(key, replacementValue);
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/u);
  const matches = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith(`${key}=`));
  if (matches.length !== 1) {
    throw new Error(`Expected one private staging E2E binding: ${key}.`);
  }
  if (matches[0]!.line !== `${key}=${expectedValue}`) {
    throw new Error(`Private staging E2E binding changed: ${key}.`);
  }
  lines[matches[0]!.index] = `${key}=${replacementValue}`;
  return lines.join(newline);
}

export function stagingE2eEmail(siteId: string, stage: string) {
  if (!/^[a-z][a-z0-9-]{1,62}$/u.test(siteId)) {
    throw new Error("Site must be a safe slug.");
  }
  if (!/^[a-z][a-z0-9-]{1,31}$/u.test(stage)) {
    throw new Error("Stage must be a safe slug.");
  }
  return `cms-e2e-${siteId}-${stage}@example.com`;
}

export function assertSyntheticE2eEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^cms-e2e-[a-z0-9-]+@example\.com$/u.test(email)) {
    throw new Error(
      "The staging E2E identity must use the reserved cms-e2e-* @example.com address.",
    );
  }
  return email;
}

export function extractTotpSecret(totpUri: string) {
  let uri: URL;
  try {
    uri = new URL(totpUri);
  } catch {
    throw new Error(
      "The authentication provider returned an invalid TOTP URI.",
    );
  }
  if (uri.protocol !== "otpauth:" || uri.hostname !== "totp") {
    throw new Error("The authentication provider did not return a TOTP URI.");
  }
  const encodedSecret = uri.searchParams.get("secret") ?? "";
  if (!/^[A-Z2-7]{16,256}$/u.test(encodedSecret)) {
    throw new Error(
      "The authentication provider returned an invalid TOTP secret.",
    );
  }
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  for (const character of encodedSecret) {
    const value = alphabet.indexOf(character);
    if (value < 0) {
      throw new Error(
        "The authentication provider returned an invalid TOTP secret.",
      );
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  const secret = new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(bytes),
  );
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(secret)) {
    throw new Error("The decoded TOTP secret is invalid.");
  }
  return { encodedSecret, secret } as const;
}

export function generateTotp(secret: string, timestamp = Date.now()) {
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(secret)) {
    throw new Error("TOTP secret is invalid.");
  }
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error("TOTP timestamp is invalid.");
  }
  const counter = Math.floor(timestamp / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", Buffer.from(secret, "utf8"))
    .update(message)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (value % 1_000_000).toString().padStart(6, "0");
}

export class AuthCookieJar {
  readonly #cookies = new Map<string, string>();

  absorb(headers: Headers) {
    const values = headers.getSetCookie();
    for (const value of values) {
      const pair = value.split(";", 1)[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      if (!name) continue;
      if (cookieValue) this.#cookies.set(name, cookieValue);
      else this.#cookies.delete(name);
    }
  }

  header() {
    return [...this.#cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get size() {
    return this.#cookies.size;
  }
}
