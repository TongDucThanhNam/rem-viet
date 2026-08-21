import { afterEach, describe, expect, test } from "bun:test";
import {
  runDamProviderConformance,
  runMediaProviderConformance,
} from "@agency/cms-runtime";

import {
  applyCloudflareCmsMigrations,
  createCloudflareCmsMediaProvider,
  type CloudflareR2MediaBucket,
} from "../src";
import { LibsqlD1Database } from "./libsql-d1";

class MemoryMediaBucket implements CloudflareR2MediaBucket {
  readonly objects = new Map<string, unknown>();
  readonly deleted: string[] = [];

  async put(key: string, value: unknown) {
    this.objects.set(key, value);
  }

  async delete(key: string) {
    this.deleted.push(key);
    this.objects.delete(key);
  }
}

const databases: LibsqlD1Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function database() {
  const value = new LibsqlD1Database();
  databases.push(value);
  return value;
}

describe("Cloudflare D1/R2 media provider", () => {
  test("passes DAM v2 folders, deduplication, metadata, variants, delivery, replace, and trash conformance", async () => {
    const db = database();
    const bucket = new MemoryMediaBucket();
    await applyCloudflareCmsMigrations(db);
    const queued: string[] = [];
    const replacements: string[] = [];
    let sequence = 0;
    const provider = createCloudflareCmsMediaProvider({
      database: db,
      bucket,
      createId: () => `dam-generated-${++sequence}`,
      now: () => new Date("2026-08-21T00:00:00.000Z"),
      resolveUsage: (record) =>
        record.id === "dam-primary" ? [{ type: "page", id: "home" }] : [],
      replaceUsage: ({ from, to }) => {
        replacements.push(`${from.id}:${to.id}`);
        return 1;
      },
      enqueueVariant: ({ variant }) => {
        queued.push(variant.id);
      },
      deliveryAdapter: {
        sign: ({ url, expiresAt }) =>
          `${url}?signature=test&expires=${expiresAt.toISOString()}`,
      },
    });

    await expect(runDamProviderConformance({ provider })).resolves.toEqual({
      foldersAndFilters: true,
      duplicateDetection: true,
      metadataAndFocalPoint: true,
      privateDelivery: true,
      asyncVariants: true,
      trashRestoreRetention: true,
      usageAndReplace: true,
    });
    expect(queued).toEqual(["dam-generated-1"]);
    expect(replacements).toEqual(["dam-primary:dam-replacement"]);
    expect(bucket.objects.has("media/dam-primary.png")).toBe(true);
    expect(bucket.objects.has("media/dam-duplicate.png")).toBe(false);
    expect(bucket.objects.has("media/dam-replacement.png")).toBe(false);
  });

  test("passes upload, metadata, usage, and safe-delete conformance", async () => {
    const db = database();
    const bucket = new MemoryMediaBucket();
    await applyCloudflareCmsMigrations(db);
    await db.exec("CREATE TABLE media_audit (action TEXT NOT NULL)");
    const provider = createCloudflareCmsMediaProvider({
      database: db,
      bucket,
      now: () => new Date("2026-08-16T00:00:00.000Z"),
      resolveUsage: (record) =>
        record.id === "conformance-media" ? [{ type: "page", id: "home" }] : [],
      prepareMutationStatements: (event) =>
        db
          .prepare("INSERT INTO media_audit (action) VALUES (?)")
          .bind(event.action),
    });

    await expect(runMediaProviderConformance({ provider })).resolves.toEqual({
      objectLifecycle: true,
      metadata: true,
      usage: true,
      safeDelete: true,
    });
    expect(bucket.objects.size).toBe(0);
    expect(bucket.deleted).toEqual(["media/conformance.png"]);
    const audit = await db
      .prepare("SELECT action FROM media_audit ORDER BY rowid")
      .all<{ action: string }>();
    expect(audit.results.map(({ action }) => action)).toEqual([
      "upload",
      "update",
      "forceDelete",
    ]);
  });

  test("removes a newly uploaded R2 object when D1 metadata persistence fails", async () => {
    const db = database();
    const bucket = new MemoryMediaBucket();
    await applyCloudflareCmsMigrations(db);
    const provider = createCloudflareCmsMediaProvider({ database: db, bucket });
    await provider.upload({
      id: "duplicate-id",
      key: "media/first.png",
      url: "/api/media/media/first.png",
      size: 1,
      mimeType: "image/png",
      body: new Uint8Array([1]),
      actorId: "owner-1",
    });

    await expect(
      provider.upload({
        id: "duplicate-id",
        key: "media/rollback.png",
        url: "/api/media/media/rollback.png",
        size: 1,
        mimeType: "image/png",
        body: new Uint8Array([2]),
        actorId: "owner-1",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(bucket.objects.has("media/first.png")).toBe(true);
    expect(bucket.objects.has("media/rollback.png")).toBe(false);
  });
});
