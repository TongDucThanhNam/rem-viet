import { describe, expect, test } from "bun:test";

import {
  addPrivateBindingIfMissing,
  assertSyntheticE2eEmail,
  AuthCookieJar,
  extractTotpSecret,
  generateTotp,
  providerClockOffsetMs,
  replacePrivateBinding,
  stagingE2eEmail,
} from "./site-e2e-identity-lib";

describe("staging E2E identity contracts", () => {
  test("adds a missing private binding while preserving newline style", () => {
    expect(
      addPrivateBindingIfMissing(
        "BETTER_AUTH_SECRET=keep\r\n",
        "CMS_E2E_PASSWORD",
        "generated-password",
      ),
    ).toEqual({
      contents:
        "BETTER_AUTH_SECRET=keep\r\nCMS_E2E_PASSWORD=generated-password\r\n",
      added: true,
    });
    expect(
      addPrivateBindingIfMissing(
        "CMS_E2E_PASSWORD=keep\n",
        "CMS_E2E_PASSWORD",
        "replacement",
      ),
    ).toEqual({
      contents: "CMS_E2E_PASSWORD=keep\n",
      added: false,
    });
    expect(() =>
      addPrivateBindingIfMissing(
        "CMS_E2E_PASSWORD=first\nCMS_E2E_PASSWORD=second\n",
        "CMS_E2E_PASSWORD",
        "replacement",
      ),
    ).toThrow(/Duplicate private staging E2E binding/u);
  });

  test("keeps the automation identity synthetic and deterministic", () => {
    expect(stagingE2eEmail("rem-viet", "staging")).toBe(
      "cms-e2e-rem-viet-staging@example.com",
    );
    expect(
      assertSyntheticE2eEmail("CMS-E2E-REM-VIET-STAGING@EXAMPLE.COM"),
    ).toBe("cms-e2e-rem-viet-staging@example.com");
    expect(() => assertSyntheticE2eEmail("owner@example.com")).toThrow(
      /reserved/u,
    );
  });

  test("replaces only the exact private value during a guarded repair", () => {
    expect(
      replacePrivateBinding(
        "CMS_E2E_TOTP_SECRET=encoded\r\nADMIN_EMAILS=keep\r\n",
        "CMS_E2E_TOTP_SECRET",
        "encoded",
        "decoded",
      ),
    ).toBe("CMS_E2E_TOTP_SECRET=decoded\r\nADMIN_EMAILS=keep\r\n");
    expect(() =>
      replacePrivateBinding(
        "CMS_E2E_TOTP_SECRET=other\n",
        "CMS_E2E_TOTP_SECRET",
        "encoded",
        "decoded",
      ),
    ).toThrow(/changed/u);
  });

  test("extracts the provider secret and produces stable six-digit TOTP", () => {
    const secret = "12345678901234567890";
    expect(
      extractTotpSecret(
        "otpauth://totp/R%C3%A8m%20Vina?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=R%C3%A8m%20Vina",
      ),
    ).toEqual({
      encodedSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      secret,
    });
    expect(generateTotp(secret, 59_000)).toBe("287082");
    expect(() => extractTotpSecret("https://example.com")).toThrow(/TOTP/u);
  });

  test("derives a bounded provider clock offset from the request midpoint", () => {
    expect(
      providerClockOffsetMs("1970-01-01T00:01:41.000Z", 100_000, 102_000),
    ).toBe(0);
    expect(
      providerClockOffsetMs("1970-01-01T00:03:11.000Z", 100_000, 102_000),
    ).toBe(90_000);
    expect(() =>
      providerClockOffsetMs("1970-01-01T01:00:00.000Z", 100_000, 102_000),
    ).toThrow(/five minutes/u);
  });

  test("retains only cookie name/value pairs and applies expiry", () => {
    const jar = new AuthCookieJar();
    jar.absorb(
      new Headers({
        "set-cookie": "session=first; Path=/; HttpOnly",
      }),
    );
    expect(jar.header()).toBe("session=first");
    expect(jar.size).toBe(1);
    jar.absorb(new Headers({ "set-cookie": "session=; Max-Age=0; Path=/" }));
    expect(jar.header()).toBe("");
    expect(jar.size).toBe(0);
  });
});
