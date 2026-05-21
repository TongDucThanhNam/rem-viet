import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false).notNull(),
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
