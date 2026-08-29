import { describe, expect, test } from "bun:test";

import {
  createCmsAgencySiteArtifacts,
  createCmsAgencyWorkflowPlan,
  createCmsTemplateFactory,
  defineCmsAgencySite,
  defineCmsTemplateBlock,
} from "../src";
import { instantiateCmsVisualPattern } from "@agency/cms-visual-editor";

const textBlock = defineCmsTemplateBlock({
  type: "textBlock",
  schemaVersion: 2,
  fields: [{ path: "text", label: "Text", kind: "text" }],
  defaults: () => ({ text: "Hello" }),
  parse: (value) => {
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as { text?: unknown }).text !== "string"
    ) {
      throw new Error("Text is required.");
    }
    return value as { text: string };
  },
  renderer: "text-renderer",
  editor: "text-editor",
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: (value) => ({
        text: String((value as { body?: unknown }).body ?? ""),
      }),
    },
  ],
});

const factory = createCmsTemplateFactory({
  id: "@agency/cms-template-test",
  version: "0.1.0",
  schemaVersion: 1,
  blocks: [textBlock],
  patterns: [
    {
      id: "text-intro",
      label: "Text intro",
      description: "A configured introductory text block.",
      category: "Editorial",
      createNodes: ({ createId }) => [
        textBlock.createSeed({
          id: createId("textBlock"),
          data: { text: "Pattern intro" },
        }),
      ],
    },
  ],
});

const manifest = {
  schemaVersion: 1,
  id: "test-site",
  name: "Test site",
  siteUrl: "https://test.example",
  kit: {
    version: "0.1.0",
    template: factory.id,
    provider: "cloudflare",
    contentSchemaVersion: 1,
  },
  defaultLocale: "en-US",
  locales: ["en-US"],
  preset: "editorial",
  brand: {
    logo: "/assets/logo.svg",
    colors: { ink: "#111" },
    fonts: ["Inter"],
  },
  features: { blog: true, media: true },
  infrastructure: {
    adapter: "alchemy-cloudflare",
    alchemyApp: "test-site",
    workerName: "test-site-web",
    d1Name: "test-site-db",
    r2BucketName: "test-site-media",
    backupBucketName: "test-site-backups",
  },
};

describe("agency template factory", () => {
  test("derives registry, seed and migrations from one block definition", () => {
    expect(factory.registry.require("textBlock").fields[0]?.path).toBe("text");
    expect(textBlock.createSeed({ id: "text-1" })).toMatchObject({
      id: "text-1",
      schemaVersion: 2,
      data: { text: "Hello" },
    });
    expect(
      instantiateCmsVisualPattern({
        patterns: factory.patterns,
        patternId: "text-intro",
        createId: () => "pattern-text",
      }),
    ).toMatchObject([
      {
        id: "pattern-text",
        type: "textBlock",
        data: { text: "Pattern intro" },
      },
    ]);
    expect(
      textBlock.migrateNode({
        id: "text-1",
        type: "textBlock",
        schemaVersion: 1,
        enabled: true,
        data: { body: "Migrated" },
      }),
    ).toMatchObject({ schemaVersion: 2, data: { text: "Migrated" } });
  });

  test("fails closed for missing registrations and migration gaps", () => {
    expect(() =>
      createCmsTemplateFactory({
        id: "@agency/cms-template-empty",
        version: "0.1.0",
        schemaVersion: 1,
        blocks: [],
      }),
    ).toThrow("non-empty");
    expect(() =>
      defineCmsTemplateBlock({
        ...textBlock.definition,
        type: "brokenBlock",
        schemaVersion: 3,
        migrations: [{ from: 1, to: 2, migrate: () => ({ text: "two" }) }],
      }),
    ).toThrow("2->3");
  });

  test("generates manifest, theme, asset and seed contracts", () => {
    const site = defineCmsAgencySite({
      manifest,
      template: factory,
      theme: { schemaVersion: 1, tokens: { "--color-ink": "#111111" } },
      assets: [
        {
          id: "brand-logo",
          kind: "image",
          src: "/assets/logo.svg",
          altRequired: true,
        },
      ],
    });
    const document = factory.createDocument({
      id: "home",
      siteId: "test-site",
      nodes: [textBlock.createSeed({ id: "text-1" })],
    });
    expect(
      Object.keys(
        createCmsAgencySiteArtifacts({ site, documents: [document] }),
      ),
    ).toEqual([
      "site.manifest.json",
      "theme.tokens.json",
      "assets.contract.json",
      "content.seed.json",
    ]);
    expect(() =>
      defineCmsAgencySite({
        ...site,
        assets: [],
      }),
    ).toThrow("brand logo");
    expect(() =>
      createCmsAgencySiteArtifacts({
        site,
        documents: [{ ...document, siteId: "other-site" }],
      }),
    ).toThrow("site identity");
  });

  test("publishes all local workflows while marking deployment as authorization-bound", () => {
    expect(
      createCmsAgencyWorkflowPlan({ siteId: "test-site", workflow: "check" }),
    ).toMatchObject({
      remoteMutation: false,
      requiresExplicitAuthorization: false,
    });
    expect(
      createCmsAgencyWorkflowPlan({
        siteId: "test-site",
        workflow: "deploy",
        stage: "staging",
      }),
    ).toMatchObject({
      remoteMutation: true,
      requiresExplicitAuthorization: true,
      stage: "staging",
    });
  });
});
