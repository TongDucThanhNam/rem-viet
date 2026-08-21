import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as automationSchema from "@rem-viet/db/schema/automation";
import * as contentSchema from "@rem-viet/db/schema/content";
import { drizzle } from "drizzle-orm/bun-sqlite";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const { buildCmsCalendarEntries, listCmsCalendar, listCmsCalendarInputSchema } =
  await import("../src/services/calendar");
type CmsCalendarRuntime = import("../src/services/calendar").CmsCalendarRuntime;

function createRuntime() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE pages (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      scheduled_at integer
    );
    CREATE TABLE posts (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      scheduled_at integer
    );
    CREATE TABLE cms_collection_documents (
      collection_slug text NOT NULL,
      id text NOT NULL,
      locale text DEFAULT '' NOT NULL,
      data text NOT NULL,
      scheduled_at integer,
      PRIMARY KEY(collection_slug, id, locale)
    );
    CREATE TABLE cms_releases (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      scheduled_at integer
    );
  `);
  const db = drizzle(sqlite, {
    schema: { ...automationSchema, ...contentSchema },
  });
  const now = new Date("2026-08-04T12:00:00.000Z");
  return {
    runtime: {
      db: db as unknown as CmsCalendarRuntime["db"],
      now: () => now,
      reviewQueue: async () => [
        {
          assigneeIds: ["owner-1"],
          dueAt: "2026-08-02T09:00:00.000Z",
          overdue: true,
          requestedAt: new Date("2026-08-01T08:00:00.000Z"),
          documentType: "page" as const,
          documentId: "page-review",
          title: "Review campaign",
        },
      ],
    } satisfies CmsCalendarRuntime,
    sqlite,
  };
}

describe("CMS operations calendar", () => {
  test("merges scheduled content, releases, and due reviews without projection duplicates", async () => {
    const { runtime, sqlite } = createRuntime();
    sqlite.run("insert into pages (id, title, scheduled_at) values (?, ?, ?)", [
      "page-1",
      "Campaign page",
      Date.parse("2026-08-04T10:00:00.000Z"),
    ]);
    sqlite.run("insert into posts (id, title, scheduled_at) values (?, ?, ?)", [
      "post-outside",
      "September post",
      Date.parse("2026-09-01T00:00:00Z"),
    ]);
    sqlite.run(
      "insert into cms_collection_documents (collection_slug, id, locale, data, scheduled_at) values (?, ?, ?, ?, ?)",
      [
        "campaigns",
        "campaign-1",
        "vi-VN",
        JSON.stringify({ title: "Localized campaign" }),
        Date.parse("2026-08-05T10:00:00.000Z"),
      ],
    );
    sqlite.run(
      "insert into cms_collection_documents (collection_slug, id, locale, data, scheduled_at) values (?, ?, ?, ?, ?)",
      [
        "standard-pages",
        "page-1",
        "",
        JSON.stringify({ title: "Duplicate page projection" }),
        Date.parse("2026-08-04T10:00:00.000Z"),
      ],
    );
    sqlite.run(
      "insert into cms_releases (id, name, status, scheduled_at) values (?, ?, ?, ?)",
      [
        "release-1",
        "Launch bundle",
        "scheduled",
        Date.parse("2026-08-06T10:00:00.000Z"),
      ],
    );

    const entries = await listCmsCalendar(
      {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-09-01T00:00:00.000Z",
      },
      runtime,
    );

    expect(entries.map((entry) => [entry.kind, entry.title])).toEqual([
      ["review_due", "Review campaign"],
      ["content_schedule", "Campaign page"],
      ["content_schedule", "Localized campaign"],
      ["release_schedule", "Launch bundle"],
    ]);
    expect(entries[0]).toMatchObject({ overdue: true });
    expect(entries[1]).toMatchObject({ overdue: true });
    expect(entries[2]).toMatchObject({ locale: "vi-VN", overdue: false });
    expect(entries.some((entry) => entry.title.includes("Duplicate"))).toBe(
      false,
    );
  });

  test("applies kind, half-open range, deterministic order, and limit", () => {
    const entries = buildCmsCalendarEntries(
      [
        {
          id: "release:b",
          kind: "release_schedule",
          startsAt: "2026-08-10T10:00:00.000Z",
          title: "Zulu",
          status: "scheduled",
          entityType: "release",
          entityId: "b",
          collection: null,
          locale: "",
        },
        {
          id: "release:a",
          kind: "release_schedule",
          startsAt: "2026-08-10T10:00:00.000Z",
          title: "Alpha",
          status: "scheduled",
          entityType: "release",
          entityId: "a",
          collection: null,
          locale: "",
        },
        {
          id: "review:outside",
          kind: "review_due",
          startsAt: "2026-09-01T00:00:00.000Z",
          title: "Outside",
          status: "requested",
          entityType: "page",
          entityId: "outside",
          collection: null,
          locale: "",
        },
      ],
      {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-09-01T00:00:00.000Z",
        kinds: ["release_schedule"],
        limit: 1,
      },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("Alpha");
  });

  test("rejects reversed and unbounded calendar windows", () => {
    expect(() =>
      listCmsCalendarInputSchema.parse({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow("Calendar end must be after its start");
    expect(() =>
      listCmsCalendarInputSchema.parse({
        from: "2026-01-01T00:00:00.000Z",
        to: "2027-01-03T00:00:00.000Z",
      }),
    ).toThrow("limited to 366 days");
  });
});
