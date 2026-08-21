import { describe, expect, test } from "bun:test";
import {
  runDamProviderConformance,
  runMediaProviderConformance,
} from "@agency/cms-runtime";

import {
  applyPostgresCmsMigrations,
  createPostgresCmsMediaProvider,
  type PostgresCmsClient,
  type PostgresCmsDatabase,
} from "../src";

class MemoryPostgresDamDatabase implements PostgresCmsDatabase {
  readonly statements: Array<Readonly<{ text: string; values: unknown[] }>> =
    [];
  readonly #damState = new Map<string, string>();

  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ) {
    return this.#execute<TRow>(text, values);
  }

  async connect(): Promise<PostgresCmsClient> {
    return {
      query: <TRow extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        values: unknown[] = [],
      ) => this.#execute<TRow>(text, values),
      release() {},
    };
  }

  async #execute<TRow extends Record<string, unknown>>(
    text: string,
    values: unknown[],
  ) {
    this.statements.push({ text, values: [...values] });
    const normalized = text.replace(/\s+/g, " ").trim().toUpperCase();
    if (
      normalized.startsWith("SELECT PAYLOAD") &&
      normalized.includes("AGENCY_CMS_POSTGRES_DAM_STATE")
    ) {
      const payload = this.#damState.get(String(values[0]));
      return { rows: (payload ? [{ payload }] : []) as TRow[] };
    }
    if (normalized.startsWith("INSERT INTO AGENCY_CMS_POSTGRES_DAM_STATE")) {
      if (!this.#damState.has(String(values[0]))) {
        this.#damState.set(String(values[0]), String(values[1]));
      }
    } else if (normalized.startsWith("UPDATE AGENCY_CMS_POSTGRES_DAM_STATE")) {
      this.#damState.set(String(values[2]), String(values[0]));
    }
    return { rows: [] as TRow[] };
  }
}

function createStorage() {
  const objects = new Map<string, unknown>();
  const deleted: string[] = [];
  return {
    objects,
    deleted,
    storage: {
      async put(key: string, value: unknown) {
        objects.set(key, value);
      },
      async delete(key: string) {
        deleted.push(key);
        objects.delete(key);
      },
    },
  };
}

function ids(prefix: string) {
  let value = 0;
  return () => `${prefix}-${++value}`;
}

function clock() {
  let value = Date.parse("2026-08-21T00:00:00.000Z");
  return () => new Date((value += 1_000));
}

describe("PostgreSQL/S3 DAM provider", () => {
  test("passes the shared DAM v2 conformance on serializable PostgreSQL state", async () => {
    const database = new MemoryPostgresDamDatabase();
    const { storage, objects, deleted } = createStorage();
    await applyPostgresCmsMigrations(database);
    const provider = createPostgresCmsMediaProvider({
      database,
      storage,
      namespace: "dam_conformance",
      createId: ids("dam-generated"),
      now: clock(),
      resolveUsage: (record) =>
        record.id === "dam-primary" ? [{ type: "page", id: "home" }] : [],
      replaceUsage: () => 1,
      enqueueVariant: () => undefined,
      deliveryAdapter: {
        sign: ({ key, expiresAt }) =>
          `https://signed.example/${key}?expires=${expiresAt.toISOString()}`,
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
    expect(objects.has("media/dam-primary.png")).toBe(true);
    expect(objects.has("media/dam-duplicate.png")).toBe(false);
    expect(deleted).toContain("media/dam-replacement.png");
    expect(
      database.statements.some(({ text }) =>
        text.includes("pg_advisory_xact_lock(hashtext($1))"),
      ),
    ).toBe(true);
    expect(
      database.statements
        .filter(({ text }) => /SELECT|INSERT|UPDATE/.test(text))
        .every(({ text }) => !text.includes("dam-primary")),
    ).toBe(true);
  });

  test("keeps the legacy media contract compatible", async () => {
    const database = new MemoryPostgresDamDatabase();
    const { storage, objects } = createStorage();
    await applyPostgresCmsMigrations(database);
    const provider = createPostgresCmsMediaProvider({
      database,
      storage,
      namespace: "media_conformance",
      createId: ids("media-generated"),
      now: clock(),
      resolveUsage: (record) =>
        record.id === "conformance-media" ? [{ type: "page", id: "home" }] : [],
    });

    await expect(runMediaProviderConformance({ provider })).resolves.toEqual({
      objectLifecycle: true,
      metadata: true,
      usage: true,
      safeDelete: true,
    });
    expect(objects.size).toBe(0);
  });
});
