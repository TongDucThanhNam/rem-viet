CREATE TABLE `cms_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`document_id` text NOT NULL,
	`action` text NOT NULL,
	`version` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`actor_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	CONSTRAINT "cms_review_events_action_check" CHECK("cms_review_events"."action" in ('requested', 'changes_requested', 'approved', 'published')),
	CONSTRAINT "cms_review_events_version_check" CHECK("cms_review_events"."version" >= 0),
	CONSTRAINT "cms_review_events_note_check" CHECK(length("cms_review_events"."note") <= 500)
);
--> statement-breakpoint
CREATE INDEX `cms_review_events_document_idx` ON `cms_review_events` (`document_type`,`document_id`,"occurred_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `cms_review_events_action_unique` ON `cms_review_events` (`document_type`,`document_id`,`version`,`action`);