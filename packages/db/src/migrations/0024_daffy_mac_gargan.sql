DROP INDEX `cms_workflow_policy_target_unique`;--> statement-breakpoint
ALTER TABLE `cms_workflow_policies` ADD `folder` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cms_workflow_policy_target_unique` ON `cms_workflow_policies` (`collection`,`folder`,`locale`);--> statement-breakpoint
ALTER TABLE `pages` ADD `folder` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `pages_folder_status_idx` ON `pages` (`folder`,`status`);--> statement-breakpoint
ALTER TABLE `posts` ADD `folder` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `posts_folder_status_idx` ON `posts` (`folder`,`status`);--> statement-breakpoint
UPDATE `cms_collection_documents`
SET `data` = json_set(`data`, '$.folder', COALESCE(json_extract(`data`, '$.folder'), '')),
    `schema_version` = 2
WHERE `collection_slug` = 'standard-pages' AND `schema_version` = 1;--> statement-breakpoint
UPDATE `cms_collection_revisions`
SET `snapshot` = json_set(`snapshot`, '$.folder', COALESCE(json_extract(`snapshot`, '$.folder'), '')),
    `schema_version` = 2
WHERE `collection_slug` = 'standard-pages' AND `schema_version` = 1;
