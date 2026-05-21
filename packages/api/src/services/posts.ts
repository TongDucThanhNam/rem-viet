import { createDb } from "@rem-viet/db";
import { posts } from "@rem-viet/db/schema/content";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

export const listPostsInputSchema = z
  .object({
    status: z.enum(["draft", "published"]).optional(),
  })
  .optional();

export const postSlugInputSchema = z.object({
  slug: z.string().min(1),
  status: z.enum(["draft", "published"]).optional(),
});

function parseContent(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

function toLegacyPost(row: typeof posts.$inferSelect) {
  return {
    id: row.id,
    _id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    cover: row.coverImage,
    coverImage: row.coverImage,
    tags: row.tags,
    status: row.status,
    url: row.url,
    content: parseContent(row.content),
    table_of_contents: row.tableOfContents ?? null,
    tableOfContents: row.tableOfContents ?? null,
    publishDate: row.publishDate,
    created_time: row.createdAt.toISOString(),
    last_edited_time: row.updatedAt.toISOString(),
    lastEditedTime: row.updatedAt.toISOString(),
  };
}

export async function listPosts(
  input: z.infer<typeof listPostsInputSchema> = {},
) {
  const db = createDb();
  const rows = await db
    .select()
    .from(posts)
    .where(input?.status ? eq(posts.status, input.status) : undefined)
    .orderBy(desc(posts.createdAt));

  return rows.map(toLegacyPost);
}

export async function getPostBySlug(
  input: z.infer<typeof postSlugInputSchema>,
) {
  const db = createDb();
  const slug = input.slug.replace(/\.html$/, "");
  const conditions = [or(eq(posts.slug, slug), eq(posts.id, slug))];

  if (input.status) {
    conditions.push(eq(posts.status, input.status));
  }

  const row = await db.query.posts.findFirst({
    where: and(...conditions),
  });

  if (!row) {
    return null;
  }

  return toLegacyPost(row);
}
