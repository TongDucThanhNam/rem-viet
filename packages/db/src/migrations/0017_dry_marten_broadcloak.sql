CREATE TABLE `cms_job_queues` (
	`name` text PRIMARY KEY NOT NULL,
	`concurrency_limit` integer DEFAULT 1 NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cms_job_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`idempotency_key` text NOT NULL,
	`state` text,
	`last_error` text DEFAULT '' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`job_id`) REFERENCES `cms_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_job_steps_idempotency_key_unique` ON `cms_job_steps` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `cms_job_steps_job_name_unique` ON `cms_job_steps` (`job_id`,`name`);--> statement-breakpoint
CREATE INDEX `cms_job_steps_job_status_idx` ON `cms_job_steps` (`job_id`,`status`);--> statement-breakpoint
CREATE TABLE `cms_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_name` text NOT NULL,
	`queue_name` text NOT NULL,
	`payload` text NOT NULL,
	`result` text,
	`workflow_state` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`retry_policy` text NOT NULL,
	`timeout_ms` integer NOT NULL,
	`available_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`locked_until` integer,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`retention_until` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`queue_name`) REFERENCES `cms_job_queues`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_jobs_idempotency_key_unique` ON `cms_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `cms_jobs_queue_status_available_idx` ON `cms_jobs` (`queue_name`,`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `cms_jobs_locked_until_idx` ON `cms_jobs` (`locked_until`);--> statement-breakpoint
CREATE INDEX `cms_jobs_retention_until_idx` ON `cms_jobs` (`retention_until`);--> statement-breakpoint
CREATE TABLE `cms_outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`aggregate_version` integer NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 8 NOT NULL,
	`available_at` integer NOT NULL,
	`locked_until` integer,
	`last_error` text DEFAULT '' NOT NULL,
	`occurred_at` integer NOT NULL,
	`dispatched_at` integer,
	`retention_until` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_outbox_events_idempotency_key_unique` ON `cms_outbox_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `cms_outbox_status_available_idx` ON `cms_outbox_events` (`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `cms_outbox_aggregate_idx` ON `cms_outbox_events` (`aggregate_type`,`aggregate_id`,`aggregate_version`);--> statement-breakpoint
CREATE INDEX `cms_outbox_retention_idx` ON `cms_outbox_events` (`retention_until`);--> statement-breakpoint
CREATE TABLE `cms_release_items` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`document_type` text NOT NULL,
	`document_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`expected_version` integer NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`before_state` text,
	`after_state` text,
	`last_error` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`rolled_back_at` integer,
	FOREIGN KEY (`release_id`) REFERENCES `cms_releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_release_item_document_unique` ON `cms_release_items` (`release_id`,`document_type`,`document_id`,`locale`);--> statement-breakpoint
CREATE INDEX `cms_release_items_release_position_idx` ON `cms_release_items` (`release_id`,`position`);--> statement-breakpoint
CREATE TABLE `cms_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`idempotency_key` text NOT NULL,
	`scheduled_at` integer,
	`job_id` text,
	`receipt` text,
	`last_error` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`job_id`) REFERENCES `cms_jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_releases_idempotency_key_unique` ON `cms_releases` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `cms_releases_status_schedule_idx` ON `cms_releases` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `cms_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`event_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 8 NOT NULL,
	`payload_hash` text DEFAULT '' NOT NULL,
	`http_status` integer,
	`response_snippet` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`delivered_at` integer,
	`replay_of_delivery_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`endpoint_id`) REFERENCES `cms_webhook_endpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `cms_outbox_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_webhook_deliveries_dedupe_key_unique` ON `cms_webhook_deliveries` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `cms_webhook_delivery_status_idx` ON `cms_webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `cms_webhook_delivery_event_idx` ON `cms_webhook_deliveries` (`event_id`);--> statement-breakpoint
CREATE INDEX `cms_webhook_delivery_endpoint_idx` ON `cms_webhook_deliveries` (`endpoint_id`);--> statement-breakpoint
CREATE TABLE `cms_webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`topics` text NOT NULL,
	`secret_ciphertext` text NOT NULL,
	`previous_secret_ciphertext` text,
	`previous_secret_valid_until` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE INDEX `cms_webhook_endpoints_active_idx` ON `cms_webhook_endpoints` (`active`);--> statement-breakpoint
CREATE INDEX `cms_webhook_endpoints_url_idx` ON `cms_webhook_endpoints` (`url`);--> statement-breakpoint
CREATE TABLE `cms_workflow_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`stages` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_workflow_policy_target_unique` ON `cms_workflow_policies` (`collection`,`locale`);