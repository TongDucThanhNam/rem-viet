import { afterEach, describe, expect, test } from "bun:test";
import {
  type CmsBlock,
  CmsError,
  booleanField,
  createCollectionRegistry,
  createCmsExtensionRegistry,
  defineCollection,
  defineCmsLifecycleHook,
  defineFeatureModule,
  relationshipField,
  textField,
} from "@agency/cms-core";
import {
  assertCmsCollectionAccess,
  createCmsRestResources,
  createCmsServerSdk,
  exportCmsContent,
  importCmsContent,
  runCollectionProviderConformance,
  runEditorialReviewProviderConformance,
  runGlobalContentProviderConformance,
  runPageProviderConformance,
  type CmsPageContent,
  stableJson,
  toCmsRestError,
} from "@agency/cms-runtime";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import {
  applyCloudflareCmsMigrations,
  createCloudflareCmsCollectionProvider,
  createCloudflareCmsGlobalContentProvider,
  createCloudflareCmsPageProvider,
  type CloudflareD1Database,
} from "../src";
import { LibsqlD1Database } from "./libsql-d1";

type TextBlock = CmsBlock<"text", { text: string }>;
type TestContent = CmsPageContent<TextBlock>;

const databases: LibsqlD1Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function database() {
  const value = new LibsqlD1Database();
  databases.push(value);
  return value;
}

function parseContent(value: unknown): TestContent {
  const content = value as TestContent;
  if (
    !content ||
    typeof content.title !== "string" ||
    typeof content.slug !== "string" ||
    !Array.isArray(content.blocks) ||
    !content.seo
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Invalid test page content.",
      retryable: false,
    });
  }
  return content;
}

function content(title: string, text: string): TestContent {
  return {
    title,
    slug: "home",
    template: "landing",
    blocks: [
      {
        id: "intro",
        type: "text",
        schemaVersion: 1,
        enabled: true,
        data: { text },
      },
    ],
    seo: {
      title,
      description: `${title} description`,
      canonicalUrl: "",
      ogImage: "",
      robotsIndex: true,
      robotsFollow: true,
    },
  };
}

function encodeBlocks(value: TestContent) {
  return value.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    enabled: block.enabled,
    text: block.data.text,
  }));
}

function encodeRevision(value: TestContent) {
  return {
    title: value.title,
    slug: value.slug,
    template: value.template,
    blocks: encodeBlocks(value),
    seoTitle: value.seo.title,
    seoDescription: value.seo.description,
    canonicalUrl: value.seo.canonicalUrl,
    ogImage: value.seo.ogImage,
    robotsIndex: value.seo.robotsIndex,
    robotsFollow: value.seo.robotsFollow,
  };
}

function parseEncodedContent(value: unknown): TestContent {
  const input = value as Record<string, unknown>;
  const seo = input.seo as TestContent["seo"] | undefined;
  const blocks = (input.blocks as Array<Record<string, unknown>>).map(
    (block) =>
      "data" in block
        ? (block as TextBlock)
        : {
            id: String(block.id),
            type: "text" as const,
            schemaVersion: 1,
            enabled: Boolean(block.enabled),
            data: { text: String(block.text) },
          },
  );
  return parseContent({
    title: input.title,
    slug: input.slug,
    template: input.template,
    blocks,
    seo: seo ?? {
      title: String(input.seoTitle ?? ""),
      description: String(input.seoDescription ?? ""),
      canonicalUrl: String(input.canonicalUrl ?? ""),
      ogImage: String(input.ogImage ?? ""),
      robotsIndex: Boolean(input.robotsIndex),
      robotsFollow: Boolean(input.robotsFollow),
    },
  });
}

describe("Cloudflare D1 page provider", () => {
  test("applies the empty and upgraded schema migrations idempotently", async () => {
    const empty = database();
    await applyCloudflareCmsMigrations(empty);
    await applyCloudflareCmsMigrations(empty);
    const migrationCount = await empty
      .prepare("SELECT COUNT(*) AS count FROM cms_provider_migrations")
      .first<{ count: number }>();
    expect(Number(migrationCount?.count)).toBe(7);

    const upgraded = database();
    await upgraded.exec(`
      CREATE TABLE pages (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
        template TEXT NOT NULL DEFAULT 'standard', blocks TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft', seo_title TEXT NOT NULL DEFAULT '',
        seo_description TEXT NOT NULL DEFAULT '', canonical_url TEXT NOT NULL DEFAULT '',
        og_image TEXT NOT NULL DEFAULT '', robots_index INTEGER NOT NULL DEFAULT 1,
        robots_follow INTEGER NOT NULL DEFAULT 1, published_revision_id TEXT,
        version INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE page_revisions (
        id TEXT PRIMARY KEY, page_id TEXT NOT NULL, version INTEGER NOT NULL,
        snapshot TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
      );
    `);
    await applyCloudflareCmsMigrations(upgraded);
    await expect(
      upgraded.prepare("SELECT id FROM pages").all(),
    ).resolves.toEqual({ results: [] });
    await expect(
      upgraded.prepare("SELECT id FROM media").all(),
    ).resolves.toEqual({ results: [] });
    await expect(
      upgraded.prepare("SELECT key FROM cms_globals").all(),
    ).resolves.toEqual({ results: [] });
    await expect(
      upgraded.prepare("SELECT id FROM cms_review_events").all(),
    ).resolves.toEqual({ results: [] });
    await expect(
      upgraded.prepare("SELECT id FROM cms_collection_documents").all(),
    ).resolves.toEqual({ results: [] });
    const upgradedColumns = await upgraded
      .prepare("PRAGMA table_info(pages)")
      .all<{ name: string }>();
    expect(upgradedColumns.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "published_at",
        "scheduled_at",
        "scheduled_by",
        "schedule_note",
      ]),
    );
  });

  test("passes generic collection lifecycle, query, relationship, and permission conformance", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    const lifecycle = {
      drafts: true,
      revisions: true,
      scheduling: true,
    } as const;
    const access = {
      read: [] as const,
      create: ["content.write"] as const,
      update: ["content.write"] as const,
      delete: ["content.delete"] as const,
      publish: ["content.publish"] as const,
    };
    const authors = defineCollection({
      slug: "provider-authors",
      labels: { singular: "Author", plural: "Authors" },
      schemaVersion: 1,
      lifecycle,
      access,
      fields: [textField({ name: "name", label: "Name", required: true })],
    });
    const articles = defineCollection({
      slug: "provider-articles",
      labels: { singular: "Article", plural: "Articles" },
      schemaVersion: 1,
      lifecycle,
      access,
      fields: [
        textField({ name: "title", label: "Title", required: true }),
        booleanField({
          name: "featured",
          label: "Featured",
          defaultValue: false,
        }),
        relationshipField({
          name: "author",
          label: "Author",
          relationTo: "provider-authors",
          hasMany: false,
          required: true,
          onDelete: "restrict",
        }),
        relationshipField({
          name: "contributors",
          label: "Contributors",
          relationTo: "provider-authors",
          hasMany: true,
          defaultValue: [],
          onDelete: "nullify",
        }),
      ],
    });
    const registry = createCollectionRegistry([authors, articles] as const);
    let sequence = 0;
    const provider = createCloudflareCmsCollectionProvider({
      database: db,
      registry,
      createId: () => `collection-id-${++sequence}`,
      now: () => new Date("2026-08-17T00:00:00.000Z"),
    });
    await provider.createDraft({
      collection: authors.slug,
      id: "author-1",
      data: { name: "First Author" },
      actorId: "editor",
    });

    const conformance = await runCollectionProviderConformance({
      provider,
      collection: articles.slug,
      initial: {
        title: "Initial collection article",
        featured: true,
        author: "author-1",
      },
      changed: {
        title: "Changed collection article",
        featured: false,
        author: "author-1",
      },
      filter: { field: "featured", operator: "equals", value: true },
    });
    expect(conformance).toEqual({
      draftIsolation: true,
      filteredPagination: true,
      optimisticConflict: true,
      publish: true,
      revisionRestore: true,
      scheduling: true,
    });

    await expect(
      provider.createDraft({
        collection: articles.slug,
        id: "dangling",
        data: { title: "Dangling", author: "missing" },
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const author2 = await provider.createDraft({
      collection: authors.slug,
      id: "author-2",
      data: { name: "Second Author" },
      actorId: "editor",
    });
    await provider.createDraft({
      collection: authors.slug,
      id: "author-3",
      data: { name: "Third Author" },
      actorId: "editor",
    });
    const reference = await provider.createDraft({
      collection: articles.slug,
      id: "reference-policy",
      data: {
        title: "Reference policies",
        author: "author-2",
        contributors: ["author-3"],
      },
      actorId: "editor",
    });
    await expect(
      provider.delete({
        collection: authors.slug,
        id: "author-2",
        expectedVersion: author2.version,
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await provider.saveDraft({
      collection: articles.slug,
      id: reference.id,
      expectedVersion: reference.version,
      data: {
        title: "Reference policies",
        author: "author-3",
        contributors: ["author-2"],
      },
      actorId: "editor",
    });
    await provider.delete({
      collection: authors.slug,
      id: "author-2",
      expectedVersion: author2.version,
      actorId: "editor",
    });
    await expect(
      provider.getDraft({ collection: articles.slug, id: reference.id }),
    ).resolves.toMatchObject({ data: { contributors: [] } });
    expect(author2.data).toEqual({ name: "Second Author" });

    const authorized = createCloudflareCmsCollectionProvider({
      database: db,
      registry,
      authorize: ({ action, collection, actorId }) =>
        assertCmsCollectionAccess(
          collection,
          action,
          actorId === "editor" ? ["content.write"] : [],
        ),
    });
    await expect(
      authorized.createDraft({
        collection: authors.slug,
        id: "forbidden-author",
        data: { name: "Forbidden" },
        actorId: "viewer",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      authorized.createDraft({
        collection: authors.slug,
        id: "permitted-author",
        data: { name: "Permitted" },
        actorId: "editor",
      }),
    ).resolves.toMatchObject({ data: { name: "Permitted" } });
  });

  test("keeps localized drafts, publication, schedules, revisions, and relationships independent", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    const localization = {
      locales: ["vi-VN", "en-US", "fr-FR"],
      defaultLocale: "vi-VN",
    } as const;
    const lifecycle = {
      drafts: true,
      revisions: true,
      scheduling: true,
    } as const;
    const access = {
      read: [] as const,
      create: ["content.write"] as const,
      update: ["content.write"] as const,
      delete: ["content.delete"] as const,
      publish: ["content.publish"] as const,
    };
    const authors = defineCollection({
      slug: "localized-authors",
      labels: { singular: "Author", plural: "Authors" },
      schemaVersion: 1,
      localization,
      lifecycle,
      access,
      fields: [
        textField({
          name: "name",
          label: "Name",
          required: true,
          localized: true,
        }),
      ],
    });
    const articles = defineCollection({
      slug: "localized-articles",
      labels: { singular: "Article", plural: "Articles" },
      schemaVersion: 1,
      localization,
      lifecycle,
      access,
      fields: [
        textField({ name: "slug", label: "Slug", required: true }),
        textField({
          name: "title",
          label: "Title",
          required: true,
          localized: true,
        }),
        relationshipField({
          name: "author",
          label: "Author",
          relationTo: authors.slug,
          hasMany: false,
          required: true,
          localized: true,
          onDelete: "restrict",
          localeBehavior: "same",
        }),
      ],
    });
    let sequence = 0;
    const provider = createCloudflareCmsCollectionProvider({
      database: db,
      registry: createCollectionRegistry([authors, articles]),
      createId: () => `localized-${++sequence}`,
      now: () => new Date("2026-08-18T00:00:00.000Z"),
    });
    await provider.createDraft({
      collection: authors.slug,
      id: "author-1",
      locale: "vi-VN",
      data: { name: "Tác giả" },
      actorId: "editor",
    });
    await provider.createDraft({
      collection: authors.slug,
      id: "author-1",
      locale: "en-US",
      data: { name: "Author" },
      actorId: "editor",
    });
    await provider.createDraft({
      collection: authors.slug,
      id: "vi-only",
      locale: "vi-VN",
      data: { name: "Chỉ tiếng Việt" },
      actorId: "editor",
    });

    const viDraft = await provider.createDraft({
      collection: articles.slug,
      id: "article-1",
      locale: "vi-VN",
      data: { slug: "shared-slug", title: "Tiếng Việt", author: "author-1" },
      actorId: "editor",
    });
    const viPublished = await provider.publish({
      collection: articles.slug,
      id: viDraft.id,
      locale: "vi-VN",
      expectedVersion: viDraft.version,
      actorId: "publisher",
    });
    await expect(
      provider.getPublished({
        collection: articles.slug,
        id: viDraft.id,
        locale: "en-US",
      }),
    ).resolves.toBeNull();
    await expect(
      provider.getPublished({
        collection: articles.slug,
        id: viDraft.id,
        locale: "fr-FR",
        fallback: "default",
      }),
    ).resolves.toMatchObject({
      locale: "vi-VN",
      fallbackFrom: "fr-FR",
      data: { title: "Tiếng Việt", slug: "shared-slug" },
    });

    let enDraft = await provider.createDraft({
      collection: articles.slug,
      id: viDraft.id,
      locale: "en-US",
      data: {
        slug: "ignored-translation-slug",
        title: "English",
        author: "author-1",
      },
      actorId: "editor",
    });
    expect(enDraft.data).toEqual({
      slug: "shared-slug",
      title: "English",
      author: "author-1",
    });
    enDraft = await provider.schedule({
      collection: articles.slug,
      id: enDraft.id,
      locale: "en-US",
      expectedVersion: enDraft.version,
      scheduledAt: "2099-01-01T00:00:00.000Z",
      actorId: "editor",
    });
    await expect(
      provider.getDraft({
        collection: articles.slug,
        id: viDraft.id,
        locale: "vi-VN",
      }),
    ).resolves.toMatchObject({
      scheduledAt: null,
      version: viPublished.document.version,
    });
    const enPublished = await provider.publish({
      collection: articles.slug,
      id: enDraft.id,
      locale: "en-US",
      expectedVersion: enDraft.version,
      actorId: "publisher",
    });
    let viChanged = await provider.saveDraft({
      collection: articles.slug,
      id: viDraft.id,
      locale: "vi-VN",
      expectedVersion: viPublished.document.version,
      data: {
        slug: "shared-updated",
        title: "Bản nháp mới",
        author: "author-1",
      },
      actorId: "editor",
    });
    await expect(
      provider.getPublished({
        collection: articles.slug,
        id: viDraft.id,
        locale: "en-US",
      }),
    ).resolves.toMatchObject({
      version: enPublished.document.version,
      data: { slug: "shared-slug", title: "English" },
    });
    const viRepublished = await provider.publish({
      collection: articles.slug,
      id: viDraft.id,
      locale: "vi-VN",
      expectedVersion: viChanged.version,
      actorId: "publisher",
    });
    await expect(
      provider.getPublished({
        collection: articles.slug,
        id: viDraft.id,
        locale: "en-US",
      }),
    ).resolves.toMatchObject({
      data: { slug: "shared-updated", title: "English" },
    });
    viChanged = await provider.restore({
      collection: articles.slug,
      id: viDraft.id,
      locale: "vi-VN",
      expectedVersion: viRepublished.document.version,
      revisionId: viPublished.revision.id,
      actorId: "editor",
    });
    expect(viChanged.data).toMatchObject({ title: "Tiếng Việt" });
    const viUnpublished = await provider.unpublish({
      collection: articles.slug,
      id: viDraft.id,
      locale: "vi-VN",
      expectedVersion: viChanged.version,
      actorId: "publisher",
    });
    expect(viUnpublished.status).toBe("draft");
    await expect(
      provider.getPublished({
        collection: articles.slug,
        id: viDraft.id,
        locale: "en-US",
      }),
    ).resolves.toMatchObject({ data: { title: "English" } });
    await expect(
      provider.listRevisions({
        collection: articles.slug,
        id: viDraft.id,
        locale: "vi-VN",
      }),
    ).resolves.toHaveLength(2);
    await expect(
      provider.listRevisions({
        collection: articles.slug,
        id: viDraft.id,
        locale: "en-US",
      }),
    ).resolves.toHaveLength(1);
    await expect(
      provider.createDraft({
        collection: articles.slug,
        id: "dangling-locale",
        locale: "vi-VN",
        data: { slug: "dangling", title: "Hợp lệ", author: "vi-only" },
        actorId: "editor",
      }),
    ).resolves.toMatchObject({ locale: "vi-VN" });
    await expect(
      provider.createDraft({
        collection: articles.slug,
        id: "dangling-locale",
        locale: "en-US",
        data: { slug: "dangling", title: "Missing locale", author: "vi-only" },
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  test("serves typed REST resources and imports deterministic bundles atomically", async () => {
    const lifecycle = {
      drafts: true,
      revisions: true,
      scheduling: true,
    } as const;
    const access = {
      read: ["content.readDraft"] as const,
      create: ["content.write"] as const,
      update: ["content.write"] as const,
      delete: ["content.delete"] as const,
      publish: ["content.publish"] as const,
    };
    const authors = defineCollection({
      slug: "portable-authors",
      labels: { singular: "Author", plural: "Authors" },
      schemaVersion: 1,
      lifecycle,
      access,
      fields: [textField({ name: "name", label: "Name", required: true })],
    });
    const articles = defineCollection({
      slug: "portable-articles",
      labels: { singular: "Article", plural: "Articles" },
      schemaVersion: 2,
      migrations: [{ from: 1, to: 2, migrate: (data) => data }],
      lifecycle,
      access,
      fields: [
        textField({ name: "title", label: "Title", required: true }),
        relationshipField({
          name: "author",
          label: "Author",
          relationTo: authors.slug,
          hasMany: false,
          required: true,
          onDelete: "restrict",
        }),
      ],
    });
    const registry = createCollectionRegistry([authors, articles] as const);
    const sourceDb = database();
    const targetDb = database();
    const rollbackDb = database();
    await Promise.all(
      [sourceDb, targetDb, rollbackDb].map(applyCloudflareCmsMigrations),
    );
    let sequence = 0;
    const source = createCloudflareCmsCollectionProvider({
      database: sourceDb,
      registry,
      createId: () => `portable-source-${++sequence}`,
      now: () => new Date("2026-08-18T01:00:00.000Z"),
    });
    const sdk = createCmsServerSdk(registry, source);
    const author = await sdk.collection(authors.slug).create({
      id: "author-1",
      data: { name: "Portable author" },
      actorId: "editor",
    });
    await sdk.collection(authors.slug).publish({
      id: author.id,
      expectedVersion: author.version,
      actorId: "publisher",
    });
    const article = await sdk.collection(articles.slug).create({
      id: "article-1",
      data: { title: "Portable article", author: author.id },
      actorId: "editor",
    });
    await sdk.collection(articles.slug).publish({
      id: article.id,
      expectedVersion: article.version,
      actorId: "publisher",
    });
    await expect(
      sdk.collection(articles.slug).resolveRelationship({
        field: "author",
        id: author.id,
        actorId: "reader",
        view: "published",
      }),
    ).resolves.toMatchObject({ data: { name: "Portable author" } });

    const rest = createCmsRestResources({
      provider: source,
      actorFor: async (request) => ({
        actorId: "rest-user",
        capabilities:
          request.headers.get("authorization") === "allowed"
            ? (["content.readDraft"] as const)
            : ([] as const),
      }),
    });
    expect(rest.resources).toHaveLength(8);
    const allowed = await rest.handle(
      new Request(
        "https://cms.test/cms/collections/portable-articles/documents?status=published&limit=1",
        { headers: { authorization: "allowed" } },
      ),
    );
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toMatchObject({ total: 1, limit: 1 });
    const forbidden = await rest.handle(
      new Request(
        "https://cms.test/cms/collections/portable-articles/documents",
      ),
    );
    expect(forbidden.status).toBe(403);
    expect(toCmsRestError(new Error("SQL password=secret"))).toEqual({
      code: "CAPABILITY_UNAVAILABLE",
      message: "CMS request failed.",
      retryable: false,
    });

    const firstExport = await exportCmsContent({
      provider: source,
      actorId: "exporter",
    });
    const secondExport = await exportCmsContent({
      provider: source,
      actorId: "exporter",
    });
    expect(stableJson(firstExport)).toBe(stableJson(secondExport));
    expect(stableJson(firstExport)).not.toContain("password");

    const target = createCloudflareCmsCollectionProvider({
      database: targetDb,
      registry,
      createId: () => `portable-target-${++sequence}`,
      now: () => new Date("2026-08-18T02:00:00.000Z"),
    });
    const validation = await importCmsContent({
      provider: target,
      bundle: firstExport,
      actorId: "importer",
      validationOnly: true,
    });
    expect(validation).toMatchObject({
      mode: "validation",
      applied: false,
      creates: [{ id: "article-1" }, { id: "author-1" }],
      conflicts: [],
      validationFailures: [],
    });
    expect(
      await target.getDraft({ collection: authors.slug, id: author.id }),
    ).toBeNull();
    const dryRun = await importCmsContent({
      provider: target,
      bundle: firstExport,
      actorId: "importer",
      dryRun: true,
    });
    expect(dryRun).toMatchObject({ mode: "dry-run", applied: false });
    const applied = await importCmsContent({
      provider: target,
      bundle: firstExport,
      actorId: "importer",
    });
    expect(applied).toMatchObject({ mode: "apply", applied: true });
    await expect(
      target.getPublished({ collection: articles.slug, id: article.id }),
    ).resolves.toMatchObject({
      data: { title: "Portable article", author: "author-1" },
    });
    const unchanged = await importCmsContent({
      provider: target,
      bundle: firstExport,
      actorId: "importer",
      dryRun: true,
    });
    expect(unchanged.skips).toHaveLength(2);
    const targetArticle = await target.getDraft({
      collection: articles.slug,
      id: article.id,
    });
    const updateBundle = structuredClone(firstExport);
    const updateDocument = updateBundle.documents.find(
      (document) => document.collection === articles.slug,
    )!;
    updateDocument.expectedVersion = targetArticle!.version;
    updateDocument.data.title = "Portable article updated";
    updateDocument.publishedData!.title = "Portable article updated";
    const updateReport = await importCmsContent({
      provider: target,
      bundle: updateBundle,
      actorId: "importer",
      dryRun: true,
    });
    expect(updateReport.updates).toHaveLength(1);
    const conflictBundle = structuredClone(updateBundle);
    conflictBundle.documents.find(
      (document) => document.collection === articles.slug,
    )!.expectedVersion = null;
    const conflictReport = await importCmsContent({
      provider: target,
      bundle: conflictBundle,
      actorId: "importer",
      dryRun: true,
    });
    expect(conflictReport.conflicts).toHaveLength(1);

    const migrationBundle = structuredClone(firstExport);
    const migrationDocument = migrationBundle.documents.find(
      (document) => document.collection === articles.slug,
    )!;
    migrationDocument.schemaVersion = 1;
    const migrationDb = database();
    await applyCloudflareCmsMigrations(migrationDb);
    const migrationReport = await importCmsContent({
      provider: createCloudflareCmsCollectionProvider({
        database: migrationDb,
        registry,
      }),
      bundle: migrationBundle,
      actorId: "importer",
      dryRun: true,
    });
    expect(migrationReport.requiredMigrations).toEqual([
      { collection: articles.slug, id: article.id, from: 1, to: 2 },
    ]);

    const brokenBundle = structuredClone(firstExport);
    brokenBundle.documents.find(
      (document) => document.collection === articles.slug,
    )!.data.author = "missing-author";
    const missing = await importCmsContent({
      provider: target,
      bundle: brokenBundle,
      actorId: "importer",
      dryRun: true,
    });
    expect(missing.missingRelationships).toHaveLength(1);
    const invalidDocumentBundle = structuredClone(firstExport);
    delete invalidDocumentBundle.documents.find(
      (document) => document.collection === articles.slug,
    )!.data.title;
    const invalid = await importCmsContent({
      provider: target,
      bundle: invalidDocumentBundle,
      actorId: "importer",
      dryRun: true,
    });
    expect(invalid.validationFailures).toHaveLength(1);

    const rollbackExtensions = createCmsExtensionRegistry({
      modules: [
        defineFeatureModule({
          id: "portable-rollback",
          collections: [authors, articles],
          hooks: [
            defineCmsLifecycleHook({
              id: "portable-rollback/reject",
              event: "create",
              collection: articles.slug,
              run() {
                throw new CmsError({
                  code: "VALIDATION_FAILED",
                  message: "Rollback fixture rejected the article.",
                  retryable: false,
                });
              },
            }),
          ],
        }),
      ],
    });
    const rollback = createCloudflareCmsCollectionProvider({
      database: rollbackDb,
      extensions: rollbackExtensions,
    });
    await expect(
      importCmsContent({
        provider: rollback,
        bundle: firstExport,
        actorId: "importer",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      rollback.getDraft({ collection: authors.slug, id: author.id }),
    ).resolves.toBeNull();
  });

  test("executes ordered module hooks before D1 batches and rolls failures back", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    const articles = defineCollection({
      slug: "hooked-articles",
      labels: { singular: "Article", plural: "Articles" },
      schemaVersion: 1,
      lifecycle: { drafts: true, revisions: true, scheduling: true },
      access: {
        read: [],
        create: ["content.write"],
        update: ["content.write"],
        delete: ["content.delete"],
        publish: ["content.publish"],
      },
      fields: [textField({ name: "title", label: "Title", required: true })],
    });
    const events: string[] = [];
    const operationHooks = [
      "create",
      "update",
      "publish",
      "unpublish",
      "restore",
      "delete",
    ].map((event) =>
      defineCmsLifecycleHook({
        id: `hook-conformance/${event}`,
        event: event as
          "create" | "update" | "publish" | "unpublish" | "restore" | "delete",
        collection: articles.slug,
        run(context) {
          events.push(event);
          if (event === "create") {
            return {
              data: {
                ...context.data,
                title: `${String(context.data?.title).trim()}!`,
              },
            };
          }
          if (event === "update" && context.data?.title === "Reject") {
            throw new CmsError({
              code: "VALIDATION_FAILED",
              message: "Rejected by update policy.",
              retryable: false,
            });
          }
        },
      }),
    );
    const extensions = createCmsExtensionRegistry({
      modules: [
        defineFeatureModule({
          id: "hook-conformance",
          collections: [articles],
          hooks: [
            defineCmsLifecycleHook({
              id: "hook-conformance/validate",
              event: "validate",
              collection: articles.slug,
              order: -10,
              run(context) {
                events.push(`validate:${context.operation}`);
              },
            }),
            ...operationHooks,
          ],
          permissions: [
            {
              id: "hook-conformance/write",
              capability: "content.write",
              collection: articles.slug,
              operations: ["create", "update", "restore"],
            },
          ],
          migrations: [
            {
              id: "hook-conformance/v1",
              from: 0,
              to: 1,
              migrate: (state) => state,
            },
          ],
          admin: [
            {
              id: "hook-conformance/admin",
              collection: articles.slug,
              placement: "navigation",
              label: "Hooked articles",
            },
          ],
        }),
      ],
    });
    let sequence = 0;
    const provider = createCloudflareCmsCollectionProvider({
      database: db,
      extensions,
      createId: () => `hook-id-${++sequence}`,
      now: () => new Date("2026-08-18T00:00:00.000Z"),
    });

    let document = await provider.createDraft({
      collection: articles.slug,
      id: "article-1",
      data: { title: "  Hello  " },
      actorId: "editor",
    });
    expect(document.data).toEqual({ title: "Hello!" });
    await expect(
      provider.saveDraft({
        collection: articles.slug,
        id: document.id,
        expectedVersion: document.version,
        data: { title: "Reject" },
        actorId: "editor",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      provider.getDraft({ collection: articles.slug, id: document.id }),
    ).resolves.toMatchObject({ version: 1, data: { title: "Hello!" } });

    document = await provider.saveDraft({
      collection: articles.slug,
      id: document.id,
      expectedVersion: document.version,
      data: { title: "Second" },
      actorId: "editor",
    });
    const first = await provider.publish({
      collection: articles.slug,
      id: document.id,
      expectedVersion: document.version,
      actorId: "publisher",
    });
    document = await provider.saveDraft({
      collection: articles.slug,
      id: document.id,
      expectedVersion: first.document.version,
      data: { title: "Third" },
      actorId: "editor",
    });
    const second = await provider.publish({
      collection: articles.slug,
      id: document.id,
      expectedVersion: document.version,
      actorId: "publisher",
    });
    document = await provider.restore({
      collection: articles.slug,
      id: document.id,
      expectedVersion: second.document.version,
      revisionId: first.revision.id,
      actorId: "editor",
    });
    document = await provider.unpublish({
      collection: articles.slug,
      id: document.id,
      expectedVersion: document.version,
      actorId: "publisher",
    });
    await provider.delete({
      collection: articles.slug,
      id: document.id,
      expectedVersion: document.version,
      actorId: "owner",
    });

    expect(events).toEqual([
      "validate:create",
      "create",
      "validate:update",
      "update",
      "validate:update",
      "update",
      "validate:publish",
      "publish",
      "validate:update",
      "update",
      "validate:publish",
      "publish",
      "validate:restore",
      "restore",
      "validate:unpublish",
      "unpublish",
      "validate:delete",
      "delete",
    ]);

    const unauthorizedEvents = events.length;
    const authorized = createCloudflareCmsCollectionProvider({
      database: db,
      extensions,
      authorize: ({ action, collection, actorId }) =>
        assertCmsCollectionAccess(
          collection,
          action,
          actorId === "editor" ? ["content.write"] : [],
        ),
    });
    await expect(
      authorized.createDraft({
        collection: articles.slug,
        id: "forbidden",
        data: { title: "Forbidden" },
        actorId: "viewer",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(events).toHaveLength(unauthorizedEvents);
  });

  test("migrates stored collection snapshots through the registered schema", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    const legacy = defineCollection({
      slug: "legacy-records",
      labels: { singular: "Legacy record", plural: "Legacy records" },
      schemaVersion: 2,
      lifecycle: { drafts: true, revisions: true, scheduling: false },
      access: {
        read: [],
        create: ["content.write"],
        update: ["content.write"],
        delete: ["content.delete"],
        publish: ["content.publish"],
      },
      fields: [
        textField({ name: "title", label: "Title", required: true }),
        textField({ name: "summary", label: "Summary", required: true }),
      ],
      migrations: [
        {
          from: 1,
          to: 2,
          migrate: (data) => ({ ...(data as object), summary: "Migrated" }),
        },
      ],
    });
    const provider = createCloudflareCmsCollectionProvider({
      database: db,
      registry: createCollectionRegistry([legacy]),
    });
    await db
      .prepare(
        `INSERT INTO cms_collection_documents (
          collection_slug, id, schema_version, version, status, data,
          updated_by, created_at, updated_at
        ) VALUES (?, ?, 1, 1, 'draft', ?, '', 0, 0)`,
      )
      .bind(legacy.slug, "legacy-1", JSON.stringify({ title: "Before" }))
      .run();

    await expect(
      provider.getDraft({ collection: legacy.slug, id: "legacy-1" }),
    ).resolves.toMatchObject({
      schemaVersion: 2,
      data: { title: "Before", summary: "Migrated" },
    });
  });

  test("passes versioned global settings and navigation conformance", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    let sequence = 0;
    const provider = createCloudflareCmsGlobalContentProvider({
      database: db,
      parseContent(value) {
        const content = value as { label?: unknown; links?: unknown };
        if (
          typeof content?.label !== "string" ||
          !Array.isArray(content.links) ||
          !content.links.every((link) => typeof link === "string")
        )
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: "Invalid global test content.",
            retryable: false,
          });
        return { label: content.label, links: content.links as string[] };
      },
      createId: () => `global-revision-${++sequence}`,
      now: () => new Date(`2026-08-16T00:00:0${sequence}.000Z`),
    });

    await expect(
      runGlobalContentProviderConformance({
        provider,
        key: "navigation:header",
        initial: { label: "Primary", links: ["/"] },
        changed: { label: "Primary", links: ["/", "/journal"] },
      }),
    ).resolves.toEqual({
      create: true,
      optimisticConflict: true,
      revisionHistory: true,
      restore: true,
      update: true,
    });
  });

  test("passes the runtime draft/publish/conflict/restore conformance suite", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    let sequence = 0;
    const provider = createCloudflareCmsPageProvider({
      database: db,
      parseContent,
      createId: () => `provider-id-${++sequence}`,
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    });

    await expect(
      runPageProviderConformance({
        provider,
        initial: content("Initial", "Hero and FAQ v1"),
        changed: content("Changed", "Edited working draft"),
      }),
    ).resolves.toEqual({
      delete: true,
      draftIsolation: true,
      optimisticConflict: true,
      publish: true,
      revisionRestore: true,
      scheduling: true,
      unpublish: true,
    });
  });

  test("passes the version-bound editorial review conformance suite", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    let sequence = 0;
    const provider = createCloudflareCmsPageProvider({
      database: db,
      parseContent,
      createId: () => `review-id-${++sequence}`,
      now: () =>
        new Date(`2026-08-17T00:00:${String(sequence).padStart(2, "0")}.000Z`),
    });
    let document = await provider.createDraft({
      id: "review-conformance",
      content: content("Review v1", "Initial review copy"),
      actorId: "editor-conformance",
    });

    await expect(
      runEditorialReviewProviderConformance({
        workflow: provider.reviews,
        target: { documentId: document.id, documentType: "page" },
        advanceDocument: async () => {
          document = await provider.saveDraft({
            id: document.id,
            expectedVersion: document.version,
            content: content(
              `Review v${document.version + 1}`,
              `Working copy ${document.version + 1}`,
            ),
            actorId: "editor-conformance",
          });
          return document;
        },
        publishDocument: async () => {
          const published = await provider.publish({
            id: document.id,
            expectedVersion: document.version,
            actorId: "reviewer-conformance",
          });
          document = published.document;
          return document;
        },
      }),
    ).resolves.toEqual({
      approvalResolution: true,
      decisionValidation: true,
      idempotentRequest: true,
      pendingQueue: true,
      staleProtection: true,
      versionBound: true,
    });
  });

  test("keeps legacy storage codecs and mutation statements inside each D1 batch", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    await db.exec(`
      CREATE TABLE provider_audit (
        action TEXT NOT NULL,
        document_id TEXT NOT NULL,
        version INTEGER NOT NULL
      );
    `);
    let sequence = 0;
    const provider = createCloudflareCmsPageProvider({
      database: db,
      parseContent: parseEncodedContent,
      encodeBlocks,
      encodeRevision,
      createId: () => `codec-id-${++sequence}`,
      now: () => new Date("2026-08-16T00:00:00.000Z"),
      prepareMutationStatements: (event) =>
        db
          .prepare(
            "INSERT INTO provider_audit (action, document_id, version) VALUES (?, ?, ?)",
          )
          .bind(event.action, event.documentId, event.version),
    });

    await runPageProviderConformance({
      provider,
      initial: content("Codec initial", "Legacy row v1"),
      changed: content("Codec changed", "Legacy row v2"),
    });

    const page = await db
      .prepare("SELECT blocks FROM pages WHERE id = ?")
      .bind("conformance-home")
      .first<{ blocks: string }>();
    const revision = await db
      .prepare("SELECT snapshot FROM page_revisions ORDER BY version LIMIT 1")
      .first<{ snapshot: string }>();
    const audit = await db
      .prepare("SELECT action FROM provider_audit ORDER BY rowid")
      .all<{ action: string }>();

    expect(JSON.parse(page!.blocks)[0]).toEqual({
      id: "intro",
      type: "text",
      enabled: true,
      text: "Legacy row v2",
    });
    expect(JSON.parse(revision!.snapshot)).toMatchObject({
      seoTitle: "Codec initial",
      blocks: [{ text: "Legacy row v1" }],
    });
    expect(JSON.parse(revision!.snapshot)).not.toHaveProperty("seo");
    expect(audit.results.map(({ action }) => action)).toEqual([
      "create",
      "schedule",
      "unschedule",
      "publish",
      "save",
      "schedule",
      "publish",
      "restore",
      "unpublish",
      "save",
      "publish",
      "create",
      "delete",
    ]);
  });

  test("rejects schedules that are not in the future", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    const provider = createCloudflareCmsPageProvider({
      database: db,
      parseContent,
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    });
    const created = await provider.createDraft({
      id: "past-schedule",
      content: content("Past", "Past schedule"),
      actorId: "owner-1",
    });

    await expect(
      provider.schedule({
        id: created.id,
        expectedVersion: created.version,
        scheduledAt: "2026-08-15T00:00:00.000Z",
        actorId: "owner-1",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  test("maps unique slugs and stale lifecycle commands to portable conflicts", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    const provider = createCloudflareCmsPageProvider({
      database: db,
      parseContent,
    });
    const created = await provider.createDraft({
      id: "portable-conflict",
      content: content("First", "First"),
      actorId: "owner-1",
    });

    await expect(
      provider.createDraft({
        id: "duplicate-slug",
        content: content("Duplicate", "Duplicate"),
        actorId: "owner-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const changed = await provider.saveDraft({
      id: created.id,
      expectedVersion: created.version,
      content: content("Changed", "Changed"),
      actorId: "owner-1",
    });
    await expect(
      provider.delete({
        id: created.id,
        expectedVersion: created.version,
        actorId: "owner-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      provider.delete({
        id: created.id,
        expectedVersion: changed.version,
        actorId: "owner-1",
      }),
    ).resolves.toMatchObject({ id: created.id });
  });

  test("rolls back a page save when an application mutation statement conflicts", async () => {
    const db = database();
    await applyCloudflareCmsMigrations(db);
    await db.exec(`
      CREATE TABLE provider_redirects (
        old_path TEXT NOT NULL UNIQUE,
        new_path TEXT NOT NULL
      );
      INSERT INTO provider_redirects (old_path, new_path)
      VALUES ('/old', '/existing');
    `);
    const provider = createCloudflareCmsPageProvider({
      database: db,
      parseContent,
      prepareMutationStatements: (event) =>
        event.action === "save"
          ? db
              .prepare(
                "INSERT INTO provider_redirects (old_path, new_path) VALUES (?, ?)",
              )
              .bind("/old", "/new")
          : null,
    });
    const created = await provider.createDraft({
      id: "atomic-page-redirect",
      content: content("Before", "Before"),
      actorId: "owner-1",
    });

    await expect(
      provider.saveDraft({
        id: created.id,
        expectedVersion: created.version,
        content: content("After", "After"),
        actorId: "owner-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(provider.getDraft({ id: created.id })).resolves.toMatchObject({
      version: created.version,
      content: { title: "Before" },
    });
  });

  test("passes the same conformance suite on an isolated Miniflare D1 binding", async () => {
    const miniflare = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script:
          'export default { fetch() { return new Response("cms-provider-test") } }',
        d1Databases: { DB: "cms-provider-test" },
      }),
    );

    try {
      const db = (await miniflare.getD1Database(
        "DB",
      )) as unknown as CloudflareD1Database;
      await applyCloudflareCmsMigrations(db);
      let sequence = 0;
      const provider = createCloudflareCmsPageProvider({
        database: db,
        parseContent,
        createId: () => `miniflare-id-${++sequence}`,
        now: () => new Date("2026-08-16T00:00:00.000Z"),
      });

      await expect(
        runPageProviderConformance({
          provider,
          initial: content("D1 initial", "Hero and FAQ v1"),
          changed: content("D1 changed", "Edited working draft"),
        }),
      ).resolves.toEqual({
        delete: true,
        draftIsolation: true,
        optimisticConflict: true,
        publish: true,
        revisionRestore: true,
        scheduling: true,
        unpublish: true,
      });
    } finally {
      await miniflare.dispose();
    }
  });
});
