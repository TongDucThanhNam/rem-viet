import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as governanceSchema from "@rem-viet/db/schema/governance";
import { drizzle } from "drizzle-orm/bun-sqlite";

mock.module("cloudflare:workers", () => ({
  env: {
    ADMIN_EMAILS: "owner@example.com",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
  },
}));

const {
  apiKeyScopeSchema,
  authenticateCmsApiKey,
  createServiceAccountWithKey,
  hashCmsApiKeyToken,
  listServiceAccounts,
  parseCmsApiKeyToken,
  revokeApiKey,
  rotateApiKey,
} = await import("../src/services/api-keys");
type CmsApiKeyRuntime = import("../src/services/api-keys").CmsApiKeyRuntime;

const sqlite = new Database(":memory:");
sqlite.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE service_accounts (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    description text DEFAULT '' NOT NULL,
    created_by text DEFAULT '' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    revoked_at integer
  );
  CREATE TABLE cms_api_keys (
    id text PRIMARY KEY NOT NULL,
    service_account_id text NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
    label text NOT NULL,
    public_id text NOT NULL UNIQUE,
    secret_hash text NOT NULL,
    scopes text NOT NULL,
    expires_at integer NOT NULL,
    last_used_at integer,
    created_by text DEFAULT '' NOT NULL,
    created_at integer NOT NULL,
    revoked_at integer,
    rotated_from_key_id text
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
const database = drizzle(sqlite, { schema: governanceSchema });
Object.assign(database, {
  batch: async (queries: PromiseLike<unknown>[]) => {
    const results = [];
    for (const query of queries) results.push(await query);
    return results;
  },
});
const runtime = {
  db: database as unknown as CmsApiKeyRuntime["db"],
} satisfies CmsApiKeyRuntime;
const actor = {
  userId: "owner-1",
  email: "owner@example.com",
  role: "owner" as const,
  requestId: "request-1",
};

describe("CMS API key material", () => {
  const token = `cmsk_${"a".repeat(16)}_${"b".repeat(64)}`;

  test("parses only the versioned high-entropy token shape", () => {
    expect(parseCmsApiKeyToken(token)).toEqual({
      publicId: "a".repeat(16),
      secret: "b".repeat(64),
    });
    expect(parseCmsApiKeyToken(`Bearer ${token}`)).toBeNull();
    expect(parseCmsApiKeyToken("cmsk_short_secret")).toBeNull();
    expect(parseCmsApiKeyToken(`${token}suffix`)).toBeNull();
  });

  test("stores a deterministic digest rather than plaintext", async () => {
    const digest = await hashCmsApiKeyToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
    expect(await hashCmsApiKeyToken(token)).toBe(digest);
    expect(await hashCmsApiKeyToken(`${token.slice(0, -1)}c`)).not.toBe(digest);
  });

  test("normalizes scopes and permanently excludes staff management", () => {
    expect(
      apiKeyScopeSchema.parse([
        "media.manage",
        "content.readDraft",
        "media.manage",
      ]),
    ).toEqual(["content.readDraft", "media.manage"]);
    expect(() => apiKeyScopeSchema.parse(["staff.manage"])).toThrow();
    expect(() => apiKeyScopeSchema.parse([])).toThrow();
  });

  test("creates, authenticates, rotates, revokes, and audits without persisting plaintext", async () => {
    const created = await createServiceAccountWithKey(
      {
        name: "Content sync",
        description: "Integration test",
        keyLabel: "Primary",
        scopes: ["content.readDraft", "content.write"],
        expiresAt: new Date(Date.now() + 60_000),
      },
      actor,
      runtime,
    );
    const stored = sqlite
      .query("select secret_hash, scopes from cms_api_keys where id = ?")
      .get(created.key.id) as { secret_hash: string; scopes: string };
    expect(stored.secret_hash).not.toBe(created.rawKey);
    expect(stored.secret_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.scopes).not.toContain(created.rawKey);

    await expect(
      authenticateCmsApiKey(`Bearer ${created.rawKey}`, runtime),
    ).resolves.toMatchObject({
      apiKeyId: created.key.id,
      serviceAccountName: "Content sync",
      capabilities: ["content.readDraft", "content.write"],
    });
    expect(
      sqlite
        .query("select last_used_at from cms_api_keys where id = ?")
        .get(created.key.id),
    ).toMatchObject({ last_used_at: expect.any(Number) });
    const invalidRawKey = `${created.rawKey.slice(0, -1)}${created.rawKey.endsWith("a") ? "b" : "a"}`;
    await expect(
      authenticateCmsApiKey(`Bearer ${invalidRawKey}`, runtime),
    ).resolves.toBeNull();

    const rotated = await rotateApiKey(
      {
        keyId: created.key.id,
        scopes: ["content.readDraft"],
        expiresAt: new Date(Date.now() + 120_000),
      },
      actor,
      runtime,
    );
    await expect(
      authenticateCmsApiKey(`Bearer ${created.rawKey}`, runtime),
    ).resolves.toBeNull();
    await expect(
      authenticateCmsApiKey(`Bearer ${rotated.rawKey}`, runtime),
    ).resolves.toMatchObject({ capabilities: ["content.readDraft"] });

    await revokeApiKey({ keyId: rotated.key.id }, actor, runtime);
    await expect(
      authenticateCmsApiKey(`Bearer ${rotated.rawKey}`, runtime),
    ).resolves.toBeNull();

    const listed = await listServiceAccounts(runtime);
    expect(JSON.stringify(listed)).not.toContain(created.rawKey);
    expect(JSON.stringify(listed)).not.toContain(rotated.rawKey);
    expect(JSON.stringify(listed)).not.toContain("secretHash");
    const audit = sqlite
      .query(
        "select action, before, after from audit_events order by created_at",
      )
      .all() as Array<{ action: string; before: string; after: string }>;
    expect(audit.map((event) => event.action)).toEqual([
      "service_account.create",
      "service_account.key_rotate",
      "service_account.key_revoke",
    ]);
    expect(JSON.stringify(audit)).not.toContain(created.rawKey);
    expect(JSON.stringify(audit)).not.toContain(rotated.rawKey);
  });

  test("rejects an expired key before scope authorization", async () => {
    const created = await createServiceAccountWithKey(
      {
        name: "Expired sync",
        description: "Expiry test",
        keyLabel: "Short lived",
        scopes: ["content.readDraft"],
        expiresAt: new Date(Date.now() + 60_000),
      },
      actor,
      runtime,
    );
    sqlite.run("update cms_api_keys set expires_at = 0 where id = ?", [
      created.key.id,
    ]);
    await expect(
      authenticateCmsApiKey(`Bearer ${created.rawKey}`, runtime),
    ).resolves.toBeNull();
  });
});
