import {
  createCloudflareCmsPageProvider,
  type CloudflareD1Database,
} from "@agency/cms-provider-cloudflare";
import type { CmsPageContent } from "@agency/cms-runtime";
import {
  toLegacyRemVietTemplateBlock,
  toRemVietTemplateBlock,
  type RemVietTemplateBlock,
} from "@agency/cms-template-rem-viet";
import { env } from "@rem-viet/env/server";

import type { CmsActor } from "./content-revisions";
import { pageMutationStatements } from "./page-provider-audit";
import { assertCmsWorkflowInitialPublishAllowed } from "./workflow-policies";

export type RemVietHomeContent = CmsPageContent<RemVietTemplateBlock>;

type StoredHomeContent = Record<string, unknown> & {
  blocks?: unknown;
  seo?: unknown;
};

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function parseRemVietHomeContent(value: unknown): RemVietHomeContent {
  const input = value as StoredHomeContent;
  if (
    !input ||
    typeof input.title !== "string" ||
    typeof input.slug !== "string" ||
    input.template !== "landing" ||
    !Array.isArray(input.blocks)
  ) {
    throw new Error("Invalid Rèm Việt homepage content.");
  }

  const blocks = input.blocks.map((block) => {
    const parsed = toRemVietTemplateBlock(block);
    if (!parsed.success) throw parsed.error;
    return parsed.data;
  });
  const nestedSeo =
    input.seo && typeof input.seo === "object"
      ? (input.seo as Record<string, unknown>)
      : null;

  return {
    title: input.title,
    slug: input.slug,
    template: "landing",
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

export function encodeRemVietHomeBlocks(content: RemVietHomeContent) {
  return content.blocks.map(toLegacyRemVietTemplateBlock);
}

export function encodeRemVietHomeRevision(content: RemVietHomeContent) {
  return {
    title: content.title,
    slug: content.slug,
    template: content.template,
    blocks: encodeRemVietHomeBlocks(content),
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

export function createRemVietHomePageProvider(actor?: CmsActor) {
  const database = databaseBinding();
  return createCloudflareCmsPageProvider({
    database,
    parseContent: parseRemVietHomeContent,
    encodeBlocks: encodeRemVietHomeBlocks,
    encodeRevision: encodeRemVietHomeRevision,
    prepareMutationStatements: actor
      ? (event) =>
          pageMutationStatements(
            database,
            actor,
            event,
            encodeRemVietHomeRevision,
          )
      : undefined,
  });
}

type CreateHomePageInput = {
  blocks: unknown[];
  canonicalUrl: string;
  ogImage: string;
  robotsFollow: boolean;
  robotsIndex: boolean;
  seoDescription: string;
  seoTitle: string;
  status: "draft" | "published";
  title: string;
};

export async function createRemVietHomePage(
  input: CreateHomePageInput,
  actor: CmsActor,
) {
  if (input.status === "published") {
    await assertCmsWorkflowInitialPublishAllowed({ collection: "page" });
  }
  const content = parseRemVietHomeContent({
    title: input.title,
    slug: "home",
    template: "landing",
    blocks: input.blocks,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    canonicalUrl: input.canonicalUrl,
    ogImage: input.ogImage,
    robotsIndex: input.robotsIndex,
    robotsFollow: input.robotsFollow,
  });
  const provider = createRemVietHomePageProvider(actor);
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

export async function isRemVietHomePage(pageId: string) {
  const row = await databaseBinding()
    .prepare("SELECT slug, template FROM pages WHERE id = ? LIMIT 1")
    .bind(pageId)
    .first<{ slug: string; template: string }>();
  return row?.slug === "home" && row.template === "landing";
}

type HomePageMetadataRow = {
  createdAt: number;
  publishedAt: number | null;
  scheduleNote: string;
  scheduledAt: number | null;
  scheduledBy: string;
  updatedAt: number;
  updatedBy: string;
  version: number;
};

export async function getPublishedRemVietHomePage() {
  const provider = createRemVietHomePageProvider();
  const published = await provider.getPublished({ slug: "home" });
  if (!published) return null;

  const metadata = await databaseBinding()
    .prepare(
      `SELECT version, updated_by AS updatedBy,
        published_at AS publishedAt, scheduled_at AS scheduledAt,
        scheduled_by AS scheduledBy, schedule_note AS scheduleNote,
        created_at AS createdAt, updated_at AS updatedAt
       FROM pages WHERE id = ? LIMIT 1`,
    )
    .bind(published.id)
    .first<HomePageMetadataRow>();
  if (!metadata) return null;

  const { content } = published;
  return {
    id: published.id,
    _id: published.id,
    title: content.title,
    slug: content.slug,
    template: content.template,
    blocks: encodeRemVietHomeBlocks(content),
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

type HomeDraftUpdate = {
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
};

export function canUseRemVietHomeDraftUpdate(input: HomeDraftUpdate) {
  return (
    (input.slug === undefined || input.slug === "home") &&
    (input.template === undefined || input.template === "landing") &&
    input.status === undefined
  );
}

export async function saveRemVietHomeDraft(
  input: HomeDraftUpdate & { pageId: string },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const current = document.content;
  const content = parseRemVietHomeContent({
    title: input.title ?? current.title,
    slug: input.slug ?? current.slug,
    template: input.template ?? current.template,
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

export async function publishRemVietHomePage(
  input: { pageId: string; expectedVersion?: number; note?: string },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
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
    snapshot: encodeRemVietHomeRevision(published.revision.content),
    version: published.document.version,
  };
}

export async function unpublishRemVietHomePage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const unpublished = await provider.unpublish({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
  return { version: unpublished.version };
}

export async function deleteRemVietHomePage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  return provider.delete({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
}

export async function scheduleRemVietHomePage(
  input: {
    pageId: string;
    scheduledAt: Date;
    expectedVersion?: number;
    note?: string;
  },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
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

export async function unscheduleRemVietHomePage(
  input: { pageId: string; expectedVersion?: number },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
  const document = await provider.getDraft({ id: input.pageId });
  if (!document) throw new Error("Page not found");
  const scheduled = await provider.unschedule({
    id: input.pageId,
    expectedVersion: input.expectedVersion ?? document.version,
    actorId: actor.userId,
  });
  return {
    scheduledAt: scheduled.scheduledAt ? new Date(scheduled.scheduledAt) : null,
    version: scheduled.version,
  };
}

export async function listRemVietHomeRevisions(pageId: string) {
  const revisions = await createRemVietHomePageProvider().listRevisions(pageId);
  return revisions.map((revision) => ({
    id: revision.id,
    pageId: revision.documentId,
    version: revision.version,
    snapshot: encodeRemVietHomeRevision(revision.content),
    note: revision.note,
    createdBy: revision.createdBy,
    createdAt: new Date(revision.createdAt),
  }));
}

export async function restoreRemVietHomeRevision(
  input: {
    pageId: string;
    revisionId: string;
    expectedVersion?: number;
  },
  actor: CmsActor,
) {
  const provider = createRemVietHomePageProvider(actor);
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
    snapshot: encodeRemVietHomeRevision(restored.content),
    version: restored.version,
  };
}
