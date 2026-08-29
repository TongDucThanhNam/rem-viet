import { afterEach, describe, expect, mock, test } from "bun:test";
import { applyCloudflareCmsMigrations } from "@agency/cms-provider-cloudflare";

import { LibsqlD1Database } from "../../cms-provider-cloudflare/tests/libsql-d1";

const workerBindings: Record<string, unknown> = {};
mock.module("cloudflare:workers", () => ({ env: workerBindings }));

const {
  createReusableContent,
  deleteReusableContent,
  detachReusableStandardPageBlock,
  publishReusableContent,
  reusableContentUsageGraph,
  updateReusableContent,
} = await import("../src/services/reusable-content-runtime");
const {
  createRemVietStandardPage,
  getPublishedRemVietStandardPage,
  publishRemVietStandardPage,
  saveRemVietStandardPageDraft,
} = await import("../src/services/standard-page-runtime");

const databases: LibsqlD1Database[] = [];

afterEach(() => {
  delete workerBindings.DB;
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
  workerBindings.DB = value;
  return value;
}

const actor = {
  userId: "reusable-editor",
  email: "reusable@example.com",
  role: "admin" as const,
  requestId: "reusable-request",
};

const syncedReference = (
  fragmentId: string,
  overrides: Array<
    { op: "set"; path: string; value: string } | { op: "unset"; path: string }
  > = [],
) => ({
  kind: "cms.reusable-reference" as const,
  fragmentId,
  contentType: "standard-page-block",
  revisionId: null,
  overrides,
});

describe("Rèm Việt reusable-content integration", () => {
  test("syncs published blocks, supports local override/detach, graphs usage, and restricts delete", async () => {
    await database();
    const fragment = await createReusableContent(
      {
        title: "Shared contact CTA",
        key: "shared-contact-cta",
        description: "Used by standard pages",
        status: "published",
        value: {
          id: "shared-source",
          type: "cta",
          title: "Contact us",
          href: "/contact",
        },
      },
      actor,
    );
    const page = await createRemVietStandardPage(
      {
        title: "Reusable page",
        slug: "reusable-page",
        folder: "",
        template: "standard",
        blocks: [
          {
            id: "page-local-cta",
            type: "reusableContent",
            reference: syncedReference(fragment.id),
          },
        ],
        status: "draft",
        seoTitle: "",
        seoDescription: "",
        canonicalUrl: "",
        ogImage: "",
        robotsIndex: true,
        robotsFollow: true,
      },
      actor,
    );
    const publishedPage = await publishRemVietStandardPage(
      { pageId: page.id, expectedVersion: page.version },
      actor,
    );

    expect(
      (await getPublishedRemVietStandardPage("reusable-page"))?.blocks,
    ).toEqual([
      {
        id: "page-local-cta",
        type: "cta",
        title: "Contact us",
        href: "/contact",
      },
    ]);

    const savedFragment = await updateReusableContent(
      {
        fragmentId: fragment.id,
        expectedVersion: fragment.version,
        value: {
          id: "shared-source",
          type: "cta",
          title: "Talk to an expert",
          href: "/consultation",
        },
      },
      actor,
    );
    await publishReusableContent(
      {
        fragmentId: fragment.id,
        expectedVersion: savedFragment.version,
        note: "Update shared CTA",
      },
      actor,
    );
    expect(
      (await getPublishedRemVietStandardPage("reusable-page"))?.blocks,
    ).toEqual([
      {
        id: "page-local-cta",
        type: "cta",
        title: "Talk to an expert",
        href: "/consultation",
      },
    ]);

    const savedPage = await saveRemVietStandardPageDraft(
      {
        pageId: page.id,
        expectedVersion: publishedPage.version,
        blocks: [
          {
            id: "page-local-cta",
            type: "reusableContent",
            reference: syncedReference(fragment.id, [
              { op: "set", path: "/title", value: "Page-only title" },
            ]),
          },
        ],
      },
      actor,
    );
    await publishRemVietStandardPage(
      { pageId: page.id, expectedVersion: savedPage.version },
      actor,
    );
    expect(
      (await getPublishedRemVietStandardPage("reusable-page"))?.blocks,
    ).toEqual([
      {
        id: "page-local-cta",
        type: "cta",
        title: "Page-only title",
        href: "/consultation",
      },
    ]);

    const detached = await detachReusableStandardPageBlock({
      reference: syncedReference(fragment.id),
      mode: "published",
      blockId: "page-local-cta",
    });
    expect(detached.block).toEqual({
      id: "page-local-cta",
      type: "cta",
      title: "Talk to an expert",
      href: "/consultation",
    });
    expect(detached.detachedFrom).toEqual(
      expect.objectContaining({
        fragmentId: fragment.id,
        contentType: "standard-page-block",
      }),
    );
    const graph = await reusableContentUsageGraph();
    expect(graph.byFragment[fragment.id]).toHaveLength(2);
    expect(
      graph.byFragment[fragment.id]?.map(({ sourceType }) => sourceType).sort(),
    ).toEqual(["standard-page-draft", "standard-page-published"]);
    expect(graph.byFragment[fragment.id]?.[0]).toEqual(
      expect.objectContaining({
        sourceId: page.id,
        path: "/0/reference",
      }),
    );
    await expect(
      deleteReusableContent(
        {
          fragmentId: fragment.id,
          expectedVersion: savedFragment.version + 1,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("rejects page publication while its synced fragment is draft-only", async () => {
    await database();
    const fragment = await createReusableContent(
      {
        title: "Private CTA",
        key: "private-cta",
        description: "",
        status: "draft",
        value: {
          id: "private-source",
          type: "cta",
          title: "Private",
          href: "/private",
        },
      },
      actor,
    );
    const page = await createRemVietStandardPage(
      {
        title: "Blocked reusable page",
        slug: "blocked-reusable-page",
        folder: "",
        template: "standard",
        blocks: [
          {
            id: "private-reference",
            type: "reusableContent",
            reference: syncedReference(fragment.id),
          },
        ],
        status: "draft",
        seoTitle: "",
        seoDescription: "",
        canonicalUrl: "",
        ogImage: "",
        robotsIndex: true,
        robotsFollow: true,
      },
      actor,
    );
    await expect(
      publishRemVietStandardPage(
        { pageId: page.id, expectedVersion: page.version },
        actor,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
