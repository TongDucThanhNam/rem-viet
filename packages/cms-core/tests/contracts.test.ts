import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  CmsError,
  createCollectionRegistry,
  createCmsBlockSchema,
  createCmsDocumentSchema,
  defineCollection,
  decideCmsEditorialReviewInputSchema,
  cmsSiteManifestSchema,
  cmsVisualEditingCapabilitiesSchema,
  migrateBlockData,
  requestCmsEditorialReviewInputSchema,
  migrateCollectionData,
  type CmsCollectionData,
  type CmsFieldDefinition,
} from "../src";

describe("neutral CMS contracts", () => {
  const textBlockSchema = createCmsBlockSchema(
    "text",
    z.object({ text: z.string() }),
  );

  test("validates versioned block and document envelopes", () => {
    const block = {
      id: "intro",
      type: "text",
      schemaVersion: 1,
      enabled: true,
      data: { text: "Hello" },
    };

    expect(textBlockSchema.parse(block)).toEqual(block);
    expect(
      createCmsDocumentSchema(textBlockSchema).safeParse({
        id: "home",
        documentType: "page",
        schemaVersion: 1,
        version: 0,
        status: "draft",
        blocks: [block],
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  test("requires contiguous explicit migrations", () => {
    expect(
      migrateBlockData({ text: "before" }, 1, 2, [
        {
          from: 1,
          to: 2,
          migrate: (data) => ({ ...(data as object), migrated: true }),
        },
      ]),
    ).toEqual({ text: "before", migrated: true });

    expect(() => migrateBlockData({}, 1, 2, [])).toThrow(CmsError);
  });

  test("models visual editing separately from provider authorization", () => {
    expect(
      cmsVisualEditingCapabilitiesSchema.parse({
        draftMode: true,
        livePreview: true,
        clickToEdit: true,
        sectionReorder: true,
        responsivePreview: true,
        webhooks: false,
        localization: false,
      }),
    ).toMatchObject({ livePreview: true, clickToEdit: true });
  });

  test("validates provider-neutral, version-bound review commands", () => {
    const request = {
      actorId: "editor-1",
      documentId: "home",
      documentType: "page",
      expectedVersion: 2,
      note: "Please check the hero",
    };
    expect(requestCmsEditorialReviewInputSchema.parse(request)).toEqual(
      request,
    );
    expect(
      decideCmsEditorialReviewInputSchema.safeParse({
        ...request,
        decision: "changes_requested",
        note: "",
      }).success,
    ).toBe(false);
    expect(
      decideCmsEditorialReviewInputSchema.safeParse({
        ...request,
        decision: "approved",
        note: "",
      }).success,
    ).toBe(true);
    expect(
      requestCmsEditorialReviewInputSchema.safeParse({
        ...request,
        note: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  test("validates a versioned provider-neutral site manifest", () => {
    const manifest = {
      schemaVersion: 1,
      id: "acme-demo",
      name: "Acme Demo",
      siteUrl: "https://acme.example",
      kit: {
        version: "0.1.0",
        template: "@agency/template-showcase",
        provider: "edge-native",
        contentSchemaVersion: 1,
      },
      defaultLocale: "vi-VN",
      locales: ["vi-VN"],
      preset: "showcase",
      brand: {
        logo: "/logo.svg",
        colors: { primary: "#111111" },
        fonts: ["Inter"],
      },
      features: { blog: true, media: true },
      infrastructure: {
        adapter: "edge-composition",
        alchemyApp: "acme-demo",
        workerName: "acme-web",
        d1Name: "acme-db",
        r2BucketName: "acme-media",
        backupBucketName: "acme-backups",
      },
    } as const;

    expect(cmsSiteManifestSchema.parse(manifest)).toEqual(manifest);
    expect(
      cmsSiteManifestSchema.safeParse({
        ...manifest,
        defaultLocale: "en-US",
      }).success,
    ).toBe(false);
    expect(
      cmsSiteManifestSchema.safeParse({
        ...manifest,
        siteUrl: "https://user:secret@acme.example/private",
      }).success,
    ).toBe(false);
    expect(
      cmsSiteManifestSchema.safeParse({
        ...manifest,
        kit: { ...manifest.kit, version: "latest" },
      }).success,
    ).toBe(false);
    expect(
      cmsSiteManifestSchema.safeParse({
        ...manifest,
        registryToken: "must-not-enter-manifest",
      }).success,
    ).toBe(false);
    expect(
      cmsSiteManifestSchema.safeParse({
        ...manifest,
        infrastructure: {
          ...manifest.infrastructure,
          apiToken: "must-not-enter-manifest",
        },
      }).success,
    ).toBe(false);
    expect(
      cmsSiteManifestSchema.safeParse({
        ...manifest,
        name: "Acme\nADMIN_EMAILS=attacker@example.com",
      }).success,
    ).toBe(false);
  });
});

describe("code-first collection contracts", () => {
  const titleField = {
    name: "title",
    kind: "text",
    label: "Title",
    required: true,
  } as const satisfies CmsFieldDefinition<"title", "text", string, true>;
  const featuredField = {
    name: "featured",
    kind: "boolean",
    label: "Featured",
    required: false,
  } as const satisfies CmsFieldDefinition<
    "featured",
    "boolean",
    boolean,
    false
  >;

  const articles = defineCollection({
    slug: "articles",
    labels: { singular: "Article", plural: "Articles" },
    schemaVersion: 2,
    fields: [titleField, featuredField],
    lifecycle: { drafts: true, revisions: true, scheduling: true },
    access: {
      read: [],
      create: ["content.write"],
      update: ["content.write"],
      delete: ["content.delete"],
      publish: ["content.publish"],
    },
    migrations: [
      {
        from: 1,
        to: 2,
        migrate: (data) => ({ ...(data as object), featured: false }),
      },
    ],
  });

  test("defines a versioned collection and infers its document data", () => {
    const valid: CmsCollectionData<typeof articles> = {
      title: "Typed collection",
      featured: true,
    };
    expect(valid).toEqual({ title: "Typed collection", featured: true });
    expect(Object.isFrozen(articles)).toBe(true);
    expect(migrateCollectionData(articles, { title: "Before" }, 1)).toEqual({
      title: "Before",
      featured: false,
    });
  });

  test("registers collections without a core switch", () => {
    const people = defineCollection({
      ...articles,
      slug: "people",
      labels: { singular: "Person", plural: "People" },
    });
    const registry = createCollectionRegistry([articles, people] as const);

    expect(registry.get("articles")).toBe(articles);
    expect(registry.get("people").labels.singular).toBe("Person");
    expect(registry.has("missing")).toBe(false);
    expect(() => registry.get("missing" as "articles")).toThrow(CmsError);
  });

  test("rejects ambiguous fields, invalid lifecycle, and migration gaps", () => {
    expect(() =>
      defineCollection({
        ...articles,
        fields: [titleField, titleField],
      }),
    ).toThrow("Duplicate field name");
    expect(() =>
      defineCollection({
        ...articles,
        schemaVersion: 1,
        migrations: [],
        lifecycle: { drafts: false, revisions: false, scheduling: true },
      }),
    ).toThrow(CmsError);
    expect(() =>
      defineCollection({ ...articles, schemaVersion: 3, migrations: [] }),
    ).toThrow("Missing collection migration");
    expect(() => createCollectionRegistry([articles, articles])).toThrow(
      "Duplicate collection slug",
    );
  });
});
