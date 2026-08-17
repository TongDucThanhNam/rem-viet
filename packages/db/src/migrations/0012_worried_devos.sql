CREATE TABLE `cms_collection_documents` (
	`collection_slug` text NOT NULL,
	`id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`data` text NOT NULL,
	`published_revision_id` text,
	`scheduled_at` integer,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`collection_slug`, `id`)
);
--> statement-breakpoint
CREATE INDEX `cms_collection_documents_status_idx` ON `cms_collection_documents` (`collection_slug`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `cms_collection_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_slug` text NOT NULL,
	`document_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_slug`,`document_id`) REFERENCES `cms_collection_documents`(`collection_slug`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cms_collection_revisions_document_idx` ON `cms_collection_revisions` (`collection_slug`,`document_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `cms_collection_revisions_version_unique` ON `cms_collection_revisions` (`collection_slug`,`document_id`,`version`);--> statement-breakpoint
INSERT OR IGNORE INTO `cms_collection_documents` (
	`collection_slug`, `id`, `schema_version`, `version`, `status`, `data`,
	`published_revision_id`, `scheduled_at`, `updated_by`, `created_at`, `updated_at`
)
SELECT
	'standard-pages', p.`id`, 1, p.`version`, p.`status`,
	json_object(
		'title', p.`title`,
		'slug', p.`slug`,
		'template', 'standard',
		'blocks', json(COALESCE((
			SELECT json_group_array(json(
				CASE
					WHEN json_type(block.value, '$.schemaVersion') IS NOT NULL
					THEN json(block.value)
					ELSE json_object(
						'id', COALESCE(json_extract(block.value, '$.id'), 'standard-' || block.key || '-' || json_extract(block.value, '$.type')),
						'type', json_extract(block.value, '$.type'),
						'schemaVersion', 1,
						'enabled', json('true'),
						'data', json(json_remove(block.value, '$.id', '$.type'))
					)
				END
			))
			FROM json_each(p.`blocks`) AS block
		), '[]')),
		'seoTitle', p.`seo_title`,
		'seoDescription', p.`seo_description`,
		'canonicalUrl', p.`canonical_url`,
		'ogImage', p.`og_image`,
		'robotsIndex', json(CASE WHEN p.`robots_index` <> 0 THEN 'true' ELSE 'false' END),
		'robotsFollow', json(CASE WHEN p.`robots_follow` <> 0 THEN 'true' ELSE 'false' END)
	),
	p.`published_revision_id`, p.`scheduled_at`, p.`updated_by`, p.`created_at`, p.`updated_at`
FROM `pages` AS p
WHERE p.`template` = 'standard';--> statement-breakpoint
INSERT OR IGNORE INTO `cms_collection_revisions` (
	`id`, `collection_slug`, `document_id`, `schema_version`, `version`,
	`snapshot`, `note`, `created_by`, `created_at`
)
SELECT
	r.`id`, 'standard-pages', r.`page_id`, 1, r.`version`,
	json_object(
		'title', COALESCE(json_extract(r.`snapshot`, '$.title'), p.`title`),
		'slug', COALESCE(json_extract(r.`snapshot`, '$.slug'), p.`slug`),
		'template', 'standard',
		'blocks', json(COALESCE((
			SELECT json_group_array(json(
				CASE
					WHEN json_type(block.value, '$.schemaVersion') IS NOT NULL
					THEN json(block.value)
					ELSE json_object(
						'id', COALESCE(json_extract(block.value, '$.id'), 'standard-' || block.key || '-' || json_extract(block.value, '$.type')),
						'type', json_extract(block.value, '$.type'),
						'schemaVersion', 1,
						'enabled', json('true'),
						'data', json(json_remove(block.value, '$.id', '$.type'))
					)
				END
			))
			FROM json_each(COALESCE(json_extract(r.`snapshot`, '$.blocks'), json('[]'))) AS block
		), '[]')),
		'seoTitle', COALESCE(json_extract(r.`snapshot`, '$.seo.title'), json_extract(r.`snapshot`, '$.seoTitle'), ''),
		'seoDescription', COALESCE(json_extract(r.`snapshot`, '$.seo.description'), json_extract(r.`snapshot`, '$.seoDescription'), ''),
		'canonicalUrl', COALESCE(json_extract(r.`snapshot`, '$.seo.canonicalUrl'), json_extract(r.`snapshot`, '$.canonicalUrl'), ''),
		'ogImage', COALESCE(json_extract(r.`snapshot`, '$.seo.ogImage'), json_extract(r.`snapshot`, '$.ogImage'), ''),
		'robotsIndex', json(CASE WHEN COALESCE(json_extract(r.`snapshot`, '$.seo.robotsIndex'), json_extract(r.`snapshot`, '$.robotsIndex'), 1) <> 0 THEN 'true' ELSE 'false' END),
		'robotsFollow', json(CASE WHEN COALESCE(json_extract(r.`snapshot`, '$.seo.robotsFollow'), json_extract(r.`snapshot`, '$.robotsFollow'), 1) <> 0 THEN 'true' ELSE 'false' END)
	),
	r.`note`, r.`created_by`, r.`created_at`
FROM `page_revisions` AS r
INNER JOIN `pages` AS p ON p.`id` = r.`page_id`
WHERE p.`template` = 'standard';
