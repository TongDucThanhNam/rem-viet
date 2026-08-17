export const clientForbiddenEnvironmentKeys = [
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAILS",
  "CMS_BOOTSTRAP_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "RESEND_API_KEY",
  "LEAD_NOTIFICATION_EMAIL",
  "EMAIL_FROM",
  "JSONLINK_API_KEY",
  "SANITY_API_READ_TOKEN",
  "SANITY_PREVIEW_COOKIE_SECRET",
  "CLOUDFLARE_ALERT_API_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_DATABASE_ID",
  "CLOUDFLARE_D1_TOKEN",
] as const;

export type ClientForbiddenEnvironmentKey =
  (typeof clientForbiddenEnvironmentKeys)[number];

export type PrivateEnvironmentCandidate = {
  key: ClientForbiddenEnvironmentKey;
  value: string;
};

export type ClientArtifact = {
  path: string;
  contents: Uint8Array;
};

export type ClientSecretExposure = {
  key: ClientForbiddenEnvironmentKey;
  path: string;
  type: "configured-value";
};

const minimumPrivateValueLength = 8;

export function privateEnvironmentCandidates(
  environments: Array<Record<string, string | undefined>>,
) {
  const candidates: PrivateEnvironmentCandidate[] = [];
  const seen = new Set<string>();

  for (const environment of environments) {
    for (const key of clientForbiddenEnvironmentKeys) {
      const value = environment[key]?.trim();
      if (!value || value.length < minimumPrivateValueLength) continue;

      const identity = `${key}\0${value}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      candidates.push({ key, value });
    }
  }

  return candidates;
}

function valueRepresentations(value: string) {
  return [
    value,
    JSON.stringify(value).slice(1, -1),
    encodeURIComponent(value),
  ].filter((candidate, index, values) => values.indexOf(candidate) === index);
}

function includes(contents: Uint8Array, value: string) {
  return Buffer.from(contents).includes(Buffer.from(value, "utf8"));
}

export function findClientSecretExposures(
  artifacts: ClientArtifact[],
  privateValues: PrivateEnvironmentCandidate[],
) {
  const exposures: ClientSecretExposure[] = [];
  const seen = new Set<string>();

  function expose(exposure: ClientSecretExposure) {
    const identity = `${exposure.type}\0${exposure.key}\0${exposure.path}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    exposures.push(exposure);
  }

  for (const artifact of artifacts) {
    for (const candidate of privateValues) {
      if (
        valueRepresentations(candidate.value).some((value) =>
          includes(artifact.contents, value),
        )
      ) {
        expose({
          key: candidate.key,
          path: artifact.path,
          type: "configured-value",
        });
      }
    }
  }

  return exposures.sort((left, right) =>
    `${left.key}:${left.path}:${left.type}`.localeCompare(
      `${right.key}:${right.path}:${right.type}`,
    ),
  );
}
