export const sanityWebhookEnvironmentKeys = [
  "SANITY_PROJECT_ID",
  "SANITY_DATASET",
  "SANITY_WEBHOOK_SECRET",
] as const;

export type SanityWebhookEnvironment = Readonly<{
  projectId: string;
  dataset: string;
  secret: string;
}>;

type EnvironmentSource = Partial<
  Record<(typeof sanityWebhookEnvironmentKeys)[number], unknown>
>;

export function readSanityWebhookEnvironment(
  source: EnvironmentSource,
): SanityWebhookEnvironment | null {
  const secret = stringValue(source.SANITY_WEBHOOK_SECRET);
  if (!secret) return null;

  const projectId = stringValue(source.SANITY_PROJECT_ID);
  const dataset = stringValue(source.SANITY_DATASET);
  const missing = [
    !projectId ? "SANITY_PROJECT_ID" : "",
    !dataset ? "SANITY_DATASET" : "",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Incomplete Sanity webhook configuration: missing ${missing.join(", ")}.`,
    );
  }
  if (!/^[a-z0-9-]+$/i.test(projectId)) {
    throw new Error("SANITY_PROJECT_ID is invalid.");
  }
  if (!/^[a-z0-9_-]+$/i.test(dataset)) {
    throw new Error("SANITY_DATASET is invalid.");
  }
  if (secret.length < 32 || secret.length > 512) {
    throw new Error("SANITY_WEBHOOK_SECRET must contain 32 to 512 characters.");
  }
  return Object.freeze({ projectId, dataset, secret });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
