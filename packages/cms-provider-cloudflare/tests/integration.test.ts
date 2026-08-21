import { describe, expect, test } from "bun:test";

import { cmsIntegrationProvider } from "../src/integration";

describe("Cloudflare CMS TanStack integration manifest", () => {
  test("owns a complete, unique, SaaS-free generated application slice", () => {
    expect(cmsIntegrationProvider).toMatchObject({
      schemaVersion: 1,
      id: "cloudflare",
      packageName: "@agency/cms-provider-cloudflare",
      packageVersion: "0.1.0",
      capabilities: {
        schedule: true,
        media: true,
        webhook: false,
        release: false,
        localization: true,
        transaction: true,
        search: false,
      },
      diagnostics: { databaseBinding: "CMS_DB" },
    });
    expect(
      new Set(cmsIntegrationProvider.files.map(({ path }) => path)).size,
    ).toBe(cmsIntegrationProvider.files.length);
    expect(cmsIntegrationProvider.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "src/cms/collections.ts",
        "src/cms/provider.server.ts",
        "src/routes/api/cms/$.ts",
        "src/routes/admin/cms.tsx",
        "cms/migrations/README.md",
      ]),
    );
    const content = cmsIntegrationProvider.files
      .map((file) => file.content)
      .join("\n");
    expect(content).not.toContain("@sanity/");
    expect(content).not.toContain("SANITY_");
  });
});
