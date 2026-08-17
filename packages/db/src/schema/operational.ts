import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

const softDelete = {
  isDeleted: integer("is_deleted", { mode: "boolean" })
    .default(false)
    .notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
};

export const logs = sqliteTable(
  "logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    method: text("method"),
    url: text("url"),
    statusCode: integer("status_code"),
    ipAddress: text("ip_address"),
    deviceId: text("device_id"),
    timeStamp: integer("time_stamp", { mode: "timestamp_ms" }),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    index("logs_user_id_idx").on(table.userId),
    index("logs_status_code_idx").on(table.statusCode),
    index("logs_active_deleted_idx").on(table.isActive, table.isDeleted),
  ],
);

export const webVitals = sqliteTable(
  "web_vitals",
  {
    id: text("id").primaryKey(),
    schemaVersion: integer("schema_version").default(1).notNull(),
    name: text("name", { enum: ["CLS", "LCP", "INP"] }).notNull(),
    value: real("value").notNull(),
    rating: text("rating", {
      enum: ["good", "needs-improvement", "poor"],
    }).notNull(),
    navigationType: text("navigation_type", {
      enum: [
        "navigate",
        "reload",
        "back-forward",
        "back-forward-cache",
        "prerender",
        "restore",
      ],
    }).notNull(),
    path: text("path").notNull(),
    deviceClass: text("device_class", {
      enum: ["mobile", "tablet", "desktop"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("web_vitals_name_created_idx").on(table.name, table.createdAt),
    index("web_vitals_path_created_idx").on(table.path, table.createdAt),
  ],
);

export const sanityWebhookDeliveries = sqliteTable(
  "sanity_webhook_deliveries",
  {
    idempotencyKey: text("idempotency_key").primaryKey(),
    webhookId: text("webhook_id").notNull(),
    projectId: text("project_id").notNull(),
    dataset: text("dataset").notNull(),
    documentId: text("document_id").notNull(),
    agencyId: text("agency_id").notNull(),
    operation: text("operation", {
      enum: ["create", "update", "delete"],
    }).notNull(),
    transactionId: text("transaction_id").notNull(),
    transactionTime: integer("transaction_time", {
      mode: "timestamp_ms",
    }).notNull(),
    signatureTimestamp: integer("signature_timestamp", {
      mode: "timestamp_ms",
    }).notNull(),
    status: text("status", { enum: ["processing", "completed"] })
      .default("processing")
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("sanity_webhook_status_updated_idx").on(
      table.status,
      table.updatedAt,
    ),
    index("sanity_webhook_document_idx").on(
      table.projectId,
      table.dataset,
      table.documentId,
    ),
  ],
);
