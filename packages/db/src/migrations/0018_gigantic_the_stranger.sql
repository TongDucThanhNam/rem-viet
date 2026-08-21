ALTER TABLE `cms_webhook_deliveries` ADD `locked_until` integer;--> statement-breakpoint
CREATE INDEX `cms_webhook_delivery_locked_until_idx` ON `cms_webhook_deliveries` (`locked_until`);