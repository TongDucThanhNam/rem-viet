import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { applyCloudflareCmsMigrations } from "@agency/cms-provider-cloudflare";
import type { CmsCollectionProvider } from "@agency/cms-runtime";
import { REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION } from "@agency/cms-template-rem-viet";
import * as automationSchema from "@rem-viet/db/schema/automation";
import * as contentSchema from "@rem-viet/db/schema/content";
import * as governanceSchema from "@rem-viet/db/schema/governance";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";

import { LibsqlD1Database } from "../../cms-provider-cloudflare/tests/libsql-d1";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const { clearCmsTaskRegistryForTests, runDueCmsJobs } =
  await import("../src/services/jobs");
const {
  createCmsRelease,
  createCmsReleaseInputSchema,
  executeCmsRelease,
  getCmsRelease,
  previewCmsRelease,
  scheduleCmsRelease,
} = await import("../src/services/releases");
const { createRemVietCollectionProviderForDatabase } =
  await import("../src/services/standard-page-runtime");
type CmsReleaseDocumentAdapter =
  import("../src/services/releases").CmsReleaseDocumentAdapter;
type CmsReleaseDocumentSnapshot =
  import("../src/services/releases").CmsReleaseDocumentSnapshot;
type CmsReleaseRuntime = import("../src/services/releases").CmsReleaseRuntime;

const actor = {
  userId: "owner-1",
  email: "owner@example.com",
  role: "owner" as const,
  requestId: "request-1",
};

const collectionDatabases: LibsqlD1Database[] = [];

afterEach(() => {
  for (const database of collectionDatabases.splice(0)) database.close();
});

function runtimeDocumentKey(item: {
  collection: string;
  documentId: string;
  documentType: string;
  locale: string;
}) {
  return item.documentType === "collection"
    ? `${item.collection}:${item.documentId}:${item.locale || "default"}`
    : item.documentId;
}

function createRuntime(options?: {
  failDocumentId?: string;
  invalidDocumentId?: string;
}) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE cms_job_queues (
      name text PRIMARY KEY NOT NULL,
      concurrency_limit integer DEFAULT 1 NOT NULL,
      paused integer DEFAULT false NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE cms_jobs (
      id text PRIMARY KEY NOT NULL,
      task_name text NOT NULL,
      queue_name text NOT NULL REFERENCES cms_job_queues(name),
      payload text NOT NULL,
      result text,
      workflow_state text,
      idempotency_key text NOT NULL UNIQUE,
      status text DEFAULT 'queued' NOT NULL,
      attempt integer DEFAULT 0 NOT NULL,
      max_attempts integer DEFAULT 5 NOT NULL,
      retry_policy text NOT NULL,
      timeout_ms integer NOT NULL,
      available_at integer NOT NULL,
      started_at integer,
      completed_at integer,
      locked_until integer,
      lock_token text,
      cancel_requested integer DEFAULT false NOT NULL,
      last_error text DEFAULT '' NOT NULL,
      retention_until integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE cms_releases (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      idempotency_key text NOT NULL UNIQUE,
      scheduled_at integer,
      job_id text REFERENCES cms_jobs(id) ON DELETE SET NULL,
      receipt text,
      last_error text DEFAULT '' NOT NULL,
      created_by text DEFAULT '' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      started_at integer,
      completed_at integer
    );
    CREATE TABLE cms_release_items (
      id text PRIMARY KEY NOT NULL,
      release_id text NOT NULL REFERENCES cms_releases(id) ON DELETE CASCADE,
      document_type text NOT NULL,
      collection text DEFAULT '' NOT NULL,
      document_id text NOT NULL,
      locale text DEFAULT '' NOT NULL,
      expected_version integer NOT NULL,
      position integer NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      before_state text,
      after_state text,
      last_error text DEFAULT '' NOT NULL,
      published_at integer,
      rolled_back_at integer,
      UNIQUE(release_id, document_type, collection, document_id, locale)
    );
    CREATE TABLE audit_events (
      id text PRIMARY KEY NOT NULL,
      actor_user_id text DEFAULT '' NOT NULL,
      actor_email text DEFAULT '' NOT NULL,
      actor_role text DEFAULT 'system' NOT NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      before text,
      after text,
      request_id text DEFAULT '' NOT NULL,
      created_at integer NOT NULL
    );
  `);
  const database = drizzle(sqlite, {
    schema: { ...automationSchema, ...governanceSchema },
  });
  Object.assign(database, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      const results = [];
      for (const query of queries) results.push(await query);
      return results;
    },
  });
  let now = new Date("2026-08-21T00:00:00.000Z");
  const documents = new Map<string, CmsReleaseDocumentSnapshot>();
  let publishes = 0;
  let rollbacks = 0;
  const adapter: CmsReleaseDocumentAdapter = {
    async inspect(item) {
      const document = documents.get(runtimeDocumentKey(item));
      if (!document) throw new Error(`Missing ${item.documentId}`);
      return structuredClone(document);
    },
    async validate(item) {
      if (item.documentId === options?.invalidDocumentId) {
        throw new Error("Workflow approval is incomplete");
      }
    },
    async publish(item, marker) {
      if (item.documentId === options?.failDocumentId) {
        throw new Error("Provider failed for owner@example.com");
      }
      publishes += 1;
      const next = {
        version: item.expectedVersion + 1,
        publicationMarker: marker,
        state: { value: `published-${item.documentId}` },
      } satisfies CmsReleaseDocumentSnapshot;
      documents.set(runtimeDocumentKey(item), next);
      return structuredClone(next);
    },
    async rollback(item, before) {
      rollbacks += 1;
      documents.set(runtimeDocumentKey(item), structuredClone(before));
    },
  };
  const runtime = {
    db: database as unknown as CmsReleaseRuntime["db"],
    now: () => now,
    random: () => 0.5,
    documentAdapter: adapter,
  } satisfies CmsReleaseRuntime;
  return {
    documents,
    runtime,
    setNow(value: Date) {
      now = value;
    },
    sqlite,
    effects() {
      return { publishes, rollbacks };
    },
  };
}

async function createCollectionRuntime(options?: { failLocale?: string }) {
  const database = new LibsqlD1Database();
  collectionDatabases.push(database);
  await applyCloudflareCmsMigrations(database);
  await database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE audit_events (
      id text PRIMARY KEY NOT NULL,
      actor_user_id text DEFAULT '' NOT NULL,
      actor_email text DEFAULT '' NOT NULL,
      actor_role text DEFAULT 'system' NOT NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      before text,
      after text,
      request_id text DEFAULT '' NOT NULL,
      created_at integer NOT NULL
    );
    CREATE TABLE cms_outbox_events (
      id text PRIMARY KEY NOT NULL,
      topic text NOT NULL,
      aggregate_type text NOT NULL,
      aggregate_id text NOT NULL,
      aggregate_version integer NOT NULL,
      payload text NOT NULL,
      idempotency_key text NOT NULL UNIQUE,
      status text DEFAULT 'pending' NOT NULL,
      attempts integer DEFAULT 0 NOT NULL,
      max_attempts integer DEFAULT 8 NOT NULL,
      available_at integer NOT NULL,
      locked_until integer,
      last_error text DEFAULT '' NOT NULL,
      occurred_at integer NOT NULL,
      dispatched_at integer,
      retention_until integer NOT NULL
    );
    CREATE TABLE cms_releases (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      idempotency_key text NOT NULL UNIQUE,
      scheduled_at integer,
      job_id text,
      receipt text,
      last_error text DEFAULT '' NOT NULL,
      created_by text DEFAULT '' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      started_at integer,
      completed_at integer
    );
    CREATE TABLE cms_release_items (
      id text PRIMARY KEY NOT NULL,
      release_id text NOT NULL REFERENCES cms_releases(id) ON DELETE CASCADE,
      document_type text NOT NULL,
      collection text DEFAULT '' NOT NULL,
      document_id text NOT NULL,
      locale text DEFAULT '' NOT NULL,
      expected_version integer NOT NULL,
      position integer NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      before_state text,
      after_state text,
      last_error text DEFAULT '' NOT NULL,
      published_at integer,
      rolled_back_at integer,
      UNIQUE(release_id, document_type, collection, document_id, locale)
    );
  `);
  const provider = createRemVietCollectionProviderForDatabase(database);
  const releaseProvider = createRemVietCollectionProviderForDatabase(
    database,
    actor,
  );
  const collectionProvider = options?.failLocale
    ? (new Proxy(releaseProvider, {
        get(target, property, receiver) {
          if (property === "publish") {
            return async (input: Parameters<typeof provider.publish>[0]) => {
              if (input.locale === options.failLocale) {
                throw new Error(`Provider rejected locale ${input.locale}`);
              }
              return target.publish(input);
            };
          }
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as CmsCollectionProvider)
    : releaseProvider;
  const db = drizzleD1(database as unknown as D1Database, {
    schema: { ...automationSchema, ...contentSchema, ...governanceSchema },
  });
  return {
    database,
    provider,
    runtime: {
      db: db as unknown as CmsReleaseRuntime["db"],
      now: () => new Date("2026-08-21T00:00:00.000Z"),
      collectionProvider,
    } satisfies CmsReleaseRuntime,
  };
}

beforeEach(() => clearCmsTaskRegistryForTests());

describe("durable CMS releases", () => {
  test("uses collection, document, and locale as the release identity", () => {
    const collection = REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION;
    const base = {
      documentType: "collection" as const,
      collection,
      documentId: "campaign-1",
      expectedVersion: 1,
    };
    expect(
      createCmsReleaseInputSchema.parse({
        name: "Two locales",
        idempotencyKey: "release-two-locales",
        items: [
          { ...base, locale: "vi-VN" },
          { ...base, locale: "en-US" },
        ],
      }).items,
    ).toHaveLength(2);
    expect(() =>
      createCmsReleaseInputSchema.parse({
        name: "Duplicate locale",
        idempotencyKey: "release-duplicate-locale",
        items: [
          { ...base, locale: "vi-VN" },
          { ...base, locale: "vi-VN" },
        ],
      }),
    ).toThrow("Duplicate release item");
    expect(() =>
      createCmsReleaseInputSchema.parse({
        name: "Wrong standard page path",
        idempotencyKey: "release-standard-page-collection",
        items: [{ ...base, collection: "standard-pages", locale: "" }],
      }),
    ).toThrow("Use the page release type");
  });

  test("creates one atomic release for concurrent idempotent requests", async () => {
    const { runtime, sqlite } = createRuntime();
    const input = {
      name: "Concurrent release",
      idempotencyKey: "release-concurrent-create",
      items: [
        {
          documentType: "page" as const,
          documentId: "page-1",
          expectedVersion: 2,
          locale: null,
        },
      ],
    };

    const [first, second] = await Promise.all([
      createCmsRelease(input, actor, runtime),
      createCmsRelease(input, actor, runtime),
    ]);

    expect(second.id).toBe(first.id);
    expect(
      sqlite.query("select count(*) as count from cms_releases").get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite.query("select count(*) as count from cms_release_items").get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite
        .query(
          "select count(*) as count from audit_events where action = 'cms_release.create'",
        )
        .get(),
    ).toEqual({ count: 1 });

    await expect(
      createCmsRelease(
        { ...input, name: "A different release" },
        actor,
        runtime,
      ),
    ).rejects.toThrow("idempotency key is already bound");
  });

  test("publishes each document exactly once and returns the stored receipt on replay", async () => {
    const { documents, effects, runtime } = createRuntime();
    documents.set("page-1", {
      version: 3,
      publicationMarker: null,
      state: { value: "draft" },
    });
    const release = await createCmsRelease(
      {
        name: "Homepage launch",
        idempotencyKey: "release-homepage-launch",
        items: [
          {
            documentType: "page",
            documentId: "page-1",
            expectedVersion: 3,
            locale: null,
          },
        ],
      },
      actor,
      runtime,
    );

    const first = await executeCmsRelease(release.id, actor, runtime);
    const replay = await executeCmsRelease(release.id, actor, runtime);
    expect(first).toEqual(replay);
    expect(effects()).toEqual({ publishes: 1, rollbacks: 0 });
    expect(await getCmsRelease(release.id, runtime)).toMatchObject({
      status: "published",
      items: [{ status: "published", expectedVersion: 3 }],
    });
  });

  test("publishes two locales of one collection document exactly once", async () => {
    const { database, provider, runtime } = await createCollectionRuntime();
    const collection = REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION;
    const vi = await provider.createDraft({
      collection,
      id: "summer-campaign",
      locale: "vi-VN",
      data: { code: "summer-2026", headline: "Mùa hè thoáng mát" },
      actorId: "editor-1",
    });
    const en = await provider.createDraft({
      collection,
      id: vi.id,
      locale: "en-US",
      data: { code: "ignored", headline: "A breezy summer" },
      actorId: "editor-1",
    });
    const release = await createCmsRelease(
      {
        name: "Localized campaign launch",
        idempotencyKey: "release-localized-campaign",
        items: [
          {
            documentType: "collection",
            collection,
            documentId: vi.id,
            locale: "vi-VN",
            expectedVersion: vi.version,
          },
          {
            documentType: "collection",
            collection,
            documentId: en.id,
            locale: "en-US",
            expectedVersion: en.version,
          },
        ],
      },
      actor,
      runtime,
    );

    await expect(
      previewCmsRelease({ releaseId: release.id }, runtime),
    ).resolves.toMatchObject({
      valid: true,
      items: [
        { collection, locale: "vi-VN", currentVersion: vi.version },
        { collection, locale: "en-US", currentVersion: en.version },
      ],
    });
    const first = await executeCmsRelease(release.id, actor, runtime);
    const replay = await executeCmsRelease(release.id, actor, runtime);

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      status: "published",
      items: [
        { collection, locale: "vi-VN", publishedVersion: vi.version + 1 },
        { collection, locale: "en-US", publishedVersion: en.version + 1 },
      ],
    });
    await expect(
      provider.getPublished({
        collection,
        id: vi.id,
        locale: "vi-VN",
      }),
    ).resolves.toMatchObject({ data: { headline: "Mùa hè thoáng mát" } });
    await expect(
      provider.getPublished({
        collection,
        id: en.id,
        locale: "en-US",
      }),
    ).resolves.toMatchObject({ data: { headline: "A breezy summer" } });
    await expect(
      provider.listRevisions({ collection, id: vi.id, locale: "vi-VN" }),
    ).resolves.toHaveLength(1);
    await expect(
      provider.listRevisions({ collection, id: en.id, locale: "en-US" }),
    ).resolves.toHaveLength(1);
    const outbox = await database
      .prepare(
        `SELECT topic, aggregate_id AS aggregateId, payload
         FROM cms_outbox_events ORDER BY aggregate_id`,
      )
      .all<{ aggregateId: string; payload: string; topic: string }>();
    expect(outbox.results).toHaveLength(2);
    expect(outbox.results.map((event) => event.topic)).toEqual([
      "content.collection.published",
      "content.collection.published",
    ]);
    expect(
      outbox.results.map((event) => JSON.parse(event.payload).locale).sort(),
    ).toEqual(["en-US", "vi-VN"]);
  });

  test("compensates a published locale when a later locale fails", async () => {
    const { database, provider, runtime } = await createCollectionRuntime({
      failLocale: "en-US",
    });
    const collection = REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION;
    const vi = await provider.createDraft({
      collection,
      id: "autumn-campaign",
      locale: "vi-VN",
      data: { code: "autumn-2026", headline: "Thu dịu mát" },
      actorId: "editor-1",
    });
    const en = await provider.createDraft({
      collection,
      id: vi.id,
      locale: "en-US",
      data: { code: "ignored", headline: "A gentle autumn" },
      actorId: "editor-1",
    });
    const release = await createCmsRelease(
      {
        name: "Localized rollback",
        idempotencyKey: "release-localized-rollback",
        items: [
          {
            documentType: "collection",
            collection,
            documentId: vi.id,
            locale: "vi-VN",
            expectedVersion: vi.version,
          },
          {
            documentType: "collection",
            collection,
            documentId: en.id,
            locale: "en-US",
            expectedVersion: en.version,
          },
        ],
      },
      actor,
      runtime,
    );

    await expect(executeCmsRelease(release.id, actor, runtime)).rejects.toThrow(
      "Provider rejected locale en-US",
    );
    await expect(
      provider.getPublished({ collection, id: vi.id, locale: "vi-VN" }),
    ).resolves.toBeNull();
    await expect(
      provider.getDraft({ collection, id: vi.id, locale: "vi-VN" }),
    ).resolves.toMatchObject({ status: "draft", version: vi.version });
    await expect(
      provider.listRevisions({ collection, id: vi.id, locale: "vi-VN" }),
    ).resolves.toHaveLength(0);
    await expect(getCmsRelease(release.id, runtime)).resolves.toMatchObject({
      status: "failed",
      receipt: {
        compensationComplete: true,
        compensation: [{ status: "rolled_back" }],
      },
      items: [{ status: "rolled_back" }, { status: "pending" }],
    });
    await expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM cms_outbox_events")
        .first<{ count: number }>(),
    ).resolves.toEqual({ count: 0 });
  });

  test("fails preflight on an outdated version before publishing anything", async () => {
    const { documents, effects, runtime } = createRuntime();
    documents.set("post-1", {
      version: 5,
      publicationMarker: null,
      state: { value: "newer draft" },
    });
    const release = await createCmsRelease(
      {
        name: "Outdated release",
        idempotencyKey: "release-outdated-version",
        items: [
          {
            documentType: "post",
            documentId: "post-1",
            expectedVersion: 4,
            locale: null,
          },
        ],
      },
      actor,
      runtime,
    );

    await expect(executeCmsRelease(release.id, actor, runtime)).rejects.toThrow(
      "expected version 4, found 5",
    );
    expect(effects()).toEqual({ publishes: 0, rollbacks: 0 });
    expect(await getCmsRelease(release.id, runtime)).toMatchObject({
      status: "failed",
      receipt: { status: "failed", compensationComplete: true },
    });
  });

  test("previews all conflicts and validates every item before any publish", async () => {
    const { documents, effects, runtime } = createRuntime({
      invalidDocumentId: "post-2",
    });
    documents.set("page-1", {
      version: 2,
      publicationMarker: null,
      state: {},
    });
    documents.set("post-2", {
      version: 4,
      publicationMarker: null,
      state: {},
    });
    const release = await createCmsRelease(
      {
        name: "Validated release",
        idempotencyKey: "release-preflight-validation",
        items: [
          {
            documentType: "page",
            documentId: "page-1",
            expectedVersion: 2,
            locale: null,
          },
          {
            documentType: "post",
            documentId: "post-2",
            expectedVersion: 4,
            locale: null,
          },
        ],
      },
      actor,
      runtime,
    );

    expect(
      await previewCmsRelease({ releaseId: release.id }, runtime),
    ).toMatchObject({
      valid: false,
      items: [
        { documentId: "page-1", currentVersion: 2, valid: true },
        {
          documentId: "post-2",
          currentVersion: 4,
          valid: false,
          issue: "Workflow approval is incomplete",
        },
      ],
    });
    await expect(executeCmsRelease(release.id, actor, runtime)).rejects.toThrow(
      "Workflow approval is incomplete",
    );
    expect(effects()).toEqual({ publishes: 0, rollbacks: 0 });
  });

  test("compensates already-published items in reverse after a later failure", async () => {
    const { documents, effects, runtime } = createRuntime({
      failDocumentId: "post-2",
    });
    documents.set("page-1", {
      version: 1,
      publicationMarker: null,
      state: { value: "page-before" },
    });
    documents.set("post-2", {
      version: 7,
      publicationMarker: null,
      state: { value: "post-before" },
    });
    const release = await createCmsRelease(
      {
        name: "Two-document release",
        idempotencyKey: "release-two-document-failure",
        items: [
          {
            documentType: "page",
            documentId: "page-1",
            expectedVersion: 1,
            locale: null,
          },
          {
            documentType: "post",
            documentId: "post-2",
            expectedVersion: 7,
            locale: null,
          },
        ],
      },
      actor,
      runtime,
    );

    await expect(executeCmsRelease(release.id, actor, runtime)).rejects.toThrow(
      "Provider failed for [redacted-email]",
    );
    expect(effects()).toEqual({ publishes: 1, rollbacks: 1 });
    expect(documents.get("page-1")).toMatchObject({
      version: 1,
      state: { value: "page-before" },
    });
    expect(await getCmsRelease(release.id, runtime)).toMatchObject({
      status: "failed",
      receipt: {
        status: "failed",
        compensationComplete: true,
        compensation: [{ status: "rolled_back" }],
      },
      items: [{ status: "rolled_back" }, { status: "pending" }],
    });
  });

  test("scheduling is idempotent and persists one durable job", async () => {
    const { documents, effects, runtime, setNow, sqlite } = createRuntime();
    documents.set("page-1", {
      version: 1,
      publicationMarker: null,
      state: {},
    });
    const release = await createCmsRelease(
      {
        name: "Scheduled release",
        idempotencyKey: "release-scheduled-once",
        items: [
          {
            documentType: "page",
            documentId: "page-1",
            expectedVersion: 1,
            locale: null,
          },
        ],
      },
      actor,
      runtime,
    );
    const scheduledAt = new Date("2026-08-22T00:00:00.000Z");
    const first = await scheduleCmsRelease(
      { releaseId: release.id, scheduledAt },
      actor,
      runtime,
    );
    const duplicate = await scheduleCmsRelease(
      { releaseId: release.id, scheduledAt },
      actor,
      runtime,
    );

    expect(duplicate.jobId).toBe(first.jobId);
    expect(
      sqlite.query("select count(*) as count from cms_jobs").get(),
    ).toEqual({ count: 1 });
    expect(duplicate).toMatchObject({
      status: "scheduled",
      scheduledAt,
    });
    expect(await runDueCmsJobs(runtime.now!(), 10, runtime)).toMatchObject({
      processed: 0,
    });
    setNow(scheduledAt);
    expect(await runDueCmsJobs(runtime.now!(), 10, runtime)).toMatchObject({
      processed: 1,
      succeeded: 1,
    });
    expect(await getCmsRelease(release.id, runtime)).toMatchObject({
      status: "published",
      receipt: { status: "published" },
    });
    expect(effects()).toEqual({ publishes: 1, rollbacks: 0 });
    expect(await runDueCmsJobs(runtime.now!(), 10, runtime)).toMatchObject({
      processed: 0,
    });
    expect(effects()).toEqual({ publishes: 1, rollbacks: 0 });
  });
});
