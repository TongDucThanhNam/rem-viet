import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    folder: text("folder").default("").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    coverImage: text("cover_image").default("").notNull(),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .default([])
      .notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .default("draft")
      .notNull(),
    url: text("url").default("").notNull(),
    content: text("content").default("").notNull(),
    tableOfContents: text("table_of_contents", { mode: "json" }).$type<
      unknown | null
    >(),
    publishDate: text("publish_date").default("").notNull(),
    seoTitle: text("seo_title").default("").notNull(),
    seoDescription: text("seo_description").default("").notNull(),
    canonicalUrl: text("canonical_url").default("").notNull(),
    ogImage: text("og_image").default("").notNull(),
    robotsIndex: integer("robots_index", { mode: "boolean" })
      .default(true)
      .notNull(),
    robotsFollow: integer("robots_follow", { mode: "boolean" })
      .default(true)
      .notNull(),
    publishedRevisionId: text("published_revision_id"),
    version: integer("version").default(1).notNull(),
    updatedBy: text("updated_by").default("").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    scheduledBy: text("scheduled_by").default("").notNull(),
    scheduleNote: text("schedule_note").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    index("posts_slug_idx").on(table.slug),
    index("posts_status_idx").on(table.status),
    index("posts_folder_status_idx").on(table.folder, table.status),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    folder: text("folder").default("").notNull(),
    title: text("title").notNull(),
    template: text("template", { enum: ["landing", "standard"] })
      .default("standard")
      .notNull(),
    blocks: text("blocks", { mode: "json" })
      .$type<unknown[]>()
      .default([])
      .notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .default("draft")
      .notNull(),
    seoTitle: text("seo_title").default("").notNull(),
    seoDescription: text("seo_description").default("").notNull(),
    canonicalUrl: text("canonical_url").default("").notNull(),
    ogImage: text("og_image").default("").notNull(),
    robotsIndex: integer("robots_index", { mode: "boolean" })
      .default(true)
      .notNull(),
    robotsFollow: integer("robots_follow", { mode: "boolean" })
      .default(true)
      .notNull(),
    publishedRevisionId: text("published_revision_id"),
    version: integer("version").default(1).notNull(),
    updatedBy: text("updated_by").default("").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    scheduledBy: text("scheduled_by").default("").notNull(),
    scheduleNote: text("schedule_note").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    index("pages_slug_idx").on(table.slug),
    index("pages_status_idx").on(table.status),
    index("pages_folder_status_idx").on(table.folder, table.status),
  ],
);

export const postRevisions = sqliteTable(
  "post_revisions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<unknown>().notNull(),
    note: text("note").default("").notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("post_revisions_post_id_idx").on(table.postId),
    uniqueIndex("post_revisions_post_version_unique").on(
      table.postId,
      table.version,
    ),
  ],
);

export const pageRevisions = sqliteTable(
  "page_revisions",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<unknown>().notNull(),
    note: text("note").default("").notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("page_revisions_page_id_idx").on(table.pageId),
    uniqueIndex("page_revisions_page_version_unique").on(
      table.pageId,
      table.version,
    ),
  ],
);

export const cmsCollectionDocuments = sqliteTable(
  "cms_collection_documents",
  {
    collectionSlug: text("collection_slug").notNull(),
    id: text("id").notNull(),
    locale: text("locale").default("").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    version: integer("version").default(1).notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .default("draft")
      .notNull(),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    publishedRevisionId: text("published_revision_id"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    updatedBy: text("updated_by").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.collectionSlug, table.id, table.locale] }),
    index("cms_collection_documents_status_idx").on(
      table.collectionSlug,
      table.locale,
      table.status,
      table.updatedAt,
    ),
  ],
);

export const cmsCollectionRevisions = sqliteTable(
  "cms_collection_revisions",
  {
    id: text("id").primaryKey(),
    collectionSlug: text("collection_slug").notNull(),
    documentId: text("document_id").notNull(),
    locale: text("locale").default("").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    version: integer("version").notNull(),
    snapshot: text("snapshot", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    note: text("note").default("").notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.collectionSlug, table.documentId, table.locale],
      foreignColumns: [
        cmsCollectionDocuments.collectionSlug,
        cmsCollectionDocuments.id,
        cmsCollectionDocuments.locale,
      ],
    }).onDelete("cascade"),
    index("cms_collection_revisions_document_idx").on(
      table.collectionSlug,
      table.documentId,
      table.locale,
      table.createdAt,
    ),
    uniqueIndex("cms_collection_revisions_version_unique").on(
      table.collectionSlug,
      table.documentId,
      table.locale,
      table.version,
    ),
  ],
);

export const cmsMediaFolders = sqliteTable("cms_media_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  ...timestamps,
});

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    url: text("url").notNull(),
    altText: text("alt_text").default("").notNull(),
    size: integer("size").default(0).notNull(),
    mimeType: text("mime_type").default("").notNull(),
    width: integer("width"),
    height: integer("height"),
    folderId: text("folder_id"),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .default([])
      .notNull(),
    contentHash: text("content_hash"),
    visibility: text("visibility", { enum: ["public", "private"] })
      .default("public")
      .notNull(),
    assetStatus: text("asset_status", { enum: ["active", "trashed"] })
      .default("active")
      .notNull(),
    focalX: real("focal_x"),
    focalY: real("focal_y"),
    customMetadata: text("custom_metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    localizedMetadata: text("localized_metadata", { mode: "json" })
      .$type<Record<string, Record<string, unknown>>>()
      .default({})
      .notNull(),
    copyright: text("copyright").default("").notNull(),
    license: text("license").default("").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    trashedAt: integer("trashed_at", { mode: "timestamp_ms" }),
    purgeAt: integer("purge_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("media_key_idx").on(table.key),
    index("media_mime_type_idx").on(table.mimeType),
    uniqueIndex("media_content_hash_unique")
      .on(table.contentHash)
      .where(sql`${table.contentHash} is not null`),
    index("media_folder_status_idx").on(
      table.folderId,
      table.assetStatus,
      table.updatedAt,
    ),
  ],
);

export const cmsMediaVariants = sqliteTable(
  "cms_media_variants",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    width: integer("width"),
    height: integer("height"),
    format: text("format", { enum: ["avif", "webp", "jpeg", "png"] }).notNull(),
    fit: text("fit", { enum: ["cover", "contain", "crop"] }).notNull(),
    status: text("status", { enum: ["pending", "ready", "failed"] }).notNull(),
    objectKey: text("object_key"),
    url: text("url"),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cms_media_variants_asset_id_name_unique").on(
      table.assetId,
      table.name,
    ),
    index("cms_media_variants_asset_idx").on(table.assetId, table.createdAt),
    check(
      "cms_media_variants_format_check",
      sql`${table.format} in ('avif', 'webp', 'jpeg', 'png')`,
    ),
    check(
      "cms_media_variants_fit_check",
      sql`${table.fit} in ('cover', 'contain', 'crop')`,
    ),
    check(
      "cms_media_variants_status_check",
      sql`${table.status} in ('pending', 'ready', 'failed')`,
    ),
  ],
);

export const menus = sqliteTable(
  "menus",
  {
    id: text("id").primaryKey(),
    location: text("location", { enum: ["header", "footer"] })
      .notNull()
      .unique(),
    title: text("title").default("").notNull(),
    items: text("items", { mode: "json" })
      .$type<unknown[]>()
      .default([])
      .notNull(),
    ...timestamps,
  },
  (table) => [index("menus_location_idx").on(table.location)],
);

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  logo: text("logo").default("").notNull(),
  phone: text("phone").default("").notNull(),
  address: text("address").default("").notNull(),
  socials: text("socials", { mode: "json" })
    .$type<Record<string, string>>()
    .default({})
    .notNull(),
  homepageSections: text("homepage_sections", { mode: "json" })
    .$type<unknown[]>()
    .default([])
    .notNull(),
  ...timestamps,
});

export const cmsGlobals = sqliteTable("cms_globals", {
  key: text("key").primaryKey(),
  content: text("content", { mode: "json" }).$type<unknown>().notNull(),
  version: integer("version").default(1).notNull(),
  publishedRevisionId: text("published_revision_id"),
  updatedBy: text("updated_by").default("").notNull(),
  ...timestamps,
});

export const cmsGlobalRevisions = sqliteTable(
  "cms_global_revisions",
  {
    id: text("id").primaryKey(),
    globalKey: text("global_key")
      .notNull()
      .references(() => cmsGlobals.key, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<unknown>().notNull(),
    note: text("note").default("").notNull(),
    createdBy: text("created_by").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("cms_global_revisions_key_idx").on(table.globalKey),
    uniqueIndex("cms_global_revisions_key_version_unique").on(
      table.globalKey,
      table.version,
    ),
  ],
);

export const redirects = sqliteTable(
  "redirects",
  {
    id: text("id").primaryKey(),
    oldPath: text("old_path").notNull().unique(),
    newPath: text("new_path").notNull(),
    statusCode: integer("status_code", {
      mode: "number",
    })
      .$type<301 | 302 | 307 | 308>()
      .default(301)
      .notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    createdBy: text("created_by").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    index("redirects_active_idx").on(table.active),
    index("redirects_new_path_idx").on(table.newPath),
  ],
);

export const formDefinitions = sqliteTable(
  "form_definitions",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    fields: text("fields", { mode: "json" })
      .$type<unknown[]>()
      .default([])
      .notNull(),
    notificationSettings: text("notification_settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    retentionDays: integer("retention_days").default(365).notNull(),
    ...timestamps,
  },
  (table) => [index("form_definitions_active_idx").on(table.active)],
);

export const formSubmissions = sqliteTable(
  "form_submissions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => formDefinitions.id),
    formKey: text("form_key").notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    status: text("status", {
      enum: ["new", "contacted", "closed", "spam"],
    })
      .default("new")
      .notNull(),
    sourcePage: text("source_page").default("").notNull(),
    ipHash: text("ip_hash").default("").notNull(),
    userAgent: text("user_agent").default("").notNull(),
    internalNote: text("internal_note").default("").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    notificationStatus: text("notification_status", {
      enum: ["pending", "sent", "failed", "skipped"],
    })
      .default("pending")
      .notNull(),
    notificationResults: text("notification_results", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    notifiedAt: integer("notified_at", { mode: "timestamp_ms" }),
    notificationError: text("notification_error").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    index("form_submissions_form_idx").on(table.formId),
    index("form_submissions_status_idx").on(table.status),
    index("form_submissions_created_idx").on(table.createdAt),
    index("form_submissions_rate_idx").on(
      table.formKey,
      table.ipHash,
      table.createdAt,
    ),
  ],
);
