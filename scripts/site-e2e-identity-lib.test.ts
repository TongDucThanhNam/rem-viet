import { describe, expect, test } from "bun:test";

import {
  addPrivateBindingIfMissing,
  assertSyntheticE2eEmail,
  AuthCookieJar,
  extractTotpSecret,
  generateTotp,
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

  test("extracts the provider secret and produces stable six-digit TOTP", () => {
    const secret = "0123456789abcdefghijklmnopqrstuv";
    expect(
      extractTotpSecret(
        `otpauth://totp/R%C3%A8m%20Vina?secret=${secret}&issuer=R%C3%A8m%20Vina`,
      ),
    ).toBe(secret);
    expect(generateTotp(secret, 1_800_000)).toMatch(/^\d{6}$/u);
    expect(generateTotp(secret, 1_800_000)).toBe(
      generateTotp(secret, 1_800_000),
    );
    expect(() => extractTotpSecret("https://example.com")).toThrow(/TOTP/u);
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
