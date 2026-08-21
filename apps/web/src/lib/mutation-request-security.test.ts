import { describe, expect, test } from "bun:test";

import { rejectCrossSiteMutation } from "./mutation-request-security";

function request(input: {
  method?: string;
  origin?: string;
  fetchSite?: string;
  cookie?: string;
}) {
  return new Request("https://cms.example/api/trpc/content.publish", {
    method: input.method ?? "POST",
    headers: {
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.fetchSite ? { "sec-fetch-site": input.fetchSite } : {}),
      ...(input.cookie ? { cookie: input.cookie } : {}),
    },
  });
}

describe("same-origin mutation boundary", () => {
  test("accepts exact-origin browser mutations", () => {
    expect(
      rejectCrossSiteMutation(
        request({
          origin: "https://cms.example",
          fetchSite: "same-origin",
        }),
      ),
    ).toBeNull();
  });

  test("rejects foreign, opaque, cross-site, and sibling-origin mutations", async () => {
    for (const candidate of [
      request({ origin: "https://attacker.example" }),
      request({ origin: "null" }),
      request({ fetchSite: "cross-site" }),
      request({
        origin: "https://admin.cms.example",
        fetchSite: "same-site",
      }),
    ]) {
      const response = rejectCrossSiteMutation(candidate);
      expect(response?.status).toBe(403);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      expect(await response?.json()).toMatchObject({ statusCode: 403 });
    }
  });

  test("requires an origin for cookie-authenticated mutations", async () => {
    const response = rejectCrossSiteMutation(
      request({ cookie: "better-auth.session_token=opaque" }),
    );
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ statusCode: 403 });
  });

  test("preserves origin-less server clients and safe cross-origin reads", () => {
    expect(rejectCrossSiteMutation(request({}))).toBeNull();
    expect(
      rejectCrossSiteMutation(
        request({ method: "GET", origin: "https://attacker.example" }),
      ),
    ).toBeNull();
  });
});
