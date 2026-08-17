import { afterEach, describe, expect, mock, test } from "bun:test";
import { applyCloudflareCmsMigrations } from "@agency/cms-provider-cloudflare";

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
  `);
  return value;
}

function page(title: string, slug: string) {
  return {
    title,
    slug,
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
      content: { title: "New page", slug: "new-page" },
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
        `SELECT slug, title, blocks, version, published_revision_id AS revisionId,
          scheduled_at AS scheduledAt FROM pages WHERE id = ?`,
      )
      .bind(created.id)
      .first<{
        slug: string;
        title: string;
        blocks: string;
        version: number;
        revisionId: string | null;
        scheduledAt: number | null;
      }>();
    expect(legacy).toMatchObject({
      slug: "new-page",
      title: "New page",
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
