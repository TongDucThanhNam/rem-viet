ALTER TABLE `cms_globals` ADD `published_revision_id` text;--> statement-breakpoint
UPDATE `cms_globals`
SET `published_revision_id` = (
	SELECT `id` FROM `cms_global_revisions`
	WHERE `global_key` = `cms_globals`.`key`
		AND `version` = `cms_globals`.`version`
	ORDER BY `created_at` DESC
	LIMIT 1
)
WHERE `published_revision_id` IS NULL;
