DROP INDEX `cms_release_item_document_unique`;--> statement-breakpoint
ALTER TABLE `cms_release_items` ADD `collection` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cms_release_item_document_unique` ON `cms_release_items` (`release_id`,`document_type`,`collection`,`document_id`,`locale`);