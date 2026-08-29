import {
  createCloudflareCmsCollectionProvider,
  createCloudflareCmsEditorialReviewProvider,
  type CloudflareCmsCollectionMutationEvent,
  type CloudflareCmsMutationEvent,
  type CloudflareD1Database,
  type CloudflareD1PreparedStatement,
} from "@agency/cms-provider-cloudflare";
import { createCmsExtensionRegistry } from "@agency/cms-core";
import {
  cmsReusableContentModule,
  createCmsPageCollectionAdapter,
  createCmsReusableContentRuntime,
  type CmsPageContent,
} from "@agency/cms-runtime";
import {
  fromRemVietStandardPageCollectionData,
  remVietStandardPagesCollection,
  remVietStandardPagesModule,
  toRemVietStandardPageCollectionData,
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
  type RemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import {
  cmsContentFolderSchema,
  parseRichTextDocument,
  slugifyContent,
} from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";

import type { CmsActor } from "./content-revisions";
import { validateRedirectGraph } from "./operations";
import { pageMutationStatements } from "./page-provider-audit";
import {
  pageSlugRedirectStatements,
  type PageSlugRedirect,
} from "./page-provider-redirect";
import { assertCmsWorkflowInitialPublishAllowed } from "./workflow-policies";
import { collectionMutationStatements } from "./collection-provider-audit";

export type RemVietStandardPageContent = Omit<
  CmsPageContent<RemVietStandardBlock>,
  "template"
> & { folder: string; template: "standard" };

type RemVietPageMutationEvent =
  CloudflareCmsMutationEvent<RemVietStandardPageContent> & {
    readonly note?: string;
  };

type StoredStandardContent = Record<string, unknown> & {
  blocks?: unknown;
  seo?: unknown;
};

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function parseRemVietStandardPageContent(
  value: unknown,
): RemVietStandardPageContent {
  const input = value as StoredStandardContent;
  if (
    !input ||
    typeof input.title !== "string" ||
    typeof input.slug !== "string" ||
    input.template !== "standard" ||
    !Array.isArray(input.blocks)
  ) {
    throw new Error("Invalid Rèm Việt standard page content.");
  }
  const blocks = input.blocks.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success) throw parsed.error;
    if (parsed.data.type !== "richText") return parsed.data;
    const normalized = parseRichTextDocument(parsed.data.data.content.trim());
    return normalized
      ? {
          ...parsed.data,
          data: { content: JSON.stringify(normalized) },
        }
      : parsed.data;
  });
  const nestedSeo =
    input.seo && typeof input.seo === "object"
      ? (input.seo as Record<string, unknown>)
      : null;
  return {
    title: input.title,
    slug: input.slug,
    folder: cmsContentFolderSchema.parse(input.folder ?? ""),
    template: "standard",
    blocks,
    seo: {
      title: String(nestedSeo?.title ?? input.seoTitle ?? ""),
      description: String(nestedSeo?.description ?? input.seoDescription ?? ""),
      canonicalUrl: String(nestedSeo?.canonicalUrl ?? input.canonicalUrl ?? ""),
      ogImage: String(nestedSeo?.ogImage ?? input.ogImage ?? ""),
      robotsIndex: booleanValue(
        nestedSeo?.robotsIndex ?? input.robotsIndex,
        true,
      ),
      robotsFollow: booleanValue(
        nestedSeo?.robotsFollow ?? input.robotsFollow,
        true,
      ),
    },
  };
}

export function encodeRemVietStandardPageBlocks(
  content: RemVietStandardPageContent,
) {
  return content.blocks.map(toLegacyRemVietStandardBlock);
}

export function encodeRemVietStandardPageRevision(
  content: RemVietStandardPageContent,
) {
  return {
    title: content.title,
    slug: content.slug,
    folder: content.folder,
    template: content.template,
    blocks: encodeRemVietStandardPageBlocks(content),
    seoTitle: content.seo.title,
    seoDescription: content.seo.description,
    canonicalUrl: content.seo.canonicalUrl,
    ogImage: content.seo.ogImage,
    robotsIndex: content.seo.robotsIndex,
    robotsFollow: content.seo.robotsFollow,
  };
}

const remVietExtensions = createCmsExtensionRegistry({
  modules: [remVietStandardPagesModule, cmsReusableContentModule],
});

export async function resolveRemVietStandardPageBlocks(
  blocks: readonly RemVietStandardBlock[],
  mode: "draft" | "published" = "published",
) {
  const runtime = createCmsReusableContentRuntime(
    createRemVietCollectionProvider(),
  );
  return Promise.all(
    blocks.map(async (block, index) => {
      if (block.type !== "reusableContent") return block;
      const resolved = await runtime.resolve({
        value: block.data.reference,
        mode,
      });
      const parsed = toRemVietStandardBlock(resolved.value, index);
      if (!parsed.success) throw parsed.error;
      if (parsed.data.type === "reusableContent") {
        throw new Error(
          "Nested reusable block wrappers must resolve before render.",
        );
      }
      return { ...parsed.data, id: block.id };
    }),
  );
}

function legacyPageValues(content: RemVietStandardPageContent) {
  return [
    content.slug,
    content.folder,
    content.title,
    content.template,
    JSON.stringify(encodeRemVietStandardPageBlocks(content)),
    content.seo.title,
    content.seo.description,
    content.seo.canonicalUrl,
    content.seo.ogImage,
    content.seo.robotsIndex ? 1 : 0,
    content.seo.robotsFollow ? 1 : 0,
  ] as const;
}

function pageMutationEvent(
  event: CloudflareCmsCollectionMutationEvent,
): RemVietPageMutationEvent {
  const parse = (value: Readonly<Record<string, unknown>> | null) =>
    value
      ? parseRemVietStandardPageContent(
          fromRemVietStandardPageCollectionData(value),
        )
      : null;
  return {
    action: event.action,
    actorId: event.actorId,
    after: parse(event.after),
    before: parse(event.before),
    documentId: event.documentId,
    previousPublishedRevisionId: event.previousPublishedRevisionId,
    previousScheduledAt: event.previousScheduledAt,
    revisionId: event.revisionId,
    note: event.note,
    scheduledAt: event.scheduledAt,
    timestamp: event.timestamp,
    version: event.version,
  };
}

function legacyPageProjectionStatements(
  database: CloudflareD1Database,
  event: RemVietPageMutationEvent,
): CloudflareD1PreparedStatement[] {
  const now = event.timestamp.getTime();
  const expectedVersion = Math.max(1, event.version - 1);
  if (event.action === "create") {
    if (!event.after) throw new Error("Page creation requires content.");
    return [
      database
        .prepare(
          `INSERT INTO pages (
            id, slug, folder, title, template, blocks, status,
            seo_title, seo_description, canonical_url, og_image,
            robots_index, robots_follow, published_revision_id,
            version, updated_by, published_at, scheduled_at,
            scheduled_by, schedule_note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, NULL,
            1, ?, NULL, NULL, '', '', ?, ?)`,
        )
        .bind(
          event.documentId,
          ...legacyPageValues(event.after),
          event.actorId,
          now,
          now,
        ),
    ];
  }
  if (event.action === "save" || event.action === "restore") {
    if (!event.after) throw new Error(`${event.action} requires page content.`);
    return [
      database
        .prepare(
          `UPDATE pages SET
            slug = ?, folder = ?, title = ?, template = ?, blocks = ?,
            seo_title = ?, seo_description = ?, canonical_url = ?, og_image = ?,
            robots_index = ?, robots_follow = ?, version = ?, updated_by = ?,
            updated_at = ?, scheduled_at = CASE WHEN ? THEN NULL ELSE scheduled_at END,
            scheduled_by = CASE WHEN ? THEN '' ELSE scheduled_by END,
            schedule_note = CASE WHEN ? THEN '' ELSE schedule_note END
           WHERE id = ? AND version = ?`,
        )
        .bind(
          ...legacyPageValues(event.after),
          event.version,
          event.actorId,
          now,
          event.action === "restore" ? 1 : 0,
          event.action === "restore" ? 1 : 0,
          event.action === "restore" ? 1 : 0,
          event.documentId,
          expectedVersion,
        ),
    ];
  }
  if (event.action === "schedule" || event.action === "unschedule") {
    const scheduledAt = event.scheduledAt
      ? new Date(event.scheduledAt).getTime()
      : null;
    return [
      database
        .prepare(
          `UPDATE pages SET scheduled_at = ?, scheduled_by = ?, schedule_note = ?,
            version = ?, updated_by = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .bind(
          scheduledAt,
          scheduledAt === null ? "" : event.actorId,
          scheduledAt === null ? "" : (event.note ?? ""),
          event.version,
          event.actorId,
          now,
          event.documentId,
          expectedVersion,
        ),
    ];
  }
  if (event.action === "publish") {
    if (!event.after || !event.revisionId)
      throw new Error("Page publication requires content and a revision.");
    return [
      database
        .prepare(
          `INSERT INTO page_revisions
            (id, page_id, version, snapshot, note, created_by, created_at)
           SELECT ?, id, ?, ?, ?, ?, ? FROM pages
           WHERE id = ? AND version = ?`,
        )
        .bind(
          event.revisionId,
          event.version,
          JSON.stringify(encodeRemVietStandardPageRevision(event.after)),
          event.note ?? "",
          event.actorId,
          now,
          event.documentId,
          expectedVersion,
        ),
      database
        .prepare(
          `UPDATE pages SET status = 'published', published_revision_id = ?,
            published_at = ?, scheduled_at = NULL, scheduled_by = '', schedule_note = '',
            version = ?, updated_by = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .bind(
          event.revisionId,
          now,
          event.version,
          event.actorId,
          now,
          event.documentId,
          expectedVersion,
        ),
    ];
  }
  if (event.action === "unpublish") {
    return [
      database
        .prepare(
          `UPDATE pages SET status = 'draft', published_revision_id = NULL,
            published_at = NULL, version = ?, updated_by = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .bind(
          event.version,
          event.actorId,
          now,
          event.documentId,
          expectedVersion,
        ),
    ];
  }
  return [
    database
      .prepare("DELETE FROM page_revisions WHERE page_id = ?")
      .bind(event.documentId),
    database
      .prepare("DELETE FROM pages WHERE id = ? AND version = ?")
      .bind(event.documentId, event.version),
  ];
}

function databaseBinding() {
  return env.DB as unknown as CloudflareD1Database;
}

export function hasRemVietStandardPageProviderBinding() {
  const database = env.DB as unknown as
    Partial<CloudflareD1Database> | undefined;
  return typeof database?.prepare === "function";
}

export function createRemVietStandardPageProvider(
  actor?: CmsActor,
  options?: { slugRedirect?: PageSlugRedirect },
) {
  return createRemVietStandardPageProviderForDatabase(
    databaseBinding(),
    actor,
    options,
  );
}

/** Raw collection provider for installed non-page collections. Standard pages
 * keep using the page adapter below so their legacy projection remains atomic. */
export function createRemVietCollectionProvider(actor?: CmsActor) {
  return createRemVietCollectionProviderForDatabase(databaseBinding(), actor);
}

export function createRemVietCollectionProviderForDatabase(
  database: CloudflareD1Database,
  actor?: CmsActor,
) {
  return createCloudflareCmsCollectionProvider({
    database,
    extensions: remVietExtensions,
    ...(actor
      ? {
          prepareMutationStatements: (
            event: CloudflareCmsCollectionMutationEvent,
          ) => collectionMutationStatements(database, actor, event),
        }
      : {}),
  });
}

export function createRemVietStandardPageProviderForDatabase(
  database: CloudflareD1Database,
  actor?: CmsActor,
  options?: { slugRedirect?: PageSlugRedirect },
) {
  const reviews = createCloudflareCmsEditorialReviewProvider({ database });
  const provider = createCloudflareCmsCollectionProvider({
    database,
    extensions: remVietExtensions,
    prepareMutationStatements: (collectionEvent) => {
      const event = pageMutationEvent(collectionEvent);
      return [
        ...legacyPageProjectionStatements(database, event),
        ...(event.action === "publish"
          ? [
              reviews.preparePublicationStatement({
                actorId: event.actorId,
                documentId: event.documentId,
                occurredAt: event.timestamp,
                reviewVersion: event.version - 1,
              }),
            ]
          : []),
        ...(actor
          ? pageMutationStatements(
              database,
              actor,
              event,
              encodeRemVietStandardPageRevision,
            )
          : []),
        ...(actor && options?.slugRedirect
          ? pageSlugRedirectStatements(
              database,
              actor,
              options.slugRedirect,
              event,
            )
          : []),
      ];
    },
  });
  return createCmsPageCollectionAdapter<RemVietStandardPageContent>({
    provider,
    collection: remVietStandardPagesCollection,
    reviews,
    toData: toRemVietStandardPageCollectionData,
    fromData: (data) =>
      parseRemVietStandardPageContent(
        fromRemVietStandardPageCollectionData(data),
      ),
  });
}

type CreateStandardPageInput = {
  blocks: unknown[];
  canonicalUrl: string;
  folder?: string;
  ogImage: string;
  robotsFollow: boolean;
  robotsIndex: boolean;
  seoDescription: string;
  seoTitle: string;
  slug?: string;
  status: "draft" | "published";
  title: string;
};

export async function createRemVietStandardPage(
  input: CreateStandardPageInput,
  actor: CmsActor,
) {
  if (input.status === "published") {
    await assertCmsWorkflowInitialPublishAllowed({
      collection: "page",
      folder: input.folder,
    });
  }
  const slug = slugifyContent(input.slug || input.title);
  if (!slug) throw new Error("Slug is required");
  const content = parseRemVietStandardPageContent({
    title: input.title,
    slug,
    folder: input.folder,
    template: "standard",
    blocks: input.blocks,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    canonicalUrl: input.canonicalUrl,
    ogImage: input.ogImage,
    robotsIndex: input.robotsIndex,
    robotsFollow: input.robotsFollow,
  });
  if (input.status === "published") {
    await resolveRemVietStandardPageBlocks(content.blocks, "published");
  }
  const provider = createRemVietStandardPageProvider(actor);
  const created = await provider.createDraft({
    content,
    actorId: actor.userId,
  });
  return input.status === "published"
    ? (
        await provider.publish({
          id: created.id,
          expectedVersion: created.version,
          actorId: actor.userId,
          note: "Initial publish",
        })
      ).document
    : created;
}

export async function isRemVietStandardPage(pageId: string) {
  const row = await databaseBinding()
    .prepare("SELECT template FROM pages WHERE id = ? LIMIT 1")
    .bind(pageId)
    .first<{ template: string }>();
  return row?.template === "standard";
}

type PublishedStandardMetadataRow = {
  id: string;
  createdAt: number;
  publishedAt: number | null;
  scheduleNote: string;
  scheduledAt: number | null;
  scheduledBy: string;
  updatedAt: number;
  updatedBy: string;
  version: number;
};

export async function getPublishedRemVietStandardPage(slug: string) {
  const metadata = await databaseBinding()
    .prepare(
      `SELECT p.id, p.version, p.updated_by AS updatedBy,
        p.published_at AS publishedAt, p.scheduled_at AS scheduledAt,
        p.scheduled_by AS scheduledBy, p.schedule_note AS scheduleNote,
        p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM pages p
       INNER JOIN page_revisions r ON r.id = p.published_revision_id
       WHERE p.status = 'published' AND p.template = 'standard'
         AND json_extract(r.snapshot, '$.slug') = ?
       LIMIT 1`,
    )
    .bind(slug)
    .first<PublishedStandardMetadataRow>();
  if (!metadata) return null;
  const published = await createRemVietStandardPageProvider().getPublished({
    id: metadata.id,
  });
  if (!published) return null;
  const { content } = published;
  const resolvedBlocks = await resolveRemVietStandardPageBlocks(
    content.blocks,
    "published",
  );
  return {
    id: published.id,
    _id: published.id,
    title: content.title,
    slug: content.slug,
    folder: content.folder,
    template: content.template,
    blocks: resolvedBlocks.map(toLegacyRemVietStandardBlock),
    status: "published" as const,
    seoTitle: content.seo.title,
    seoDescription: content.seo.description,
    canonicalUrl: content.seo.canonicalUrl,
    ogImage: content.seo.ogImage,
    robotsIndex: content.seo.robotsIndex,
    robotsFollow: content.seo.robotsFollow,
    publishedRevisionId: published.publishedRevisionId,
    version: Number(metadata.version),
    updatedBy: metadata.updatedBy,
    publishedAt:
      metadata.publishedAt === null
        ? null
        : new Date(Number(metadata.publishedAt)).toISOString(),
    scheduledAt:
      metadata.scheduledAt === null
        ? null
        : new Date(Number(metadata.scheduledAt)),
    scheduledBy: metadata.scheduledBy,
    scheduleNote: metadata.scheduleNote,
    createdAt: new Date(Number(metadata.createdAt)).toISOString(),
    updatedAt: new Date(Number(metadata.updatedAt)).toISOString(),
  };
}

type StandardDraftUpdate = {
  blocks?: unknown[];
  canonicalUrl?: string;
  expectedVersion?: number;
  folder?: string;
  ogImage?: string;
  robotsFollow?: boolean;
  robotsIndex?: boolean;
  seoDescription?: string;
  seoTitle?: string;
  slug?: string;
  status?: "draft" | "published";
  template?: "landing" | "standard";
  title?: string;
  createRedirect?: boolean;
};

export async function canUseRemVietStandardDraftUpdate(
  input: StandardDraftUpdate & { pageId: string },
) {
  if (
    (input.template !== undefined && input.template !== "standard") ||
    (input.status !== undefined && input.status !== "published")
  ) {
    return false;
  }
  return isRemVietStandardPage(input.pageId);
}

export async function saveRemVietStandardPageDraft(
  input: StandardDraftUpdate & { pageId: string },
  actor: CmsActor,
) {
  const reader = createRemVietStandardPageProvider();
  const document = await reader.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const current = document.content;
  const nextSlug = input.slug ? slugifyContent(input.slug) : current.slug;
  if (!nextSlug) throw new Error("Slug is required");
  const slugRedirect =
    input.createRedirect &&
    current.slug !== nextSlug &&
    document.publishedRevisionId
      ? await validateRedirectGraph(`/${current.slug}`, `/${nextSlug}`)
      : undefined;
  const provider = createRemVietStandardPageProvider(actor, { slugRedirect });
  const content = parseRemVietStandardPageContent({
    title: input.title ?? current.title,
    slug: nextSlug,
    folder: input.folder ?? current.folder,
    template: "standard",
    blocks: input.blocks ?? current.blocks,
    seo: {
      title: input.seoTitle ?? current.seo.title,
      description: input.seoDescription ?? current.seo.description,
      canonicalUrl: input.canonicalUrl ?? current.seo.canonicalUrl,
      ogImage: input.ogImage ?? current.seo.ogImage,
      robotsIndex: input.robotsIndex ?? current.seo.robotsIndex,
      robotsFollow: input.robotsFollow ?? current.seo.robotsFollow,
    },
  });
  return provider.saveDraft({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    content,
    actorId: actor.userId,
  });
}

export async function publishRemVietStandardPage(
  input: { pageId: string; expectedVersion?: number; note?: string },
  actor: CmsActor,
) {
  const provider = createRemVietStandardPageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  await resolveRemVietStandardPageBlocks(document.content.blocks, "published");
  const published = await provider.publish({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
    note: input.note,
  });
  return {
    publishedRevisionId: published.revision.id,
    snapshot: encodeRemVietStandardPageRevision(published.revision.content),
    version: published.document.version,
  };
}

export async function unpublishRemVietStandardPage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietStandardPageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const unpublished = await provider.unpublish({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
  return { version: unpublished.version };
}

export async function deleteRemVietStandardPage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietStandardPageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  return provider.delete({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
}

export async function listRemVietStandardPageRevisions(pageId: string) {
  const revisions =
    await createRemVietStandardPageProvider().listRevisions(pageId);
  return revisions.map((revision) => ({
    id: revision.id,
    pageId: revision.documentId,
    version: revision.version,
    snapshot: encodeRemVietStandardPageRevision(revision.content),
    note: revision.note,
    createdBy: revision.createdBy,
    createdAt: new Date(revision.createdAt),
  }));
}

export async function restoreRemVietStandardPageRevision(
  input: { pageId: string; revisionId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietStandardPageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page or revision not found");
  const restored = await provider.restore({
    id: input.pageId,
    revisionId: input.revisionId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
  return {
    restoredFrom: input.revisionId,
    snapshot: encodeRemVietStandardPageRevision(restored.content),
    version: restored.version,
  };
}

export async function scheduleRemVietStandardPage(
  input: {
    pageId: string;
    scheduledAt: Date;
    expectedVersion?: number;
    note?: string;
  },
  actor: CmsActor,
) {
  const provider = createRemVietStandardPageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const scheduled = await provider.schedule({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    scheduledAt: input.scheduledAt.toISOString(),
    actorId: actor.userId,
    note: input.note,
  });
  return {
    scheduledAt: scheduled.scheduledAt ? new Date(scheduled.scheduledAt) : null,
    version: scheduled.version,
  };
}

export async function unscheduleRemVietStandardPage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietStandardPageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const scheduled = await provider.unschedule({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
  return { scheduledAt: null, version: scheduled.version };
}
