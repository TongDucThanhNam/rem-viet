import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    coverImage: text("cover_image").default("").notNull(),
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]).notNull(),
    status: text("status", { enum: ["draft", "published"] }).default("draft").notNull(),
    url: text("url").default("").notNull(),
    content: text("content").default("").notNull(),
    tableOfContents: text("table_of_contents", { mode: "json" }).$type<
      unknown | null
    >(),
    publishDate: text("publish_date").default("").notNull(),
    seoTitle: text("seo_title").default("").notNull(),
    seoDescription: text("seo_description").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    index("posts_slug_idx").on(table.slug),
    index("posts_status_idx").on(table.status),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    blocks: text("blocks", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
    status: text("status", { enum: ["draft", "published"] }).default("draft").notNull(),
    seoTitle: text("seo_title").default("").notNull(),
    seoDescription: text("seo_description").default("").notNull(),
    ...timestamps,
  },
  (table) => [
    index("pages_slug_idx").on(table.slug),
    index("pages_status_idx").on(table.status),
  ],
);

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
    ...timestamps,
  },
  (table) => [
    index("media_key_idx").on(table.key),
    index("media_mime_type_idx").on(table.mimeType),
  ],
);

export const menus = sqliteTable(
  "menus",
  {
    id: text("id").primaryKey(),
    location: text("location", { enum: ["header", "footer"] }).notNull().unique(),
    title: text("title").default("").notNull(),
    items: text("items", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
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
