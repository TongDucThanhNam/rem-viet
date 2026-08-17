import { createClient, type InValue } from "@libsql/client";
import { afterEach, describe, expect, test } from "bun:test";

import { createD1DeliveryStore } from "./sanity-webhook-delivery-store";

const clients: ReturnType<typeof createClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("Sanity D1 webhook delivery store", () => {
  test("deduplicates completed work and reclaims only expired processing leases", async () => {
    const client = createClient({ url: ":memory:" });
    clients.push(client);
    await client.execute(`CREATE TABLE sanity_webhook_deliveries (
      idempotency_key text PRIMARY KEY NOT NULL,
      webhook_id text NOT NULL,
      project_id text NOT NULL,
      dataset text NOT NULL,
      document_id text NOT NULL,
      agency_id text NOT NULL,
      operation text NOT NULL,
      transaction_id text NOT NULL,
      transaction_time integer NOT NULL,
      signature_timestamp integer NOT NULL,
      status text DEFAULT 'processing' NOT NULL,
      completed_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`);
    let now = new Date("2026-08-16T08:00:00.000Z");
    const store = createD1DeliveryStore(
      libsqlD1(client),
      () => now,
      5 * 60 * 1000,
    );
    const event = {
      agencyId: "home",
      dataset: "staging",
      documentId: "agency-page-home",
      idempotencyKey: "delivery-1",
      operation: "update" as const,
      projectId: "project-test",
      signatureTimestamp: now.toISOString(),
      transactionId: "transaction-1",
      transactionTime: now.toISOString(),
      webhookId: "webhook-1",
    };

    expect(await store.claim(event)).toBe("claimed");
    expect(await store.claim(event)).toBe("duplicate");
    now = new Date(now.getTime() + 5 * 60 * 1000 + 1);
    expect(await store.claim(event)).toBe("claimed");
    await store.release(event);
    expect(await store.claim(event)).toBe("claimed");
    await store.complete(event);
    now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(await store.claim(event)).toBe("duplicate");

    const row = await client.execute(
      "SELECT status, completed_at FROM sanity_webhook_deliveries",
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]?.status).toBe("completed");
    expect(Number(row.rows[0]?.completed_at)).toBeGreaterThan(0);
  });
});

function libsqlD1(client: ReturnType<typeof createClient>) {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              const result = await client.execute({
                sql,
                args: values as InValue[],
              });
              return { meta: { changes: result.rowsAffected } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}
