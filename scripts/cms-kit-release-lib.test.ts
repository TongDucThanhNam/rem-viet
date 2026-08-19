import { describe, expect, test } from "bun:test";

import {
  assertCmsKitPreparedProvenance,
  assertCmsKitPublishPackageSet,
  cmsKitPackageNames,
  assertCmsKitReleaseEligible,
  assertCmsKitArtifactPolicy,
  assertCmsKitCompatibilityMatrix,
  assertCmsKitReleaseNotes,
  createCmsKitPublicationReceipt,
  createCmsKitPublishRequest,
  createCmsKitReleaseProvenance,
} from "./cms-kit-release-lib";

const digest = "a".repeat(64);

describe("CMS Kit private release provenance", () => {
  test("sorts coordinated packages and allows only clean committed sources", () => {
    const provenance = createCmsKitReleaseProvenance({
      version: "0.1.0",
      commit: "b".repeat(40),
      sourceState: "clean",
      lockSha256: digest,
      compatibilitySha256: digest,
      changelogSha256: digest,
      migrationNotesSha256: digest,
      packages: [
        {
          name: "@agency/cms-runtime",
          version: "0.1.0",
          artifact: "artifacts/runtime.tgz",
          sha256: digest,
          size: 2,
          artifactPolicy: { status: "passed", fileCount: 3, textFileCount: 3 },
        },
        {
          name: "@agency/cms-core",
          version: "0.1.0",
          artifact: "artifacts/core.tgz",
          sha256: digest,
          size: 1,
          artifactPolicy: { status: "passed", fileCount: 3, textFileCount: 3 },
        },
      ],
      generatedAt: "2026-08-16T00:00:00.000Z",
    });
    expect(provenance.packages.map((entry) => entry.name)).toEqual([
      "@agency/cms-core",
      "@agency/cms-runtime",
    ]);
    expect(assertCmsKitReleaseEligible(provenance)).toBe(provenance);
  });

  test("rejects mixed versions and dirty publication", () => {
    expect(() =>
      createCmsKitReleaseProvenance({
        version: "0.1.0",
        commit: "b".repeat(40),
        sourceState: "clean",
        lockSha256: digest,
        compatibilitySha256: digest,
        changelogSha256: digest,
        migrationNotesSha256: digest,
        packages: [
          {
            name: "@agency/cms-core",
            version: "0.2.0",
            artifact: "artifacts/core.tgz",
            sha256: digest,
            size: 1,
            artifactPolicy: {
              status: "passed",
              fileCount: 3,
              textFileCount: 3,
            },
          },
        ],
        generatedAt: "2026-08-16T00:00:00.000Z",
      }),
    ).toThrow(/not coordinated/);

    const dirty = createCmsKitReleaseProvenance({
      version: "0.1.0",
      commit: "b".repeat(40),
      sourceState: "dirty",
      lockSha256: digest,
      compatibilitySha256: digest,
      changelogSha256: digest,
      migrationNotesSha256: digest,
      packages: [
        {
          name: "@agency/cms-core",
          version: "0.1.0",
          artifact: "artifacts/core.tgz",
          sha256: digest,
          size: 1,
          artifactPolicy: { status: "passed", fileCount: 3, textFileCount: 3 },
        },
      ],
      generatedAt: "2026-08-16T00:00:00.000Z",
    });
    expect(() => assertCmsKitReleaseEligible(dirty)).toThrow(/clean checkout/);
  });

  test("allows only publishable files and rejects secrets or client coupling", () => {
    expect(
      assertCmsKitArtifactPolicy({
        packageName: "@agency/cms-core",
        entries: [
          "package/package.json",
          "package/README.md",
          "package/src/index.ts",
        ],
        textFiles: {
          "package/package.json": '{"name":"@agency/cms-core"}',
          "package/README.md": "Neutral CMS contracts",
          "package/src/index.ts": "export const schemaVersion = 1;",
        },
      }),
    ).toEqual({ status: "passed", fileCount: 3, textFileCount: 3 });

    expect(() =>
      assertCmsKitArtifactPolicy({
        packageName: "@agency/cms-core",
        entries: ["package/package.json", "package/tests/private.test.ts"],
        textFiles: {},
      }),
    ).toThrow(/publish allowlist/);
    expect(() =>
      assertCmsKitArtifactPolicy({
        packageName: "@agency/cms-core",
        entries: ["package/package.json", "package/src/index.ts"],
        textFiles: {
          "package/package.json": '{"name":"@agency/cms-core"}',
          "package/src/index.ts": "export const owner = '@rem-viet/cms';",
        },
      }),
    ).toThrow(/private brand coupling/);
    expect(() =>
      assertCmsKitArtifactPolicy({
        packageName: "@agency/cms-core",
        entries: ["package/package.json", "package/src/index.ts"],
        textFiles: {
          "package/package.json": JSON.stringify({
            name: "@agency/cms-core",
            private: true,
            scripts: { postinstall: "node setup.js" },
          }),
          "package/src/index.ts": "export {};",
        },
      }),
    ).toThrow(/lifecycle-safe/);
    expect(() =>
      assertCmsKitArtifactPolicy({
        packageName: "@agency/cms-template-rem-viet",
        entries: ["package/package.json", "package/src/index.ts"],
        textFiles: {
          "package/package.json": '{"name":"@agency/cms-template-rem-viet"}',
          "package/src/index.ts":
            "CMS_PRIVATE_REGISTRY_TOKEN=definitely-not-a-placeholder",
        },
      }),
    ).toThrow(/secret-like/);
  });

  test("requires a version-bound complete compatibility matrix", () => {
    const matrix = {
      schemaVersion: 1,
      current: "0.1.0",
      schemas: {
        remVietBlock: 1,
        cloudflareProvider: 1,
        cloudflareMigrationsThrough: "0003_media_metadata",
      },
      validatedWith: Object.fromEntries(
        [
          "bun",
          "typescript",
          "react",
          "vite",
          "tanstackReactRouter",
          "tanstackReactStart",
          "alchemy",
        ].map((key) => [key, "1.0.0"]),
      ),
      rehearsals: [],
    };
    expect(assertCmsKitCompatibilityMatrix(matrix, "0.1.0")).toBe(matrix);
    expect(() => assertCmsKitCompatibilityMatrix(matrix, "0.2.0")).toThrow(
      /does not match/,
    );
  });

  test("requires release-bound changelog and migration notes", () => {
    const migrations = {
      schemaVersion: 1,
      current: "0.1.0",
      releases: [
        {
          version: "0.1.0",
          providerMigration: "Apply provider migrations",
          rollback: "Restore the verified backup",
          verification: ["bun run cms:kit:upgrade"],
        },
      ],
    };
    expect(
      assertCmsKitReleaseNotes({
        releaseVersion: "0.1.0",
        changelog: "# Changes\n\n## 0.1.0\n\nInitial release.\n",
        migrations,
      }).release,
    ).toBe(migrations.releases[0]);
    expect(() =>
      assertCmsKitReleaseNotes({
        releaseVersion: "0.2.0",
        changelog: "## 0.1.0\n",
        migrations,
      }),
    ).toThrow(/do not cover/);
  });

  test("requires exact private publication authority and complete verification receipts", () => {
    const provenance = createCmsKitReleaseProvenance({
      version: "0.1.0",
      commit: "b".repeat(40),
      sourceState: "clean",
      lockSha256: digest,
      compatibilitySha256: digest,
      changelogSha256: digest,
      migrationNotesSha256: digest,
      packages: [
        {
          name: "@agency/cms-core",
          version: "0.1.0",
          artifact: "artifacts/agency-cms-core-0.1.0.tgz",
          sha256: digest,
          size: 10,
          artifactPolicy: { status: "passed", fileCount: 3, textFileCount: 3 },
        },
      ],
      generatedAt: "2026-08-16T00:00:00.000Z",
    });
    const confirmation = `PUBLISH CMS KIT 0.1.0 ${"b".repeat(40)}`;
    expect(() =>
      createCmsKitPublishRequest(provenance, {
        registry: "https://registry.example.test",
        tokenPresent: true,
        confirmation: "wrong",
      }),
    ).toThrow(/exact confirmation/);
    expect(() =>
      createCmsKitPublishRequest(provenance, {
        registry: "http://registry.example.test",
        tokenPresent: true,
        confirmation,
      }),
    ).toThrow(/must be HTTPS/);
    expect(() =>
      createCmsKitPublishRequest(provenance, {
        registry: "https://registry.example.test",
        tokenPresent: false,
        confirmation,
      }),
    ).toThrow(/token is not configured/);
    const request = createCmsKitPublishRequest(provenance, {
      registry: "https://registry.example.test/",
      tokenPresent: true,
      confirmation,
    });
    expect(request.registry).toBe("https://registry.example.test");
    const receipt = createCmsKitPublicationReceipt(
      request,
      [
        {
          name: "@agency/cms-core",
          version: "0.1.0",
          sha256: digest,
          publishedAt: "2026-08-16T00:01:00.000Z",
          verifiedAt: "2026-08-16T00:02:00.000Z",
        },
      ],
      "2026-08-16T00:03:00.000Z",
    );
    expect(receipt).toMatchObject({
      status: "published-and-verified",
      access: "restricted",
      version: "0.1.0",
    });
    expect(() =>
      createCmsKitPublicationReceipt(request, [], "2026-08-16T00:03:00Z"),
    ).toThrow(/missing packages/);
  });

  test("treats prepared bundle provenance as untrusted input", () => {
    expect(() =>
      assertCmsKitPublishPackageSet([{ name: "@agency/cms-core" }]),
    ).toThrow(/exact ten-package set/);
    expect(
      assertCmsKitPublishPackageSet(
        cmsKitPackageNames.map((name) => ({ name })),
      ),
    ).toHaveLength(10);
    expect(() =>
      createCmsKitReleaseProvenance({
        version: "0.1.0",
        commit: "c".repeat(40),
        sourceState: "clean",
        lockSha256: digest,
        compatibilitySha256: digest,
        changelogSha256: digest,
        migrationNotesSha256: digest,
        packages: [
          {
            name: "@agency/cms-core",
            version: "0.1.0",
            artifact: "../outside.tgz",
            sha256: digest,
            size: 10,
            artifactPolicy: {
              status: "passed",
              fileCount: 3,
              textFileCount: 3,
            },
          },
        ],
        generatedAt: "2026-08-16T00:00:00.000Z",
      }),
    ).toThrow(/invalid artifact provenance/);
    expect(() => assertCmsKitPreparedProvenance({ schemaVersion: 1 })).toThrow(
      /malformed/,
    );
  });
});
