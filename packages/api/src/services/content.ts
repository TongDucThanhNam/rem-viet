import {
  createCloudflareCmsMediaProvider,
  type CloudflareCmsMediaMutationEvent,
  type CloudflareD1Database,
  type CloudflareR2MediaBucket,
} from "@agency/cms-provider-cloudflare";
import type { CmsGlobalDocument, CmsMediaRecord } from "@agency/cms-runtime";
import {
  CmsError,
  allowedMediaTypeSchema,
  menuLocationSchema,
  parseRichTextDocument,
  pageBlockListSchema,
  pageBlocksSchema,
  postStatusSchema,
  maxMediaBytes,
  mediaKeyPattern,
  safeMediaSourceSchema,
  defaultSocials,
  slugifyContent,
  socialsSchema,
  type PageRevisionSnapshot,
  type PostRevisionSnapshot,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  media,
  menus,
  pageRevisions,
  pages,
  postRevisions,
  posts,
  siteSettings,
} from "@rem-viet/db/schema/content";
import { products } from "@rem-viet/db/schema/catalog";
import { env } from "@rem-viet/env/server";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";

import { blankToUndefined } from "./parsing";
import { createRedirect } from "./operations";
import {
  createRemVietGlobalContentProvider,
  navigationGlobalKey,
  remVietNavigationGlobalSchema,
  remVietSiteSettingsGlobalSchema,
  SITE_SETTINGS_GLOBAL_KEY,
  type RemVietNavigationGlobal,
  type RemVietSiteSettingsGlobal,
} from "./global-content-runtime";
import { getPublishedRemVietHomePage } from "./home-page-runtime";
import { getPublishedRemVietStandardPage } from "./standard-page-runtime";
import {
  ContentWorkflowError,
  getPublishedPageRecordBySlug,
  getPublishedPostRecordBySlug,
  listPublishedPageRecords,
  listPublishedPostRecords,
  publishPage,
  publishPost,
  recordContentAudit,
  unpublishPage,
  unpublishPost,
  type CmsActor,
} from "./content-revisions";
import { assertCmsWorkflowInitialPublishAllowed } from "./workflow-policies";

const defaultSettingsId = "default";

const postContentSchema = z
  .string()
  .max(500_000)
  .superRefine((value, ctx) => {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && !parseRichTextDocument(trimmed)) {
      ctx.addIssue({
        code: "custom",
        message: "Structured rich-text payload is invalid",
      });
    }
  })
  .transform((value) => {
    const normalized = parseRichTextDocument(value.trim());
    return normalized ? JSON.stringify(normalized) : value;
  })
  .pipe(z.string().max(500_000));

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
  content: postContentSchema.optional().default(""),
  status: postStatusSchema.optional().default("draft"),
  publishDate: z.string().optional().default(""),
  seoTitle: z.string().optional().default(""),
  seoDescription: z.string().optional().default(""),
  canonicalUrl: z.string().optional().default(""),
  ogImage: z.string().optional().default(""),
  robotsIndex: z.boolean().optional().default(true),
  robotsFollow: z.boolean().optional().default(true),
  url: z.string().optional().default(""),
  tableOfContents: z.unknown().optional().nullable(),
});

export const updatePostInputSchema = z.object({
  postId: z.string().min(1),
  title: z.string().min(1).optional(),
  slug: z.preprocess(blankToUndefined, z.string().optional()),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: postContentSchema.optional(),
  status: postStatusSchema.optional(),
  publishDate: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  ogImage: z.string().optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  url: z.string().optional(),
  tableOfContents: z.unknown().optional().nullable(),
  expectedVersion: z.coerce.number().int().positive().optional(),
  createRedirect: z.boolean().optional(),
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

export const deletePageInputSchema = pageIdInputSchema.extend({
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const createPageInputSchema = z.object({
  title: z.string().min(1),
  slug: z.preprocess(blankToUndefined, z.string().optional()),
  template: z.enum(["landing", "standard"]).optional().default("standard"),
  blocks: pageBlocksSchema.optional().default([]),
  status: postStatusSchema.optional().default("draft"),
  seoTitle: z.string().optional().default(""),
  seoDescription: z.string().optional().default(""),
  canonicalUrl: z.string().optional().default(""),
  ogImage: z.string().optional().default(""),
  robotsIndex: z.boolean().optional().default(true),
  robotsFollow: z.boolean().optional().default(true),
});

export const updatePageInputSchema = z.object({
  pageId: z.string().min(1),
  title: z.string().min(1).optional(),
  slug: z.preprocess(blankToUndefined, z.string().optional()),
  template: z.enum(["landing", "standard"]).optional(),
  blocks: pageBlockListSchema.optional(),
  status: postStatusSchema.optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  ogImage: z.string().optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
  createRedirect: z.boolean().optional(),
});

export const createMediaInputSchema = z.object({
  key: z.string().regex(mediaKeyPattern),
  url: safeMediaSourceSchema,
  altText: z.string().optional().default(""),
  size: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(maxMediaBytes)
    .optional()
    .default(0),
  mimeType: allowedMediaTypeSchema,
  width: z.coerce.number().int().positive().optional().nullable(),
  height: z.coerce.number().int().positive().optional().nullable(),
});

export const updateMediaInputSchema = z.object({
  mediaId: z.string().min(1),
  altText: z.string().optional().default(""),
});

export const mediaIdInputSchema = z.object({
  mediaId: z.string().min(1),
  force: z.boolean().optional().default(false),
});

export const menuLocationInputSchema = z.object({
  location: menuLocationSchema,
});

export const updateMenuInputSchema = z.object({
  location: menuLocationSchema,
  title: z.string().optional().default(""),
  items: menuItemsSchema,
  expectedVersion: z.number().int().positive().optional(),
});

export const updateSiteSettingsInputSchema = z.object({
  logo: z.literal("").or(safeMediaSourceSchema).optional().default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  socials: socialsSchema.optional().default(defaultSocials),
  homepageSections: homepageSectionsSchema.optional().default([]),
  expectedVersion: z.number().int().positive().optional(),
});

export const globalRevisionInputSchema = z.object({
  revisionId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export const menuRevisionInputSchema = globalRevisionInputSchema.extend({
  location: menuLocationSchema,
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
    canonicalUrl: row.canonicalUrl,
    ogImage: row.ogImage,
    robotsIndex: row.robotsIndex,
    robotsFollow: row.robotsFollow,
    publishedRevisionId: row.publishedRevisionId,
    version: row.version,
    scheduledAt: row.scheduledAt ? iso(row.scheduledAt) : null,
    scheduleNote: row.scheduleNote,
    created_time: iso(row.createdAt),
    last_edited_time: iso(row.updatedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    lastEditedTime: iso(row.updatedAt),
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
  };
}

function toPublishedLegacyPost(
  row: typeof posts.$inferSelect,
  snapshot: PostRevisionSnapshot,
) {
  return {
    id: row.id,
    _id: row.id,
    title: snapshot.title,
    slug: snapshot.slug,
    description: snapshot.description,
    cover: snapshot.coverImage,
    coverImage: snapshot.coverImage,
    tags: snapshot.tags,
    status: "published" as const,
    url: snapshot.url,
    content: parseContent(snapshot.content),
    table_of_contents: snapshot.tableOfContents,
    tableOfContents: snapshot.tableOfContents,
    publishDate: snapshot.publishDate,
    seoTitle: snapshot.seoTitle,
    seoDescription: snapshot.seoDescription,
    canonicalUrl: snapshot.canonicalUrl,
    ogImage: snapshot.ogImage,
    robotsIndex: snapshot.robotsIndex,
    robotsFollow: snapshot.robotsFollow,
    created_time: iso(row.createdAt),
    last_edited_time: iso(row.updatedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    lastEditedTime: iso(row.updatedAt),
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
    publishedRevisionId: row.publishedRevisionId,
    version: row.version,
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
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
  };
}

function toPublishedPage(
  row: typeof pages.$inferSelect,
  snapshot: PageRevisionSnapshot,
) {
  return {
    ...row,
    ...snapshot,
    _id: row.id,
    status: "published" as const,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
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
    throw new ContentWorkflowError("CONFLICT", "Post slug already exists");
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
    throw new ContentWorkflowError("CONFLICT", "Page slug already exists");
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
  const records = await listPublishedPostRecords();

  return records.map(({ document, snapshot }) =>
    toPublishedLegacyPost(document, snapshot),
  );
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
  const slug = input.slug.replace(/\.html$/, "");
  const record = await getPublishedPostRecordBySlug(slug);

  return record
    ? toPublishedLegacyPost(record.document, record.snapshot)
    : null;
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

  return row
    ? response("Post found", 200, toLegacyPost(row))
    : response("Post not found", 404, null);
}

export async function createPost(
  input: z.infer<typeof createPostInputSchema>,
  actor?: CmsActor,
) {
  const db = createDb();
  const now = new Date();
  const postId = crypto.randomUUID();
  const slug = normalizeSlug(input.slug, input.title);
  const shouldPublish = input.status === "published";

  if (shouldPublish) {
    await assertCmsWorkflowInitialPublishAllowed("post");
  }

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
      status: "draft",
      publishDate: input.publishDate,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      canonicalUrl: input.canonicalUrl,
      ogImage: input.ogImage,
      robotsIndex: input.robotsIndex,
      robotsFollow: input.robotsFollow,
      url: input.url,
      tableOfContents: input.tableOfContents ?? null,
      version: 1,
      updatedBy: actor?.userId ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdPost) {
    throw new Error("Failed to create post");
  }

  await recordContentAudit({
    action: "post.create",
    actor,
    after: toLegacyPost(createdPost),
    entityId: createdPost.id,
    entityType: "post",
  });

  if (shouldPublish) {
    await publishPost({ postId, note: "Initial publish" }, actor);
    const publishedPost = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!publishedPost) {
      throw new Error("Published post could not be reloaded");
    }

    return response(
      "Post created and published",
      201,
      toLegacyPost(publishedPost),
    );
  }

  return response("Post created", 201, toLegacyPost(createdPost));
}

export async function updatePost(
  input: z.infer<typeof updatePostInputSchema>,
  actor?: CmsActor,
) {
  const db = createDb();
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  if (!existing) {
    return response("Post not found", 404, null);
  }

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== existing.version
  ) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Content changed since it was loaded (expected version ${input.expectedVersion}, found ${existing.version})`,
    );
  }

  const nextSlug =
    input.slug !== undefined
      ? normalizeSlug(input.slug, input.title ?? existing.title)
      : undefined;

  if (nextSlug) {
    await assertUniquePostSlug(nextSlug, input.postId);
  }

  const nextVersion = existing.version + 1;

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
      ...(input.publishDate !== undefined && {
        publishDate: input.publishDate,
      }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && {
        seoDescription: input.seoDescription,
      }),
      ...(input.canonicalUrl !== undefined && {
        canonicalUrl: input.canonicalUrl,
      }),
      ...(input.ogImage !== undefined && { ogImage: input.ogImage }),
      ...(input.robotsIndex !== undefined && {
        robotsIndex: input.robotsIndex,
      }),
      ...(input.robotsFollow !== undefined && {
        robotsFollow: input.robotsFollow,
      }),
      ...(input.url !== undefined && { url: input.url }),
      ...(Object.hasOwn(input, "tableOfContents") && {
        tableOfContents: input.tableOfContents ?? null,
      }),
      ...(input.status === "draft" && existing.status === "draft"
        ? { status: "draft" as const }
        : {}),
      version: nextVersion,
      updatedBy: actor?.userId ?? "",
      updatedAt: new Date(),
    })
    .where(
      input.expectedVersion === undefined
        ? eq(posts.id, input.postId)
        : and(
            eq(posts.id, input.postId),
            eq(posts.version, input.expectedVersion),
          ),
    )
    .returning();

  if (!updatedPost) {
    if (input.expectedVersion !== undefined) {
      throw new ContentWorkflowError(
        "CONFLICT",
        `Content changed since it was loaded (expected version ${input.expectedVersion})`,
      );
    }
    return response("Post not found", 404, null);
  }

  await recordContentAudit({
    action: "post.update",
    actor,
    before: toLegacyPost(existing),
    after: toLegacyPost(updatedPost),
    entityId: updatedPost.id,
    entityType: "post",
  });

  if (
    input.createRedirect &&
    nextSlug &&
    nextSlug !== existing.slug &&
    existing.publishedRevisionId
  ) {
    await createRedirect(
      {
        oldPath: `/bai-viet/${existing.slug}`,
        newPath: `/bai-viet/${nextSlug}`,
        statusCode: 301,
        active: true,
      },
      actor,
    );
  }

  if (input.status === "published") {
    await publishPost({ postId: input.postId }, actor);
  } else if (input.status === "draft" && existing.status === "published") {
    await unpublishPost({ postId: input.postId }, actor);
  }

  const finalPost = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  return finalPost
    ? response("Post updated", 200, toLegacyPost(finalPost))
    : response("Post not found", 404, null);
}

export async function deletePost(
  input: z.infer<typeof postIdInputSchema>,
  actor?: CmsActor,
) {
  const db = createDb();
  const [deletedPost] = await db
    .delete(posts)
    .where(eq(posts.id, input.postId))
    .returning();

  if (!deletedPost) {
    return response("Post not found", 404, null);
  }

  await recordContentAudit({
    action: "post.delete",
    actor,
    before: toLegacyPost(deletedPost),
    entityId: deletedPost.id,
    entityType: "post",
  });

  return response("Post deleted", 200, toLegacyPost(deletedPost));
}

export async function listPages(
  _input: z.infer<typeof listPagesInputSchema> = {},
) {
  const records = await listPublishedPageRecords();

  return records.map(({ document, snapshot }) =>
    toPublishedPage(document, snapshot),
  );
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
  const slug = input.slug.replace(/\.html$/, "");
  if (slug === "home") {
    const home = await getPublishedRemVietHomePage();
    return home
      ? { ...home, blocks: pageBlocksSchema.parse(home.blocks) }
      : null;
  }
  const standardPage = await getPublishedRemVietStandardPage(slug);
  if (standardPage) {
    return {
      ...standardPage,
      blocks: pageBlocksSchema.parse(standardPage.blocks),
    };
  }
  const record = await getPublishedPageRecordBySlug(slug);

  return record ? toPublishedPage(record.document, record.snapshot) : null;
}

export async function getPageById(input: z.infer<typeof pageIdInputSchema>) {
  const db = createDb();
  const row = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  return row
    ? response("Page found", 200, toPage(row))
    : response("Page not found", 404, null);
}

export async function createPage(
  input: z.infer<typeof createPageInputSchema>,
  actor?: CmsActor,
) {
  const db = createDb();
  const now = new Date();
  const pageId = crypto.randomUUID();
  const slug = normalizeSlug(input.slug, input.title);
  const shouldPublish = input.status === "published";

  if (shouldPublish) {
    await assertCmsWorkflowInitialPublishAllowed("page");
  }

  await assertUniquePageSlug(slug);

  const [createdPage] = await db
    .insert(pages)
    .values({
      id: pageId,
      slug,
      title: input.title,
      template: input.template,
      blocks: input.blocks,
      status: "draft",
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      canonicalUrl: input.canonicalUrl,
      ogImage: input.ogImage,
      robotsIndex: input.robotsIndex,
      robotsFollow: input.robotsFollow,
      version: 1,
      updatedBy: actor?.userId ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdPage) {
    throw new Error("Failed to create page");
  }

  await recordContentAudit({
    action: "page.create",
    actor,
    after: toPage(createdPage),
    entityId: createdPage.id,
    entityType: "page",
  });

  if (shouldPublish) {
    await publishPage({ pageId, note: "Initial publish" }, actor);
    const publishedPage = await db.query.pages.findFirst({
      where: eq(pages.id, pageId),
    });

    if (!publishedPage) {
      throw new Error("Published page could not be reloaded");
    }

    return response("Page created and published", 201, toPage(publishedPage));
  }

  return response("Page created", 201, toPage(createdPage));
}

export async function updatePage(
  input: z.infer<typeof updatePageInputSchema>,
  actor?: CmsActor,
) {
  const db = createDb();
  const existing = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  if (!existing) {
    return response("Page not found", 404, null);
  }

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== existing.version
  ) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Content changed since it was loaded (expected version ${input.expectedVersion}, found ${existing.version})`,
    );
  }

  const nextSlug =
    input.slug !== undefined
      ? normalizeSlug(input.slug, input.title ?? existing.title)
      : undefined;

  if (nextSlug) {
    await assertUniquePageSlug(nextSlug, input.pageId);
  }

  const nextVersion = existing.version + 1;

  const [updatedPage] = await db
    .update(pages)
    .set({
      ...(nextSlug !== undefined && { slug: nextSlug }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.template !== undefined && { template: input.template }),
      ...(input.blocks !== undefined && { blocks: input.blocks }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && {
        seoDescription: input.seoDescription,
      }),
      ...(input.canonicalUrl !== undefined && {
        canonicalUrl: input.canonicalUrl,
      }),
      ...(input.ogImage !== undefined && { ogImage: input.ogImage }),
      ...(input.robotsIndex !== undefined && {
        robotsIndex: input.robotsIndex,
      }),
      ...(input.robotsFollow !== undefined && {
        robotsFollow: input.robotsFollow,
      }),
      ...(input.status === "draft" && existing.status === "draft"
        ? { status: "draft" as const }
        : {}),
      version: nextVersion,
      updatedBy: actor?.userId ?? "",
      updatedAt: new Date(),
    })
    .where(
      input.expectedVersion === undefined
        ? eq(pages.id, input.pageId)
        : and(
            eq(pages.id, input.pageId),
            eq(pages.version, input.expectedVersion),
          ),
    )
    .returning();

  if (!updatedPage) {
    if (input.expectedVersion !== undefined) {
      throw new ContentWorkflowError(
        "CONFLICT",
        `Content changed since it was loaded (expected version ${input.expectedVersion})`,
      );
    }
    return response("Page not found", 404, null);
  }

  await recordContentAudit({
    action: "page.update",
    actor,
    before: toPage(existing),
    after: toPage(updatedPage),
    entityId: updatedPage.id,
    entityType: "page",
  });

  if (
    input.createRedirect &&
    nextSlug &&
    nextSlug !== existing.slug &&
    existing.slug !== "home" &&
    existing.publishedRevisionId
  ) {
    await createRedirect(
      {
        oldPath: `/${existing.slug}`,
        newPath: `/${nextSlug}`,
        statusCode: 301,
        active: true,
      },
      actor,
    );
  }

  if (input.status === "published") {
    await publishPage({ pageId: input.pageId }, actor);
  } else if (input.status === "draft" && existing.status === "published") {
    await unpublishPage({ pageId: input.pageId }, actor);
  }

  const finalPage = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  return finalPage
    ? response("Page updated", 200, toPage(finalPage))
    : response("Page not found", 404, null);
}

export async function deletePage(
  input: z.infer<typeof deletePageInputSchema>,
  actor?: CmsActor,
) {
  const db = createDb();
  const [deletedPage] = await db
    .delete(pages)
    .where(eq(pages.id, input.pageId))
    .returning();

  if (!deletedPage) {
    return response("Page not found", 404, null);
  }

  await recordContentAudit({
    action: "page.delete",
    actor,
    before: toPage(deletedPage),
    entityId: deletedPage.id,
    entityType: "page",
  });

  return response("Page deleted", 200, toPage(deletedPage));
}

async function loadMediaUsageCorpus() {
  const db = createDb();
  const [
    pageRows,
    postRows,
    pageRevisionRows,
    postRevisionRows,
    productRows,
    settingsRows,
  ] = await Promise.all([
    db
      .select({ id: pages.id, ogImage: pages.ogImage, value: pages.blocks })
      .from(pages),
    db
      .select({
        id: posts.id,
        cover: posts.coverImage,
        ogImage: posts.ogImage,
        value: posts.content,
      })
      .from(posts),
    db
      .select({ id: pageRevisions.id, value: pageRevisions.snapshot })
      .from(pageRevisions),
    db
      .select({ id: postRevisions.id, value: postRevisions.snapshot })
      .from(postRevisions),
    db.select({ id: products.id, value: products.imageUrls }).from(products),
    getSiteSettings().then((settings) => [
      { id: settings.id, value: settings.logo },
    ]),
  ]);
  return {
    pageRows,
    postRows,
    pageRevisionRows,
    postRevisionRows,
    productRows,
    settingsRows,
  };
}

export type MediaUsageCorpus = Awaited<ReturnType<typeof loadMediaUsageCorpus>>;

export type MediaUsageReference = {
  type:
    | "page"
    | "post"
    | "page_revision"
    | "post_revision"
    | "product"
    | "site_settings";
  id: string;
};

export function mediaUsagesFromCorpus(
  corpus: MediaUsageCorpus,
  url: string,
  key: string,
): MediaUsageReference[] {
  const {
    pageRows,
    postRows,
    pageRevisionRows,
    postRevisionRows,
    productRows,
    settingsRows,
  } = corpus;
  const needles = [url, key];
  const matches = (value: unknown) =>
    needles.some((needle) => JSON.stringify(value ?? "").includes(needle));
  return [
    ...pageRows
      .filter((row) => matches(row.ogImage) || matches(row.value))
      .map((row) => ({ type: "page" as const, id: row.id })),
    ...postRows
      .filter(
        (row) =>
          matches(row.cover) || matches(row.ogImage) || matches(row.value),
      )
      .map((row) => ({ type: "post" as const, id: row.id })),
    ...pageRevisionRows
      .filter((row) => matches(row.value))
      .map((row) => ({ type: "page_revision" as const, id: row.id })),
    ...postRevisionRows
      .filter((row) => matches(row.value))
      .map((row) => ({ type: "post_revision" as const, id: row.id })),
    ...productRows
      .filter((row) => matches(row.value))
      .map((row) => ({ type: "product" as const, id: row.id })),
    ...settingsRows
      .filter((row) => matches(row.value))
      .map((row) => ({ type: "site_settings" as const, id: row.id })),
  ];
}

export function assertMediaDeletionAllowed(
  usages: readonly MediaUsageReference[],
  force: boolean,
  actorRole?: CmsActor["role"],
) {
  if (usages.length && !force) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Media đang được dùng tại ${usages.length} vị trí. Gỡ tham chiếu trước hoặc owner force-delete.`,
    );
  }
  if (force && actorRole !== "owner") {
    throw new ContentWorkflowError(
      "FORBIDDEN",
      "Only owner can force-delete referenced media",
    );
  }
}

async function mediaUsages(url: string, key: string) {
  return mediaUsagesFromCorpus(await loadMediaUsageCorpus(), url, key);
}

function mediaRecordWithoutUsage(record: CmsMediaRecord | null) {
  if (!record) return null;
  const { usageReferences: _usageReferences, ...value } = record;
  return { ...value, _id: value.id };
}

function createMediaAuditStatement(
  database: CloudflareD1Database,
  actor: CmsActor,
  event: CloudflareCmsMediaMutationEvent,
) {
  const isDelete = event.action === "delete" || event.action === "forceDelete";
  const action =
    event.action === "upload"
      ? "media.create"
      : event.action === "update"
        ? "media.update"
        : event.action === "forceDelete"
          ? "media.force_delete"
          : "media.delete";
  const before = isDelete
    ? event.before && {
        ...mediaRecordWithoutUsage(event.before),
        usageReferences: event.usageReferences,
      }
    : mediaRecordWithoutUsage(event.before);
  const after = mediaRecordWithoutUsage(event.after);
  return database
    .prepare(
      `INSERT INTO audit_events (
        id, actor_user_id, actor_email, actor_role, action,
        entity_type, entity_id, before, after, request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'media', ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      actor.userId,
      actor.email,
      actor.role,
      action,
      event.before?.id ?? event.after?.id ?? "",
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      actor.requestId ?? "",
      event.timestamp.getTime(),
    );
}

function createRemVietMediaProvider(
  actor?: CmsActor,
  usageCorpus?: MediaUsageCorpus,
) {
  const database = env.DB as unknown as CloudflareD1Database;
  const configuredBucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket })
    .PRODUCT_IMAGES;
  const bucket = (configuredBucket ?? {
    async put() {
      throw new Error("Media storage is not configured");
    },
    async delete() {
      throw new Error("Media storage is not configured");
    },
  }) as unknown as CloudflareR2MediaBucket;
  return createCloudflareCmsMediaProvider({
    database,
    bucket,
    resolveUsage: (record) =>
      usageCorpus
        ? mediaUsagesFromCorpus(usageCorpus, record.url, record.key)
        : mediaUsages(record.url, record.key),
    prepareMutationStatements: actor
      ? (event) => createMediaAuditStatement(database, actor, event)
      : undefined,
  });
}

function toLegacyProviderMedia(record: CmsMediaRecord) {
  return { ...record, _id: record.id };
}

export async function listMedia() {
  const usageCorpus = await loadMediaUsageCorpus();
  return (await createRemVietMediaProvider(undefined, usageCorpus).list()).map(
    toLegacyProviderMedia,
  );
}

export async function uploadMediaRecord(
  input: z.infer<typeof createMediaInputSchema> & { body: unknown },
  actor: CmsActor,
) {
  const uploaded = await createRemVietMediaProvider(actor).upload({
    ...input,
    actorId: actor.userId,
  });
  return response("Media created", 201, toLegacyProviderMedia(uploaded));
}

export async function rollbackUploadedMediaRecord(
  mediaId: string,
  actor: CmsActor,
) {
  return createRemVietMediaProvider(actor).delete({
    id: mediaId,
    actorId: actor.userId,
    force: true,
  });
}

export async function createMediaRecord(
  input: z.infer<typeof createMediaInputSchema>,
  actor?: CmsActor,
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

  await recordContentAudit({
    action: "media.create",
    actor,
    after: toMedia(createdMedia),
    entityId: createdMedia.id,
    entityType: "media",
  });

  return response("Media created", 201, toMedia(createdMedia));
}

export async function updateMedia(
  input: z.infer<typeof updateMediaInputSchema>,
  actor?: CmsActor,
) {
  if (!actor) throw new Error("Media actor is required");
  try {
    const updated = await createRemVietMediaProvider(actor).updateMetadata({
      id: input.mediaId,
      altText: input.altText,
      actorId: actor.userId,
    });
    return response("Media updated", 200, toLegacyProviderMedia(updated));
  } catch (error) {
    if (error instanceof CmsError && error.code === "NOT_FOUND") {
      return response("Media not found", 404, null);
    }
    throw error;
  }
}

export async function deleteMedia(
  input: z.infer<typeof mediaIdInputSchema>,
  actor?: CmsActor,
) {
  if (!actor) throw new Error("Media actor is required");
  const provider = createRemVietMediaProvider(actor);
  const existing = await provider.get(input.mediaId);
  if (!existing) {
    return response("Media not found", 404, null);
  }
  assertMediaDeletionAllowed(
    existing.usageReferences as MediaUsageReference[],
    input.force,
    actor.role,
  );
  const deleted = await provider.delete({
    id: input.mediaId,
    actorId: actor.userId,
    force: input.force,
  });
  return response("Media deleted", 200, toLegacyProviderMedia(deleted));
}

function globalMenuToLegacy(
  document: CmsGlobalDocument<RemVietNavigationGlobal>,
) {
  return {
    id: document.key,
    _id: document.key,
    location: document.content.location,
    title: document.content.title,
    items: document.content.items,
    version: document.version,
    updatedBy: document.updatedBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function globalSettingsToLegacy(
  document: CmsGlobalDocument<RemVietSiteSettingsGlobal>,
) {
  return {
    id: defaultSettingsId,
    _id: defaultSettingsId,
    logo: document.content.logo,
    phone: document.content.phone,
    address: document.content.address,
    socials: document.content.socials,
    homepageSections: document.content.homepageSections,
    version: document.version,
    updatedBy: document.updatedBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function saveBootstrapGlobal(content: RemVietNavigationGlobal) {
  const provider = createRemVietGlobalContentProvider();
  const key = navigationGlobalKey(content.location);
  try {
    return await provider.save({
      key,
      expectedVersion: null,
      content,
      actorId: "legacy-bootstrap",
      note: "Import legacy navigation",
    });
  } catch (error) {
    if (!(error instanceof CmsError) || error.code !== "CONFLICT") throw error;
    const current = await provider.get({ key });
    if (!current) throw error;
    return current;
  }
}

async function getMenuGlobal(location: "header" | "footer") {
  const provider = createRemVietGlobalContentProvider();
  const key = navigationGlobalKey(location);
  const current = await provider.get({ key });
  if (current) {
    const content = remVietNavigationGlobalSchema.parse(current.content);
    return { ...current, content };
  }

  const legacy = await createDb().query.menus.findFirst({
    where: eq(menus.location, location),
  });
  if (!legacy) return null;
  const parsed = toMenu(legacy);
  const imported = await saveBootstrapGlobal(
    remVietNavigationGlobalSchema.parse({
      kind: "navigation",
      location,
      title: parsed.title,
      items: parsed.items,
    }),
  );
  return {
    ...imported,
    content: remVietNavigationGlobalSchema.parse(imported.content),
  };
}

async function getSiteSettingsGlobal() {
  const provider = createRemVietGlobalContentProvider();
  const current = await provider.get({ key: SITE_SETTINGS_GLOBAL_KEY });
  if (current) {
    const content = remVietSiteSettingsGlobalSchema.parse(current.content);
    return { ...current, content };
  }

  const db = createDb();
  let legacy = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, defaultSettingsId),
  });
  if (!legacy) {
    const now = new Date();
    [legacy] = await db
      .insert(siteSettings)
      .values({
        id: defaultSettingsId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    legacy ??= await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, defaultSettingsId),
    });
  }
  if (!legacy) throw new Error("Failed to bootstrap site settings");
  const parsed = toSiteSettings(legacy);
  const content = remVietSiteSettingsGlobalSchema.parse({
    kind: "site-settings",
    logo: parsed.logo,
    phone: parsed.phone,
    address: parsed.address,
    socials: parsed.socials,
    homepageSections: parsed.homepageSections,
  });
  try {
    const imported = await provider.save({
      key: SITE_SETTINGS_GLOBAL_KEY,
      expectedVersion: null,
      content,
      actorId: "legacy-bootstrap",
      note: "Import legacy site settings",
    });
    return {
      ...imported,
      content: remVietSiteSettingsGlobalSchema.parse(imported.content),
    };
  } catch (error) {
    if (!(error instanceof CmsError) || error.code !== "CONFLICT") throw error;
    const winner = await provider.get({ key: SITE_SETTINGS_GLOBAL_KEY });
    if (!winner) throw error;
    return {
      ...winner,
      content: remVietSiteSettingsGlobalSchema.parse(winner.content),
    };
  }
}

export async function listMenus() {
  const documents = await Promise.all([
    getMenuGlobal("footer"),
    getMenuGlobal("header"),
  ]);
  return documents
    .filter((document): document is NonNullable<typeof document> =>
      Boolean(document),
    )
    .map(globalMenuToLegacy)
    .sort((left, right) => left.location.localeCompare(right.location));
}

export async function getMenuByLocation(
  input: z.infer<typeof menuLocationInputSchema>,
) {
  const document = await getMenuGlobal(input.location);
  return document ? globalMenuToLegacy(document) : null;
}

export async function listMenuRevisions(
  input: z.infer<typeof menuLocationInputSchema>,
) {
  await getMenuGlobal(input.location);
  const revisions = await createRemVietGlobalContentProvider().listRevisions(
    navigationGlobalKey(input.location),
  );
  return revisions.map((revision) => ({
    ...revision,
    content: remVietNavigationGlobalSchema.parse(revision.content),
  }));
}

export async function updateMenu(
  input: z.infer<typeof updateMenuInputSchema>,
  actor?: CmsActor,
) {
  const current = await getMenuGlobal(input.location);
  const provider = createRemVietGlobalContentProvider();
  const saved = await provider.save({
    key: navigationGlobalKey(input.location),
    expectedVersion: input.expectedVersion ?? current?.version ?? null,
    content: remVietNavigationGlobalSchema.parse({
      kind: "navigation",
      location: input.location,
      title: input.title,
      items: input.items,
    }),
    actorId: actor?.userId ?? "system",
    note: current ? "Update navigation" : "Create navigation",
  });
  const document = {
    ...saved,
    content: remVietNavigationGlobalSchema.parse(saved.content),
  };
  const after = globalMenuToLegacy(document);
  await recordContentAudit({
    action: current ? "menu.update" : "menu.create",
    actor,
    ...(current ? { before: globalMenuToLegacy(current) } : {}),
    after,
    entityId: document.key,
    entityType: "menu",
  });
  return response(
    current ? "Menu updated" : "Menu created",
    current ? 200 : 201,
    after,
  );
}

export async function restoreMenuRevision(
  input: z.infer<typeof menuRevisionInputSchema>,
  actor?: CmsActor,
) {
  const current = await getMenuGlobal(input.location);
  if (!current) {
    throw new ContentWorkflowError("NOT_FOUND", "Menu or revision not found");
  }
  const restored = await createRemVietGlobalContentProvider().restore({
    key: navigationGlobalKey(input.location),
    revisionId: input.revisionId,
    expectedVersion: input.expectedVersion,
    actorId: actor?.userId ?? "system",
    note: `Restore ${input.location} navigation revision`,
  });
  const document = {
    ...restored,
    content: remVietNavigationGlobalSchema.parse(restored.content),
  };
  const after = globalMenuToLegacy(document);
  await recordContentAudit({
    action: "menu.restore",
    actor,
    before: globalMenuToLegacy(current),
    after: { ...after, restoredFrom: input.revisionId },
    entityId: document.key,
    entityType: "menu",
  });
  return response("Menu revision restored", 200, after);
}

export async function getSiteSettings() {
  return globalSettingsToLegacy(await getSiteSettingsGlobal());
}

export async function listSiteSettingsRevisions() {
  await getSiteSettingsGlobal();
  const revisions = await createRemVietGlobalContentProvider().listRevisions(
    SITE_SETTINGS_GLOBAL_KEY,
  );
  return revisions.map((revision) => ({
    ...revision,
    content: remVietSiteSettingsGlobalSchema.parse(revision.content),
  }));
}

export async function updateSiteSettings(
  input: z.infer<typeof updateSiteSettingsInputSchema>,
  actor?: CmsActor,
) {
  const current = await getSiteSettingsGlobal();
  const provider = createRemVietGlobalContentProvider();
  const saved = await provider.save({
    key: SITE_SETTINGS_GLOBAL_KEY,
    expectedVersion: input.expectedVersion ?? current.version,
    content: remVietSiteSettingsGlobalSchema.parse({
      kind: "site-settings",
      logo: input.logo,
      phone: input.phone,
      address: input.address,
      socials: input.socials,
      homepageSections: input.homepageSections,
    }),
    actorId: actor?.userId ?? "system",
    note: "Update site settings",
  });
  const document = {
    ...saved,
    content: remVietSiteSettingsGlobalSchema.parse(saved.content),
  };
  const before = globalSettingsToLegacy(current);
  const after = globalSettingsToLegacy(document);
  await recordContentAudit({
    action: "site_settings.update",
    actor,
    before,
    after,
    entityId: document.key,
    entityType: "site_settings",
  });
  return response("Site settings updated", 200, after);
}

export async function restoreSiteSettingsRevision(
  input: z.infer<typeof globalRevisionInputSchema>,
  actor?: CmsActor,
) {
  const current = await getSiteSettingsGlobal();
  const restored = await createRemVietGlobalContentProvider().restore({
    key: SITE_SETTINGS_GLOBAL_KEY,
    revisionId: input.revisionId,
    expectedVersion: input.expectedVersion,
    actorId: actor?.userId ?? "system",
    note: "Restore site settings revision",
  });
  const document = {
    ...restored,
    content: remVietSiteSettingsGlobalSchema.parse(restored.content),
  };
  const before = globalSettingsToLegacy(current);
  const after = globalSettingsToLegacy(document);
  await recordContentAudit({
    action: "site_settings.restore",
    actor,
    before,
    after: { ...after, restoredFrom: input.revisionId },
    entityId: document.key,
    entityType: "site_settings",
  });
  return response("Site settings revision restored", 200, after);
}
