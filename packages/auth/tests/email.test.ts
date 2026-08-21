import { describe, expect, test } from "bun:test";

import { isAuthEmailDeliveryConfigured, sendAuthEmail } from "../src/email";

describe("auth transactional email", () => {
  test("skips safely without provider credentials", async () => {
    expect(isAuthEmailDeliveryConfigured({})).toBe(false);
    expect(
      isAuthEmailDeliveryConfigured({
        RESEND_API_KEY: "configured",
        EMAIL_FROM: "cms@example.test",
      }),
    ).toBe(true);
    expect(
      await sendAuthEmail(
        { to: "owner@example.test", subject: "Reset", text: "secret-link" },
        { values: {} },
      ),
    ).toEqual({ status: "skipped" });
  });

  test("delivers without exposing message text in the result", async () => {
    let requestBody = "";
    const result = await sendAuthEmail(
      {
        to: "owner@example.test",
        subject: "Reset",
        text: "https://example.test/reset?token=secret-token",
      },
      {
        values: {
          RESEND_API_KEY: "provider-secret",
          EMAIL_FROM: "CMS <cms@example.test>",
        },
        fetch: (async (_url, init) => {
          requestBody = String(init?.body);
          return Response.json({ id: "email-1" });
        }) as typeof fetch,
      },
    );

    expect(result).toEqual({ status: "sent", providerId: "email-1" });
    expect(requestBody).toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });
});
