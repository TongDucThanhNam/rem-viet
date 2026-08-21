import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as automationSchema from "@rem-viet/db/schema/automation";
import * as governanceSchema from "@rem-viet/db/schema/governance";
import { drizzle } from "drizzle-orm/bun-sqlite";

mock.module("cloudflare:workers", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CMS_WEBHOOK_ALLOWED_HOSTS: "hooks.example.com",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const { dispatchCmsOutboxEvents } = await import("../src/services/outbox");
const {
  createWebhookEndpoint,
  deliverDueCmsWebhooks,
  listWebhookDeliveries,
  listWebhookEndpoints,
  replayWebhookDelivery,
  rotateWebhookSecret,
  signCmsWebhookPayload,
  validateCmsWebhookUrl,
} = await import("../src/services/webhooks");
type CmsWebhookRuntime = import("../src/services/webhooks").CmsWebhookRuntime;

const actor = {
  userId: "owner-1",
  email: "owner@example.com",
  role: "owner" as const,
  requestId: "request-1",
};

function createRuntime(fetchImplementation?: typeof fetch) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
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
    CREATE TABLE cms_webhook_endpoints (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      url text NOT NULL,
      topics text NOT NULL,
      secret_ciphertext text NOT NULL,
      previous_secret_ciphertext text,
      previous_secret_valid_until integer,
      active integer DEFAULT true NOT NULL,
      created_by text DEFAULT '' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      revoked_at integer
    );
    CREATE TABLE cms_webhook_deliveries (
      id text PRIMARY KEY NOT NULL,
      endpoint_id text NOT NULL REFERENCES cms_webhook_endpoints(id) ON DELETE CASCADE,
      event_id text NOT NULL REFERENCES cms_outbox_events(id) ON DELETE CASCADE,
      dedupe_key text NOT NULL UNIQUE,
      status text DEFAULT 'pending' NOT NULL,
      attempt integer DEFAULT 0 NOT NULL,
      max_attempts integer DEFAULT 8 NOT NULL,
      payload_hash text DEFAULT '' NOT NULL,
      http_status integer,
      response_snippet text DEFAULT '' NOT NULL,
      last_error text DEFAULT '' NOT NULL,
      next_attempt_at integer NOT NULL,
      locked_until integer,
      lock_token text,
      delivered_at integer,
      replay_of_delivery_id text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
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
  const runtime = {
    db: database as unknown as CmsWebhookRuntime["db"],
    now: () => now,
    random: () => 0.5,
    fetch: fetchImplementation,
    values: {
      BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
      CMS_WEBHOOK_ALLOWED_HOSTS: "hooks.example.com",
    },
  } satisfies CmsWebhookRuntime;
  return {
    runtime,
    setNow(value: Date) {
      now = value;
    },
    sqlite,
  };
}

function insertPublishEvent(sqlite: Database, now: Date, id = "event-1") {
  sqlite.run(
    `insert into cms_outbox_events (
      id, topic, aggregate_type, aggregate_id, aggregate_version, payload,
      idempotency_key, status, attempts, max_attempts, available_at,
      occurred_at, retention_until
    ) values (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 8, ?, ?, ?)`,
    [
      id,
      "content.page.published",
      "page",
      "page-1",
      3,
      JSON.stringify({ documentId: "page-1", version: 3 }),
      `content.page.published:page-1:v3:${id}`,
      now.getTime(),
      now.getTime(),
      now.getTime() + 90 * 24 * 60 * 60 * 1000,
    ],
  );
}

describe("CMS webhook security and delivery", () => {
  test("grants one claim to concurrent outbox and delivery workers", async () => {
    let requests = 0;
    const fakeFetch = (async () => {
      requests += 1;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const { runtime, sqlite } = createRuntime(fakeFetch);
    await createWebhookEndpoint(
      {
        name: "Concurrent sink",
        url: "https://hooks.example.com/cms",
        topics: ["*"],
      },
      actor,
      runtime,
    );
    insertPublishEvent(sqlite, runtime.now!());

    const dispatches = await Promise.all([
      dispatchCmsOutboxEvents(runtime.now!(), 10, runtime),
      dispatchCmsOutboxEvents(runtime.now!(), 10, runtime),
    ]);
    expect(dispatches.reduce((sum, item) => sum + item.processed, 0)).toBe(1);
    expect(
      sqlite
        .query("select count(*) as count from cms_webhook_deliveries")
        .get(),
    ).toEqual({ count: 1 });

    const deliveries = await Promise.all([
      deliverDueCmsWebhooks(runtime.now!(), 10, runtime),
      deliverDueCmsWebhooks(runtime.now!(), 10, runtime),
    ]);
    expect(deliveries.reduce((sum, item) => sum + item.processed, 0)).toBe(1);
    expect(requests).toBe(1);
  });

  test("requires an exact allowlisted public HTTPS origin", () => {
    const values = { CMS_WEBHOOK_ALLOWED_HOSTS: "hooks.example.com" };
    expect(validateCmsWebhookUrl("https://hooks.example.com/cms", values)).toBe(
      "https://hooks.example.com/cms",
    );
    for (const value of [
      "http://hooks.example.com/cms",
      "https://localhost/cms",
      "https://127.0.0.1/cms",
      "https://10.0.0.2/cms",
      "https://[::1]/cms",
      "https://evil.example.com/cms",
      "https://hooks.example.com:444/cms",
      "https://hooks.example.com.evil.test/cms",
    ]) {
      expect(() => validateCmsWebhookUrl(value, values)).toThrow();
    }
  });

  test("encrypts secrets, rotates with a bounded overlap, and never lists key material", async () => {
    const { runtime, sqlite } = createRuntime();
    const created = await createWebhookEndpoint(
      {
        name: "Publishing sink",
        url: "https://hooks.example.com/cms",
        topics: ["content.page.published"],
      },
      actor,
      runtime,
    );
    const stored = sqlite
      .query("select secret_ciphertext from cms_webhook_endpoints where id = ?")
      .get(created.endpoint.id) as { secret_ciphertext: string };
    expect(created.secret).toMatch(/^whsec_[a-f0-9]{64}$/);
    expect(stored.secret_ciphertext).toStartWith("v1.");
    expect(stored.secret_ciphertext).not.toContain(created.secret);

    const rotated = await rotateWebhookSecret(
      { endpointId: created.endpoint.id },
      actor,
      runtime,
    );
    const afterRotation = sqlite
      .query(
        "select secret_ciphertext, previous_secret_ciphertext, previous_secret_valid_until from cms_webhook_endpoints where id = ?",
      )
      .get(created.endpoint.id) as Record<string, string | number>;
    expect(rotated.secret).not.toBe(created.secret);
    expect(afterRotation.previous_secret_ciphertext).toBe(
      stored.secret_ciphertext,
    );
    expect(afterRotation.previous_secret_valid_until).toBe(
      rotated.previousSecretValidUntil.getTime(),
    );
    const listed = JSON.stringify(await listWebhookEndpoints(runtime));
    expect(listed).not.toContain(created.secret);
    expect(listed).not.toContain(rotated.secret);
    expect(listed).not.toContain("Ciphertext");
    const audit = JSON.stringify(
      sqlite.query("select * from audit_events").all(),
    );
    expect(audit).not.toContain(created.secret);
    expect(audit).not.toContain(rotated.secret);
  });

  test("fans out once and signs a verifiable idempotent request", async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return new Response("accepted", { status: 202 });
    }) as typeof fetch;
    const { runtime, sqlite } = createRuntime(fakeFetch);
    const endpoint = await createWebhookEndpoint(
      {
        name: "Publishing sink",
        url: "https://hooks.example.com/cms",
        topics: ["content.page.published"],
      },
      actor,
      runtime,
    );
    insertPublishEvent(sqlite, runtime.now!());

    expect(
      await dispatchCmsOutboxEvents(runtime.now!(), 10, runtime),
    ).toMatchObject({ processed: 1, dispatched: 1, deliveries: 1 });
    expect(
      await dispatchCmsOutboxEvents(runtime.now!(), 10, runtime),
    ).toMatchObject({ processed: 0, deliveries: 0 });
    expect(
      sqlite
        .query("select count(*) as count from cms_webhook_deliveries")
        .get(),
    ).toEqual({ count: 1 });

    expect(
      await deliverDueCmsWebhooks(runtime.now!(), 10, runtime),
    ).toMatchObject({ processed: 1, delivered: 1 });
    expect(captured?.url).toBe("https://hooks.example.com/cms");
    const headers = new Headers(captured?.init?.headers);
    const body = String(captured?.init?.body);
    const timestamp = Number(headers.get("X-CMS-Timestamp"));
    const deliveryId = headers.get("X-CMS-Delivery")!;
    expect(headers.get("Idempotency-Key")).toContain("event-1:original");
    expect(headers.get("X-CMS-Event")).toBe("content.page.published");
    expect(headers.get("X-CMS-Signature")).toBe(
      await signCmsWebhookPayload({
        secret: endpoint.secret,
        timestamp,
        deliveryId,
        body,
      }),
    );
    expect(JSON.parse(body)).toMatchObject({
      schemaVersion: 1,
      id: "event-1",
      aggregate: { type: "page", id: "page-1", version: 3 },
    });
  });

  test("reclaims expired delivery leases and dead-letters bounded redacted failures", async () => {
    const fakeFetch = (async () =>
      new Response("sk_abcdefghijklmnopqrstuvwxyz123456 owner@example.com", {
        status: 500,
      })) as typeof fetch;
    const { runtime, setNow, sqlite } = createRuntime(fakeFetch);
    await createWebhookEndpoint(
      {
        name: "Failing sink",
        url: "https://hooks.example.com/cms",
        topics: ["*"],
      },
      actor,
      runtime,
    );
    insertPublishEvent(sqlite, runtime.now!());
    await dispatchCmsOutboxEvents(runtime.now!(), 10, runtime);
    sqlite.run(
      "update cms_webhook_deliveries set status = 'delivering', max_attempts = 2, locked_until = ?",
      [runtime.now!().getTime() - 1],
    );

    expect(
      await deliverDueCmsWebhooks(runtime.now!(), 10, runtime),
    ).toMatchObject({ processed: 1, failed: 1 });
    setNow(new Date(runtime.now!().getTime() + 1_000));
    expect(
      await deliverDueCmsWebhooks(runtime.now!(), 10, runtime),
    ).toMatchObject({ processed: 1, deadLetter: 1 });
    const stored = sqlite
      .query(
        "select status, attempt, locked_until, response_snippet from cms_webhook_deliveries",
      )
      .get() as Record<string, string | number | null>;
    expect(stored).toMatchObject({
      status: "dead_letter",
      attempt: 2,
      locked_until: null,
    });
    expect(stored.response_snippet).toContain("[redacted-secret]");
    expect(stored.response_snippet).toContain("[redacted-email]");
    expect(stored.response_snippet).not.toContain("owner@example.com");
  });

  test("creates a unique audited manual replay", async () => {
    const { runtime, sqlite } = createRuntime();
    await createWebhookEndpoint(
      {
        name: "Replay sink",
        url: "https://hooks.example.com/cms",
        topics: ["*"],
      },
      actor,
      runtime,
    );
    insertPublishEvent(sqlite, runtime.now!());
    await dispatchCmsOutboxEvents(runtime.now!(), 10, runtime);
    const [original] = await listWebhookDeliveries(10, runtime);
    const replay = await replayWebhookDelivery(
      { deliveryId: original!.delivery.id },
      actor,
      runtime,
    );

    expect(replay.deliveryId).not.toBe(original!.delivery.id);
    expect(await listWebhookDeliveries(10, runtime)).toHaveLength(2);
    expect(
      sqlite
        .query(
          "select action from audit_events where action = 'webhook.delivery_replay'",
        )
        .get(),
    ).toEqual({ action: "webhook.delivery_replay" });
  });
});
