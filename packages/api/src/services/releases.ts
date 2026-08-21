import {
  cmsCollectionSlugSchema,
  cmsLocaleSchema,
  cmsReleaseStatusSchema,
} from "@agency/cms-core";
import {
  defineCmsTask,
  type CmsCollectionProvider,
  type CmsGlobalContentProvider,
} from "@agency/cms-runtime";
import { redactOperationalText } from "@rem-viet/cms";
import { REM_VIET_STANDARD_PAGES_COLLECTION } from "@agency/cms-template-rem-viet";
import { createDb } from "@rem-viet/db";
import {
  cmsCollectionDocuments,
  cmsCollectionRevisions,
  pageRevisions,
  pages,
  postRevisions,
  posts,
} from "@rem-viet/db/schema/content";
import {
  cmsOutboxEvents,
  cmsReleaseItems,
  cmsReleases,
} from "@rem-viet/db/schema/automation";
import { auditEvents } from "@rem-viet/db/schema/governance";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { publishPost, systemActor, type CmsActor } from "./content-revisions";
import {
  cancelCmsJob,
  enqueueCmsJob,
  registerCmsTask,
  type CmsJobsRuntime,
} from "./jobs";
import { publishManagedPage } from "./managed-page-workflow";
import type { GovernanceActor } from "./governance";
import { createRemVietCollectionProvider } from "./standard-page-runtime";
import { createRemVietGlobalContentProvider } from "./global-content-runtime";
import { assertCmsWorkflowPublishAllowed } from "./workflow-policies";

const dayMs = 24 * 60 * 60 * 1000;
const releaseTaskName = "cms/release.publish";

const releaseItemIdentitySchema = z.object({
  documentId: z.string().trim().min(1).max(256),
  expectedVersion: z.number().int().nonnegative(),
});

const releaseItemInputSchema = z.discriminatedUnion("documentType", [
  releaseItemIdentitySchema.extend({
    documentType: z.enum(["page", "post"]),
    locale: z.null().default(null),
  }),
  releaseItemIdentitySchema.extend({
    documentType: z.literal("collection"),
    collection: cmsCollectionSlugSchema.refine(
      (value) => value !== REM_VIET_STANDARD_PAGES_COLLECTION,
      "Use the page release type for standard pages",
    ),
    locale: z.union([z.literal(""), cmsLocaleSchema]).default(""),
  }),
  releaseItemIdentitySchema.extend({
    documentType: z.literal("global"),
    documentId: z.string().trim().min(1).max(160),
    locale: z.null().default(null),
  }),
]);

export const createCmsReleaseInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    idempotencyKey: z.string().trim().min(8).max(256),
    items: z.array(releaseItemInputSchema).min(1).max(500),
  })
  .superRefine((value, context) => {
    const keys = value.items.map((item) =>
      [
        item.documentType,
        item.documentType === "collection" ? item.collection : "",
        item.documentId,
        item.locale ?? "",
      ].join(":"),
    );
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
    if (duplicate) {
      context.addIssue({
        code: "custom",
        message: `Duplicate release item: ${duplicate}`,
        path: ["items"],
      });
    }
  });

export const cmsReleaseIdInputSchema = z.object({
  releaseId: z.string().trim().min(1).max(128),
});

export const listCmsReleasesInputSchema = z.object({
  status: cmsReleaseStatusSchema.optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const scheduleCmsReleaseInputSchema = cmsReleaseIdInputSchema.extend({
  scheduledAt: z.coerce.date(),
});

type ReleaseItem = typeof cmsReleaseItems.$inferSelect;

function workflowFolderFromReleaseState(state: unknown) {
  if (!state || typeof state !== "object" || !("document" in state)) return "";
  const document = state.document;
  return document &&
    typeof document === "object" &&
    "folder" in document &&
    typeof document.folder === "string"
    ? document.folder
    : "";
}

export type CmsReleaseDocumentSnapshot = Readonly<{
  version: number;
  publicationMarker: string | null;
  state: unknown;
}>;

export type CmsReleaseDocumentAdapter = Readonly<{
  inspect: (item: ReleaseItem) => Promise<CmsReleaseDocumentSnapshot>;
  validate?: (
    item: ReleaseItem,
    current: CmsReleaseDocumentSnapshot,
  ) => Promise<void>;
  publish: (
    item: ReleaseItem,
    marker: string,
    actor: CmsActor,
  ) => Promise<CmsReleaseDocumentSnapshot>;
  rollback: (
    item: ReleaseItem,
    before: CmsReleaseDocumentSnapshot,
    after: CmsReleaseDocumentSnapshot,
    actor: CmsActor,
  ) => Promise<void>;
}>;

export type CmsReleaseRuntime = CmsJobsRuntime &
  Readonly<{
    documentAdapter?: CmsReleaseDocumentAdapter;
    collectionProvider?: CmsCollectionProvider;
    globalProvider?: CmsGlobalContentProvider;
  }>;

function runtimeDb(runtime?: CmsReleaseRuntime) {
  return runtime?.db ?? createDb();
}

function runtimeNow(runtime?: CmsReleaseRuntime) {
  return runtime?.now?.() ?? new Date();
}

async function stableId(prefix: string, value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${prefix}_${hex.slice(0, 32)}`;
}

function auditValues(input: {
  actor: GovernanceActor | CmsActor;
  action: string;
  releaseId: string;
  before?: unknown;
  after?: unknown;
  now: Date;
  auditId?: string;
}) {
  return {
    id: input.auditId ?? crypto.randomUUID(),
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    entityType: "cms_release",
    entityId: input.releaseId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.actor.requestId,
    createdAt: input.now,
  } satisfies typeof auditEvents.$inferInsert;
}

function dateValue(value: unknown) {
  return value === null || value === undefined ? null : new Date(String(value));
}

function pageRollbackValues(value: Record<string, unknown>) {
  return {
    slug: String(value.slug),
    title: String(value.title),
    template: value.template as "landing" | "standard",
    blocks: value.blocks as unknown[],
    status: value.status as "draft" | "published",
    seoTitle: String(value.seoTitle),
    seoDescription: String(value.seoDescription),
    canonicalUrl: String(value.canonicalUrl),
    ogImage: String(value.ogImage),
    robotsIndex: Boolean(value.robotsIndex),
    robotsFollow: Boolean(value.robotsFollow),
    publishedRevisionId:
      value.publishedRevisionId === null
        ? null
        : String(value.publishedRevisionId),
    version: Number(value.version),
    updatedBy: String(value.updatedBy),
    publishedAt: dateValue(value.publishedAt),
    scheduledAt: dateValue(value.scheduledAt),
    scheduledBy: String(value.scheduledBy),
    scheduleNote: String(value.scheduleNote),
    updatedAt: dateValue(value.updatedAt) ?? new Date(),
  };
}

function postRollbackValues(value: Record<string, unknown>) {
  return {
    slug: String(value.slug),
    title: String(value.title),
    description: String(value.description),
    coverImage: String(value.coverImage),
    tags: value.tags as string[],
    status: value.status as "draft" | "published",
    url: String(value.url),
    content: String(value.content),
    tableOfContents: value.tableOfContents,
    publishDate: String(value.publishDate),
    seoTitle: String(value.seoTitle),
    seoDescription: String(value.seoDescription),
    canonicalUrl: String(value.canonicalUrl),
    ogImage: String(value.ogImage),
    robotsIndex: Boolean(value.robotsIndex),
    robotsFollow: Boolean(value.robotsFollow),
    publishedRevisionId:
      value.publishedRevisionId === null
        ? null
        : String(value.publishedRevisionId),
    version: Number(value.version),
    updatedBy: String(value.updatedBy),
    publishedAt: dateValue(value.publishedAt),
    scheduledAt: dateValue(value.scheduledAt),
    scheduledBy: String(value.scheduledBy),
    scheduleNote: String(value.scheduleNote),
    updatedAt: dateValue(value.updatedAt) ?? new Date(),
  };
}

function collectionRollbackValues(value: Record<string, unknown>) {
  return {
    schemaVersion: Number(value.schemaVersion),
    version: Number(value.version),
    status: value.status as "draft" | "published",
    data: value.data as Record<string, unknown>,
    publishedRevisionId:
      value.publishedRevisionId === null
        ? null
        : String(value.publishedRevisionId),
    scheduledAt: dateValue(value.scheduledAt),
    updatedBy: String(value.updatedBy),
    updatedAt: dateValue(value.updatedAt) ?? new Date(),
  };
}

function asState(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("Release rollback state is missing");
  }
  return value as Record<string, unknown>;
}

function collectionProvider(runtime?: CmsReleaseRuntime, actor?: CmsActor) {
  return runtime?.collectionProvider ?? createRemVietCollectionProvider(actor);
}

function globalProvider(runtime?: CmsReleaseRuntime, actor?: CmsActor) {
  return runtime?.globalProvider ?? createRemVietGlobalContentProvider(actor);
}

function releaseItemIdentity(item: ReleaseItem) {
  return item.documentType === "collection"
    ? `${item.collection}:${item.documentId}:${item.locale || "default"}`
    : `${item.documentType}:${item.documentId}`;
}

function publicationOutboxKey(item: ReleaseItem, version: number) {
  return item.documentType === "collection"
    ? `content.collection.published:${releaseItemIdentity(item)}:v${version}`
    : `content.${item.documentType}.published:${item.documentId}:v${version}`;
}

function createProductionDocumentAdapter(
  runtime?: CmsReleaseRuntime,
): CmsReleaseDocumentAdapter {
  const db = runtimeDb(runtime);
  const inspect = async (
    item: ReleaseItem,
  ): Promise<CmsReleaseDocumentSnapshot> => {
    if (item.documentType === "collection") {
      const provider = collectionProvider(runtime);
      const document = await provider.getDraft({
        collection: item.collection,
        id: item.documentId,
        locale: item.locale,
      });
      if (!document) {
        throw new Error(
          `Collection document not found: ${releaseItemIdentity(item)}`,
        );
      }
      const revision = document.publishedRevisionId
        ? (
            await provider.listRevisions({
              collection: item.collection,
              id: item.documentId,
              locale: item.locale,
            })
          ).find((candidate) => candidate.id === document.publishedRevisionId)
        : null;
      return {
        version: document.version,
        publicationMarker: revision?.note ?? null,
        state: { document },
      };
    }
    if (item.documentType === "global") {
      const provider = globalProvider(runtime);
      const document = await provider.get({ key: item.documentId });
      if (!document) {
        throw new Error(`Global content not found: ${item.documentId}`);
      }
      const revision = document.publishedRevisionId
        ? (await provider.listRevisions(document.key)).find(
            (candidate) => candidate.id === document.publishedRevisionId,
          )
        : null;
      return {
        version: document.version,
        publicationMarker: revision?.note ?? null,
        state: { document },
      };
    }
    if (item.documentType === "page") {
      const document = await db.query.pages.findFirst({
        where: eq(pages.id, item.documentId),
      });
      if (!document) throw new Error(`Page not found: ${item.documentId}`);
      const revision = document.publishedRevisionId
        ? await db.query.pageRevisions.findFirst({
            where: eq(pageRevisions.id, document.publishedRevisionId),
          })
        : null;
      const collection =
        document.template === "standard"
          ? await db.query.cmsCollectionDocuments.findFirst({
              where: and(
                eq(
                  cmsCollectionDocuments.collectionSlug,
                  REM_VIET_STANDARD_PAGES_COLLECTION,
                ),
                eq(cmsCollectionDocuments.id, item.documentId),
                eq(cmsCollectionDocuments.locale, item.locale),
              ),
            })
          : null;
      return {
        version: document.version,
        publicationMarker: revision?.note ?? null,
        state: { document, collection },
      };
    }
    const document = await db.query.posts.findFirst({
      where: eq(posts.id, item.documentId),
    });
    if (!document) throw new Error(`Post not found: ${item.documentId}`);
    const revision = document.publishedRevisionId
      ? await db.query.postRevisions.findFirst({
          where: eq(postRevisions.id, document.publishedRevisionId),
        })
      : null;
    return {
      version: document.version,
      publicationMarker: revision?.note ?? null,
      state: { document },
    };
  };

  return {
    inspect,
    async validate(item, current) {
      if (item.documentType === "global") return;
      await assertCmsWorkflowPublishAllowed(
        {
          collection:
            item.documentType === "collection"
              ? item.collection
              : item.documentType,
          documentId: item.documentId,
          version: current.version,
          locale: item.locale,
          folder: workflowFolderFromReleaseState(current.state),
        },
        runtime,
      );
    },
    async publish(item, marker, actor) {
      if (item.documentType === "collection") {
        await collectionProvider(runtime, actor).publish({
          collection: item.collection,
          id: item.documentId,
          locale: item.locale,
          expectedVersion: item.expectedVersion,
          actorId: actor.userId,
          note: marker,
        });
      } else if (item.documentType === "global") {
        await globalProvider(runtime, actor).publish({
          key: item.documentId,
          expectedVersion: item.expectedVersion,
          actorId: actor.userId,
          note: marker,
        });
      } else if (item.documentType === "page") {
        await publishManagedPage(
          {
            pageId: item.documentId,
            expectedVersion: item.expectedVersion,
            note: marker,
          },
          actor,
        );
      } else {
        await publishPost(
          {
            postId: item.documentId,
            expectedVersion: item.expectedVersion,
            note: marker,
          },
          actor,
        );
      }
      return inspect(item);
    },
    async rollback(item, before, after, actor) {
      const beforeState = asState(before.state);
      const afterState = asState(after.state);
      const beforeDocument = asState(beforeState.document);
      const afterDocument = asState(afterState.document);
      const current = await inspect(item);
      const currentState = asState(current.state);
      const currentDocument = asState(currentState.document);
      if (
        current.version !== after.version ||
        currentDocument.publishedRevisionId !==
          afterDocument.publishedRevisionId
      ) {
        throw new Error(
          `Cannot compensate ${item.documentType} ${item.documentId}; it changed after release publication`,
        );
      }
      const now = runtimeNow(runtime);
      const queries = [];
      if (item.documentType === "global") {
        await globalProvider(runtime, actor).rollbackPublication({
          key: item.documentId,
          expectedVersion: after.version,
          restoreVersion: before.version,
          restorePublishedRevisionId:
            beforeDocument.publishedRevisionId === null
              ? null
              : String(beforeDocument.publishedRevisionId),
          publicationRevisionId: String(afterDocument.publishedRevisionId),
          actorId: actor.userId,
        });
      } else if (item.documentType === "collection") {
        queries.push(
          db
            .update(cmsCollectionDocuments)
            .set(collectionRollbackValues(beforeDocument))
            .where(
              and(
                eq(cmsCollectionDocuments.collectionSlug, item.collection),
                eq(cmsCollectionDocuments.id, item.documentId),
                eq(cmsCollectionDocuments.locale, item.locale),
                eq(cmsCollectionDocuments.version, after.version),
              ),
            ),
          db
            .delete(cmsCollectionRevisions)
            .where(
              eq(
                cmsCollectionRevisions.id,
                String(afterDocument.publishedRevisionId),
              ),
            ),
        );
      } else if (item.documentType === "page") {
        queries.push(
          db
            .update(pages)
            .set(pageRollbackValues(beforeDocument))
            .where(
              and(
                eq(pages.id, item.documentId),
                eq(pages.version, after.version),
              ),
            ),
          db
            .delete(pageRevisions)
            .where(
              eq(pageRevisions.id, String(afterDocument.publishedRevisionId)),
            ),
        );
        const beforeCollection = beforeState.collection;
        const afterCollection = afterState.collection;
        if (beforeCollection && afterCollection) {
          const beforeCollectionState = asState(beforeCollection);
          const afterCollectionState = asState(afterCollection);
          queries.push(
            db
              .update(cmsCollectionDocuments)
              .set(collectionRollbackValues(beforeCollectionState))
              .where(
                and(
                  eq(
                    cmsCollectionDocuments.collectionSlug,
                    REM_VIET_STANDARD_PAGES_COLLECTION,
                  ),
                  eq(cmsCollectionDocuments.id, item.documentId),
                  eq(cmsCollectionDocuments.locale, item.locale),
                  eq(cmsCollectionDocuments.version, after.version),
                ),
              ),
            db
              .delete(cmsCollectionRevisions)
              .where(
                eq(
                  cmsCollectionRevisions.id,
                  String(afterCollectionState.publishedRevisionId),
                ),
              ),
          );
        }
      } else {
        queries.push(
          db
            .update(posts)
            .set(postRollbackValues(beforeDocument))
            .where(
              and(
                eq(posts.id, item.documentId),
                eq(posts.version, after.version),
              ),
            ),
          db
            .delete(postRevisions)
            .where(
              eq(postRevisions.id, String(afterDocument.publishedRevisionId)),
            ),
        );
      }
      queries.push(
        db
          .delete(cmsOutboxEvents)
          .where(
            eq(
              cmsOutboxEvents.idempotencyKey,
              publicationOutboxKey(item, after.version),
            ),
          ),
        db.insert(auditEvents).values(
          auditValues({
            actor,
            action: "cms_release.item_rollback",
            releaseId: item.releaseId,
            before: { itemId: item.id, version: after.version },
            after: { itemId: item.id, version: before.version },
            now,
          }),
        ),
      );
      await db.batch(queries as [(typeof queries)[number], ...typeof queries]);
    },
  };
}

function documentAdapter(runtime?: CmsReleaseRuntime) {
  return runtime?.documentAdapter ?? createProductionDocumentAdapter(runtime);
}

function assertReleaseMatchesInput(
  release: Awaited<ReturnType<typeof getCmsRelease>>,
  input: z.infer<typeof createCmsReleaseInputSchema>,
) {
  const itemsMatch =
    release.items.length === input.items.length &&
    release.items.every((item, position) => {
      const requested = input.items[position];
      return (
        requested !== undefined &&
        item.position === position &&
        item.documentType === requested.documentType &&
        item.collection ===
          (requested.documentType === "collection"
            ? requested.collection
            : "") &&
        item.documentId === requested.documentId &&
        item.expectedVersion === requested.expectedVersion &&
        item.locale === (requested.locale ?? "")
      );
    });
  if (
    release.name !== input.name ||
    release.idempotencyKey !== input.idempotencyKey ||
    !itemsMatch
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Release idempotency key is already bound to another payload",
    });
  }
}

export async function createCmsRelease(
  input: z.infer<typeof createCmsReleaseInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsReleaseRuntime,
) {
  const parsed = createCmsReleaseInputSchema.parse(input);
  const db = runtimeDb(runtime);
  const now = runtimeNow(runtime);
  const id = await stableId("rel", parsed.idempotencyKey);
  const existing = await db.query.cmsReleases.findFirst({
    where: eq(cmsReleases.id, id),
  });
  if (existing) {
    const release = await getCmsRelease(id, runtime);
    assertReleaseMatchesInput(release, parsed);
    return release;
  }
  const itemValues = await Promise.all(
    parsed.items.map(async (item, position) => ({
      id: await stableId("reli", `${id}:${position}`),
      releaseId: id,
      documentType: item.documentType,
      collection: item.documentType === "collection" ? item.collection : "",
      documentId: item.documentId,
      locale: item.locale ?? "",
      expectedVersion: item.expectedVersion,
      position,
      status: "pending" as const,
    })),
  );
  await db.batch([
    db
      .insert(cmsReleases)
      .values({
        id,
        name: parsed.name,
        status: "draft",
        idempotencyKey: parsed.idempotencyKey,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: cmsReleases.id }),
    ...itemValues.map((item) =>
      db
        .insert(cmsReleaseItems)
        .values(item)
        .onConflictDoNothing({ target: cmsReleaseItems.id }),
    ),
    db
      .insert(auditEvents)
      .values(
        auditValues({
          actor,
          action: "cms_release.create",
          releaseId: id,
          after: {
            name: parsed.name,
            items: itemValues.map((item) => ({
              documentType: item.documentType,
              collection: item.collection,
              documentId: item.documentId,
              locale: item.locale,
              expectedVersion: item.expectedVersion,
            })),
          },
          now,
          auditId: `cms-release-create:${id}`,
        }),
      )
      .onConflictDoNothing({ target: auditEvents.id }),
  ]);
  const release = await getCmsRelease(id, runtime);
  assertReleaseMatchesInput(release, parsed);
  return release;
}

export async function getCmsRelease(
  releaseId: string,
  runtime?: CmsReleaseRuntime,
) {
  const db = runtimeDb(runtime);
  const release = await db.query.cmsReleases.findFirst({
    where: eq(cmsReleases.id, releaseId),
  });
  if (!release) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "CMS release not found",
    });
  }
  const items = await db
    .select()
    .from(cmsReleaseItems)
    .where(eq(cmsReleaseItems.releaseId, release.id))
    .orderBy(asc(cmsReleaseItems.position));
  return { ...release, items };
}

export async function listCmsReleases(
  input: z.infer<typeof listCmsReleasesInputSchema>,
  runtime?: CmsReleaseRuntime,
) {
  const parsed = listCmsReleasesInputSchema.parse(input);
  const db = runtimeDb(runtime);
  const rows = await db
    .select()
    .from(cmsReleases)
    .where(parsed.status ? eq(cmsReleases.status, parsed.status) : undefined)
    .orderBy(desc(cmsReleases.createdAt))
    .limit(parsed.limit);
  return Promise.all(rows.map((release) => getCmsRelease(release.id, runtime)));
}

export async function previewCmsRelease(
  input: z.infer<typeof cmsReleaseIdInputSchema>,
  runtime?: CmsReleaseRuntime,
) {
  const release = await getCmsRelease(input.releaseId, runtime);
  const adapter = documentAdapter(runtime);
  const items = [];
  for (const item of release.items) {
    let currentVersion: number | null = null;
    try {
      const current = await adapter.inspect(item);
      currentVersion = current.version;
      const alreadyApplied =
        current.version === item.expectedVersion + 1 &&
        current.publicationMarker === releaseMarker(release.id, item.id);
      if (!alreadyApplied && current.version !== item.expectedVersion) {
        throw new Error(
          `Expected version ${item.expectedVersion}, found ${current.version}`,
        );
      }
      if (!alreadyApplied) await adapter.validate?.(item, current);
      items.push({
        id: item.id,
        documentType: item.documentType,
        collection: item.collection,
        documentId: item.documentId,
        locale: item.locale,
        expectedVersion: item.expectedVersion,
        currentVersion,
        alreadyApplied,
        valid: true,
        issue: "",
      });
    } catch (error) {
      items.push({
        id: item.id,
        documentType: item.documentType,
        collection: item.collection,
        documentId: item.documentId,
        locale: item.locale,
        expectedVersion: item.expectedVersion,
        currentVersion,
        alreadyApplied: false,
        valid: false,
        issue: redactOperationalText(
          error instanceof Error ? error.message : String(error),
        ),
      });
    }
  }
  return {
    releaseId: release.id,
    name: release.name,
    status: release.status,
    valid: items.every((item) => item.valid),
    items,
  };
}

const releasePayloadSchema = z.object({ releaseId: z.string().min(1) });

export function createCmsReleasePublishTask(runtime?: CmsReleaseRuntime) {
  return defineCmsTask({
    definition: {
      name: releaseTaskName,
      queue: "cms-releases",
      timeoutMs: 5 * 60 * 1000,
      retry: {
        maxAttempts: 5,
        initialDelayMs: 5_000,
        multiplier: 2,
        maxDelayMs: 15 * 60 * 1000,
        jitter: 0.2,
      },
      retentionDays: 90,
    },
    parsePayload: (value) => releasePayloadSchema.parse(value),
    execute: (payload, context) =>
      executeCmsRelease(
        payload.releaseId,
        {
          ...systemActor,
          requestId: `job:${context.jobId}`,
        },
        runtime,
      ),
  });
}

const productionReleaseTask = createCmsReleasePublishTask();

export function ensureCmsReleaseTaskRegistered(runtime?: CmsReleaseRuntime) {
  const task = runtime
    ? createCmsReleasePublishTask(runtime)
    : productionReleaseTask;
  registerCmsTask(task);
  return task;
}

export async function scheduleCmsRelease(
  input: z.infer<typeof scheduleCmsReleaseInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsReleaseRuntime,
) {
  const db = runtimeDb(runtime);
  const release = await getCmsRelease(input.releaseId, runtime);
  if (release.status === "scheduled" && release.jobId) return release;
  if (release.status !== "draft" && release.status !== "failed") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Release cannot be scheduled from ${release.status}`,
    });
  }
  ensureCmsReleaseTaskRegistered(runtime);
  const job = await enqueueCmsJob(
    {
      taskName: releaseTaskName,
      payload: { releaseId: release.id },
      idempotencyKey: `cms-release:${release.id}:publish`,
      availableAt: input.scheduledAt,
    },
    runtime,
  );
  const now = runtimeNow(runtime);
  await db.batch([
    db
      .update(cmsReleases)
      .set({
        status: "scheduled",
        scheduledAt: input.scheduledAt,
        jobId: job.id,
        lastError: "",
        updatedAt: now,
      })
      .where(eq(cmsReleases.id, release.id)),
    db.insert(auditEvents).values(
      auditValues({
        actor,
        action: "cms_release.schedule",
        releaseId: release.id,
        before: { status: release.status },
        after: { scheduledAt: input.scheduledAt, jobId: job.id },
        now,
      }),
    ),
  ]);
  return getCmsRelease(release.id, runtime);
}

export function publishCmsReleaseNow(
  input: z.infer<typeof cmsReleaseIdInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsReleaseRuntime,
) {
  return scheduleCmsRelease(
    { releaseId: input.releaseId, scheduledAt: runtimeNow(runtime) },
    actor,
    runtime,
  );
}

export async function cancelCmsRelease(
  input: z.infer<typeof cmsReleaseIdInputSchema>,
  actor: GovernanceActor,
  runtime?: CmsReleaseRuntime,
) {
  const db = runtimeDb(runtime);
  const release = await getCmsRelease(input.releaseId, runtime);
  if (["published", "rolled_back", "cancelled"].includes(release.status)) {
    return release;
  }
  if (release.jobId) await cancelCmsJob(release.jobId, runtime, actor);
  const now = runtimeNow(runtime);
  await db.batch([
    db
      .update(cmsReleases)
      .set({ status: "cancelled", updatedAt: now, completedAt: now })
      .where(eq(cmsReleases.id, release.id)),
    db.insert(auditEvents).values(
      auditValues({
        actor,
        action: "cms_release.cancel",
        releaseId: release.id,
        before: { status: release.status, jobId: release.jobId },
        now,
      }),
    ),
  ]);
  return getCmsRelease(release.id, runtime);
}

function releaseMarker(releaseId: string, itemId: string) {
  return `cms-release:${releaseId}:${itemId}`;
}

export async function executeCmsRelease(
  releaseId: string,
  actor: CmsActor = systemActor,
  runtime?: CmsReleaseRuntime,
) {
  const db = runtimeDb(runtime);
  const release = await getCmsRelease(releaseId, runtime);
  if (release.status === "published") return release.receipt;
  if (release.status === "cancelled") return { status: "cancelled" as const };
  if (
    !["draft", "scheduled", "publishing", "failed"].includes(release.status)
  ) {
    throw new Error(`Release cannot execute from ${release.status}`);
  }
  const startedAt = runtimeNow(runtime);
  await db
    .update(cmsReleases)
    .set({
      status: "publishing",
      startedAt: release.startedAt ?? startedAt,
      completedAt: null,
      lastError: "",
      updatedAt: startedAt,
    })
    .where(eq(cmsReleases.id, release.id));
  const adapter = documentAdapter(runtime);

  try {
    for (const item of release.items) {
      if (item.status === "published") continue;
      const marker = releaseMarker(release.id, item.id);
      const current = await adapter.inspect(item);
      if (
        current.version === item.expectedVersion + 1 &&
        current.publicationMarker === marker
      ) {
        await db
          .update(cmsReleaseItems)
          .set({
            status: "published",
            afterState: current,
            publishedAt: runtimeNow(runtime),
            lastError: "",
          })
          .where(eq(cmsReleaseItems.id, item.id));
        continue;
      }
      if (current.version !== item.expectedVersion) {
        throw new Error(
          `Release conflict for ${item.documentType} ${item.documentId}: expected version ${item.expectedVersion}, found ${current.version}`,
        );
      }
      await adapter.validate?.(item, current);
      await db
        .update(cmsReleaseItems)
        .set({
          status: "pending",
          beforeState: item.beforeState ?? current,
          afterState: null,
          lastError: "",
        })
        .where(eq(cmsReleaseItems.id, item.id));
    }

    for (const item of release.items) {
      const reloaded = await db.query.cmsReleaseItems.findFirst({
        where: eq(cmsReleaseItems.id, item.id),
      });
      if (!reloaded || reloaded.status === "published") continue;
      const marker = releaseMarker(release.id, item.id);
      const current = await adapter.inspect(reloaded);
      const after =
        current.version === reloaded.expectedVersion + 1 &&
        current.publicationMarker === marker
          ? current
          : await adapter.publish(reloaded, marker, actor);
      if (
        after.version !== reloaded.expectedVersion + 1 ||
        after.publicationMarker !== marker
      ) {
        throw new Error(
          `Release publication receipt is invalid for ${reloaded.documentType} ${reloaded.documentId}`,
        );
      }
      await db
        .update(cmsReleaseItems)
        .set({
          status: "published",
          afterState: after,
          publishedAt: runtimeNow(runtime),
          lastError: "",
        })
        .where(eq(cmsReleaseItems.id, reloaded.id));
    }

    const completedAt = runtimeNow(runtime);
    const completed = await getCmsRelease(release.id, runtime);
    const receipt = {
      schemaVersion: 1,
      releaseId: release.id,
      status: "published",
      completedAt: completedAt.toISOString(),
      items: completed.items.map((item) => ({
        id: item.id,
        documentType: item.documentType,
        collection: item.collection,
        documentId: item.documentId,
        locale: item.locale,
        expectedVersion: item.expectedVersion,
        publishedVersion: item.expectedVersion + 1,
      })),
      compensation: null,
    };
    await db.batch([
      db
        .update(cmsReleases)
        .set({
          status: "published",
          receipt,
          completedAt,
          updatedAt: completedAt,
          lastError: "",
        })
        .where(eq(cmsReleases.id, release.id)),
      db.insert(auditEvents).values(
        auditValues({
          actor,
          action: "cms_release.publish",
          releaseId: release.id,
          after: receipt,
          now: completedAt,
        }),
      ),
    ]);
    return receipt;
  } catch (error) {
    const message = redactOperationalText(
      error instanceof Error ? error.message : String(error),
    );
    const current = await getCmsRelease(release.id, runtime);
    const compensation: Array<{
      itemId: string;
      status: "rolled_back" | "failed";
      error?: string;
    }> = [];
    for (const item of [...current.items].reverse()) {
      const marker = releaseMarker(release.id, item.id);
      try {
        const inspected = await adapter.inspect(item);
        const wasPublished =
          item.status === "published" ||
          (inspected.version === item.expectedVersion + 1 &&
            inspected.publicationMarker === marker);
        if (!wasPublished) continue;
        if (!item.beforeState) {
          throw new Error("Release rollback state is missing");
        }
        const before = item.beforeState as CmsReleaseDocumentSnapshot;
        const after = (item.afterState ??
          inspected) as CmsReleaseDocumentSnapshot;
        await adapter.rollback(item, before, after, actor);
        const rolledBackAt = runtimeNow(runtime);
        await db
          .update(cmsReleaseItems)
          .set({
            status: "rolled_back",
            rolledBackAt,
            lastError: "",
          })
          .where(eq(cmsReleaseItems.id, item.id));
        compensation.push({ itemId: item.id, status: "rolled_back" });
      } catch (rollbackError) {
        const rollbackMessage = redactOperationalText(
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError),
        );
        await db
          .update(cmsReleaseItems)
          .set({ status: "failed", lastError: rollbackMessage })
          .where(eq(cmsReleaseItems.id, item.id));
        compensation.push({
          itemId: item.id,
          status: "failed",
          error: rollbackMessage,
        });
      }
    }
    const failedAt = runtimeNow(runtime);
    const receipt = {
      schemaVersion: 1,
      releaseId: release.id,
      status: "failed",
      failedAt: failedAt.toISOString(),
      error: message,
      compensation,
      compensationComplete: compensation.every(
        (item) => item.status === "rolled_back",
      ),
    };
    await db.batch([
      db
        .update(cmsReleases)
        .set({
          status: "failed",
          receipt,
          lastError: message,
          completedAt: failedAt,
          updatedAt: failedAt,
        })
        .where(eq(cmsReleases.id, release.id)),
      db.insert(auditEvents).values(
        auditValues({
          actor,
          action: "cms_release.failed",
          releaseId: release.id,
          after: receipt,
          now: failedAt,
        }),
      ),
    ]);
    throw new Error(message);
  }
}

export const cmsReleaseRetentionMs = 90 * dayMs;
