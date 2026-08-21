import { describe, expect, test } from "bun:test";
import {
  createCollectionRegistry,
  defineCollection,
  textField,
} from "@agency/cms-core";
import { runCollectionProviderConformance } from "@agency/cms-runtime";

import {
  applyPostgresCmsMigrations,
  createPostgresCmsCollectionProvider,
  type PostgresCmsClient,
  type PostgresCmsDatabase,
} from "../src";

class MemoryPostgresDatabase implements PostgresCmsDatabase {
  readonly statements: Array<Readonly<{ text: string; values: unknown[] }>> =
    [];
  readonly #state = new Map<string, string>();

  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ) {
    return this.#execute<TRow>(text, values);
  }

  async connect(): Promise<PostgresCmsClient> {
    let released = false;
    return {
      query: async <
        TRow extends Record<string, unknown> = Record<string, unknown>,
      >(
        text: string,
        values: unknown[] = [],
      ) => this.#execute<TRow>(text, values),
      release: () => {
        released = true;
      },
      get released() {
        return released;
      },
    } as PostgresCmsClient;
  }

  async #execute<TRow extends Record<string, unknown>>(
    text: string,
    values: unknown[],
  ) {
    this.statements.push({ text, values: [...values] });
    const normalized = text.replace(/\s+/g, " ").trim().toUpperCase();
    if (normalized.startsWith("SELECT PAYLOAD")) {
      const payload = this.#state.get(String(values[0]));
      return { rows: (payload ? [{ payload }] : []) as TRow[] };
    }
    if (normalized.startsWith("INSERT INTO AGENCY_CMS_POSTGRES_STATE")) {
      if (!this.#state.has(String(values[0]))) {
        this.#state.set(String(values[0]), String(values[1]));
      }
    } else if (normalized.startsWith("UPDATE AGENCY_CMS_POSTGRES_STATE")) {
      this.#state.set(String(values[2]), String(values[0]));
    }
    return { rows: [] as TRow[] };
  }
}

const pages = defineCollection({
  slug: "pages",
  labels: { singular: "Page", plural: "Pages" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: { read: [], create: [], update: [], delete: [], publish: [] },
  fields: [
    textField({ name: "title", label: "Title", required: true, indexed: true }),
    textField({ name: "slug", label: "Slug", required: true, unique: true }),
  ],
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug"] },
});

describe("PostgreSQL CMS collection provider", () => {
  test("passes the shared lifecycle conformance on parameterized serializable transactions", async () => {
    const database = new MemoryPostgresDatabase();
    await applyPostgresCmsMigrations(database);
    const provider = createPostgresCmsCollectionProvider({
      database,
      registry: createCollectionRegistry([pages]),
      createId: (() => {
        let id = 0;
        return () => `postgres-${++id}`;
      })(),
      now: (() => {
        let time = Date.parse("2026-08-21T00:00:00.000Z");
        return () => new Date((time += 1_000));
      })(),
    });
    expect(
      await runCollectionProviderConformance({
        provider,
        collection: pages.slug,
        initial: { title: "Initial", slug: "initial" },
        changed: { title: "Changed", slug: "initial" },
        filter: { field: "title", operator: "contains", value: "Init" },
      }),
    ).toEqual({
      draftIsolation: true,
      filteredPagination: true,
      optimisticConflict: true,
      publish: true,
      revisionRestore: true,
      scheduling: true,
    });
    expect(database.statements.some(({ text }) => text === "BEGIN")).toBe(true);
    expect(
      database.statements.some(({ text }) =>
        text.includes("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"),
      ),
    ).toBe(true);
    expect(
      database.statements.some(({ text }) =>
        text.includes("pg_advisory_xact_lock(hashtext($1))"),
      ),
    ).toBe(true);
    expect(
      database.statements
        .filter(({ text }) => /SELECT|INSERT|UPDATE/.test(text))
        .every(({ text }) => !text.includes("collection-conformance-document")),
    ).toBe(true);
  });
});
