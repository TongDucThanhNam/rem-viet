import { describe, expect, test } from "bun:test";
import { Pool } from "pg";
import {
  createCollectionRegistry,
  defineCollection,
  textField,
} from "@agency/cms-core";
import {
  runCollectionProviderConformance,
  runDamProviderConformance,
} from "@agency/cms-runtime";

import {
  applyPostgresCmsMigrations,
  createPostgresCmsCollectionProvider,
  createPostgresCmsMediaProvider,
  type PostgresCmsDatabase,
} from "../src";

const connectionString = process.env.CMS_POSTGRES_TEST_URL?.trim();
const integrationTest = connectionString ? test : test.skip;

const pages = defineCollection({
  slug: "postgres-integration-pages",
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

describe("real PostgreSQL conformance", () => {
  integrationTest(
    "runs the shared provider lifecycle against a PostgreSQL server",
    async () => {
      const namespace = `ci_${Date.now().toString(36)}`;
      const pool = new Pool({
        connectionString,
        max: 4,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 1_000,
        allowExitOnIdle: true,
      });
      try {
        await applyPostgresCmsMigrations(pool as PostgresCmsDatabase);
        const provider = createPostgresCmsCollectionProvider({
          database: pool as PostgresCmsDatabase,
          registry: createCollectionRegistry([pages]),
          namespace,
        });
        expect(
          await runCollectionProviderConformance({
            provider,
            collection: pages.slug,
            documentId: "real-postgres-document",
            initial: { title: "Initial", slug: "real-postgres" },
            changed: { title: "Changed", slug: "real-postgres" },
            filter: { field: "title", operator: "contains", value: "Init" },
          }),
        ).toMatchObject({
          draftIsolation: true,
          optimisticConflict: true,
          publish: true,
          revisionRestore: true,
          scheduling: true,
        });
        const objects = new Map<string, unknown>();
        const mediaProvider = createPostgresCmsMediaProvider({
          database: pool as PostgresCmsDatabase,
          namespace,
          storage: {
            async put(key, value) {
              objects.set(key, value);
            },
            async delete(key) {
              objects.delete(key);
            },
          },
          resolveUsage: (record) =>
            record.id === "dam-primary" ? [{ type: "page", id: "home" }] : [],
          replaceUsage: () => 1,
          enqueueVariant: () => undefined,
          deliveryAdapter: {
            sign: ({ key }) => `https://signed.example/${key}`,
          },
        });
        expect(
          await runDamProviderConformance({ provider: mediaProvider }),
        ).toMatchObject({
          duplicateDetection: true,
          privateDelivery: true,
          asyncVariants: true,
          trashRestoreRetention: true,
        });
      } finally {
        await pool.query(
          "DELETE FROM agency_cms_postgres_state WHERE namespace = $1",
          [namespace],
        );
        await pool.query(
          "DELETE FROM agency_cms_postgres_dam_state WHERE namespace = $1",
          [namespace],
        );
        await pool.end();
      }
    },
    20_000,
  );
});
