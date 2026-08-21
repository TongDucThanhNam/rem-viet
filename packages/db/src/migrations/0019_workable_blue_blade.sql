ALTER TABLE `cms_jobs` ADD `lock_token` text;--> statement-breakpoint
ALTER TABLE `cms_outbox_events` ADD `lock_token` text;--> statement-breakpoint
ALTER TABLE `cms_webhook_deliveries` ADD `lock_token` text;