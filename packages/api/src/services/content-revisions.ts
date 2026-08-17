import {
  pageRevisionSnapshotSchema,
  postRevisionSnapshotSchema,
  revisionNoteSchema,
  type PageRevisionSnapshot,
  type PostRevisionSnapshot,
  type StaffRole,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import {
  pageRevisions,
  pages,
  postRevisions,
  posts,
} from "@rem-viet/db/schema/content";
import { auditEvents } from "@rem-viet/db/schema/governance";
import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { reportOperationalIncident } from "./incidents";

export type CmsActor = {
  userId: string;
  email: string;
  role: StaffRole | "system";
  requestId?: string;
};

export const systemActor: CmsActor = {
  userId: "",
  email: "",
  role: "system",
};

export const publishContentInputSchema = z.object({
  note: revisionNoteSchema.optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const publishPageInputSchema = publishContentInputSchema.extend({
  pageId: z.string().min(1),
});

export const publishPostInputSchema = publishContentInputSchema.extend({
  postId: z.string().min(1),
});

export const pageRevisionInputSchema = z.object({
  pageId: z.string().min(1),
  revisionId: z.string().min(1),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const postRevisionInputSchema = z.object({
  postId: z.string().min(1),
  revisionId: z.string().min(1),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const unpublishPageInputSchema = z.object({
  pageId: z.string().min(1),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const unpublishPostInputSchema = z.object({
  postId: z.string().min(1),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

const scheduledAtSchema = z.coerce
  .date()
  .refine(
    (value) => value.getTime() > Date.now(),
    "Scheduled time must be in the future",
  );

export const schedulePageInputSchema = z.object({
  pageId: z.string().min(1),
  scheduledAt: scheduledAtSchema,
  note: revisionNoteSchema.optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const schedulePostInputSchema = z.object({
  postId: z.string().min(1),
  scheduledAt: scheduledAtSchema,
  note: revisionNoteSchema.optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const unschedulePageInputSchema = z.object({
  pageId: z.string().min(1),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const unschedulePostInputSchema = z.object({
  postId: z.string().min(1),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export class ContentWorkflowError extends Error {
  constructor(
    readonly code: "CONFLICT" | "NOT_FOUND" | "INVALID_REVISION" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "ContentWorkflowError";
  }
}

function assertVersion(actual: number, expected?: number) {
  if (expected !== undefined && actual !== expected) {
    throw new ContentWorkflowError(
      "CONFLICT",
      `Content changed since it was loaded (expected version ${expected}, found ${actual})`,
    );
  }
}

function pageSnapshot(row: typeof pages.$inferSelect): PageRevisionSnapshot {
  return pageRevisionSnapshotSchema.parse({
    title: row.title,
    slug: row.slug,
    template: row.template,
    blocks: row.blocks,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    ogImage: row.ogImage,
    robotsIndex: row.robotsIndex,
    robotsFollow: row.robotsFollow,
  });
}

function postSnapshot(
  row: typeof posts.$inferSelect,
  publishDate = row.publishDate,
): PostRevisionSnapshot {
  return postRevisionSnapshotSchema.parse({
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImage: row.coverImage,
    tags: row.tags,
    content: row.content,
    publishDate,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    ogImage: row.ogImage,
    robotsIndex: row.robotsIndex,
    robotsFollow: row.robotsFollow,
    url: row.url,
    tableOfContents: row.tableOfContents ?? null,
  });
}

function auditValues(input: {
  action: string;
  actor: CmsActor;
  after?: unknown;
  before?: unknown;
  entityId: string;
  entityType: string;
}) {
  return {
    id: crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor.requestId ?? "",
    createdAt: new Date(),
  } satisfies typeof auditEvents.$inferInsert;
}

export async function recordContentAudit(input: {
  action: string;
  actor?: CmsActor;
  after?: unknown;
  before?: unknown;
  entityId: string;
  entityType: string;
}) {
  const db = createDb();

  await db.insert(auditEvents).values(
    auditValues({
      ...input,
      actor: input.actor ?? systemActor,
    }),
  );
}

export type PublishedPageRecord = {
  document: typeof pages.$inferSelect;
  snapshot: PageRevisionSnapshot;
};

export type PublishedPostRecord = {
  document: typeof posts.$inferSelect;
  snapshot: PostRevisionSnapshot;
};

export async function listPublishedPageRecords() {
  const db = createDb();
  const rows = await db
    .select({ document: pages, snapshot: pageRevisions.snapshot })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.id, pages.publishedRevisionId))
    .where(eq(pages.status, "published"))
    .orderBy(desc(pages.createdAt));

  return rows.flatMap((row) => {
    const snapshot = pageRevisionSnapshotSchema.safeParse(row.snapshot);

    return snapshot.success
      ? [{ document: row.document, snapshot: snapshot.data }]
      : [];
  });
}

export async function getPublishedPageRecordBySlug(slug: string) {
  const db = createDb();
  const publishedSlug = sql<string>`json_extract(${pageRevisions.snapshot}, '$.slug')`;
  const [row] = await db
    .select({ document: pages, snapshot: pageRevisions.snapshot })
    .from(pages)
    .innerJoin(pageRevisions, eq(pageRevisions.id, pages.publishedRevisionId))
    .where(and(eq(pages.status, "published"), eq(publishedSlug, slug)))
    .limit(1);

  if (!row) {
    return null;
  }

  const snapshot = pageRevisionSnapshotSchema.safeParse(row.snapshot);

  return snapshot.success
    ? ({
        document: row.document,
        snapshot: snapshot.data,
      } satisfies PublishedPageRecord)
    : null;
}

export async function listPublishedPostRecords() {
  const db = createDb();
  const rows = await db
    .select({ document: posts, snapshot: postRevisions.snapshot })
    .from(posts)
    .innerJoin(postRevisions, eq(postRevisions.id, posts.publishedRevisionId))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.createdAt));

  return rows.flatMap((row) => {
    const snapshot = postRevisionSnapshotSchema.safeParse(row.snapshot);

    return snapshot.success
      ? [{ document: row.document, snapshot: snapshot.data }]
      : [];
  });
}

export async function getPublishedPostRecordBySlug(slugOrId: string) {
  const db = createDb();
  const publishedSlug = sql<string>`json_extract(${postRevisions.snapshot}, '$.slug')`;
  const [row] = await db
    .select({ document: posts, snapshot: postRevisions.snapshot })
    .from(posts)
    .innerJoin(postRevisions, eq(postRevisions.id, posts.publishedRevisionId))
    .where(
      and(
        eq(posts.status, "published"),
        or(eq(publishedSlug, slugOrId), eq(posts.id, slugOrId)),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const snapshot = postRevisionSnapshotSchema.safeParse(row.snapshot);

  return snapshot.success
    ? ({
        document: row.document,
        snapshot: snapshot.data,
      } satisfies PublishedPostRecord)
    : null;
}

export async function publishPage(
  input: z.infer<typeof publishPageInputSchema>,
  actor: CmsActor = systemActor,
) {
  const db = createDb();
  const document = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Page not found");
  }

  assertVersion(document.version, input.expectedVersion);

  const snapshot = pageSnapshot(document);
  const revisionId = crypto.randomUUID();
  const nextVersion = document.version + 1;
  const now = new Date();

  await db.batch([
    db.insert(pageRevisions).values({
      id: revisionId,
      pageId: document.id,
      version: nextVersion,
      snapshot,
      note: input.note ?? "",
      createdBy: actor.userId,
      createdAt: now,
    }),
    db
      .update(pages)
      .set({
        status: "published",
        publishedRevisionId: revisionId,
        publishedAt: now,
        scheduledAt: null,
        scheduledBy: "",
        scheduleNote: "",
        version: nextVersion,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(pages.id, document.id)),
    db.insert(auditEvents).values(
      auditValues({
        action: "page.publish",
        actor,
        before: {
          publishedRevisionId: document.publishedRevisionId,
          version: document.version,
        },
        after: {
          publishedRevisionId: revisionId,
          snapshot,
          version: nextVersion,
        },
        entityId: document.id,
        entityType: "page",
      }),
    ),
  ]);

  return { publishedRevisionId: revisionId, snapshot, version: nextVersion };
}

export async function publishPost(
  input: z.infer<typeof publishPostInputSchema>,
  actor: CmsActor = systemActor,
) {
  const db = createDb();
  const document = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Post not found");
  }

  assertVersion(document.version, input.expectedVersion);

  const now = new Date();
  const publishDate = document.publishDate || now.toISOString();
  const snapshot = postSnapshot(document, publishDate);
  const revisionId = crypto.randomUUID();
  const nextVersion = document.version + 1;

  await db.batch([
    db.insert(postRevisions).values({
      id: revisionId,
      postId: document.id,
      version: nextVersion,
      snapshot,
      note: input.note ?? "",
      createdBy: actor.userId,
      createdAt: now,
    }),
    db
      .update(posts)
      .set({
        status: "published",
        publishedRevisionId: revisionId,
        publishedAt: now,
        publishDate,
        scheduledAt: null,
        scheduledBy: "",
        scheduleNote: "",
        version: nextVersion,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(posts.id, document.id)),
    db.insert(auditEvents).values(
      auditValues({
        action: "post.publish",
        actor,
        before: {
          publishedRevisionId: document.publishedRevisionId,
          version: document.version,
        },
        after: {
          publishedRevisionId: revisionId,
          snapshot,
          version: nextVersion,
        },
        entityId: document.id,
        entityType: "post",
      }),
    ),
  ]);

  return { publishedRevisionId: revisionId, snapshot, version: nextVersion };
}

export async function listPageRevisions(pageId: string) {
  const db = createDb();
  return db
    .select()
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, pageId))
    .orderBy(desc(pageRevisions.version));
}

export async function listPostRevisions(postId: string) {
  const db = createDb();
  return db
    .select()
    .from(postRevisions)
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.version));
}

export async function restorePageRevision(
  input: z.infer<typeof pageRevisionInputSchema>,
  actor: CmsActor = systemActor,
) {
  const db = createDb();
  const [document, revision] = await Promise.all([
    db.query.pages.findFirst({ where: eq(pages.id, input.pageId) }),
    db.query.pageRevisions.findFirst({
      where: and(
        eq(pageRevisions.id, input.revisionId),
        eq(pageRevisions.pageId, input.pageId),
      ),
    }),
  ]);

  if (!document || !revision) {
    throw new ContentWorkflowError("NOT_FOUND", "Page or revision not found");
  }

  assertVersion(document.version, input.expectedVersion);
  const parsed = pageRevisionSnapshotSchema.safeParse(revision.snapshot);

  if (!parsed.success) {
    throw new ContentWorkflowError(
      "INVALID_REVISION",
      "Page revision is invalid",
    );
  }

  const nextVersion = document.version + 1;
  const now = new Date();

  await db.batch([
    db
      .update(pages)
      .set({
        ...parsed.data,
        version: nextVersion,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(pages.id, document.id)),
    db.insert(auditEvents).values(
      auditValues({
        action: "page.restore",
        actor,
        before: pageSnapshot(document),
        after: { restoredFrom: revision.id, snapshot: parsed.data },
        entityId: document.id,
        entityType: "page",
      }),
    ),
  ]);

  return {
    restoredFrom: revision.id,
    snapshot: parsed.data,
    version: nextVersion,
  };
}

export async function restorePostRevision(
  input: z.infer<typeof postRevisionInputSchema>,
  actor: CmsActor = systemActor,
) {
  const db = createDb();
  const [document, revision] = await Promise.all([
    db.query.posts.findFirst({ where: eq(posts.id, input.postId) }),
    db.query.postRevisions.findFirst({
      where: and(
        eq(postRevisions.id, input.revisionId),
        eq(postRevisions.postId, input.postId),
      ),
    }),
  ]);

  if (!document || !revision) {
    throw new ContentWorkflowError("NOT_FOUND", "Post or revision not found");
  }

  assertVersion(document.version, input.expectedVersion);
  const parsed = postRevisionSnapshotSchema.safeParse(revision.snapshot);

  if (!parsed.success) {
    throw new ContentWorkflowError(
      "INVALID_REVISION",
      "Post revision is invalid",
    );
  }

  const nextVersion = document.version + 1;
  const now = new Date();

  await db.batch([
    db
      .update(posts)
      .set({
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description,
        coverImage: parsed.data.coverImage,
        tags: parsed.data.tags,
        content: parsed.data.content,
        publishDate: parsed.data.publishDate,
        seoTitle: parsed.data.seoTitle,
        seoDescription: parsed.data.seoDescription,
        canonicalUrl: parsed.data.canonicalUrl,
        ogImage: parsed.data.ogImage,
        robotsIndex: parsed.data.robotsIndex,
        robotsFollow: parsed.data.robotsFollow,
        url: parsed.data.url,
        tableOfContents: parsed.data.tableOfContents,
        version: nextVersion,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(posts.id, document.id)),
    db.insert(auditEvents).values(
      auditValues({
        action: "post.restore",
        actor,
        before: postSnapshot(document),
        after: { restoredFrom: revision.id, snapshot: parsed.data },
        entityId: document.id,
        entityType: "post",
      }),
    ),
  ]);

  return {
    restoredFrom: revision.id,
    snapshot: parsed.data,
    version: nextVersion,
  };
}

export async function unpublishPage(
  input: z.infer<typeof unpublishPageInputSchema>,
  actor: CmsActor = systemActor,
) {
  const db = createDb();
  const document = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Page not found");
  }

  assertVersion(document.version, input.expectedVersion);
  const nextVersion = document.version + 1;

  await db.batch([
    db
      .update(pages)
      .set({
        status: "draft",
        publishedRevisionId: null,
        publishedAt: null,
        version: nextVersion,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, document.id)),
    db.insert(auditEvents).values(
      auditValues({
        action: "page.unpublish",
        actor,
        before: { publishedRevisionId: document.publishedRevisionId },
        after: { publishedRevisionId: null },
        entityId: document.id,
        entityType: "page",
      }),
    ),
  ]);

  return { version: nextVersion };
}

export async function unpublishPost(
  input: z.infer<typeof unpublishPostInputSchema>,
  actor: CmsActor = systemActor,
) {
  const db = createDb();
  const document = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Post not found");
  }

  assertVersion(document.version, input.expectedVersion);
  const nextVersion = document.version + 1;

  await db.batch([
    db
      .update(posts)
      .set({
        status: "draft",
        publishedRevisionId: null,
        publishedAt: null,
        version: nextVersion,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, document.id)),
    db.insert(auditEvents).values(
      auditValues({
        action: "post.unpublish",
        actor,
        before: { publishedRevisionId: document.publishedRevisionId },
        after: { publishedRevisionId: null },
        entityId: document.id,
        entityType: "post",
      }),
    ),
  ]);

  return { version: nextVersion };
}

async function setPageSchedule(
  input:
    | z.infer<typeof schedulePageInputSchema>
    | z.infer<typeof unschedulePageInputSchema>,
  actor: CmsActor,
  scheduledAt: Date | null,
  note = "",
) {
  const db = createDb();
  const document = await db.query.pages.findFirst({
    where: eq(pages.id, input.pageId),
  });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Page not found");
  }

  assertVersion(document.version, input.expectedVersion);
  const nextVersion = document.version + 1;
  const now = new Date();
  const [updated] = await db
    .update(pages)
    .set({
      scheduledAt,
      scheduledBy: scheduledAt ? actor.userId : "",
      scheduleNote: scheduledAt ? note : "",
      version: nextVersion,
      updatedBy: actor.userId,
      updatedAt: now,
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

  if (!updated) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Page changed before scheduling",
    );
  }

  await db.insert(auditEvents).values(
    auditValues({
      action: scheduledAt ? "page.schedule" : "page.unschedule",
      actor,
      before: { scheduledAt: document.scheduledAt, version: document.version },
      after: { scheduledAt, version: nextVersion },
      entityId: document.id,
      entityType: "page",
    }),
  );

  return { scheduledAt, version: nextVersion };
}

async function setPostSchedule(
  input:
    | z.infer<typeof schedulePostInputSchema>
    | z.infer<typeof unschedulePostInputSchema>,
  actor: CmsActor,
  scheduledAt: Date | null,
  note = "",
) {
  const db = createDb();
  const document = await db.query.posts.findFirst({
    where: eq(posts.id, input.postId),
  });

  if (!document) {
    throw new ContentWorkflowError("NOT_FOUND", "Post not found");
  }

  assertVersion(document.version, input.expectedVersion);
  const nextVersion = document.version + 1;
  const now = new Date();
  const [updated] = await db
    .update(posts)
    .set({
      scheduledAt,
      scheduledBy: scheduledAt ? actor.userId : "",
      scheduleNote: scheduledAt ? note : "",
      version: nextVersion,
      updatedBy: actor.userId,
      updatedAt: now,
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

  if (!updated) {
    throw new ContentWorkflowError(
      "CONFLICT",
      "Post changed before scheduling",
    );
  }

  await db.insert(auditEvents).values(
    auditValues({
      action: scheduledAt ? "post.schedule" : "post.unschedule",
      actor,
      before: { scheduledAt: document.scheduledAt, version: document.version },
      after: { scheduledAt, version: nextVersion },
      entityId: document.id,
      entityType: "post",
    }),
  );

  return { scheduledAt, version: nextVersion };
}

export function schedulePage(
  input: z.infer<typeof schedulePageInputSchema>,
  actor: CmsActor = systemActor,
) {
  return setPageSchedule(input, actor, input.scheduledAt, input.note);
}

export function unschedulePage(
  input: z.infer<typeof unschedulePageInputSchema>,
  actor: CmsActor = systemActor,
) {
  return setPageSchedule(input, actor, null);
}

export function schedulePost(
  input: z.infer<typeof schedulePostInputSchema>,
  actor: CmsActor = systemActor,
) {
  return setPostSchedule(input, actor, input.scheduledAt, input.note);
}

export function unschedulePost(
  input: z.infer<typeof unschedulePostInputSchema>,
  actor: CmsActor = systemActor,
) {
  return setPostSchedule(input, actor, null);
}

/** Publish every due working draft. Public content stays on its previous
 * immutable revision until each individual publish batch succeeds. */
export async function publishDueContent(now = new Date()) {
  const db = createDb();
  const [duePages, duePosts] = await Promise.all([
    db
      .select({ id: pages.id, template: pages.template })
      .from(pages)
      .where(lte(pages.scheduledAt, now)),
    db.select({ id: posts.id }).from(posts).where(lte(posts.scheduledAt, now)),
  ]);
  const result = {
    pages: [] as string[],
    posts: [] as string[],
    errors: [] as string[],
  };

  for (const item of duePages) {
    try {
      if (item.template === "standard") {
        const { publishRemVietStandardPage } =
          await import("./standard-page-runtime");
        await publishRemVietStandardPage(
          { pageId: item.id, note: "Scheduled publish" },
          systemActor,
        );
      } else {
        await publishPage(
          { pageId: item.id, note: "Scheduled publish" },
          systemActor,
        );
      }
      result.pages.push(item.id);
    } catch (error) {
      reportOperationalIncident({
        category: "publish",
        operation: "page.publish.scheduled",
        source: "scheduler",
        error,
        entityType: "page",
        entityId: item.id,
        recoverable: true,
      });
      result.errors.push(
        `page:${item.id}:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  for (const item of duePosts) {
    try {
      await publishPost(
        { postId: item.id, note: "Scheduled publish" },
        systemActor,
      );
      result.posts.push(item.id);
    } catch (error) {
      reportOperationalIncident({
        category: "publish",
        operation: "post.publish.scheduled",
        source: "scheduler",
        error,
        entityType: "post",
        entityId: item.id,
        recoverable: true,
      });
      result.errors.push(
        `post:${item.id}:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return result;
}
