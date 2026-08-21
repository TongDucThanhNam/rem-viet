import { describe, expect, test } from "bun:test";

import { cmsIntegrationProvider } from "../src/integration";

describe("PostgreSQL/S3 CMS TanStack integration manifest", () => {
  test("owns a complete provider-neutral generated application slice", () => {
    expect(cmsIntegrationProvider).toMatchObject({
      schemaVersion: 1,
      id: "postgres",
      packageName: "@agency/cms-provider-postgres",
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
        "src/cms/media-storage.server.ts",
        "src/routes/api/cms/$.ts",
        "src/routes/admin/cms.tsx",
        "cms/migrations/README.md",
      ]),
    );
    const content = cmsIntegrationProvider.files
      .map(({ content }) => content)
      .join("\n");
    expect(content).toContain("CMS_POSTGRES_URL");
    expect(content).toContain("CMS_S3_BUCKET");
    expect(content).toContain("createPostgresCmsMediaProvider");
    expect(content).not.toContain("@libsql");
    expect(content).not.toContain("@sanity/");
    expect(content).not.toContain("SANITY_");
  });
});
