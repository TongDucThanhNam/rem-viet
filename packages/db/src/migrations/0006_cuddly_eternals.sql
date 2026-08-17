CREATE TABLE `page_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_revisions_page_id_idx` ON `page_revisions` (`page_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_revisions_page_version_unique` ON `page_revisions` (`page_id`,`version`);--> statement-breakpoint
CREATE TABLE `post_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_revisions_post_id_idx` ON `post_revisions` (`post_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_revisions_post_version_unique` ON `post_revisions` (`post_id`,`version`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text DEFAULT '' NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`actor_role` text DEFAULT 'system' NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`request_id` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `audit_events` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_events_created_at_idx` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`assigned_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_roles_role_idx` ON `staff_roles` (`role`);--> statement-breakpoint
ALTER TABLE `pages` ADD `published_revision_id` text;--> statement-breakpoint
ALTER TABLE `pages` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `updated_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `published_at` integer;--> statement-breakpoint
ALTER TABLE `posts` ADD `published_revision_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `updated_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `published_at` integer;--> statement-breakpoint

-- Backfill immutable snapshots for content that was already public before the
-- revision model landed. Deterministic ids plus INSERT OR IGNORE make the data
-- copy safe to re-run independently during a recovery drill.
INSERT OR IGNORE INTO `page_revisions` (
	`id`, `page_id`, `version`, `snapshot`, `note`, `created_by`, `created_at`
)
SELECT
	'legacy-page-' || `id`,
	`id`,
	1,
	json_object(
		'title', `title`,
		'slug', `slug`,
		'blocks', json(`blocks`),
		'seoTitle', `seo_title`,
		'seoDescription', `seo_description`
	),
	'Backfilled from pre-revision published page',
	'migration',
	`updated_at`
FROM `pages`
WHERE `status` = 'published';--> statement-breakpoint

UPDATE `pages`
SET
	`published_revision_id` = 'legacy-page-' || `id`,
	`published_at` = COALESCE(`published_at`, `updated_at`),
	`updated_by` = CASE WHEN `updated_by` = '' THEN 'migration' ELSE `updated_by` END
WHERE `status` = 'published' AND `published_revision_id` IS NULL;--> statement-breakpoint

INSERT OR IGNORE INTO `post_revisions` (
	`id`, `post_id`, `version`, `snapshot`, `note`, `created_by`, `created_at`
)
SELECT
	'legacy-post-' || `id`,
	`id`,
	1,
	json_object(
		'title', `title`,
		'slug', `slug`,
		'description', `description`,
		'coverImage', `cover_image`,
		'tags', json(`tags`),
		'content', `content`,
		'publishDate', `publish_date`,
		'seoTitle', `seo_title`,
		'seoDescription', `seo_description`,
		'url', `url`,
		'tableOfContents', CASE
			WHEN `table_of_contents` IS NULL THEN NULL
			ELSE json(`table_of_contents`)
		END
	),
	'Backfilled from pre-revision published post',
	'migration',
	`updated_at`
FROM `posts`
WHERE `status` = 'published';--> statement-breakpoint

UPDATE `posts`
SET
	`published_revision_id` = 'legacy-post-' || `id`,
	`published_at` = COALESCE(`published_at`, `updated_at`),
	`updated_by` = CASE WHEN `updated_by` = '' THEN 'migration' ELSE `updated_by` END
WHERE `status` = 'published' AND `published_revision_id` IS NULL;
