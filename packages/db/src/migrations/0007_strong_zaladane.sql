CREATE TABLE `form_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`notification_settings` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`retention_days` integer DEFAULT 365 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_definitions_key_unique` ON `form_definitions` (`key`);--> statement-breakpoint
CREATE INDEX `form_definitions_active_idx` ON `form_definitions` (`active`);--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`form_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`source_page` text DEFAULT '' NOT NULL,
	`ip_hash` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`idempotency_key` text,
	`notification_status` text DEFAULT 'pending' NOT NULL,
	`notification_results` text DEFAULT '{}' NOT NULL,
	`notified_at` integer,
	`notification_error` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `form_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_submissions_idempotency_key_unique` ON `form_submissions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `form_submissions_form_idx` ON `form_submissions` (`form_id`);--> statement-breakpoint
CREATE INDEX `form_submissions_status_idx` ON `form_submissions` (`status`);--> statement-breakpoint
CREATE INDEX `form_submissions_created_idx` ON `form_submissions` (`created_at`);--> statement-breakpoint
CREATE INDEX `form_submissions_rate_idx` ON `form_submissions` (`form_key`,`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`old_path` text NOT NULL,
	`new_path` text NOT NULL,
	`status_code` integer DEFAULT 301 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_old_path_unique` ON `redirects` (`old_path`);--> statement-breakpoint
CREATE INDEX `redirects_active_idx` ON `redirects` (`active`);--> statement-breakpoint
CREATE INDEX `redirects_new_path_idx` ON `redirects` (`new_path`);--> statement-breakpoint
ALTER TABLE `pages` ADD `template` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `canonical_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `og_image` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `robots_index` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `robots_follow` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `scheduled_at` integer;--> statement-breakpoint
ALTER TABLE `pages` ADD `scheduled_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `schedule_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `canonical_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `og_image` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `robots_index` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `robots_follow` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `scheduled_at` integer;--> statement-breakpoint
ALTER TABLE `posts` ADD `scheduled_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `schedule_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `form_definitions` (
	`id`, `key`, `name`, `fields`, `notification_settings`, `active`, `retention_days`
) VALUES (
	'core-contact-form',
	'contact',
	'Liên hệ',
	'[{"key":"name","label":"Họ và tên","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Số điện thoại","type":"tel","required":false},{"key":"message","label":"Nội dung","type":"textarea","required":true}]',
	'{"email":true,"telegram":true}',
	true,
	365
);
