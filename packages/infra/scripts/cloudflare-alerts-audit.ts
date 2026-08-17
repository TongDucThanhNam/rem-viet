import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as BunServices from "@effect/platform-bun/BunServices";
import { AuthProviders } from "alchemy/Auth/AuthProvider";
import { CloudflareApiLive, CloudflareEnvironment } from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { buildCloudflareAlertAuditReport } from "../src/cloudflare-alerts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, "packages/infra/.env"), quiet: true });
config({ path: resolve(repoRoot, ".env"), quiet: true });

const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const profile = argument("profile");
const windowDays = Number.parseInt(argument("days") ?? "30", 10);
const json = flag("json");

if (!Number.isSafeInteger(windowDays) || windowDays < 1 || windowDays > 90) {
  throw new Error("--days must be an integer between 1 and 90.");
}
if (profile) process.env.ALCHEMY_PROFILE = profile;

const alchemyCredentials = Effect.gen(function* () {
  const environment = yield* CloudflareEnvironment;
  return yield* environment;
}).pipe(
  Effect.provide(CloudflareApiLive()),
  Effect.provide(
    Layer.mergeAll(
      BunServices.layer,
      BunHttpClient.layer,
      Layer.succeed(AuthProviders, {}),
    ),
  ),
);

const credentials = await Effect.runPromise(alchemyCredentials);
const accountId =
  argument("account-id")?.trim() ||
  process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
  credentials.accountId;

if (!/^[0-9a-f]{32}$/i.test(accountId)) {
  throw new Error(
    "Cloudflare account ID must be 32 hexadecimal characters. Supply --account-id or configure the Alchemy profile.",
  );
}

type AuthContext = {
  source:
    "env-api-token" | "alchemy-api-token" | "alchemy-api-key" | "alchemy-oauth";
  headers: Record<string, string>;
};

const environmentToken = process.env.CLOUDFLARE_ALERT_API_TOKEN?.trim();
const auth: AuthContext = environmentToken
  ? {
      source: "env-api-token",
      headers: { Authorization: `Bearer ${environmentToken}` },
    }
  : credentials.type === "apiToken"
    ? {
        source: "alchemy-api-token",
        headers: {
          Authorization: `Bearer ${Redacted.value(credentials.apiToken)}`,
        },
      }
    : credentials.type === "apiKey"
      ? {
          source: "alchemy-api-key",
          headers: {
            "X-Auth-Key": Redacted.value(credentials.apiKey),
            "X-Auth-Email": Redacted.value(credentials.email),
          },
        }
      : {
          source: "alchemy-oauth",
          headers: {
            Authorization: `Bearer ${Redacted.value(credentials.accessToken)}`,
          },
        };

type CloudflareEnvelope = {
  success?: boolean;
  result?: unknown;
  errors?: Array<{ code?: unknown }>;
};

async function readEndpoint(path: string): Promise<unknown> {
  const url = new URL(
    `/client/v4/accounts/${accountId}/alerting/v3/${path}`,
    "https://api.cloudflare.com",
  );
  const response = await fetch(url, {
    headers: auth.headers,
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as CloudflareEnvelope;

  if (!response.ok || body.success !== true) {
    const codes = (body.errors ?? [])
      .map((error) => error.code)
      .filter((code): code is string | number =>
        ["string", "number"].includes(typeof code),
      );
    const suffix = codes.length > 0 ? ` (codes: ${codes.join(", ")})` : "";
    if (
      [401, 403].includes(response.status) &&
      auth.source === "alchemy-oauth"
    ) {
      throw new Error(
        `Cloudflare Notifications rejected the Alchemy OAuth grant (HTTP ${response.status})${suffix}. Re-run 'bunx alchemy login --configure', customize OAuth scopes, retain the defaults and add 'notification:read'.`,
      );
    }
    throw new Error(
      `Cloudflare Notifications request failed (HTTP ${response.status})${suffix}. The credential needs Notifications: Read permission.`,
    );
  }
  return body.result;
}

const since = new Date(
  Date.now() - windowDays * 24 * 60 * 60 * 1_000,
).toISOString();
const historyPath = `history?per_page=100&page=1&since=${encodeURIComponent(since)}`;
const [availableAlerts, destinationsEligible, policies, history] =
  await Promise.all([
    readEndpoint("available_alerts"),
    readEndpoint("destinations/eligible"),
    readEndpoint("policies"),
    readEndpoint(historyPath),
  ]);

const report = {
  checkedAt: new Date().toISOString(),
  authSource: auth.source,
  windowDays,
  ...buildCloudflareAlertAuditReport({
    availableAlerts,
    destinationsEligible,
    policies,
    history,
  }),
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Cloudflare alerts: ${report.availableAlertTypeCount} types; email capability ${report.emailDeliveryReady ? "ready" : "not ready"}; operational policy ${report.operationalEmailPolicyConfigured ? "configured" : "missing"}; receipt ${report.operationalEmailReceiptRecorded ? "recorded" : "missing"}.`,
  );
  console.table(report.destinations);
  console.table(report.policies);
  for (const gap of report.gaps) console.log(`GAP: ${gap}`);
}

if (!report.releaseEvidenceReady) process.exitCode = 2;
