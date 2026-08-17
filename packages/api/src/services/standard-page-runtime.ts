import {
  createCloudflareCmsPageProvider,
  type CloudflareD1Database,
} from "@agency/cms-provider-cloudflare";
import type { CmsPageContent } from "@agency/cms-runtime";
import {
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
  type RemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { parseRichTextDocument, slugifyContent } from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";

import type { CmsActor } from "./content-revisions";
import { validateRedirectGraph } from "./operations";
import { pageMutationStatements } from "./page-provider-audit";
import {
  pageSlugRedirectStatements,
  type PageSlugRedirect,
} from "./page-provider-redirect";

export type RemVietStandardPageContent = CmsPageContent<RemVietStandardBlock>;

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
  const database = databaseBinding();
  return createCloudflareCmsPageProvider({
    database,
    parseContent: parseRemVietStandardPageContent,
    encodeBlocks: encodeRemVietStandardPageBlocks,
    encodeRevision: encodeRemVietStandardPageRevision,
    prepareMutationStatements: actor
      ? (event) => [
          ...pageMutationStatements(
            database,
            actor,
            event,
            encodeRemVietStandardPageRevision,
          ),
          ...(options?.slugRedirect
            ? pageSlugRedirectStatements(
                database,
                actor,
                options.slugRedirect,
                event,
              )
            : []),
        ]
      : undefined,
  });
}

type CreateStandardPageInput = {
  blocks: unknown[];
  canonicalUrl: string;
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
  const slug = slugifyContent(input.slug || input.title);
  if (!slug) throw new Error("Slug is required");
  const content = parseRemVietStandardPageContent({
    title: input.title,
    slug,
    template: "standard",
    blocks: input.blocks,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    canonicalUrl: input.canonicalUrl,
    ogImage: input.ogImage,
    robotsIndex: input.robotsIndex,
    robotsFollow: input.robotsFollow,
  });
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
  return {
    id: published.id,
    _id: published.id,
    title: content.title,
    slug: content.slug,
    template: content.template,
    blocks: encodeRemVietStandardPageBlocks(content),
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
