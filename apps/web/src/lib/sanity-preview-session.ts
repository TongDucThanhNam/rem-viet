import { validateApiPerspective, type ClientPerspective } from "@sanity/client";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";

export const sanityPreviewSignatureCookieName =
  "__agency_sanity_preview_signature";

export function normalizeSanityPerspective(
  value: unknown,
): Exclude<ClientPerspective, "raw"> {
  const candidate =
    typeof value === "string" && value.includes(",")
      ? value.split(",").map((entry) => entry.trim())
      : value;
  validateApiPerspective(candidate);
  if (candidate === "raw") {
    throw new Error("The raw Sanity perspective is not allowed in preview.");
  }
  return candidate;
}

export function serializeSanityPerspective(
  perspective: Exclude<ClientPerspective, "raw">,
) {
  return Array.isArray(perspective) ? perspective.join(",") : perspective;
}

export async function signSanityPerspective(
  perspective: Exclude<ClientPerspective, "raw">,
  secret: string,
) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(serializeSanityPerspective(perspective)),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

export async function readSignedSanityPerspective(
  cookieHeader: string | null,
  secret: string,
): Promise<Exclude<ClientPerspective, "raw"> | null> {
  const cookies = parseCookieHeader(cookieHeader);
  const rawPerspective = cookies.get(perspectiveCookieName);
  const signature = cookies.get(sanityPreviewSignatureCookieName);
  if (!rawPerspective || !signature) return null;

  let perspective: Exclude<ClientPerspective, "raw">;
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    perspective = normalizeSanityPerspective(
      decodeURIComponent(rawPerspective),
    );
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signatureBytes,
    new TextEncoder().encode(serializeSanityPerspective(perspective)),
  );
  return valid ? perspective : null;
}

export function previewCookieHeaders(input: {
  perspective: Exclude<ClientPerspective, "raw">;
  signature: string;
  partitioned: boolean;
}) {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Max-Age=3600",
  ];
  const pairs = [
    `${perspectiveCookieName}=${encodeURIComponent(serializeSanityPerspective(input.perspective))}`,
    `${sanityPreviewSignatureCookieName}=${input.signature}`,
  ];
  return pairs.map((pair) =>
    [pair, ...attributes, ...(input.partitioned ? ["Partitioned"] : [])].join(
      "; ",
    ),
  );
}

export function expiredPreviewCookieHeaders() {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Max-Age=0",
  ];
  return [perspectiveCookieName, sanityPreviewSignatureCookieName].flatMap(
    (name) => [
      [`${name}=`, ...attributes].join("; "),
      [`${name}=`, ...attributes, "Partitioned"].join("; "),
    ],
  );
}

function parseCookieHeader(header: string | null) {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    cookies.set(
      part.slice(0, separator).trim(),
      part.slice(separator + 1).trim(),
    );
  }
  return cookies;
}

function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid signature.");
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
