import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as authSchema from "@rem-viet/db/schema/auth";
import * as automationSchema from "@rem-viet/db/schema/automation";
import * as contentSchema from "@rem-viet/db/schema/content";
import * as governanceSchema from "@rem-viet/db/schema/governance";
import { drizzle } from "drizzle-orm/bun-sqlite";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const {
  createEditorialComment,
  createEditorialCommentInputSchema,
  listEditorialComments,
  replyEditorialComment,
  setEditorialCommentResolved,
} = await import("../src/services/editorial-comments");
type EditorialCommentRuntime =
  import("../src/services/editorial-comments").EditorialCommentRuntime;

const editor = {
  userId: "editor-1",
  email: "editor@example.com",
  role: "editor" as const,
  requestId: "request-editor",
};
const owner = {
  userId: "owner-1",
  email: "owner@example.com",
  role: "owner" as const,
  requestId: "request-owner",
};

let sqlite: Database;
let runtime: EditorialCommentRuntime;
let now: Date;

const operationIds = {
  create: "00000000-0000-4000-8000-000000000001",
  reply: "00000000-0000-4000-8000-000000000002",
  resolve: "00000000-0000-4000-8000-000000000003",
  reopen: "00000000-0000-4000-8000-000000000004",
  afterReopen: "00000000-0000-4000-8000-000000000005",
} as const;

beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      email text NOT NULL UNIQUE
    );
    CREATE TABLE staff_roles (
      user_id text PRIMARY KEY NOT NULL,
      role text NOT NULL
    );
    CREATE TABLE pages (id text PRIMARY KEY NOT NULL);
    CREATE TABLE posts (id text PRIMARY KEY NOT NULL);
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
      lock_token text,
      last_error text DEFAULT '' NOT NULL,
      occurred_at integer NOT NULL,
      dispatched_at integer,
      retention_until integer NOT NULL
    );
  `);
  const migrationUrl = new URL(
    "../../db/src/migrations/0023_previous_leper_queen.sql",
    import.meta.url,
  );
  sqlite.exec(
    (await Bun.file(migrationUrl).text()).replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
  sqlite.exec(`
    INSERT INTO user (id, name, email) VALUES
      ('editor-1', 'Editor One', 'editor@example.com'),
      ('owner-1', 'Owner One', 'owner@example.com');
    INSERT INTO staff_roles (user_id, role) VALUES
      ('editor-1', 'editor'),
      ('owner-1', 'owner');
    INSERT INTO pages (id) VALUES ('page-1');
    INSERT INTO posts (id) VALUES ('post-1');
  `);
  const db = drizzle(sqlite, {
    schema: {
      ...authSchema,
      ...automationSchema,
      ...contentSchema,
      ...governanceSchema,
    },
  });
  Object.assign(db, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      const results = [];
      for (const query of queries) results.push(await query);
      return results;
    },
  });
  now = new Date("2026-08-21T02:00:00.000Z");
  runtime = {
    db: db as unknown as EditorialCommentRuntime["db"],
    now: () => new Date(now),
    createId: () => crypto.randomUUID(),
  };
});

afterEach(() => sqlite.close());

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    documentType: "page" as const,
    documentId: "page-1",
    fieldPath: "blocks.hero.title",
    blockId: "hero-1",
    body: "Please verify the launch promise.",
    mentionIds: ["owner-1"],
    operationId: operationIds.create,
    ...overrides,
  };
}

describe("durable editorial comments", () => {
  test("persists anchored threads with exact retries and content-free notifications", async () => {
    expect(
      createEditorialCommentInputSchema.parse(createInput()),
    ).toMatchObject({
      fieldPath: "blocks.hero.title",
      blockId: "hero-1",
      mentionIds: ["owner-1"],
    });
    expect(() =>
      createEditorialCommentInputSchema.parse(
        createInput({ fieldPath: null, blockId: "hero-1" }),
      ),
    ).toThrow("A block anchor requires a field path");

    const created = await createEditorialComment(
      createInput(),
      editor,
      runtime,
    );
    expect(created).toMatchObject({
      authorId: "editor-1",
      body: "Please verify the launch promise.",
      mentions: ["owner-1"],
      status: "open",
      version: 1,
      target: {
        collection: "page",
        documentId: "page-1",
        fieldPath: "blocks.hero.title",
        blockId: "hero-1",
      },
    });
    expect(
      await createEditorialComment(createInput(), editor, runtime),
    ).toEqual(created);
    await expect(
      createEditorialComment(
        createInput({ body: "A divergent retry" }),
        editor,
        runtime,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const listed = await listEditorialComments(
      { documentType: "page", documentId: "page-1" },
      runtime,
    );
    expect(listed).toHaveLength(1);
    expect(
      await listEditorialComments(
        {
          documentType: "page",
          documentId: "page-1",
          fieldPath: "blocks.hero.title",
          blockId: "hero-1",
        },
        runtime,
      ),
    ).toHaveLength(1);

    const outbox = sqlite
      .query<{ topic: string; payload: string }, []>(
        "select topic, payload from cms_outbox_events",
      )
      .all();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.topic).toBe("content.comment.created");
    expect(JSON.parse(outbox[0]!.payload)).toMatchObject({
      documentId: "page-1",
      notificationRecipientIds: ["owner-1"],
      threadId: created.id,
    });
    expect(outbox[0]!.payload).not.toContain("launch promise");
    expect(sqlite.query("select id from audit_events").all()).toHaveLength(1);
    expect(
      sqlite.query("select operation_id from cms_comment_mutations").all(),
    ).toHaveLength(1);
  });

  test("serializes replies and resolve/reopen transitions with optimistic versions", async () => {
    const created = await createEditorialComment(
      createInput(),
      editor,
      runtime,
    );
    now = new Date("2026-08-21T02:01:00.000Z");
    const replied = await replyEditorialComment(
      {
        threadId: created.id,
        expectedVersion: 1,
        body: "Checked against the approved source.",
        mentionIds: ["editor-1"],
        operationId: operationIds.reply,
      },
      owner,
      runtime,
    );
    expect(replied).toMatchObject({
      status: "open",
      version: 2,
      replies: [
        {
          authorId: "owner-1",
          body: "Checked against the approved source.",
          mentions: ["editor-1"],
        },
      ],
    });
    expect(
      await replyEditorialComment(
        {
          threadId: created.id,
          expectedVersion: 1,
          body: "Checked against the approved source.",
          mentionIds: ["editor-1"],
          operationId: operationIds.reply,
        },
        owner,
        runtime,
      ),
    ).toEqual(replied);
    await expect(
      replyEditorialComment(
        {
          threadId: created.id,
          expectedVersion: 1,
          body: "Stale reply",
          mentionIds: [],
          operationId: operationIds.afterReopen,
        },
        editor,
        runtime,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    now = new Date("2026-08-21T02:02:00.000Z");
    const resolved = await setEditorialCommentResolved(
      {
        threadId: created.id,
        expectedVersion: 2,
        resolved: true,
        operationId: operationIds.resolve,
      },
      owner,
      runtime,
    );
    expect(resolved).toMatchObject({
      status: "resolved",
      resolvedBy: "owner-1",
      version: 3,
    });
    await expect(
      replyEditorialComment(
        {
          threadId: created.id,
          expectedVersion: 3,
          body: "Too late",
          mentionIds: [],
          operationId: operationIds.afterReopen,
        },
        editor,
        runtime,
      ),
    ).rejects.toThrow("Resolved comment threads cannot receive replies");

    now = new Date("2026-08-21T02:03:00.000Z");
    const reopened = await setEditorialCommentResolved(
      {
        threadId: created.id,
        expectedVersion: 3,
        resolved: false,
        operationId: operationIds.reopen,
      },
      owner,
      runtime,
    );
    expect(reopened).toMatchObject({ status: "open", version: 4 });
    expect(sqlite.query("select id from audit_events").all()).toHaveLength(4);
    expect(sqlite.query("select id from cms_outbox_events").all()).toHaveLength(
      4,
    );
    expect(
      sqlite.query("select operation_id from cms_comment_mutations").all(),
    ).toHaveLength(4);
  });

  test("rejects missing documents and inactive mention targets", async () => {
    await expect(
      createEditorialComment(
        createInput({
          documentId: "missing-page",
          operationId: "00000000-0000-4000-8000-000000000010",
        }),
        editor,
        runtime,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createEditorialComment(
        createInput({
          mentionIds: ["inactive-1"],
          operationId: "00000000-0000-4000-8000-000000000011",
        }),
        editor,
        runtime,
      ),
    ).rejects.toThrow("Unknown or inactive comment participant: inactive-1");
    expect(
      sqlite.query("select id from cms_comment_threads").all(),
    ).toHaveLength(0);
  });
});
