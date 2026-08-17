import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as BunServices from "@effect/platform-bun/BunServices";
import { AuthProviders } from "alchemy/Auth/AuthProvider";
import { CloudflareApiLive, CloudflareEnvironment } from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

export type CloudflareAuthContext = {
  source:
    "env-api-token" | "alchemy-api-token" | "alchemy-api-key" | "alchemy-oauth";
  headers: Record<string, string>;
};

export type CloudflareAuthSource = "auto" | "environment" | "alchemy";

function assertAccountId(value: string | undefined) {
  const accountId = value?.trim() ?? "";
  if (!/^[0-9a-f]{32}$/i.test(accountId)) {
    throw new Error(
      "Cloudflare account ID must be 32 hexadecimal characters. Supply --account-id, CLOUDFLARE_ACCOUNT_ID, or configure the Alchemy profile.",
    );
  }
  return accountId;
}

export function resolveEnvironmentCloudflareAuth(input: {
  accountId?: string;
  apiToken?: string;
}): { accountId: string; auth: CloudflareAuthContext } {
  const accountId = assertAccountId(input.accountId);
  const apiToken = input.apiToken?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{20,}$/.test(apiToken)) {
    throw new Error(
      "Environment authentication requires a valid CLOUDFLARE_API_TOKEN; the token value is never logged.",
    );
  }
  return {
    accountId,
    auth: {
      source: "env-api-token",
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  };
}

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

export async function resolveCloudflareAuth(input: {
  accountId?: string;
  preferAlchemy?: boolean;
  source?: CloudflareAuthSource;
}): Promise<{ accountId: string; auth: CloudflareAuthContext }> {
  const source =
    input.source ?? (input.preferAlchemy ? "alchemy" : ("auto" as const));
  const environmentAccountId =
    input.accountId?.trim() || process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const environmentToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (source === "environment") {
    return resolveEnvironmentCloudflareAuth({
      accountId: environmentAccountId,
      apiToken: environmentToken,
    });
  }
  if (source === "auto" && environmentAccountId && environmentToken) {
    return resolveEnvironmentCloudflareAuth({
      accountId: environmentAccountId,
      apiToken: environmentToken,
    });
  }

  const credentials = await Effect.runPromise(alchemyCredentials);
  const accountId = assertAccountId(
    environmentAccountId || credentials.accountId,
  );
  // A common local setup keeps the account identity in the Alchemy profile and
  // a narrowly scoped non-interactive token in private env. Prefer that token
  // after Alchemy resolves the account instead of silently falling back to an
  // OAuth grant that may not include the required product scope.
  if (source === "auto" && environmentToken) {
    return resolveEnvironmentCloudflareAuth({
      accountId,
      apiToken: environmentToken,
    });
  }
  const auth: CloudflareAuthContext =
    credentials.type === "apiToken"
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

  return { accountId, auth };
}
