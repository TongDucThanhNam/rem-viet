import { describe, expect, test } from "bun:test";

import { resolveEnvironmentCloudflareAuth } from "./cloudflare-auth";

describe("Cloudflare environment authentication", () => {
  test("builds a non-interactive bearer context for scheduled jobs", () => {
    const result = resolveEnvironmentCloudflareAuth({
      accountId: "0123456789abcdef0123456789abcdef",
      apiToken: "scheduled_backup_token_1234567890",
    });

    expect(result.accountId).toBe("0123456789abcdef0123456789abcdef");
    expect(result.auth.source).toBe("env-api-token");
    expect(result.auth.headers.Authorization).toBe(
      "Bearer scheduled_backup_token_1234567890",
    );
  });

  test("fails closed without exposing malformed credentials", () => {
    const malformedToken = "short-secret";
    expect(() =>
      resolveEnvironmentCloudflareAuth({
        accountId: "not-an-account",
        apiToken: malformedToken,
      }),
    ).toThrow(/account ID/);

    let message = "";
    try {
      resolveEnvironmentCloudflareAuth({
        accountId: "0123456789abcdef0123456789abcdef",
        apiToken: malformedToken,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/valid CLOUDFLARE_API_TOKEN/);
    expect(message).not.toContain(malformedToken);
  });
});
