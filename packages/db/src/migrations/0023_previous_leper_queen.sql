CREATE TABLE `cms_comment_mutations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`resulting_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `cms_comment_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cms_comment_mutations_action_check" CHECK("cms_comment_mutations"."action" in ('created', 'replied', 'resolved', 'reopened')),
	CONSTRAINT "cms_comment_mutations_payload_hash_check" CHECK(length("cms_comment_mutations"."payload_hash") = 64),
	CONSTRAINT "cms_comment_mutations_version_check" CHECK("cms_comment_mutations"."resulting_version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `cms_comment_mutations_thread_idx` ON `cms_comment_mutations` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cms_comment_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`mentions` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `cms_comment_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cms_comment_replies_body_check" CHECK(length(trim("cms_comment_replies"."body")) between 1 and 5000)
);
--> statement-breakpoint
CREATE INDEX `cms_comment_replies_thread_idx` ON `cms_comment_replies` (`thread_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `cms_comment_replies_author_idx` ON `cms_comment_replies` (`author_id`);--> statement-breakpoint
CREATE TABLE `cms_comment_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`document_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`field_path` text DEFAULT '' NOT NULL,
	`block_id` text DEFAULT '' NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`mentions` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` integer,
	`resolved_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`last_operation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "cms_comment_threads_document_type_check" CHECK("cms_comment_threads"."document_type" in ('page', 'post')),
	CONSTRAINT "cms_comment_threads_body_check" CHECK(length(trim("cms_comment_threads"."body")) between 1 and 5000),
	CONSTRAINT "cms_comment_threads_status_check" CHECK("cms_comment_threads"."status" in ('open', 'resolved')),
	CONSTRAINT "cms_comment_threads_version_check" CHECK("cms_comment_threads"."version" >= 1),
	CONSTRAINT "cms_comment_threads_anchor_check" CHECK("cms_comment_threads"."block_id" = '' or "cms_comment_threads"."field_path" <> '')
);
--> statement-breakpoint
CREATE INDEX `cms_comment_threads_document_idx` ON `cms_comment_threads` (`document_type`,`document_id`,`status`,"updated_at" desc);--> statement-breakpoint
CREATE INDEX `cms_comment_threads_author_idx` ON `cms_comment_threads` (`author_id`);