CREATE TABLE `cms_media_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `cms_media_folders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_media_folder_name_unique` ON `cms_media_folders` (COALESCE(`parent_id`, ''), `name`);--> statement-breakpoint
CREATE TABLE `cms_media_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`name` text NOT NULL,
	`width` integer,
	`height` integer,
	`format` text NOT NULL,
	`fit` text NOT NULL,
	`status` text NOT NULL,
	`object_key` text,
	`url` text,
	`error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cms_media_variants_format_check" CHECK("cms_media_variants"."format" in ('avif', 'webp', 'jpeg', 'png')),
	CONSTRAINT "cms_media_variants_fit_check" CHECK("cms_media_variants"."fit" in ('cover', 'contain', 'crop')),
	CONSTRAINT "cms_media_variants_status_check" CHECK("cms_media_variants"."status" in ('pending', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_media_variants_asset_id_name_unique` ON `cms_media_variants` (`asset_id`,`name`);--> statement-breakpoint
CREATE INDEX `cms_media_variants_asset_idx` ON `cms_media_variants` (`asset_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `media` ADD `folder_id` text;--> statement-breakpoint
ALTER TABLE `media` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `media` ADD `visibility` text DEFAULT 'public' NOT NULL CHECK (`visibility` IN ('public', 'private'));--> statement-breakpoint
ALTER TABLE `media` ADD `asset_status` text DEFAULT 'active' NOT NULL CHECK (`asset_status` IN ('active', 'trashed'));--> statement-breakpoint
ALTER TABLE `media` ADD `focal_x` real;--> statement-breakpoint
ALTER TABLE `media` ADD `focal_y` real;--> statement-breakpoint
ALTER TABLE `media` ADD `custom_metadata` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `localized_metadata` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `copyright` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `license` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `media` ADD `trashed_at` integer;--> statement-breakpoint
ALTER TABLE `media` ADD `purge_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `media_content_hash_unique` ON `media` (`content_hash`) WHERE "media"."content_hash" is not null;--> statement-breakpoint
CREATE INDEX `media_folder_status_idx` ON `media` (`folder_id`,`asset_status`,`updated_at`);
