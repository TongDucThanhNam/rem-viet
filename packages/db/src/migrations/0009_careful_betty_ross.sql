CREATE TABLE `cms_global_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`global_key` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`global_key`) REFERENCES `cms_globals`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cms_global_revisions_key_idx` ON `cms_global_revisions` (`global_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `cms_global_revisions_key_version_unique` ON `cms_global_revisions` (`global_key`,`version`);--> statement-breakpoint
CREATE TABLE `cms_globals` (
	`key` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
