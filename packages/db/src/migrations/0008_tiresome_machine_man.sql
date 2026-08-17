CREATE TABLE `web_vitals` (
	`id` text PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`rating` text NOT NULL,
	`navigation_type` text NOT NULL,
	`path` text NOT NULL,
	`device_class` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `web_vitals_name_created_idx` ON `web_vitals` (`name`,`created_at`);--> statement-breakpoint
CREATE INDEX `web_vitals_path_created_idx` ON `web_vitals` (`path`,`created_at`);