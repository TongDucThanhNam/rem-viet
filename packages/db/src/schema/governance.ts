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

export const serviceAccounts = sqliteTable(
  "service_accounts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("service_accounts_name_idx").on(table.name),
    index("service_accounts_revoked_at_idx").on(table.revokedAt),
  ],
);

export const cmsApiKeys = sqliteTable(
  "cms_api_keys",
  {
    id: text("id").primaryKey(),
    serviceAccountId: text("service_account_id")
      .notNull()
      .references(() => serviceAccounts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    publicId: text("public_id").notNull().unique(),
    secretHash: text("secret_hash").notNull(),
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    rotatedFromKeyId: text("rotated_from_key_id"),
  },
  (table) => [
    index("cms_api_keys_service_account_idx").on(table.serviceAccountId),
    index("cms_api_keys_expires_at_idx").on(table.expiresAt),
    index("cms_api_keys_revoked_at_idx").on(table.revokedAt),
  ],
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
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
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

export const cmsCommentThreads = sqliteTable(
  "cms_comment_threads",
  {
    id: text("id").primaryKey(),
    documentType: text("document_type", { enum: ["page", "post"] }).notNull(),
    documentId: text("document_id").notNull(),
    locale: text("locale").default("").notNull(),
    fieldPath: text("field_path").default("").notNull(),
    blockId: text("block_id").default("").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    mentions: text("mentions", { mode: "json" })
      .$type<string[]>()
      .default([])
      .notNull(),
    status: text("status", { enum: ["open", "resolved"] })
      .default("open")
      .notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    resolvedBy: text("resolved_by"),
    version: integer("version").default(1).notNull(),
    lastOperationId: text("last_operation_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("cms_comment_threads_document_idx").on(
      table.documentType,
      table.documentId,
      table.status,
      sql`${table.updatedAt} desc`,
    ),
    index("cms_comment_threads_author_idx").on(table.authorId),
    check(
      "cms_comment_threads_document_type_check",
      sql`${table.documentType} in ('page', 'post')`,
    ),
    check(
      "cms_comment_threads_body_check",
      sql`length(trim(${table.body})) between 1 and 5000`,
    ),
    check(
      "cms_comment_threads_status_check",
      sql`${table.status} in ('open', 'resolved')`,
    ),
    check("cms_comment_threads_version_check", sql`${table.version} >= 1`),
    check(
      "cms_comment_threads_anchor_check",
      sql`${table.blockId} = '' or ${table.fieldPath} <> ''`,
    ),
  ],
);

export const cmsCommentReplies = sqliteTable(
  "cms_comment_replies",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => cmsCommentThreads.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    mentions: text("mentions", { mode: "json" })
      .$type<string[]>()
      .default([])
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("cms_comment_replies_thread_idx").on(
      table.threadId,
      table.createdAt,
      table.id,
    ),
    index("cms_comment_replies_author_idx").on(table.authorId),
    check(
      "cms_comment_replies_body_check",
      sql`length(trim(${table.body})) between 1 and 5000`,
    ),
  ],
);

export const cmsCommentMutations = sqliteTable(
  "cms_comment_mutations",
  {
    operationId: text("operation_id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => cmsCommentThreads.id, { onDelete: "cascade" }),
    action: text("action", {
      enum: ["created", "replied", "resolved", "reopened"],
    }).notNull(),
    actorId: text("actor_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    resultingVersion: integer("resulting_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("cms_comment_mutations_thread_idx").on(
      table.threadId,
      table.createdAt,
    ),
    check(
      "cms_comment_mutations_action_check",
      sql`${table.action} in ('created', 'replied', 'resolved', 'reopened')`,
    ),
    check(
      "cms_comment_mutations_payload_hash_check",
      sql`length(${table.payloadHash}) = 64`,
    ),
    check(
      "cms_comment_mutations_version_check",
      sql`${table.resultingVersion} >= 1`,
    ),
  ],
);
