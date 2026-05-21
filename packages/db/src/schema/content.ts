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
    ...timestamps,
  },
  (table) => [
    index("posts_slug_idx").on(table.slug),
    index("posts_status_idx").on(table.status),
  ],
);
