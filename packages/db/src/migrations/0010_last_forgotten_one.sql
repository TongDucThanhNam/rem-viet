CREATE TABLE `sanity_webhook_deliveries` (
	`idempotency_key` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`project_id` text NOT NULL,
	`dataset` text NOT NULL,
	`document_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`operation` text NOT NULL,
	`transaction_id` text NOT NULL,
	`transaction_time` integer NOT NULL,
	`signature_timestamp` integer NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sanity_webhook_status_updated_idx` ON `sanity_webhook_deliveries` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `sanity_webhook_document_idx` ON `sanity_webhook_deliveries` (`project_id`,`dataset`,`document_id`);