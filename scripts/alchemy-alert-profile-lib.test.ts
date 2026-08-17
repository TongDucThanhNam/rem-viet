import { describe, expect, test } from "bun:test";

import {
  alertProfileScopes,
  buildAlchemyAlertProfile,
  isAlchemyAlertCredentialReady,
} from "./alchemy-alert-profile-lib";

const accountId = "a".repeat(32);

describe("least-privilege Alchemy alert profile", () => {
  test("accepts only a complete exact-scope OAuth credential", () => {
    const credential = {
      type: "oauth",
      access: "access-secret",
      refresh: "refresh-secret",
      expires: Date.now() + 60_000,
      scopes: [...alertProfileScopes, "offline_access"],
    };

    expect(isAlchemyAlertCredentialReady(credential)).toBe(true);
    expect(
      isAlchemyAlertCredentialReady({
        ...credential,
        scopes: [...credential.scopes, "workers:write"],
      }),
    ).toBe(false);
    expect(isAlchemyAlertCredentialReady({ ...credential, refresh: "" })).toBe(
      false,
    );
  });

  test("adds only the isolated notification profile", () => {
    const source = {
      version: 0,
      profiles: {
        default: {
          cloudflare: {
            method: "oauth",
            scopes: ["account:read", "workers:write"],
            accountId,
          },
        },
        preserved: { example: { method: "stored" } },
      },
    };
    const result = buildAlchemyAlertProfile(source);
    expect(result.status).toBe("created");
    expect(result.config).toEqual({
      ...source,
      profiles: {
        ...source.profiles,
        alerts: {
          cloudflare: {
            method: "oauth",
            scopes: [...alertProfileScopes],
            accountId,
          },
        },
      },
    });
    expect(source.profiles).not.toHaveProperty("alerts");
  });

  test("is idempotent and refuses divergent or unsafe profiles", () => {
    const exact = buildAlchemyAlertProfile({
      version: 0,
      profiles: {
        default: {
          cloudflare: { method: "oauth", scopes: [], accountId },
        },
        alerts: {
          cloudflare: {
            method: "oauth",
            scopes: [...alertProfileScopes],
            accountId,
          },
        },
      },
    });
    expect(exact.status).toBe("unchanged");
    expect(
      buildAlchemyAlertProfile({
        version: 0,
        profiles: {
          default: {
            cloudflare: { method: "oauth", scopes: [], accountId },
          },
          alerts: {
            cloudflare: {
              method: "oauth",
              scopes: [
                "notification:write",
                "account:read",
                "notification:read",
                "user:read",
              ],
              accountId,
            },
          },
        },
      }).status,
    ).toBe("unchanged");
    expect(() =>
      buildAlchemyAlertProfile({
        version: 0,
        profiles: {
          default: {
            cloudflare: { method: "oauth", scopes: [], accountId },
          },
          alerts: {
            cloudflare: {
              method: "oauth",
              scopes: ["account:read"],
              accountId,
            },
          },
        },
      }),
    ).toThrow(/divergent/);
    expect(() =>
      buildAlchemyAlertProfile(
        {
          version: 0,
          profiles: {
            default: {
              cloudflare: { method: "oauth", scopes: [], accountId },
            },
          },
        },
        "default",
        "../alerts",
      ),
    ).toThrow(/safe profile name/);
  });

  test("preserves Alchemy's provider-key casing", () => {
    const result = buildAlchemyAlertProfile({
      version: 0,
      profiles: {
        default: {
          Cloudflare: { method: "oauth", scopes: [], accountId },
        },
      },
    });
    expect(result.config.profiles).toHaveProperty("alerts.Cloudflare");
    expect(result.config.profiles).not.toHaveProperty("alerts.cloudflare");
  });
});
