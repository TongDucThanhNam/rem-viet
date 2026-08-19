const encoder = new TextEncoder();

export async function createPreviewSessionBinding(sessionId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`rem-viet:visual-preview:${sessionId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
