import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const cmsJobQueues = sqliteTable("cms_job_queues", {
  name: text("name").primaryKey(),
  concurrencyLimit: integer("concurrency_limit").default(1).notNull(),
  paused: integer("paused", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const cmsJobs = sqliteTable(
  "cms_jobs",
  {
    id: text("id").primaryKey(),
    taskName: text("task_name").notNull(),
    queueName: text("queue_name")
      .notNull()
      .references(() => cmsJobQueues.name),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    result: text("result", { mode: "json" }).$type<unknown | null>(),
    workflowState: text("workflow_state", { mode: "json" }).$type<
      unknown | null
    >(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status", {
      enum: [
        "queued",
        "running",
        "waiting",
        "succeeded",
        "failed",
        "dead_letter",
        "cancelled",
      ],
    })
      .default("queued")
      .notNull(),
    attempt: integer("attempt").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    retryPolicy: text("retry_policy", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    lockToken: text("lock_token"),
    cancelRequested: integer("cancel_requested", { mode: "boolean" })
      .default(false)
      .notNull(),
    lastError: text("last_error").default("").notNull(),
    retentionUntil: integer("retention_until", {
      mode: "timestamp_ms",
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cms_jobs_queue_status_available_idx").on(
      table.queueName,
      table.status,
      table.availableAt,
    ),
    index("cms_jobs_locked_until_idx").on(table.lockedUntil),
    index("cms_jobs_retention_until_idx").on(table.retentionUntil),
  ],
);

export const cmsJobSteps = sqliteTable(
  "cms_job_steps",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => cmsJobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status", {
      enum: ["running", "succeeded", "failed"],
    })
      .default("running")
      .notNull(),
    attempt: integer("attempt").default(1).notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    state: text("state", { mode: "json" }).$type<unknown | null>(),
    lastError: text("last_error").default("").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("cms_job_steps_job_name_unique").on(table.jobId, table.name),
    index("cms_job_steps_job_status_idx").on(table.jobId, table.status),
  ],
);

export const cmsOutboxEvents = sqliteTable(
  "cms_outbox_events",
  {
    id: text("id").primaryKey(),
    topic: text("topic").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    aggregateVersion: integer("aggregate_version").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status", {
      enum: ["pending", "dispatching", "dispatched", "dead_letter"],
    })
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(8).notNull(),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    lockToken: text("lock_token"),
    lastError: text("last_error").default("").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    dispatchedAt: integer("dispatched_at", { mode: "timestamp_ms" }),
    retentionUntil: integer("retention_until", {
      mode: "timestamp_ms",
    }).notNull(),
  },
  (table) => [
    index("cms_outbox_status_available_idx").on(
      table.status,
      table.availableAt,
    ),
    index("cms_outbox_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion,
    ),
    index("cms_outbox_retention_idx").on(table.retentionUntil),
  ],
);

export const cmsWebhookEndpoints = sqliteTable(
  "cms_webhook_endpoints",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    topics: text("topics", { mode: "json" }).$type<string[]>().notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    previousSecretCiphertext: text("previous_secret_ciphertext"),
    previousSecretValidUntil: integer("previous_secret_valid_until", {
      mode: "timestamp_ms",
    }),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
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
    index("cms_webhook_endpoints_active_idx").on(table.active),
    index("cms_webhook_endpoints_url_idx").on(table.url),
  ],
);

export const cmsWebhookDeliveries = sqliteTable(
  "cms_webhook_deliveries",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => cmsWebhookEndpoints.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => cmsOutboxEvents.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull().unique(),
    status: text("status", {
      enum: [
        "pending",
        "delivering",
        "delivered",
        "failed",
        "dead_letter",
        "cancelled",
      ],
    })
      .default("pending")
      .notNull(),
    attempt: integer("attempt").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(8).notNull(),
    payloadHash: text("payload_hash").default("").notNull(),
    httpStatus: integer("http_status"),
    responseSnippet: text("response_snippet").default("").notNull(),
    lastError: text("last_error").default("").notNull(),
    nextAttemptAt: integer("next_attempt_at", {
      mode: "timestamp_ms",
    }).notNull(),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    lockToken: text("lock_token"),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    replayOfDeliveryId: text("replay_of_delivery_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cms_webhook_delivery_status_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
    index("cms_webhook_delivery_event_idx").on(table.eventId),
    index("cms_webhook_delivery_endpoint_idx").on(table.endpointId),
    index("cms_webhook_delivery_locked_until_idx").on(table.lockedUntil),
  ],
);

export const cmsWorkflowPolicies = sqliteTable(
  "cms_workflow_policies",
  {
    id: text("id").primaryKey(),
    collection: text("collection").notNull(),
    folder: text("folder").default("").notNull(),
    locale: text("locale").default("").notNull(),
    stages: text("stages", { mode: "json" }).$type<unknown[]>().notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("cms_workflow_policy_target_unique").on(
      table.collection,
      table.folder,
      table.locale,
    ),
  ],
);

export const cmsReleases = sqliteTable(
  "cms_releases",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status", {
      enum: [
        "draft",
        "scheduled",
        "publishing",
        "published",
        "rolling_back",
        "rolled_back",
        "failed",
        "cancelled",
      ],
    })
      .default("draft")
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    jobId: text("job_id").references(() => cmsJobs.id, {
      onDelete: "set null",
    }),
    receipt: text("receipt", { mode: "json" }).$type<unknown | null>(),
    lastError: text("last_error").default("").notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("cms_releases_status_schedule_idx").on(
      table.status,
      table.scheduledAt,
    ),
  ],
);

export const cmsReleaseItems = sqliteTable(
  "cms_release_items",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .notNull()
      .references(() => cmsReleases.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    collection: text("collection").default("").notNull(),
    documentId: text("document_id").notNull(),
    locale: text("locale").default("").notNull(),
    expectedVersion: integer("expected_version").notNull(),
    position: integer("position").notNull(),
    status: text("status", {
      enum: ["pending", "published", "rolled_back", "failed"],
    })
      .default("pending")
      .notNull(),
    beforeState: text("before_state", { mode: "json" }).$type<unknown | null>(),
    afterState: text("after_state", { mode: "json" }).$type<unknown | null>(),
    lastError: text("last_error").default("").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    rolledBackAt: integer("rolled_back_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("cms_release_item_document_unique").on(
      table.releaseId,
      table.documentType,
      table.collection,
      table.documentId,
      table.locale,
    ),
    index("cms_release_items_release_position_idx").on(
      table.releaseId,
      table.position,
    ),
  ],
);
