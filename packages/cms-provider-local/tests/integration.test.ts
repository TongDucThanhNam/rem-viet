import { describe, expect, test } from "bun:test";

import { cmsIntegrationProvider } from "../src/integration";

describe("local CMS TanStack integration manifest", () => {
  test("owns a complete SaaS-free integration with honest capabilities", () => {
    expect(cmsIntegrationProvider).toMatchObject({
      schemaVersion: 1,
      id: "local",
      packageName: "@agency/cms-provider-local",
      packageVersion: "0.1.0",
      capabilities: {
        schedule: true,
        media: false,
        webhook: false,
        release: false,
        localization: true,
        transaction: true,
        search: false,
      },
      diagnostics: {
        databaseBinding: null,
        authenticationEnvironment: "CMS_ADMIN_TOKEN",
        databaseConfigFiles: [],
      },
    });
    const paths = cmsIntegrationProvider.files.map(({ path }) => path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        "src/cms/collections.ts",
        "src/cms/provider.server.ts",
        "src/routes/api/cms/$.ts",
        "src/routes/admin/cms.tsx",
      ]),
    );
    const content = cmsIntegrationProvider.files
      .map(({ content }) => content)
      .join("\n");
    expect(content).not.toContain("cloudflare");
    expect(content).not.toContain("@sanity/");
    expect(content).not.toContain("SANITY_");
  });
});
