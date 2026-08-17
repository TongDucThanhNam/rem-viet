export const sanityPreviewEnvironmentKeys = [
  "SANITY_PROJECT_ID",
  "SANITY_DATASET",
  "SANITY_STUDIO_URL",
  "SANITY_API_READ_TOKEN",
  "SANITY_PREVIEW_COOKIE_SECRET",
] as const;

export type SanityPreviewEnvironment = Readonly<{
  projectId: string;
  dataset: string;
  studioUrl: string;
  readToken: string;
  cookieSecret: string;
}>;

type EnvironmentSource = Partial<
  Record<(typeof sanityPreviewEnvironmentKeys)[number], unknown>
>;

export function readSanityPreviewEnvironment(
  source: EnvironmentSource,
): SanityPreviewEnvironment | null {
  const values = new Map(
    sanityPreviewEnvironmentKeys.map((key) => [key, stringValue(source[key])]),
  );
  if ([...values.values()].every((value) => !value)) return null;

  const missing = sanityPreviewEnvironmentKeys.filter(
    (key) => !values.get(key),
  );
  if (missing.length) {
    throw new Error(
      `Incomplete Sanity preview configuration: missing ${missing.join(", ")}.`,
    );
  }

  const projectId = values.get("SANITY_PROJECT_ID")!;
  const dataset = values.get("SANITY_DATASET")!;
  const studioUrl = normalizeHttpUrl(
    values.get("SANITY_STUDIO_URL")!,
    "SANITY_STUDIO_URL",
  );
  const cookieSecret = values.get("SANITY_PREVIEW_COOKIE_SECRET")!;
  if (!/^[a-z0-9-]+$/i.test(projectId)) {
    throw new Error("SANITY_PROJECT_ID is invalid.");
  }
  if (!/^[a-z0-9_-]+$/i.test(dataset)) {
    throw new Error("SANITY_DATASET is invalid.");
  }
  if (cookieSecret.length < 32) {
    throw new Error(
      "SANITY_PREVIEW_COOKIE_SECRET must be at least 32 characters.",
    );
  }

  return Object.freeze({
    projectId,
    dataset,
    studioUrl,
    readToken: values.get("SANITY_API_READ_TOKEN")!,
    cookieSecret,
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHttpUrl(value: string, name: string) {
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
