import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  applyCloudflareCmsMigrations,
  createCloudflareCmsCollectionProvider,
} from "@agency/cms-provider-cloudflare";
import { createCmsExtensionRegistry } from "@agency/cms-core";
import {
  createCmsRestResources,
  createCmsServerSdk,
  exportCmsContent,
  importCmsContent,
} from "@agency/cms-runtime";
import {
  remVietLocalizedCampaignsCollection,
  remVietStandardPagesModule,
} from "@agency/cms-template-rem-viet";

import { LibsqlD1Database } from "../../cms-provider-cloudflare/tests/libsql-d1";

mock.module("cloudflare:workers", () => ({ env: {} }));

const {
  createRemVietStandardPageProviderForDatabase,
  encodeRemVietStandardPageRevision,
} = await import("../src/services/standard-page-runtime");

const databases: LibsqlD1Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

async function database() {
  const value = new LibsqlD1Database();
  databases.push(value);
  await applyCloudflareCmsMigrations(value);
  await value.exec(`
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY, actor_user_id TEXT NOT NULL, actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL, before TEXT, after TEXT, request_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE redirects (
      id TEXT PRIMARY KEY, old_path TEXT NOT NULL UNIQUE, new_path TEXT NOT NULL,
      status_code INTEGER NOT NULL, active INTEGER NOT NULL, created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE cms_outbox_events (
      id TEXT PRIMARY KEY, topic TEXT NOT NULL, aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL, aggregate_version INTEGER NOT NULL,
      payload TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL, attempts INTEGER NOT NULL, max_attempts INTEGER NOT NULL,
      available_at INTEGER NOT NULL, locked_until INTEGER, last_error TEXT NOT NULL,
      occurred_at INTEGER NOT NULL, dispatched_at INTEGER, retention_until INTEGER NOT NULL
    );
  `);
  return value;
}

function page(title: string, slug: string) {
  return {
    title,
    slug,
    folder: "campaigns/summer",
    template: "standard" as const,
    blocks: [
      {
        id: "intro",
        type: "richText" as const,
        schemaVersion: 1,
        enabled: true,
        data: { content: "Rèm Việt collection content" },
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

describe("Rèm Việt standard-page collection runtime", () => {
  test("keeps the installed campaign fixture lifecycle independent per locale", async () => {
    const db = await database();
    let sequence = 0;
    const provider = createCloudflareCmsCollectionProvider({
      database: db,
      extensions: createCmsExtensionRegistry({
        modules: [remVietStandardPagesModule],
      }),
      createId: () => `rem-viet-locale-${++sequence}`,
      now: () => new Date("2026-08-18T00:00:00.000Z"),
    });
    const collection = remVietLocalizedCampaignsCollection.slug;
    const sdk = createCmsServerSdk(provider.registry, provider);
    const campaigns = sdk.collection(collection);
    const vi = await campaigns.create({
      id: "summer-campaign",
      locale: "vi-VN",
      data: { code: "summer-2026", headline: "Mùa hè thoáng mát" },
      actorId: "editor",
    });
    const viPublished = await provider.publish({
      collection,
      id: vi.id,
      locale: "vi-VN",
      expectedVersion: vi.version,
      actorId: "publisher",
    });
    let en = await provider.createDraft({
      collection,
      id: vi.id,
      locale: "en-US",
      data: { code: "ignored", headline: "A breezy summer" },
      actorId: "editor",
    });
    expect(en.data).toEqual({
      code: "summer-2026",
      headline: "A breezy summer",
    });
    expect(
      await provider.getPublished({ collection, id: vi.id, locale: "en-US" }),
    ).toBeNull();
    en = await provider.schedule({
      collection,
      id: vi.id,
      locale: "en-US",
      expectedVersion: en.version,
      scheduledAt: "2099-01-01T00:00:00.000Z",
      actorId: "editor",
    });
    const enPublished = await provider.publish({
      collection,
      id: vi.id,
      locale: "en-US",
      expectedVersion: en.version,
      actorId: "publisher",
    });
    await provider.saveDraft({
      collection,
      id: vi.id,
      locale: "en-US",
      expectedVersion: enPublished.document.version,
      data: { code: "ignored-again", headline: "English draft only" },
      actorId: "editor",
    });
    await expect(
      provider.getPublished({ collection, id: vi.id, locale: "vi-VN" }),
    ).resolves.toMatchObject({
      version: viPublished.document.version,
      data: { headline: "Mùa hè thoáng mát" },
    });
    await expect(
      provider.getPublished({ collection, id: vi.id, locale: "en-US" }),
    ).resolves.toMatchObject({ data: { headline: "A breezy summer" } });
    await expect(
      provider.listRevisions({ collection, id: vi.id, locale: "vi-VN" }),
    ).resolves.toHaveLength(1);
    await expect(
      provider.listRevisions({ collection, id: vi.id, locale: "en-US" }),
    ).resolves.toHaveLength(1);

    const rest = createCmsRestResources({
      provider,
      actorFor: () => ({
        actorId: "api-reader",
        capabilities: ["content.readDraft"],
      }),
    });
    const response = await rest.handle(
      new Request(
        `https://rem-viet.test/cms/collections/${collection}/documents/${vi.id}?locale=en-US&view=published`,
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      locale: "en-US",
      data: { headline: "A breezy summer" },
    });

    const bundle = await exportCmsContent({ provider, actorId: "exporter" });
    const targetDb = await database();
    const target = createCloudflareCmsCollectionProvider({
      database: targetDb,
      extensions: createCmsExtensionRegistry({
        modules: [remVietStandardPagesModule],
      }),
      createId: () => `rem-viet-import-${++sequence}`,
    });
    const dryRun = await importCmsContent({
      provider: target,
      bundle,
      actorId: "importer",
      dryRun: true,
    });
    expect(dryRun).toMatchObject({ applied: false, creates: { length: 2 } });
    expect(
      await target.getDraft({ collection, id: vi.id, locale: "vi-VN" }),
    ).toBeNull();
    await expect(
      importCmsContent({ provider: target, bundle, actorId: "importer" }),
    ).resolves.toMatchObject({ applied: true });
    await expect(
      target.getPublished({ collection, id: vi.id, locale: "en-US" }),
    ).resolves.toMatchObject({ data: { headline: "A breezy summer" } });

    const rollbackDb = await database();
    const rollback = createCloudflareCmsCollectionProvider({
      database: rollbackDb,
      extensions: createCmsExtensionRegistry({
        modules: [remVietStandardPagesModule],
      }),
    });
    const invalidBundle = {
      ...bundle,
      documents: bundle.documents.map((document) =>
        document.collection === collection && document.locale === "en-US"
          ? {
              ...document,
              data: Object.fromEntries(
                Object.entries(document.data).filter(
                  ([key]) => key !== "headline",
                ),
              ),
            }
          : document,
      ),
    };
    const rejected = await importCmsContent({
      provider: rollback,
      bundle: invalidBundle,
      actorId: "importer",
    });
    expect(rejected).toMatchObject({
      applied: false,
      validationFailures: { length: 1 },
    });
    expect(
      await rollback.getDraft({ collection, id: vi.id, locale: "vi-VN" }),
    ).toBeNull();
  });

  test("preserves the page lifecycle and legacy editorial projection atomically", async () => {
    const db = await database();
    const actor = {
      userId: "editor-1",
      email: "editor@example.com",
      role: "admin" as const,
      requestId: "request-1",
    };
    const provider = createRemVietStandardPageProviderForDatabase(db, actor, {
      slugRedirect: { oldPath: "/old-page", newPath: "/new-page" },
    });

    const created = await provider.createDraft({
      id: "standard-page-1",
      content: page("Old page", "old-page"),
      actorId: actor.userId,
    });
    const saved = await provider.saveDraft({
      id: created.id,
      expectedVersion: created.version,
      content: page("New page", "new-page"),
      actorId: actor.userId,
    });
    const scheduled = await provider.schedule({
      id: saved.id,
      expectedVersion: saved.version,
      scheduledAt: "2099-01-01T00:00:00.000Z",
      actorId: actor.userId,
      note: "Launch window",
    });
    expect(scheduled.scheduledAt).toBe("2099-01-01T00:00:00.000Z");
    const unscheduled = await provider.unschedule({
      id: scheduled.id,
      expectedVersion: scheduled.version,
      actorId: actor.userId,
    });

    await provider.reviews.requestReview({
      documentType: "page",
      documentId: unscheduled.id,
      expectedVersion: unscheduled.version,
      actorId: "editor-1",
      note: "Ready",
    });
    await provider.reviews.decideReview({
      documentType: "page",
      documentId: unscheduled.id,
      expectedVersion: unscheduled.version,
      actorId: "reviewer-1",
      decision: "approved",
      note: "Approved",
    });
    const published = await provider.publish({
      id: unscheduled.id,
      expectedVersion: unscheduled.version,
      actorId: actor.userId,
      note: "First publication",
    });

    expect(await provider.getPublished({ slug: "new-page" })).toMatchObject({
      id: created.id,
      content: {
        title: "New page",
        slug: "new-page",
        folder: "campaigns/summer",
      },
      publishedRevisionId: published.revision.id,
    });
    expect(await provider.listRevisions(created.id)).toEqual([
      expect.objectContaining({
        id: published.revision.id,
        version: published.document.version,
        note: "First publication",
      }),
    ]);
    expect(
      await provider.reviews.getState({
        documentType: "page",
        documentId: created.id,
      }),
    ).toMatchObject({ status: "approved", published: true, stale: false });

    const legacy = await db
      .prepare(
        `SELECT slug, title, folder, blocks, version, published_revision_id AS revisionId,
          scheduled_at AS scheduledAt FROM pages WHERE id = ?`,
      )
      .bind(created.id)
      .first<{
        slug: string;
        title: string;
        folder: string;
        blocks: string;
        version: number;
        revisionId: string | null;
        scheduledAt: number | null;
      }>();
    expect(legacy).toMatchObject({
      slug: "new-page",
      title: "New page",
      folder: "campaigns/summer",
      version: published.document.version,
      revisionId: published.revision.id,
      scheduledAt: null,
    });
    expect(JSON.parse(legacy!.blocks)).toEqual([
      {
        id: "intro",
        type: "richText",
        content: "Rèm Việt collection content",
      },
    ]);
    const legacyRevision = await db
      .prepare("SELECT snapshot, note FROM page_revisions WHERE id = ?")
      .bind(published.revision.id)
      .first<{ snapshot: string; note: string }>();
    expect(JSON.parse(legacyRevision!.snapshot)).toEqual(
      encodeRemVietStandardPageRevision(published.revision.content),
    );
    expect(legacyRevision?.note).toBe("First publication");
    expect(
      await db.prepare("SELECT old_path, new_path FROM redirects").all(),
    ).toEqual({
      results: [{ old_path: "/old-page", new_path: "/new-page" }],
    });
    expect(
      (
        await db
          .prepare("SELECT action FROM audit_events ORDER BY created_at, rowid")
          .all<{ action: string }>()
      ).results.map(({ action }) => action),
    ).toEqual([
      "page.create",
      "page.update",
      "redirect.create",
      "page.schedule",
      "page.unschedule",
      "page.publish",
    ]);
    expect(
      await db
        .prepare(
          `SELECT topic, aggregate_id AS aggregateId,
            aggregate_version AS aggregateVersion, idempotency_key AS idempotencyKey
          FROM cms_outbox_events`,
        )
        .first(),
    ).toEqual({
      topic: "content.page.published",
      aggregateId: created.id,
      aggregateVersion: published.document.version,
      idempotencyKey: `content.page.published:${created.id}:v${published.document.version}`,
    });

    await expect(
      provider.saveDraft({
        id: published.document.id,
        expectedVersion: published.document.version,
        content: page("Must roll back", "must-roll-back"),
        actorId: actor.userId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await provider.getDraft({ id: published.document.id }),
    ).toMatchObject({
      version: published.document.version,
      content: { title: "New page", slug: "new-page" },
    });

    const deleted = await provider.delete({
      id: published.document.id,
      expectedVersion: published.document.version,
      actorId: actor.userId,
    });
    expect(deleted.id).toBe(created.id);
    expect(await provider.getDraft({ id: created.id })).toBeNull();
    expect(
      await db
        .prepare("SELECT id FROM pages WHERE id = ?")
        .bind(created.id)
        .first(),
    ).toBeNull();
  });
});
