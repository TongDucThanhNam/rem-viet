import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

function manifest(packageDirectory: string) {
  return JSON.parse(
    readFileSync(
      join(root, "packages", packageDirectory, "package.json"),
      "utf8",
    ),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };
}

describe("Platform Kit package boundaries", () => {
  test("pins one Bun runtime and wires Windows/Linux plus real provider CI", () => {
    const repository = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { packageManager?: string };
    const workflow = readFileSync(
      join(root, ".github", "workflows", "cms-plugin-conformance.yml"),
      "utf8",
    );

    expect(repository.packageManager).toBe("bun@1.4.0");
    expect(workflow.match(/bun-version: 1\.4\.0/g)).toHaveLength(2);
    expect(workflow).toContain("os: [ubuntu-latest, windows-latest]");
    expect(workflow).toContain("bun run cms:kit:clean-checkout");
    expect(workflow).toContain("image: postgres:17-alpine");
    expect(workflow).toContain("CMS_POSTGRES_TEST_URL:");
    expect(workflow).toContain("CMS_S3_TEST_ENDPOINT:");
    expect(workflow).toContain(
      "quay.io/minio/minio:RELEASE.2025-06-13T11-33-47Z",
    );
    expect(workflow).toContain("bun --cwd packages/cms-provider-postgres test");
  });

  test("cms-core has only its schema dependency", () => {
    const value = manifest("cms-core");
    expect(Object.keys(value.dependencies ?? {})).toEqual(["zod"]);
    expect(Object.keys(value.peerDependencies ?? {})).toEqual([]);
    expect(Object.keys(value.devDependencies ?? {})).toEqual(["typescript"]);
  });

  test("neutral package sources and manifests contain no provider or client coupling", () => {
    for (const packageDirectory of [
      "cms-core",
      "cms-agency",
      "cms-collaboration",
      "cms-runtime",
      "cms-react",
      "cms-admin",
      "cms-cli",
      "cms-visual-editor",
    ]) {
      const directory = join(root, "packages", packageDirectory);
      const content = [
        ...filesBelow(join(directory, "src")),
        join(directory, "package.json"),
      ]
        .filter(
          (path) => !path.includes("node_modules") && !path.includes(".turbo"),
        )
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");

      for (const forbidden of [
        /@rem-viet/i,
        /rem[ -]viet/i,
        /rèm/i,
        /drizzle/i,
        /cloudflare/i,
        /\/assets\//i,
      ]) {
        expect(content).not.toMatch(forbidden);
      }
    }
  });

  test("dependencies point inward through React and template to core", () => {
    expect(Object.keys(manifest("cms-agency").dependencies ?? {})).toEqual([
      "zod",
    ]);
    expect(Object.keys(manifest("cms-agency").peerDependencies ?? {})).toEqual([
      "@agency/cms-core",
    ]);
    expect(manifest("cms-agency").peerDependenciesMeta).toEqual({
      "@agency/cms-core": { optional: true },
    });
    for (const packageDirectory of [
      "cms-module-forms",
      "cms-module-import",
      "cms-module-observability",
      "cms-module-privacy",
      "cms-module-redirects",
      "cms-module-seo",
      "cms-module-taxonomy",
    ]) {
      expect(
        Object.keys(manifest(packageDirectory).dependencies ?? {}),
      ).toEqual([]);
      expect(
        Object.keys(manifest(packageDirectory).peerDependencies ?? {}),
      ).toEqual(["@agency/cms-core"]);
    }
    for (const packageDirectory of [
      "cms-module-cache-cloudflare",
      "cms-module-search",
    ]) {
      expect(
        Object.keys(manifest(packageDirectory).dependencies ?? {}),
      ).toEqual([]);
      expect(
        Object.keys(manifest(packageDirectory).peerDependencies ?? {}).sort(),
      ).toEqual(["@agency/cms-core", "@agency/cms-runtime"]);
    }
    expect(Object.keys(manifest("cms-runtime").dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest("cms-runtime").peerDependencies ?? {})).toEqual(
      ["@agency/cms-core"],
    );
    expect(
      Object.keys(manifest("cms-provider-cloudflare").dependencies ?? {}),
    ).toEqual([]);
    expect(
      Object.keys(
        manifest("cms-provider-cloudflare").peerDependencies ?? {},
      ).sort(),
    ).toEqual(["@agency/cms-core", "@agency/cms-runtime"]);
    expect(
      Object.keys(manifest("cms-provider-local").dependencies ?? {}),
    ).toEqual(["@libsql/client"]);
    expect(
      Object.keys(manifest("cms-provider-local").peerDependencies ?? {}).sort(),
    ).toEqual(["@agency/cms-core", "@agency/cms-runtime"]);
    expect(
      Object.keys(manifest("cms-provider-postgres").dependencies ?? {}).sort(),
    ).toEqual([
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
      "@types/pg",
      "pg",
    ]);
    expect(
      Object.keys(
        manifest("cms-provider-postgres").peerDependencies ?? {},
      ).sort(),
    ).toEqual(["@agency/cms-core", "@agency/cms-runtime"]);
    expect(
      Object.keys(manifest("cms-provider-sanity").dependencies ?? {}),
    ).toEqual(["@sanity/webhook"]);
    expect(
      Object.keys(
        manifest("cms-provider-sanity").peerDependencies ?? {},
      ).sort(),
    ).toEqual(["@agency/cms-core", "@agency/cms-runtime"]);
    expect(Object.keys(manifest("cms-react").dependencies ?? {})).toEqual([]);
    expect(
      Object.keys(manifest("cms-react").peerDependencies ?? {}).sort(),
    ).toEqual(["@agency/cms-core", "react"]);
    expect(Object.keys(manifest("cms-admin").dependencies ?? {})).toEqual([]);
    expect(
      Object.keys(manifest("cms-admin").peerDependencies ?? {}).sort(),
    ).toEqual(["@agency/cms-core", "@agency/cms-visual-editor", "react"]);
    expect(
      Object.keys(manifest("cms-visual-editor").dependencies ?? {}),
    ).toEqual([]);
    expect(
      Object.keys(manifest("cms-visual-editor").peerDependencies ?? {}),
    ).toEqual([]);
    expect(
      Object.keys(manifest("cms-template-factory").dependencies ?? {}),
    ).toEqual([]);
    expect(
      Object.keys(
        manifest("cms-template-factory").peerDependencies ?? {},
      ).sort(),
    ).toEqual(["@agency/cms-core", "@agency/cms-visual-editor"]);
    expect(
      Object.keys(manifest("cms-template-atelier").dependencies ?? {}).sort(),
    ).toEqual(["zod"]);
    expect(
      Object.keys(
        manifest("cms-template-atelier").peerDependencies ?? {},
      ).sort(),
    ).toEqual([
      "@agency/cms-admin",
      "@agency/cms-template-factory",
      "@agency/cms-visual-editor",
      "react",
    ]);
    expect(Object.keys(manifest("cms-cli").dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest("cms-cli").peerDependencies ?? {})).toEqual([
      "@agency/cms-core",
    ]);
    expect(Object.keys(manifest("cms-alchemy").dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest("cms-alchemy").peerDependencies ?? {})).toEqual(
      ["@agency/cms-core"],
    );
    expect(
      Object.keys(manifest("cms-template-rem-viet").dependencies ?? {}).sort(),
    ).toEqual(["zod"]);
    expect(
      Object.keys(
        manifest("cms-template-rem-viet").peerDependencies ?? {},
      ).sort(),
    ).toEqual([
      "@agency/cms-admin",
      "@agency/cms-core",
      "@agency/cms-react",
      "@agency/cms-visual-editor",
      "react",
    ]);
    expect(Object.keys(manifest("cms").dependencies ?? {}).sort()).toEqual([
      "@agency/cms-core",
      "@agency/cms-template-rem-viet",
      "zod",
    ]);
  });

  test("Alchemy and CLI packages stay app-independent and are adopted", () => {
    const alchemy = filesBelow(join(root, "packages", "cms-alchemy"))
      .filter((path) => !path.includes("node_modules"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const stack = readFileSync(
      join(root, "packages", "infra", "alchemy.run.ts"),
      "utf8",
    );
    const init = readFileSync(join(root, "scripts", "site-init.ts"), "utf8");
    const addBlock = readFileSync(
      join(root, "scripts", "cms-add-block.ts"),
      "utf8",
    );
    const verify = readFileSync(
      join(root, "scripts", "site-verify-lib.ts"),
      "utf8",
    );
    const cliManifest = JSON.parse(
      readFileSync(join(root, "packages", "cms-cli", "package.json"), "utf8"),
    ) as {
      bin?: Record<string, string>;
      exports?: Record<string, unknown>;
    };
    const templateManifest = JSON.parse(
      readFileSync(
        join(root, "packages", "cms-template-rem-viet", "package.json"),
        "utf8",
      ),
    ) as { exports?: Record<string, unknown> };
    const cliConsumer = readFileSync(
      join(root, "scripts", "verify-cms-kit-consumer.ts"),
      "utf8",
    );

    expect(alchemy).not.toMatch(/@rem-viet|packages\/infra|apps\/web/i);
    expect(stack).toContain("createCmsAlchemyResourcePlan");
    expect(init).toContain("createCmsSiteInitPlan");
    expect(init).toContain("applyCmsFilePlan");
    expect(addBlock).toContain("createCmsBlockScaffoldPlan");
    expect(verify).toContain("verifyCmsSiteArtifacts");
    expect(cliManifest.bin).toEqual({ "agency-cms": "./src/cli.ts" });
    expect(cliManifest.exports?.["./command"]).toBeDefined();
    expect(templateManifest.exports?.["./bootstrap"]).toBeDefined();
    expect(templateManifest.exports?.["./admin"]).toBeDefined();
    expect(templateManifest.exports?.["./visual-authoring"]).toBeDefined();
    expect(cliConsumer).toMatch(/"agency-cms",\s+"plan-init"/);
    expect(cliConsumer).toContain("@agency/cms-template-rem-viet/bootstrap");
    expect(cliConsumer).toMatch(/"agency-cms",\s+"init"/);
    expect(cliConsumer).toMatch(/"agency-cms",\s+"add-block"/);
    expect(cliConsumer).toMatch(/"agency-cms",\s+"migrate"/);
    expect(cliConsumer).toMatch(/"agency-cms",\s+"rollback"/);
    expect(cliConsumer).toContain("block-scaffold-smoke.tsx");
    expect(cliConsumer).toContain("bootstrap-plan-smoke.ts");
    expect(cliConsumer).toContain("missing-secret checklist");
    expect(cliConsumer).toContain("cmsSiteManifestSchema");
    expect(cliConsumer).toContain("createCmsAlchemyResourcePlan");
    expect(cliConsumer).toContain("createTestimonialGridSeedBlock");
    expect(cliConsumer).toContain("migrateTestimonialGridBlockData");
    expect(cliConsumer).toContain("testimonialGridBlockEditorDefinition");
    expect(cliConsumer).toContain("CmsBlockRenderer");
  });

  test("public template entry does not import the visual-authoring kernel", () => {
    const publicEntry = readFileSync(
      join(root, "packages", "cms-template-rem-viet", "src", "index.ts"),
      "utf8",
    );
    const visualEntry = readFileSync(
      join(
        root,
        "packages",
        "cms-template-rem-viet",
        "src",
        "visual-authoring.ts",
      ),
      "utf8",
    );

    expect(publicEntry).not.toContain("@agency/cms-visual-editor");
    expect(publicEntry).not.toContain("remVietVisualComponentRegistry");
    expect(visualEntry).toContain("@agency/cms-visual-editor");
    expect(visualEntry).toContain("remVietCustomVisualEditorAdapter");

    const atelierPublicEntry = readFileSync(
      join(root, "packages", "cms-template-atelier", "src", "index.ts"),
      "utf8",
    );
    const atelierVisualEntry = readFileSync(
      join(
        root,
        "packages",
        "cms-template-atelier",
        "src",
        "visual-authoring.ts",
      ),
      "utf8",
    );
    expect(atelierPublicEntry).not.toContain("@agency/cms-visual-editor");
    expect(atelierPublicEntry).not.toContain("@agency/cms-template-factory");
    expect(atelierVisualEntry).toContain("@agency/cms-visual-editor");
    expect(atelierVisualEntry).toContain("@agency/cms-template-factory");
  });

  test("upgrade rehearsal installs coordinated artifacts and restores state", () => {
    const script = readFileSync(
      join(root, "scripts", "verify-cms-kit-upgrade.ts"),
      "utf8",
    );
    const providerFixture = readFileSync(
      join(root, "fixtures", "cms-kit-upgrade-consumer", "verify-provider.ts"),
      "utf8",
    );
    const migrationFixture = readFileSync(
      join(
        root,
        "fixtures",
        "cms-kit-upgrade-consumer",
        "content-migration.ts",
      ),
      "utf8",
    );
    const upgradeFixture = readFileSync(
      join(root, "fixtures", "cms-kit-upgrade-consumer", "upgrade.ts"),
      "utf8",
    );
    const rollbackFixture = readFileSync(
      join(root, "fixtures", "cms-kit-upgrade-consumer", "rollback.ts"),
      "utf8",
    );

    expect(script).toContain('baselineVersion = "0.1.0"');
    expect(script).toContain('nextVersion = "0.2.0-rehearsal.1"');
    expect(script).toContain("artifactDigests");
    expect(script).toContain('["bun", "rollback.ts"]');
    expect(providerFixture).toContain("revisions.length !== 2");
    expect(providerFixture).toContain('media?.altText !== "Persistent media"');
    expect(migrationFixture).toContain("createCmsMigrationPlan");
    expect(migrationFixture).toContain("Rollback backup bytes");
    expect(upgradeFixture).toContain("executeCmsMigrationPlan");
    expect(upgradeFixture).toContain("migration.receipt.json");
    expect(rollbackFixture).toContain("rollbackCmsMigration");
  });

  test("private release preparation is coordinated and fail-closed", () => {
    const source = readFileSync(
      join(root, "scripts", "prepare-cms-kit-release.ts"),
      "utf8",
    );
    const policy = readFileSync(
      join(root, "scripts", "cms-kit-release-lib.ts"),
      "utf8",
    );
    const publisher = readFileSync(
      join(root, "scripts", "publish-cms-kit-release.ts"),
      "utf8",
    );
    const rootManifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const compatibility = JSON.parse(
      readFileSync(
        join(root, "docs", "releases", "cms-kit-compatibility.json"),
        "utf8",
      ),
    ) as {
      schemas?: Record<string, unknown>;
      validatedWith?: Record<string, unknown>;
    };

    expect(source).toContain("createCmsKitReleaseProvenance");
    expect(source).toContain("assertCmsKitCompatibilityMatrix");
    expect(source).toContain("assertCmsKitReleaseNotes");
    expect(source).toContain("assertCmsKitArtifactPolicy");
    expect(source).toContain("buildCmsKitPublishArtifact");
    expect(source).toContain("CMS_PRIVATE_REGISTRY_TOKEN");
    expect(source).toContain("Preparation never publishes");
    expect(source).toContain("requiredConfirmation");
    expect(policy).toContain('sourceState === "clean"');
    expect(policy).toContain("Invalid or duplicate CMS Kit package");
    expect(policy).toContain("changelog or migration notes");
    expect(publisher).toContain("createCmsKitPublishRequest");
    expect(publisher).toContain("createCmsKitPublicationReceipt");
    expect(publisher).toContain("buildCmsKitPublishArtifact");
    expect(publisher).toContain("does not reproduce from the clean source");
    expect(publisher).toContain("exact clean prepared checkout");
    expect(publisher).toContain("publication-receipt.partial.json");
    expect(publisher).toContain("already contains publication state");
    expect(publisher).toContain('"--ignore-scripts"');
    expect(rootManifest.scripts?.["cms:kit:release:publish"]).toBe(
      "bun scripts/publish-cms-kit-release.ts",
    );
    expect(compatibility.schemas).toMatchObject({
      remVietBlock: 1,
      cloudflareProvider: 1,
      localProvider: 1,
      postgresProvider: 1,
      cloudflareMigrationsThrough: "0009_editorial_review_tasks",
    });
    expect(compatibility.validatedWith).toMatchObject({
      bun: "1.4.0",
      tanstackReactRouter: "1.170.6",
      tanstackReactStart: "1.168.9",
      alchemy: "2.0.0-beta.72",
    });
  });

  test("Platform Kit v1 requires registry, two paid upgrades, and evidence-only provenance", () => {
    const contract = readFileSync(
      join(root, "scripts", "cms-kit-v1-evidence.ts"),
      "utf8",
    );
    const verifier = readFileSync(
      join(root, "scripts", "verify-cms-kit-v1-evidence.ts"),
      "utf8",
    );
    const rootManifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const template = JSON.parse(
      readFileSync(
        join(root, "docs", "releases", "cms-kit-v1.0.0.template.json"),
        "utf8",
      ),
    ) as { adoptions?: unknown[]; releaseSourceCommit?: string };

    expect(contract).toContain("cmsKitPublicationReceiptSchema");
    expect(contract).toContain("paidEngagement: z.literal(true)");
    expect(contract).toContain("upgradedWithoutCopiedPatch: z.literal(true)");
    expect(contract).toContain("z.array(receiptReferenceSchema).min(2)");
    expect(verifier).toContain("parseCmsKitAdoptionReceipt");
    expect(verifier).toContain('"--no-renames"');
    expect(verifier).toContain("isStrictAncestor");
    expect(verifier).toContain('path.startsWith("docs/releases/evidence/")');
    expect(rootManifest.scripts["cms:kit:v1:verify"]).toBe(
      "bun scripts/verify-cms-kit-v1-evidence.ts",
    );
    expect(template.adoptions).toHaveLength(2);
    expect(template.releaseSourceCommit).toBe("");
  });

  test("Cloudflare provider does not import the app, database package, or template", () => {
    const directory = join(root, "packages", "cms-provider-cloudflare", "src");
    const content = filesBelow(directory)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(content).not.toMatch(/@rem-viet/i);
    expect(content).not.toMatch(/cms-template-rem-viet/i);
    expect(content).not.toMatch(/drizzle/i);
    expect(content).not.toMatch(/packages\/db/i);
  });

  test("local provider is app-independent and does not couple to another provider", () => {
    const directory = join(root, "packages", "cms-provider-local", "src");
    const content = filesBelow(directory)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(content).not.toMatch(/@rem-viet/i);
    expect(content).not.toMatch(/cms-template-rem-viet/i);
    expect(content).not.toMatch(/cms-provider-cloudflare/i);
    expect(content).not.toMatch(/cms-provider-sanity/i);
    expect(content).not.toMatch(/packages\/db/i);
  });

  test("PostgreSQL provider is app-independent and keeps SQLite/D1/Sanity out", () => {
    const directory = join(root, "packages", "cms-provider-postgres", "src");
    const content = filesBelow(directory)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(content).not.toMatch(/@rem-viet/i);
    expect(content).not.toMatch(/cms-template-rem-viet/i);
    expect(content).not.toMatch(/@libsql|cms-provider-local/i);
    expect(content).not.toMatch(/cms-provider-cloudflare|cms-provider-sanity/i);
    expect(content).not.toMatch(/packages\/db/i);
  });

  test("experimental Sanity provider stays optional, structural and outside the stable bundle", () => {
    const directory = join(root, "packages", "cms-provider-sanity", "src");
    const content = filesBelow(directory)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const releasePolicy = readFileSync(
      join(root, "scripts", "cms-kit-release-lib.ts"),
      "utf8",
    );

    expect(content).not.toMatch(
      /@rem-viet|cms-template-rem-viet|@sanity\/client/i,
    );
    expect(content).toContain("SanityCmsGlobalContentProvider");
    expect(content).toContain("sanityGlobalContentCapabilities");
    expect(content).toContain("agencyGlobalRevision");
    expect(content).toContain("SANITY_HOSTED_RECEIPT_SCHEMA_VERSION = 3");
    expect(content).toContain("SANITY_PRESENTATION_RECEIPT_SCHEMA_VERSION = 1");
    expect(content).toContain("parseSanityPresentationReceipt");
    expect(content).toContain("SANITY_PROMOTION_RECEIPT_SCHEMA_VERSION = 1");
    expect(content).toContain("parseSanityPromotionReceipt");
    expect(content).toContain("runGlobalContentProviderConformance");
    expect(content).toContain("cleanupSanityGlobalProofDocuments");
    expect(content).toContain("parseSanityHostedConformanceReceipt");
    expect(content).toContain("receiveSanityWebhook");
    expect(content).toContain("SANITY_WEBHOOK_PROJECTION");
    expect(releasePolicy).not.toContain('"@agency/cms-provider-sanity"');
    expect(
      JSON.parse(
        readFileSync(
          join(root, "packages", "cms-provider-sanity", "package.json"),
          "utf8",
        ),
      ).version,
    ).toContain("experimental");
  });

  test("optional Sanity Studio and TanStack preview are executable without crossing neutral boundaries", () => {
    const studioConfig = readFileSync(
      join(root, "apps", "studio", "sanity.config.ts"),
      "utf8",
    );
    const studioSchemas = filesBelow(
      join(root, "apps", "studio", "src", "schemaTypes"),
    )
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const studioVersioning = readFileSync(
      join(root, "apps", "studio", "src", "VersionedDocumentInput.tsx"),
      "utf8",
    );
    const previewServer = readFileSync(
      join(root, "apps", "web", "src", "lib", "sanity-preview.server.ts"),
      "utf8",
    );
    const previewSession = readFileSync(
      join(root, "apps", "web", "src", "lib", "sanity-preview-session.ts"),
      "utf8",
    );
    const webhookReceiver = readFileSync(
      join(root, "apps", "web", "src", "lib", "sanity-webhook.server.ts"),
      "utf8",
    );
    const webhookRoute = readFileSync(
      join(root, "apps", "web", "src", "routes", "api", "sanity", "webhook.ts"),
      "utf8",
    );
    const visualEditing = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "components",
        "sanity-visual-editing.tsx",
      ),
      "utf8",
    );
    const template = readFileSync(
      join(root, "packages", "cms-template-rem-viet", "src", "index.ts"),
      "utf8",
    );
    const presentationProof = readFileSync(
      join(root, "apps", "web", "e2e", "sanity-presentation.spec.ts"),
      "utf8",
    );
    const presentationVerifier = readFileSync(
      join(
        root,
        "packages",
        "cms-provider-sanity",
        "scripts",
        "verify-presentation.ts",
      ),
      "utf8",
    );
    const hostedVerifier = readFileSync(
      join(
        root,
        "packages",
        "cms-provider-sanity",
        "scripts",
        "verify-hosted.ts",
      ),
      "utf8",
    );
    const promotionVerifier = readFileSync(
      join(
        root,
        "packages",
        "cms-provider-sanity",
        "scripts",
        "verify-promotion.ts",
      ),
      "utf8",
    );
    const gitAttributes = readFileSync(join(root, ".gitattributes"), "utf8");
    const rootManifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(studioConfig).toContain("presentationTool");
    expect(studioConfig).toContain("defineDocuments");
    expect(studioConfig).toContain("VersionedDocumentInput");
    expect(studioSchemas).toContain("agencyHeroBlock");
    expect(studioSchemas).toContain("agencyFaqBlock");
    expect(studioVersioning).toContain('inc(1, ["version"])');
    expect(previewServer).toContain("readSignedSanityPerspective");
    expect(previewServer).toContain("stega: true");
    expect(previewSession).toContain("crypto.subtle.verify");
    expect(webhookReceiver).toContain("createD1DeliveryStore");
    expect(webhookReceiver).toContain("cache.delete");
    expect(webhookReceiver).toContain("purgeExpiredSanityWebhookDeliveries");
    expect(webhookRoute).toContain("handleSanityWebhook");
    expect(
      readFileSync(
        join(
          root,
          "apps",
          "web",
          "src",
          "lib",
          "sanity-webhook-delivery-store.ts",
        ),
        "utf8",
      ),
    ).toContain("ON CONFLICT(idempotency_key) DO NOTHING");
    expect(visualEditing).toContain("enableVisualEditing");
    expect(visualEditing).toContain("onRefresh()");
    expect(template).toContain("encodeRemVietSanityPageContent");
    expect(presentationProof).toContain(
      "[data-hovered] [data-sanity-overlay-element]",
    );
    expect(presentationProof).toContain("liveMutationNoReload");
    expect(presentationProof).toContain("publishedPerspective");
    expect(presentationProof).toContain("await cleanupDocuments(");
    expect(presentationVerifier).toContain("cleanGitCommit()");
    expect(presentationVerifier).toContain(
      "parseSanityHostedConformanceReceipt",
    );
    expect(presentationVerifier).toContain("redactBrowserFailure");
    expect(hostedVerifier).toContain("cleanGitCommit(repositoryRoot)");
    expect(promotionVerifier).toContain("assertStrictAncestor");
    expect(promotionVerifier).toContain("--no-renames");
    expect(promotionVerifier).toContain("createSanityPromotionReceipt");
    expect(gitAttributes).toContain("docs/releases/evidence/** -text");
    expect(rootManifest.scripts["cms:sanity:presentation"]).toBeTruthy();
    expect(rootManifest.scripts["cms:sanity:presentation:login"]).toBeTruthy();
    expect(rootManifest.scripts["cms:sanity:promotion"]).toBeTruthy();
  });

  test("all ten landing blocks use the registry instead of renderer switch cases", () => {
    const source = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "components",
        "landing",
        "homepage-renderer.tsx",
      ),
      "utf8",
    );
    const renderSlice = source.slice(
      source.indexOf("function renderHomeBlock"),
      source.indexOf("export function HomepageRenderer"),
    );

    expect(renderSlice).toContain("<CmsBlockRenderer");
    expect(renderSlice).not.toContain("switch (");
    for (const type of [
      "hero",
      "threatNarrative",
      "marquee",
      "benefits",
      "craftProcess",
      "bentoDetails",
      "horizontalGallery",
      "measurementGuide",
      "faq",
      "footerCta",
    ]) {
      expect(renderSlice).not.toContain(`case "${type}"`);
    }
  });

  test("the compatibility landing facade owns no concrete block schemas", () => {
    const source = readFileSync(
      join(root, "packages", "cms", "src", "landing.ts"),
      "utf8",
    );

    expect(source).not.toContain("z.object");
    expect(source).not.toContain("safeMediaSourceSchema");
    expect(source).toContain("legacyDefaultThreatNarrativeBlock");
    expect(source).toContain("legacyDefaultFooterCtaBlock");
  });

  test("all ten landing editors use the neutral admin registry", () => {
    const source = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "components",
        "admin-home-block-editor.tsx",
      ),
      "utf8",
    );
    const dispatch = source.slice(
      source.indexOf("export default function AdminHomeBlockEditor"),
    );

    expect(source).toContain("createBlockEditorRegistry");
    expect(dispatch).toContain("<CmsBlockEditor");
    expect(dispatch).not.toContain("switch (");
  });

  test("home and post editors share neutral autosave and preview orchestration", () => {
    for (const route of [
      join(root, "apps", "web", "src", "routes", "admin", "home.tsx"),
      join(
        root,
        "apps",
        "web",
        "src",
        "routes",
        "admin",
        "posts",
        "$postId",
        "edit.tsx",
      ),
    ]) {
      const source = readFileSync(route, "utf8");
      expect(source).toContain("useCmsAutosave");
      expect(source).not.toContain("window.setTimeout");
    }

    const navigation = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "hooks",
        "use-save-before-navigation.ts",
      ),
      "utf8",
    );
    expect(navigation).toContain("useCmsDraftFlush");
    expect(navigation).toContain("openCmsPreviewAfterSave");
    expect(navigation).not.toContain("for (let attempt");
  });

  test("homepage preview adopts the authenticated replay-safe v2 channel", () => {
    const host = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "home.tsx"),
      "utf8",
    );
    const preview = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "home-preview.tsx"),
      "utf8",
    );
    const session = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "functions",
        "get-preview-admin-user.ts",
      ),
      "utf8",
    );

    for (const source of [host, preview]) {
      expect(source).toContain("createCmsVisualPreviewEnvelope");
      expect(source).toContain("validateCmsVisualPreviewEnvelope");
      expect(source).toContain("initialCmsVisualPreviewReplayState");
      expect(source).toContain("expectedIdentity");
    }
    expect(preview).toContain("createCmsVisualPreviewResponseHeaders");
    expect(preview).toContain("previewSessionBinding");
    expect(session).toContain("createPreviewSessionBinding");
  });

  test("standard-page and post previews exclusively use the authenticated v2 session", () => {
    const routes = [
      join(root, "apps", "web", "src", "routes", "admin", "pages.tsx"),
      join(
        root,
        "apps",
        "web",
        "src",
        "routes",
        "admin",
        "pages_",
        "$pageId",
        "preview.tsx",
      ),
      join(
        root,
        "apps",
        "web",
        "src",
        "routes",
        "admin",
        "posts",
        "$postId",
        "edit.tsx",
      ),
      join(
        root,
        "apps",
        "web",
        "src",
        "routes",
        "admin",
        "posts",
        "$postId",
        "preview.tsx",
      ),
    ].map((path) => readFileSync(path, "utf8"));
    const postProtocol = readFileSync(
      join(root, "apps", "web", "src", "lib", "post-preview.ts"),
      "utf8",
    );

    for (const source of routes) {
      expect(source).toContain("createCmsVisualPreviewSession");
      expect(source).toContain("event.source !==");
      expect(source).not.toMatch(/cms:(?:standard-page|post-preview)/);
      expect(source).not.toMatch(
        /postMessage\(\s*createCmsVisualEditor(?:Ready|State|Selection|Move|Insert|Duplicate|Remove)Message/,
      );
    }
    for (const preview of [routes[1]!, routes[3]!]) {
      expect(preview).toContain("createCmsVisualPreviewResponseHeaders");
      expect(preview).toContain("previewSessionBinding");
    }
    expect(postProtocol).not.toMatch(/cms:post-preview/);
  });

  test("Rèm and Atelier bind their visual workspaces to the packaged editor shell", () => {
    const neutralShell = readFileSync(
      join(root, "packages", "cms-admin", "src", "editor-shell.tsx"),
      "utf8",
    );
    const remShell = readFileSync(
      join(
        root,
        "packages",
        "cms-template-rem-viet",
        "src",
        "editor-shell.tsx",
      ),
      "utf8",
    );
    const atelierShell = readFileSync(
      join(root, "packages", "cms-template-atelier", "src", "admin.tsx"),
      "utf8",
    );
    const remRoutes = [
      join(root, "apps", "web", "src", "routes", "admin", "home.tsx"),
      join(root, "apps", "web", "src", "routes", "admin", "pages.tsx"),
      join(
        root,
        "apps",
        "web",
        "src",
        "routes",
        "admin",
        "posts",
        "$postId",
        "edit.tsx",
      ),
    ].map((path) => readFileSync(path, "utf8"));

    expect(neutralShell).toContain("data-cms-editor-shell");
    expect(remShell).toContain("<CmsEditorShell");
    expect(atelierShell).toContain("<CmsEditorShell");
    for (const route of remRoutes) {
      expect(route).toContain("<RemVietEditorShell");
    }
  });

  test("operator onboarding enforces reset, verification, MFA, lockout, and recovery boundaries", () => {
    const auth = readFileSync(
      join(root, "packages", "auth", "src", "index.ts"),
      "utf8",
    );
    const authSchema = readFileSync(
      join(root, "packages", "db", "src", "schema", "auth.ts"),
      "utf8",
    );
    const apiBoundary = readFileSync(
      join(root, "packages", "api", "src", "index.ts"),
      "utf8",
    );
    const security = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "security.tsx"),
      "utf8",
    );
    const challenge = readFileSync(
      join(root, "apps", "web", "src", "routes", "xac-thuc-hai-lop.tsx"),
      "utf8",
    );
    const governance = readFileSync(
      join(root, "packages", "api", "src", "services", "governance.ts"),
      "utf8",
    );
    const apiKeys = readFileSync(
      join(root, "packages", "api", "src", "services", "api-keys.ts"),
      "utf8",
    );
    const apiContext = readFileSync(
      join(root, "packages", "api", "src", "context.ts"),
      "utf8",
    );
    const serviceAccountManager = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "components",
        "service-account-manager.tsx",
      ),
      "utf8",
    );

    expect(auth).toContain("resetPasswordTokenExpiresIn: 30 * 60");
    expect(auth).toContain("revokeSessionsOnPasswordReset: true");
    expect(auth).toContain("sendVerificationEmail");
    expect(auth).toContain("accountLockout");
    expect(auth).toContain("maxFailedAttempts: 5");
    expect(auth).toContain('storage: "database"');
    expect(auth).toContain('"/sign-in/*": { window: 60, max: 5 }');
    expect(authSchema).toContain("export const twoFactor = sqliteTable(");
    expect(authSchema).toContain("failedVerificationCount: integer(");
    expect(apiBoundary).toContain("isStaffMfaRequired");
    expect(apiBoundary).toContain('cause: "MFA_REQUIRED"');
    expect(security).toContain("authClient.twoFactor.enable");
    expect(security).toContain("mfaSetup.backupCodes");
    expect(challenge).toContain("verifyBackupCode");
    expect(challenge).toContain("ACCOUNT_TEMPORARILY_LOCKED");
    expect(governance).toContain('action: "staff.invite_sent"');
    expect(governance).toContain('action: "staff.invite_failed"');
    expect(governance).not.toMatch(/after:\s*\{[^}]*password/s);
    expect(apiKeys).toContain('const keyPrefix = "cmsk"');
    expect(apiKeys).toContain('crypto.subtle.digest(\n    "SHA-256"');
    expect(apiKeys).toContain('capability !== "staff.manage"');
    expect(apiKeys).toContain('action: "service_account.key_rotate"');
    expect(apiKeys).toContain('action: "service_account.key_revoke"');
    expect(apiKeys).not.toMatch(/after:\s*\{[^}]*(?:rawKey|secretHash)/s);
    expect(apiContext).toContain("authenticateCmsApiKey");
    expect(apiContext).toContain('("apiKey" as const)');
    expect(serviceAccountManager).toContain("Hãy sao chép khóa ngay");
    expect(serviceAccountManager).toContain("Ma trận quyền");
  });

  test("editorial review is a neutral runtime/provider/admin capability", () => {
    const core = readFileSync(
      join(root, "packages", "cms-core", "src", "index.ts"),
      "utf8",
    );
    const corePrimitives = readFileSync(
      join(root, "packages", "cms-core", "src", "primitives.ts"),
      "utf8",
    );
    const runtime = readFileSync(
      join(root, "packages", "cms-runtime", "src", "index.ts"),
      "utf8",
    );
    const provider = readFileSync(
      join(root, "packages", "cms-provider-cloudflare", "src", "index.ts"),
      "utf8",
    );
    const panel = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "components",
        "editorial-review-panel.tsx",
      ),
      "utf8",
    );
    const adapter = readFileSync(
      join(root, "packages", "api", "src", "services", "editorial-reviews.ts"),
      "utf8",
    );
    const cleanConsumer = readFileSync(
      join(
        root,
        "fixtures",
        "cms-kit-clean-consumer",
        "src",
        "provider-smoke.tsx",
      ),
      "utf8",
    );

    expect(core).toContain("cmsEditorialReviewTargetSchema");
    expect(corePrimitives).toContain('"content.review.request"');
    expect(runtime).toContain("CmsEditorialReviewWorkflow");
    expect(runtime).toContain("runEditorialReviewProviderConformance");
    expect(provider).toContain('id: "0005_editorial_reviews"');
    expect(provider).toContain("CloudflareCmsEditorialReviewProvider");
    expect(panel).toContain("resolveCmsEditorialReviewPresentation");
    expect(adapter).toContain("deriveCmsEditorialReviewState");
    expect(cleanConsumer).toContain("runEditorialReviewProviderConformance");
    expect(cleanConsumer).toContain('reviewPresentation.kind !== "published"');
  });

  test("homepage draft-save, publish, scheduling, revision, and restore routes adopt the provider adapter", () => {
    const router = readFileSync(
      join(root, "packages", "api", "src", "routers", "content.ts"),
      "utf8",
    );
    const adapter = readFileSync(
      join(root, "packages", "api", "src", "services", "home-page-runtime.ts"),
      "utf8",
    );
    const managedWorkflow = readFileSync(
      join(
        root,
        "packages",
        "api",
        "src",
        "services",
        "managed-page-workflow.ts",
      ),
      "utf8",
    );

    expect(router).toContain("listRemVietHomeRevisions");
    expect(router).toContain("saveRemVietHomeDraft");
    expect(router).toContain("publishManagedPage");
    expect(router).toContain("scheduleRemVietHomePage");
    expect(router).toContain("unscheduleRemVietHomePage");
    expect(router).toContain("restoreManagedPageRevision");
    expect(router).toContain("unpublishManagedPage");
    expect(router).toContain('capabilityProcedure("content.schedule")');
    expect(adapter).toContain("createCloudflareCmsPageProvider");
    expect(adapter).toContain("getPublishedRemVietHomePage");
    expect(adapter).toContain("prepareMutationStatements");
    expect(adapter).toContain("encodeRemVietHomeRevision");
    expect(managedWorkflow).toContain("publishRemVietHomePage");
    expect(managedWorkflow).toContain("restoreRemVietHomeRevision");
    expect(managedWorkflow).toContain("unpublishRemVietHomePage");
  });

  test("media upload, list, metadata, usage, and delete adopt the provider", () => {
    const service = readFileSync(
      join(root, "packages", "api", "src", "services", "content.ts"),
      "utf8",
    );
    const uploadRoute = readFileSync(
      join(root, "apps", "web", "src", "routes", "api", "uploads", "media.ts"),
      "utf8",
    );

    expect(service).toContain("createCloudflareCmsMediaProvider");
    expect(service).toContain("uploadMediaRecord");
    expect(service).toContain("resolveUsage");
    expect(uploadRoute).toContain("uploadMediaRecord");
    expect(uploadRoute).not.toContain("bucket.put");
  });

  test("standard pages use versioned template blocks and provider workflows", () => {
    const renderer = readFileSync(
      join(root, "apps", "web", "src", "components", "cms-page-blocks.tsx"),
      "utf8",
    );
    const router = readFileSync(
      join(root, "packages", "api", "src", "routers", "content.ts"),
      "utf8",
    );
    const adapter = readFileSync(
      join(
        root,
        "packages",
        "api",
        "src",
        "services",
        "standard-page-runtime.ts",
      ),
      "utf8",
    );
    const managedWorkflow = readFileSync(
      join(
        root,
        "packages",
        "api",
        "src",
        "services",
        "managed-page-workflow.ts",
      ),
      "utf8",
    );
    const editor = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "pages.tsx"),
      "utf8",
    );
    const collection = readFileSync(
      join(root, "packages", "cms-template-rem-viet", "src", "collections.ts"),
      "utf8",
    );

    expect(renderer).toContain("createRemVietStandardBlockRegistry");
    expect(renderer).not.toContain("switch (block.type)");
    expect(editor).toContain("createRemVietStandardBlockEditorRegistry");
    expect(editor).toContain("<CmsBlockEditor");
    expect(editor).not.toContain('selected?.type === "');
    expect(router).toContain("saveRemVietStandardPageDraft");
    expect(router).toContain("publishManagedPage");
    expect(router).toContain("scheduleRemVietStandardPage");
    expect(router).toContain("createRemVietStandardPage");
    expect(router).toContain("unpublishManagedPage");
    expect(router).toContain("deleteRemVietStandardPage");
    expect(adapter).toContain("createCloudflareCmsCollectionProvider");
    expect(adapter).toContain("createCmsPageCollectionAdapter");
    expect(collection).toContain("remVietStandardPagesCollection");
    expect(adapter).toContain("pageMutationStatements");
    expect(adapter).toContain("pageSlugRedirectStatements");
    expect(adapter).toContain("validateRedirectGraph");
    expect(managedWorkflow).toContain("publishRemVietStandardPage");
    expect(managedWorkflow).toContain("unpublishRemVietStandardPage");
    expect(managedWorkflow).toContain("restoreRemVietStandardPageRevision");
  });

  test("page editors resolve actions from provider and server capabilities", () => {
    const admin = readFileSync(
      join(root, "packages", "cms-admin", "src", "index.ts"),
      "utf8",
    );
    const router = readFileSync(
      join(root, "packages", "api", "src", "routers", "content.ts"),
      "utf8",
    );
    const home = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "home.tsx"),
      "utf8",
    );
    const pages = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "pages.tsx"),
      "utf8",
    );

    expect(admin).toContain("resolveCmsAdminWorkflow");
    expect(admin).toContain("runCmsWorkflowCommand");
    expect(admin).toContain("CmsWorkflowActionSlots");
    expect(admin).toContain('reason: "provider-unsupported"');
    expect(router).toContain(
      "createRemVietStandardPageProvider().capabilities",
    );
    expect(home).toContain("content.pages.capabilities.queryOptions()");
    expect(pages).toContain("content.pages.capabilities.queryOptions()");
    expect(home).toContain("runCmsWorkflowCommand");
    expect(home).toContain("<CmsWorkflowActionSlots");
    expect(home).toContain("<CmsRevisionList");
    expect(home).toContain("<CmsDraftStatusSlots");
    expect(pages).toContain("<CmsWorkflowActionSlots");
    expect(pages).toContain("<CmsRevisionList");
    const posts = readFileSync(
      join(
        root,
        "apps",
        "web",
        "src",
        "routes",
        "admin",
        "posts",
        "$postId",
        "edit.tsx",
      ),
      "utf8",
    );
    expect(posts).toContain("<CmsDraftStatusSlots");
    expect(home).not.toContain("const canPublish");
    expect(pages).not.toContain("const canPublish");
  });

  test("site settings and navigation use the neutral global-content provider", () => {
    const runtime = readFileSync(
      join(root, "packages", "cms-runtime", "src", "index.ts"),
      "utf8",
    );
    const provider = readFileSync(
      join(root, "packages", "cms-provider-cloudflare", "src", "index.ts"),
      "utf8",
    );
    const adapter = readFileSync(
      join(
        root,
        "packages",
        "api",
        "src",
        "services",
        "global-content-runtime.ts",
      ),
      "utf8",
    );
    const content = readFileSync(
      join(root, "packages", "api", "src", "services", "content.ts"),
      "utf8",
    );
    const settingsAdmin = readFileSync(
      join(root, "apps", "web", "src", "routes", "admin", "settings.tsx"),
      "utf8",
    );

    expect(runtime).toContain("CmsGlobalContentProvider");
    expect(runtime).toContain("runGlobalContentProviderConformance");
    expect(provider).toContain("CloudflareCmsGlobalContentProvider");
    expect(provider).toContain('id: "0004_global_content"');
    expect(adapter).toContain("createCloudflareCmsGlobalContentProvider");
    expect(content).toContain("getSiteSettingsGlobal");
    expect(content).toContain("getMenuGlobal");
    expect(content).toContain("listSiteSettingsRevisions");
    expect(content).toContain("restoreSiteSettingsRevision");
    expect(content).toContain("listMenuRevisions");
    expect(content).toContain("restoreMenuRevision");
    expect(content).not.toContain(".update(siteSettings)");
    expect(content).not.toContain(".update(menus)");
    expect(settingsAdmin).toContain("GlobalRevisionHistory");
    expect(settingsAdmin).toContain("expectedVersion");
    expect(settingsAdmin).toContain("siteSettings.restore");
    expect(settingsAdmin).toContain("menus.restore");
  });
});
