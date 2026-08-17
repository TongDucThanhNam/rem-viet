import { describe, expect, test } from "bun:test";

import {
  buildZeroTableReferenceReport,
  parseD1Inventory,
  parseWorkerD1References,
  parseWorkerNames,
  selectEmptyUnboundD1ForDeletion,
} from "./cloudflare-d1-references";

describe("Cloudflare D1 reference audit", () => {
  test("parses inventories without exposing unrelated binding values", () => {
    expect(
      parseD1Inventory([
        {
          uuid: "db-empty",
          name: "empty-db",
          num_tables: 0,
          created_at: "2026-08-15T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "db-empty",
        name: "empty-db",
        numTables: 0,
        createdAt: "2026-08-15T00:00:00.000Z",
      },
    ]);
    expect(
      parseWorkerNames([
        { id: "worker-b" },
        { id: "worker-a" },
        { id: "worker-a" },
      ]),
    ).toEqual(["worker-a", "worker-b"]);
  });

  test("recognizes current and deprecated D1 binding ID fields", () => {
    expect(
      parseWorkerD1References("worker-a", {
        bindings: [
          { type: "plain_text", name: "PRIVATE", text: "do-not-return" },
          { type: "d1", name: "DB", database_id: "db-current" },
          { type: "d1", name: "LEGACY_DB", id: "db-legacy" },
        ],
      }),
    ).toEqual([
      { worker: "worker-a", binding: "DB", databaseId: "db-current" },
      { worker: "worker-a", binding: "LEGACY_DB", databaseId: "db-legacy" },
    ]);
  });

  test("never authorizes deletion and blocks a bound empty database", () => {
    expect(
      buildZeroTableReferenceReport({
        databases: [
          { id: "bound-id-123456", name: "bound", numTables: 0 },
          { id: "unbound-id-1234", name: "unbound", numTables: 0 },
          { id: "used-id-1234567", name: "used", numTables: 2 },
        ],
        references: [
          { worker: "worker", binding: "DB", databaseId: "bound-id-123456" },
        ],
      }),
    ).toEqual([
      {
        name: "bound",
        idPrefix: "bound-id",
        numTables: 0,
        createdAt: null,
        workerBindings: [{ worker: "worker", binding: "DB" }],
        reviewState: "BLOCKED_ACTIVE_WORKER_BINDING",
        deletionAuthorized: false,
      },
      {
        name: "unbound",
        idPrefix: "unbound-",
        numTables: 0,
        createdAt: null,
        workerBindings: [],
        reviewState: "UNBOUND_OWNER_REVIEW_REQUIRED",
        deletionAuthorized: false,
      },
    ]);
  });

  test("fails closed on unsuccessful provider responses", () => {
    expect(() => parseWorkerNames({ result: [] })).toThrow("must be an array");
    expect(() =>
      parseWorkerD1References("worker", {
        bindings: [{ type: "d1", name: "DB" }],
      }),
    ).toThrow("without a database ID");
  });
});

describe("empty unbound D1 retirement gate", () => {
  const database = {
    id: "database-id",
    name: "retire-me",
    numTables: 0,
  };

  test("returns only an exactly confirmed, empty, unbound database", () => {
    expect(
      selectEmptyUnboundD1ForDeletion({
        requestedName: "retire-me",
        confirmation: "retire-me",
        databases: [database],
        references: [],
      }),
    ).toEqual(database);
  });

  test("rejects an inexact confirmation", () => {
    expect(() =>
      selectEmptyUnboundD1ForDeletion({
        requestedName: "retire-me",
        confirmation: "RETIRE-ME",
        databases: [database],
        references: [],
      }),
    ).toThrow("must exactly match");
  });

  test("rejects a database with tables or an unknown table count", () => {
    for (const numTables of [1, undefined]) {
      expect(() =>
        selectEmptyUnboundD1ForDeletion({
          requestedName: "retire-me",
          confirmation: "retire-me",
          databases: [{ ...database, numTables }],
          references: [],
        }),
      ).toThrow("not proven empty");
    }
  });

  test("rejects an active Worker binding", () => {
    expect(() =>
      selectEmptyUnboundD1ForDeletion({
        requestedName: "retire-me",
        confirmation: "retire-me",
        databases: [database],
        references: [
          { worker: "live-worker", binding: "DB", databaseId: database.id },
        ],
      }),
    ).toThrow("still bound");
  });
});
