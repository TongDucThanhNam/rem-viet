import { describe, expect, test } from "bun:test";

import {
  cmsCloudflareCacheExtensionManifest,
  cmsCloudflareCacheModule,
  createCloudflareCacheInvalidator,
  createCmsCacheInvalidationService,
  createCmsCloudflareCacheInvalidationTask,
  createMemoryCmsCacheInvalidationLedger,
  normalizeCmsCacheInvalidation,
} from "../src";

describe("official Cloudflare cache module", () => {
  test("owns server-only lifecycle metadata and only builds same-origin purges", async () => {
    expect(cmsCloudflareCacheModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-cache-cloudflare",
      uninstall: { dataPolicy: "delete" },
    });
    expect(cmsCloudflareCacheExtensionManifest).toMatchObject({
      id: "official/cache-cloudflare",
      entrypoints: [{ runtime: "server" }],
    });
    expect(cmsCloudflareCacheExtensionManifest.secrets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "CLOUDFLARE_API_TOKEN",
          exposure: "server-only",
        }),
      ]),
    );
    expect(
      normalizeCmsCacheInvalidation("https://site.example", {
        event: "content.published",
        paths: ["/news?draft=0#section", "/"],
        tags: ["collection:posts"],
      }),
    ).toEqual({
      event: "content.published",
      files: ["https://site.example/", "https://site.example/news?draft=0"],
      tags: ["collection:posts"],
    });
    expect(() =>
      normalizeCmsCacheInvalidation("https://site.example", {
        event: "content.published",
        paths: ["//attacker.example/x"],
      }),
    ).toThrow("Unsafe");
  });

  test("purges through the fixed endpoint and deduplicates payload-bound durable work", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const token = "t".repeat(40);
    const invalidator = createCloudflareCacheInvalidator({
      zoneId: "a".repeat(32),
      apiToken: token,
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init! });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });
    const service = createCmsCacheInvalidationService({
      origin: "https://site.example",
      invalidator,
      ledger: createMemoryCmsCacheInvalidationLedger(),
    });
    const task = createCmsCloudflareCacheInvalidationTask({ service });
    const payload = task.parsePayload({
      event: "redirect.changed",
      paths: ["/old", "/new"],
      tags: ["redirects"],
    });
    const context = {
      jobId: "job-cache-1",
      attempt: 1,
      idempotencyKey: "cache-event-1",
      signal: new AbortController().signal,
    };
    const first = await task.execute(payload, context);
    const duplicate = await task.execute(payload, { ...context, attempt: 2 });
    expect(first).toMatchObject({ duplicate: false, requests: 2 });
    expect(duplicate).toMatchObject({ duplicate: true, requests: 0 });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe(
      `https://api.cloudflare.com/client/v4/zones/${"a".repeat(32)}/purge_cache`,
    );
    expect(JSON.stringify(calls.map(({ init }) => init.body))).not.toContain(
      token,
    );
    expect(
      (calls[0]?.init.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${token}`);
  });
});
