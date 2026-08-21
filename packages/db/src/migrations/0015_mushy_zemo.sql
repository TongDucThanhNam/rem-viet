CREATE TABLE `cms_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`service_account_id` text NOT NULL,
	`label` text NOT NULL,
	`public_id` text NOT NULL,
	`secret_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer,
	`rotated_from_key_id` text,
	FOREIGN KEY (`service_account_id`) REFERENCES `service_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_api_keys_public_id_unique` ON `cms_api_keys` (`public_id`);--> statement-breakpoint
CREATE INDEX `cms_api_keys_service_account_idx` ON `cms_api_keys` (`service_account_id`);--> statement-breakpoint
CREATE INDEX `cms_api_keys_expires_at_idx` ON `cms_api_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `cms_api_keys_revoked_at_idx` ON `cms_api_keys` (`revoked_at`);--> statement-breakpoint
CREATE TABLE `service_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE INDEX `service_accounts_name_idx` ON `service_accounts` (`name`);--> statement-breakpoint
CREATE INDEX `service_accounts_revoked_at_idx` ON `service_accounts` (`revoked_at`);