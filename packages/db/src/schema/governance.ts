import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const staffRoles = sqliteTable(
  "staff_roles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "editor"] }).notNull(),
    assignedBy: text("assigned_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("staff_roles_role_idx").on(table.role)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").default("").notNull(),
    actorEmail: text("actor_email").default("").notNull(),
    actorRole: text("actor_role", {
      enum: ["owner", "admin", "editor", "system"],
    })
      .default("system")
      .notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: text("before", { mode: "json" }).$type<unknown | null>(),
    after: text("after", { mode: "json" }).$type<unknown | null>(),
    requestId: text("request_id").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_actor_idx").on(table.actorUserId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export const cmsReviewEvents = sqliteTable(
  "cms_review_events",
  {
    id: text("id").primaryKey(),
    documentType: text("document_type", { enum: ["page", "post"] }).notNull(),
    documentId: text("document_id").notNull(),
    action: text("action", {
      enum: ["requested", "changes_requested", "approved", "published"],
    }).notNull(),
    version: integer("version").notNull(),
    note: text("note").default("").notNull(),
    actorId: text("actor_id").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("cms_review_events_document_idx").on(
      table.documentType,
      table.documentId,
      sql`${table.occurredAt} desc`,
    ),
    uniqueIndex("cms_review_events_action_unique").on(
      table.documentType,
      table.documentId,
      table.version,
      table.action,
    ),
    check(
      "cms_review_events_action_check",
      sql`${table.action} in ('requested', 'changes_requested', 'approved', 'published')`,
    ),
    check("cms_review_events_version_check", sql`${table.version} >= 0`),
    check("cms_review_events_note_check", sql`length(${table.note}) <= 500`),
  ],
);
