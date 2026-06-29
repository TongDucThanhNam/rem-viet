import {
  menuLocationSchema,
  pageBlocksSchema,
  postStatusSchema,
  defaultSocials,
  slugifyContent,
  socialsSchema,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  media,
  menus,
  pages,
  posts,
  siteSettings,
} from "@rem-viet/db/schema/content";
import { env } from "@rem-viet/env/server";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";

import { blankToUndefined } from "./parsing";

const defaultSettingsId = "default";

const menuItemsSchema = z
  .array(
    z.object({
      label: z.string().min(1),
      href: z.string().min(1),
      order: z.coerce.number().int().optional(),
      children: z
        .array(
          z.object({
            label: z.string().min(1),
            href: z.string().min(1),
            order: z.coerce.number().int().optional(),
          }),
        )
        .optional(),
    }),
  )
  .default([]);

const homepageSectionsSchema = z
  .array(
    z.object({
      key: z.string().min(1),
      enabled: z.boolean().default(true),
      title: z.string().optional(),
    }),
  )
  .default([]);

export const listPostsInputSchema = z
  .object({
    status: postStatusSchema.optional(),
  })
  .optional();

export const adminListPostsInputSchema = z
  .object({
    search: z.preprocess(blankToUndefined, z.string().optional()),
    status: postStatusSchema.optional(),
  })
  .optional();

export const postSlugInputSchema = z.object({
  slug: z.string().min(1),
  status: postStatusSchema.optional(),
});

export const postIdInputSchema = z.object({
  postId: z.string().min(1),
});

export const createPostInputSchema = z.object({
  title: z.string().min(1),
  slug: z.preprocess(blankToUndefined, z.string().optional()),
  description: z.string().optional().default(""),
  coverImage: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  content: z.string().optional().default(""),
  status: postStatusSchema.optional().default("draft"),
  publishDate: z.string().optional().default(""),
  seoTitle: z.string().optional().default(""),
  seoDescription: z.string().optional().default(""),
  url: z.string().optional().default(""),
  tableOfContents: z.unknown().optional().nullable(),
});

export const updatePostInputSchema = createPostInputSchema
  .partial()
  .extend({
    postId: z.string().min(1),
  });

export const listPagesInputSchema = z
  .object({
    status: postStatusSchema.optional(),
  })
  .optional();

export const pageSlugInputSchema = z.object({
  slug: z.string().min(1),
  status: postStatusSchema.optional(),
});

export const pageIdInputSchema = z.object({
  pageId: z.string().min(1),
});

export const createPageInputSchema = z.object({
  title: z.string().min(1),
  slug: z.preprocess(blankToUndefined, z.string().optional()),
  blocks: pageBlocksSchema.optional().default([]),
  status: postStatusSchema.optional().default("draft"),
  seoTitle: z.string().optional().default(""),
  seoDescription: z.string().optional().default(""),
});

export const updatePageInputSchema = createPageInputSchema
  .partial()
  .extend({
    pageId: z.string().min(1),
  });

export const createMediaInputSchema = z.object({
  key: z.string().min(1),
  url: z.string().min(1),
  altText: z.string().optional().default(""),
  size: z.coerce.number().int().nonnegative().optional().default(0),
  mimeType: z.string().optional().default(""),
  width: z.coerce.number().int().positive().optional().nullable(),
  height: z.coerce.number().int().positive().optional().nullable(),
});

export const updateMediaInputSchema = z.object({
  mediaId: z.string().min(1),
  altText: z.string().optional().default(""),
});

export const mediaIdInputSchema = z.object({
  mediaId: z.string().min(1),
});

export const menuLocationInputSchema = z.object({
  location: menuLocationSchema,
});

export const updateMenuInputSchema = z.object({
  location: menuLocationSchema,
  title: z.string().optional().default(""),
  items: menuItemsSchema,
});

export const updateSiteSettingsInputSchema = z.object({
  logo: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  socials: socialsSchema.optional().default(defaultSocials),
  homepageSections: homepageSectionsSchema.optional().default([]),
});

function parseContent(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

function iso(value: Date) {
  return value.toISOString();
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
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    created_time: iso(row.createdAt),
    last_edited_time: iso(row.updatedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    lastEditedTime: iso(row.updatedAt),
  };
}

function toPage(row: typeof pages.$inferSelect) {
  const blocks = pageBlocksSchema.safeParse(row.blocks ?? []);

  return {
    ...row,
    _id: row.id,
    blocks: blocks.success ? blocks.data : [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toMedia(row: typeof media.$inferSelect) {
  return {
    ...row,
    _id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toMenu(row: typeof menus.$inferSelect) {
  const items = menuItemsSchema.safeParse(row.items ?? []);

  return {
    ...row,
    _id: row.id,
    items: items.success ? items.data : [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toSiteSettings(row: typeof siteSettings.$inferSelect) {
  const socials = socialsSchema.safeParse(row.socials ?? {});
  const homepageSections = homepageSectionsSchema.safeParse(
    row.homepageSections ?? [],
  );

  return {
    ...row,
    _id: row.id,
    socials: socials.success ? socials.data : defaultSocials,
    homepageSections: homepageSections.success ? homepageSections.data : [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function response<T>(message: string, statusCode: number, data: T) {
  return {
    message,
    statusCode,
    data,
  };
}

async function assertUniquePostSlug(slug: string, exceptPostId?: string) {
  const db = createDb();
  const row = await db.query.posts.findFirst({
    where: exceptPostId
      ? and(eq(posts.slug, slug), ne(posts.id, exceptPostId))
      : eq(posts.slug, slug),
  });

  if (row) {
    throw new Error("Post slug already exists");
  }
}

async function assertUniquePageSlug(slug: string, exceptPageId?: string) {
  const db = createDb();
  const row = await db.query.pages.findFirst({
    where: exceptPageId
      ? and(eq(pages.slug, slug), ne(pages.id, exceptPageId))
      : eq(pages.slug, slug),
  });

  if (row) {
    throw new Error("Page slug already exists");
  }
}

function normalizeSlug(slug: string | undefined, fallback: string) {
  const normalized = slugifyContent(slug || fallback);

  if (!normalized) {
    throw new Error("Slug is required");
  }

  return normalized;
}

export async function listPosts(
  _input: z.infer<typeof listPostsInputSchema> = {},
) {
  const db = createDb();
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.createdAt));

  return rows.map(toLegacyPost);
}

export async function adminListPosts(
  input: z.infer<typeof adminListPostsInputSchema> = {},
) {
  const db = createDb();
  const conditions = [];

  if (input?.status) {
    conditions.push(eq(posts.status, input.status));
  }

  const rows = await db
    .select()
    .from(posts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(posts.updatedAt));
  const keyword = input?.search?.trim().toLowerCase();
  const filtered = keyword
    ? rows.filter((post) =>
        [post.title, post.slug, post.description]
          .join(" ")
          .toLowerCase()
          .includes(keyword),
      )
    : rows;

  return filtered.map(toLegacyPost);
}

export async function getPostBySlug(
  input: z.infer<typeof postSlugInputSchema>,
) {
  const db = createDb();
  const slug = input.slug.replace(/\.html$/, "");
  const conditions = [
    or(eq(posts.slug, slug), eq(posts.id, slug)),
    eq(posts.status, "published"),
  ];

  const row = await db.query.posts.findFirst({
    where: and(...conditions),
  });

  return row ? toLegacyPost(row) : null;
}

export async function adminGetPostBySlug(
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

  return row ? toLegacyPost(row) : null;
}

export async function getPostById(input: z.infer<typeof postIdInputSchema>) {
  const db = createDb();
  const row = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  return row ? response("Post found", 200, toLegacyPost(row)) : response("Post not found", 404, null);
}

export async function createPost(
  input: z.infer<typeof createPostInputSchema>,
) {
  const db = createDb();
  const now = new Date();
  const postId = crypto.randomUUID();
  const slug = normalizeSlug(input.slug, input.title);

  await assertUniquePostSlug(slug);

  const [createdPost] = await db
    .insert(posts)
    .values({
      id: postId,
      slug,
      title: input.title,
      description: input.description,
      coverImage: input.coverImage,
      tags: input.tags,
      content: input.content,
      status: input.status,
      publishDate:
        input.status === "published" && !input.publishDate
          ? now.toISOString()
          : input.publishDate,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      url: input.url,
      tableOfContents: input.tableOfContents ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdPost) {
    throw new Error("Failed to create post");
  }

  return response("Post created", 201, toLegacyPost(createdPost));
}

export async function updatePost(
  input: z.infer<typeof updatePostInputSchema>,
) {
  const db = createDb();
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  if (!existing) {
    return response("Post not found", 404, null);
  }

  const nextSlug =
    input.slug !== undefined
      ? normalizeSlug(input.slug, input.title ?? existing.title)
      : undefined;

  if (nextSlug) {
    await assertUniquePostSlug(nextSlug, input.postId);
  }

  const [updatedPost] = await db
    .update(posts)
    .set({
      ...(nextSlug !== undefined && { slug: nextSlug }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.coverImage !== undefined && { coverImage: input.coverImage }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.publishDate !== undefined && {
        publishDate: input.publishDate,
      }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && {
        seoDescription: input.seoDescription,
      }),
      ...(input.url !== undefined && { url: input.url }),
      ...(Object.hasOwn(input, "tableOfContents") && {
        tableOfContents: input.tableOfContents ?? null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, input.postId))
    .returning();

  return updatedPost
    ? response("Post updated", 200, toLegacyPost(updatedPost))
    : response("Post not found", 404, null);
}

export async function deletePost(input: z.infer<typeof postIdInputSchema>) {
  const db = createDb();
  const [deletedPost] = await db
    .delete(posts)
    .where(eq(posts.id, input.postId))
    .returning();

  return deletedPost
    ? response("Post deleted", 200, toLegacyPost(deletedPost))
    : response("Post not found", 404, null);
}

export async function listPages(
  _input: z.infer<typeof listPagesInputSchema> = {},
) {
  const db = createDb();
  const rows = await db
    .select()
    .from(pages)
    .where(eq(pages.status, "published"))
    .orderBy(desc(pages.createdAt));

  return rows.map(toPage);
}

export async function adminListPages(
  input: z.infer<typeof listPagesInputSchema> = {},
) {
  const db = createDb();
  const rows = await db
    .select()
    .from(pages)
    .where(input?.status ? eq(pages.status, input.status) : undefined)
    .orderBy(desc(pages.updatedAt));

  return rows.map(toPage);
}

export async function getPageBySlug(
  input: z.infer<typeof pageSlugInputSchema>,
) {
  const db = createDb();
  const slug = input.slug.replace(/\.html$/, "");
  const row = await db.query.pages.findFirst({
    where: and(eq(pages.slug, slug), eq(pages.status, "published")),
  });

  return row ? toPage(row) : null;
}

export async function getPageById(input: z.infer<typeof pageIdInputSchema>) {
  const db = createDb();
  const row = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  return row ? response("Page found", 200, toPage(row)) : response("Page not found", 404, null);
}

export async function createPage(
  input: z.infer<typeof createPageInputSchema>,
) {
  const db = createDb();
  const now = new Date();
  const pageId = crypto.randomUUID();
  const slug = normalizeSlug(input.slug, input.title);

  await assertUniquePageSlug(slug);

  const [createdPage] = await db
    .insert(pages)
    .values({
      id: pageId,
      slug,
      title: input.title,
      blocks: input.blocks,
      status: input.status,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdPage) {
    throw new Error("Failed to create page");
  }

  return response("Page created", 201, toPage(createdPage));
}

export async function updatePage(
  input: z.infer<typeof updatePageInputSchema>,
) {
  const db = createDb();
  const existing = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  if (!existing) {
    return response("Page not found", 404, null);
  }

  const nextSlug =
    input.slug !== undefined
      ? normalizeSlug(input.slug, input.title ?? existing.title)
      : undefined;

  if (nextSlug) {
    await assertUniquePageSlug(nextSlug, input.pageId);
  }

  const [updatedPage] = await db
    .update(pages)
    .set({
      ...(nextSlug !== undefined && { slug: nextSlug }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.blocks !== undefined && { blocks: input.blocks }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && {
        seoDescription: input.seoDescription,
      }),
      updatedAt: new Date(),
    })
    .where(eq(pages.id, input.pageId))
    .returning();

  return updatedPage
    ? response("Page updated", 200, toPage(updatedPage))
    : response("Page not found", 404, null);
}

export async function deletePage(input: z.infer<typeof pageIdInputSchema>) {
  const db = createDb();
  const [deletedPage] = await db
    .delete(pages)
    .where(eq(pages.id, input.pageId))
    .returning();

  return deletedPage
    ? response("Page deleted", 200, toPage(deletedPage))
    : response("Page not found", 404, null);
}

export async function listMedia() {
  const db = createDb();
  const rows = await db.select().from(media).orderBy(desc(media.createdAt));

  return rows.map(toMedia);
}

export async function createMediaRecord(
  input: z.infer<typeof createMediaInputSchema>,
) {
  const db = createDb();
  const now = new Date();
  const mediaId = crypto.randomUUID();
  const [createdMedia] = await db
    .insert(media)
    .values({
      id: mediaId,
      key: input.key,
      url: input.url,
      altText: input.altText,
      size: input.size,
      mimeType: input.mimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdMedia) {
    throw new Error("Failed to create media record");
  }

  return response("Media created", 201, toMedia(createdMedia));
}

export async function updateMedia(
  input: z.infer<typeof updateMediaInputSchema>,
) {
  const db = createDb();
  const [updatedMedia] = await db
    .update(media)
    .set({
      altText: input.altText,
      updatedAt: new Date(),
    })
    .where(eq(media.id, input.mediaId))
    .returning();

  return updatedMedia
    ? response("Media updated", 200, toMedia(updatedMedia))
    : response("Media not found", 404, null);
}

export async function deleteMedia(input: z.infer<typeof mediaIdInputSchema>) {
  const db = createDb();
  const existing = await db.query.media.findFirst({
    where: eq(media.id, input.mediaId),
  });

  if (!existing) {
    return response("Media not found", 404, null);
  }

  const bucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket }).PRODUCT_IMAGES;

  if (!bucket) {
    throw new Error("Media storage is not configured");
  }

  await bucket.delete(existing.key);

  const [deletedMedia] = await db
    .delete(media)
    .where(eq(media.id, input.mediaId))
    .returning();

  return deletedMedia
    ? response("Media deleted", 200, toMedia(deletedMedia))
    : response("Media not found", 404, null);
}

export async function listMenus() {
  const db = createDb();
  const rows = await db.select().from(menus).orderBy(menus.location);

  return rows.map(toMenu);
}

export async function getMenuByLocation(
  input: z.infer<typeof menuLocationInputSchema>,
) {
  const db = createDb();
  const row = await db.query.menus.findFirst({
    where: eq(menus.location, input.location),
  });

  return row ? toMenu(row) : null;
}

export async function updateMenu(input: z.infer<typeof updateMenuInputSchema>) {
  const db = createDb();
  const existing = await db.query.menus.findFirst({
    where: eq(menus.location, input.location),
  });
  const now = new Date();

  if (!existing) {
    const [createdMenu] = await db
      .insert(menus)
      .values({
        id: crypto.randomUUID(),
        location: input.location,
        title: input.title,
        items: input.items,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!createdMenu) {
      throw new Error("Failed to create menu");
    }

    return response("Menu created", 201, toMenu(createdMenu));
  }

  const [updatedMenu] = await db
    .update(menus)
    .set({
      title: input.title,
      items: input.items,
      updatedAt: now,
    })
    .where(eq(menus.location, input.location))
    .returning();

  return updatedMenu
    ? response("Menu updated", 200, toMenu(updatedMenu))
    : response("Menu not found", 404, null);
}

export async function getSiteSettings() {
  const db = createDb();
  const existing = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, defaultSettingsId),
  });

  if (existing) {
    return toSiteSettings(existing);
  }

  const now = new Date();
  const [createdSettings] = await db
    .insert(siteSettings)
    .values({
      id: defaultSettingsId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdSettings) {
    throw new Error("Failed to create site settings");
  }

  return toSiteSettings(createdSettings);
}

export async function updateSiteSettings(
  input: z.infer<typeof updateSiteSettingsInputSchema>,
) {
  const db = createDb();
  await getSiteSettings();

  const [updatedSettings] = await db
    .update(siteSettings)
    .set({
      logo: input.logo,
      phone: input.phone,
      address: input.address,
      socials: input.socials,
      homepageSections: input.homepageSections,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, defaultSettingsId))
    .returning();

  if (!updatedSettings) {
    throw new Error("Failed to update site settings");
  }

  return response("Site settings updated", 200, toSiteSettings(updatedSettings));
}
