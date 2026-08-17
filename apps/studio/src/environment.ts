export type StudioEnvironment = Readonly<{
  projectId: string;
  dataset: string;
  previewUrl: string;
  allowOrigins: readonly string[];
}>;

export function readStudioEnvironment(
  source: Record<string, string | undefined>,
): StudioEnvironment {
  const projectId = required(source, "SANITY_STUDIO_PROJECT_ID");
  const dataset = required(source, "SANITY_STUDIO_DATASET");
  if (!/^[a-z0-9-]+$/i.test(projectId)) {
    throw new Error("SANITY_STUDIO_PROJECT_ID is invalid.");
  }
  if (!/^[a-z0-9_-]+$/i.test(dataset)) {
    throw new Error("SANITY_STUDIO_DATASET is invalid.");
  }

  const previewUrl = normalizeUrl(
    required(source, "SANITY_STUDIO_PREVIEW_URL"),
    "SANITY_STUDIO_PREVIEW_URL",
  );
  const configuredOrigins = required(source, "SANITY_STUDIO_ALLOW_ORIGINS")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter(Boolean);
  const allowOrigins = [...new Set(configuredOrigins)];
  if (allowOrigins.length !== configuredOrigins.length) {
    throw new Error("SANITY_STUDIO_ALLOW_ORIGINS must contain unique origins.");
  }
  if (!allowOrigins.includes(new URL(previewUrl).origin)) {
    throw new Error(
      "SANITY_STUDIO_ALLOW_ORIGINS must include the preview URL origin.",
    );
  }

  return Object.freeze({
    projectId,
    dataset,
    previewUrl,
    allowOrigins: Object.freeze(allowOrigins),
  });
}

function required(source: Record<string, string | undefined>, name: string) {
  const value = source[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function normalizeUrl(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTP(S).`);
  }
  return url.toString().replace(/\/$/, "");
}

function normalizeOrigin(value: string) {
  return new URL(normalizeUrl(value, "SANITY_STUDIO_ALLOW_ORIGINS")).origin;
}
