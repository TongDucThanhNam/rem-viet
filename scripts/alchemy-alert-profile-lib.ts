export const alertProfileScopes = [
  "account:read",
  "user:read",
  "notification:read",
  "notification:write",
] as const;

const alertCredentialScopes = [...alertProfileScopes, "offline_access"];

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be a JSON object.`);
  return value as JsonObject;
}

function isExactStringSet(value: unknown, expected: readonly string[]) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    return false;
  }
  const entries = new Set(value as string[]);
  return (
    entries.size === expected.length &&
    expected.every((entry) => entries.has(entry))
  );
}

export function isAlchemyAlertCredentialReady(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const credential = input as JsonObject;
  if (
    credential.type !== "oauth" ||
    typeof credential.access !== "string" ||
    credential.access.length === 0 ||
    typeof credential.refresh !== "string" ||
    credential.refresh.length === 0 ||
    typeof credential.expires !== "number" ||
    !Number.isFinite(credential.expires) ||
    credential.expires <= 0 ||
    !isExactStringSet(credential.scopes, alertCredentialScopes)
  ) {
    return false;
  }
  return true;
}

export function buildAlchemyAlertProfile(
  input: unknown,
  sourceProfile = "default",
  targetProfile = "alerts",
) {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(sourceProfile))
    throw new Error("Source profile must be a safe profile name.");
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(targetProfile))
    throw new Error("Target profile must be a safe profile name.");
  if (sourceProfile === targetProfile)
    throw new Error("Alert profile must differ from the source profile.");

  const config = object(input, "Alchemy profile config");
  if (config.version !== 0)
    throw new Error("Expected the pinned Alchemy profile schema version 0.");
  const profiles = object(config.profiles, "Alchemy profiles");
  const source = object(profiles[sourceProfile], "Source Alchemy profile");
  const providerKeys = Object.keys(source).filter(
    (key) => key.toLowerCase() === "cloudflare",
  );
  if (providerKeys.length !== 1)
    throw new Error(
      "Source Alchemy profile must contain exactly one Cloudflare provider.",
    );
  const providerKey = providerKeys[0]!;
  const cloudflare = object(source[providerKey], "Source Cloudflare profile");
  if (cloudflare.method !== "oauth")
    throw new Error("Source Cloudflare profile must use OAuth.");
  if (
    typeof cloudflare.accountId !== "string" ||
    !/^[0-9a-f]{32}$/i.test(cloudflare.accountId)
  )
    throw new Error("Source Cloudflare profile has no valid account ID.");

  const expectedProfile = {
    [providerKey]: {
      method: "oauth",
      scopes: [...alertProfileScopes],
      accountId: cloudflare.accountId.toLowerCase(),
    },
  };
  const existing = profiles[targetProfile];
  if (existing !== undefined) {
    const existingProfile = object(existing, "Target Alchemy profile");
    const existingKeys = Object.keys(existingProfile);
    const existingCloudflare = object(
      existingProfile[providerKey],
      "Target Cloudflare profile",
    );
    const exactExistingProfile =
      existingKeys.length === 1 &&
      existingKeys[0] === providerKey &&
      Object.keys(existingCloudflare).length === 3 &&
      existingCloudflare.method === "oauth" &&
      existingCloudflare.accountId === cloudflare.accountId.toLowerCase() &&
      isExactStringSet(existingCloudflare.scopes, alertProfileScopes);
    if (!exactExistingProfile)
      throw new Error(
        `Refusing to overwrite divergent Alchemy profile: ${targetProfile}`,
      );
    return { config, status: "unchanged" as const };
  }
  return {
    config: {
      ...config,
      profiles: { ...profiles, [targetProfile]: expectedProfile },
    },
    status: "created" as const,
  };
}
