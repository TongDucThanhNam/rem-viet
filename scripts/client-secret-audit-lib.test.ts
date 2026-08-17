import { describe, expect, test } from "bun:test";

import {
  findClientSecretExposures,
  privateEnvironmentCandidates,
} from "./client-secret-audit-lib";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("client build secret audit", () => {
  test("collects unique configured private values without accepting short noise", () => {
    const candidates = privateEnvironmentCandidates([
      {
        BETTER_AUTH_SECRET: "high-entropy-auth-secret",
        RESEND_API_KEY: "short",
        CLOUDFLARE_ALERT_API_TOKEN: "dedicated-alert-token-secret",
      },
      {
        BETTER_AUTH_SECRET: "high-entropy-auth-secret",
        ADMIN_EMAILS: "owner@example.com",
      },
    ]);

    expect(candidates).toEqual([
      { key: "BETTER_AUTH_SECRET", value: "high-entropy-auth-secret" },
      {
        key: "CLOUDFLARE_ALERT_API_TOKEN",
        value: "dedicated-alert-token-secret",
      },
      { key: "ADMIN_EMAILS", value: "owner@example.com" },
    ]);
  });

  test("finds encoded private values without returning secrets", () => {
    const privateValues = privateEnvironmentCandidates([
      {
        BETTER_AUTH_SECRET: "auth/secret with spaces",
        ADMIN_EMAILS: "owner@example.com",
      },
    ]);
    const exposures = findClientSecretExposures(
      [
        {
          path: "assets/auth.js",
          contents: bytes(
            'const harmlessKeyName="ADMIN_EMAILS";const leaked="auth%2Fsecret%20with%20spaces";',
          ),
        },
      ],
      privateValues,
    );

    expect(exposures).toEqual([
      {
        key: "BETTER_AUTH_SECRET",
        path: "assets/auth.js",
        type: "configured-value",
      },
    ]);
    expect(JSON.stringify(exposures)).not.toContain("auth/secret with spaces");
    expect(JSON.stringify(exposures)).not.toContain("owner@example.com");
  });

  test("accepts client artifacts with no private configuration", () => {
    expect(
      findClientSecretExposures(
        [{ path: "assets/index.js", contents: bytes("console.log('safe')") }],
        privateEnvironmentCandidates([
          { BETTER_AUTH_SECRET: "high-entropy-auth-secret" },
        ]),
      ),
    ).toEqual([]);
  });
});
