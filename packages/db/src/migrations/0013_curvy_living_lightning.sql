PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cms_collection_documents` (
	`collection_slug` text NOT NULL,
	`id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`schema_version` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`data` text NOT NULL,
	`published_revision_id` text,
	`scheduled_at` integer,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`collection_slug`, `id`, `locale`)
);--> statement-breakpoint
INSERT INTO `__new_cms_collection_documents` (
	`collection_slug`, `id`, `locale`, `schema_version`, `version`, `status`,
	`data`, `published_revision_id`, `scheduled_at`, `updated_by`, `created_at`, `updated_at`
)
SELECT `collection_slug`, `id`, '', `schema_version`, `version`, `status`,
	`data`, `published_revision_id`, `scheduled_at`, `updated_by`, `created_at`, `updated_at`
FROM `cms_collection_documents`;--> statement-breakpoint
CREATE TABLE `__new_cms_collection_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_slug` text NOT NULL,
	`document_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`schema_version` integer NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_slug`,`document_id`,`locale`)
		REFERENCES `__new_cms_collection_documents`(`collection_slug`,`id`,`locale`)
		ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_cms_collection_revisions` (
	`id`, `collection_slug`, `document_id`, `locale`, `schema_version`,
	`version`, `snapshot`, `note`, `created_by`, `created_at`
)
SELECT `id`, `collection_slug`, `document_id`, '', `schema_version`,
	`version`, `snapshot`, `note`, `created_by`, `created_at`
FROM `cms_collection_revisions`;--> statement-breakpoint
DROP TABLE `cms_collection_revisions`;--> statement-breakpoint
DROP TABLE `cms_collection_documents`;--> statement-breakpoint
ALTER TABLE `__new_cms_collection_documents` RENAME TO `cms_collection_documents`;--> statement-breakpoint
ALTER TABLE `__new_cms_collection_revisions` RENAME TO `cms_collection_revisions`;--> statement-breakpoint
CREATE INDEX `cms_collection_documents_status_idx` ON `cms_collection_documents` (`collection_slug`,`locale`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `cms_collection_revisions_document_idx` ON `cms_collection_revisions` (`collection_slug`,`document_id`,`locale`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `cms_collection_revisions_version_unique` ON `cms_collection_revisions` (`collection_slug`,`document_id`,`locale`,`version`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
