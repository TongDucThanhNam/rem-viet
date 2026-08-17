import type { AppRouter } from "@rem-viet/api/routers/index";
import { CmsError, type CmsProviderCapabilities } from "@agency/cms-core";
import type {
  CmsPageContent,
  CmsPageDocument,
  CmsPageProvider,
  CmsPageRevision,
} from "@agency/cms-runtime";
import {
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
  type RemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export type StagingStandardPageContent = CmsPageContent<RemVietStandardBlock>;

type ApiPage = {
  _id?: string;
  id?: string;
  title: string;
  slug: string;
  template: "standard";
  blocks: unknown[];
  status: "draft" | "published";
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  ogImage?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  publishedRevisionId?: string | null;
  scheduledAt?: unknown;
  version: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedBy?: string;
};

type ApiRevision = {
  id: string;
  pageId: string;
  version: number;
  snapshot: unknown;
  note?: string;
  createdAt: unknown;
  createdBy?: string;
};

const capabilities: CmsProviderCapabilities = {
  supported: [
    "content.readDraft",
    "content.write",
    "content.publish",
    "content.schedule",
    "content.restore",
    "content.delete",
  ],
};

function iso(value: unknown, fallback = new Date(0).toISOString()) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

function parseBlocks(value: unknown[]) {
  return value.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success) throw parsed.error;
    return parsed.data;
  });
}

function pageContent(page: ApiPage): StagingStandardPageContent {
  return {
    title: page.title,
    slug: page.slug,
    template: "standard",
    blocks: parseBlocks(page.blocks),
    seo: {
      title: page.seoTitle ?? "",
      description: page.seoDescription ?? "",
      canonicalUrl: page.canonicalUrl ?? "",
      ogImage: page.ogImage ?? "",
      robotsIndex: page.robotsIndex ?? true,
      robotsFollow: page.robotsFollow ?? true,
    },
  };
}

function pageDocument(
  page: ApiPage,
  documentId?: string,
): CmsPageDocument<StagingStandardPageContent> {
  const id = page._id ?? page.id;
  if (!id) throw new Error("Staging page API omitted the document ID.");
  return {
    id: documentId ?? id,
    schemaVersion: 1,
    version: page.version,
    status: page.status,
    content: pageContent(page),
    publishedRevisionId: page.publishedRevisionId ?? null,
    scheduledAt: page.scheduledAt ? iso(page.scheduledAt) : null,
    createdAt: iso(page.createdAt),
    updatedAt: iso(page.updatedAt),
    updatedBy: page.updatedBy ?? "staging-api",
  };
}

function revisionContent(value: unknown): StagingStandardPageContent {
  const snapshot = value as Partial<ApiPage>;
  if (
    typeof snapshot.title !== "string" ||
    typeof snapshot.slug !== "string" ||
    !Array.isArray(snapshot.blocks)
  )
    throw new Error("Staging revision API returned an invalid snapshot.");
  return pageContent({
    ...snapshot,
    template: "standard",
    status: "published",
    version: 1,
  } as ApiPage);
}

function portableError(error: unknown): never {
  const code =
    error && typeof error === "object" && "data" in error
      ? (error.data as { code?: unknown } | undefined)?.code
      : undefined;
  if (code === "CONFLICT")
    throw new CmsError({
      code: "CONFLICT",
      message: "Staging provider rejected a stale version.",
      retryable: true,
    });
  throw error;
}

function inputFromContent(content: StagingStandardPageContent) {
  return {
    title: content.title,
    slug: content.slug,
    template: "standard" as const,
    blocks: content.blocks.map(toLegacyRemVietStandardBlock),
    seoTitle: content.seo.title,
    seoDescription: content.seo.description,
    canonicalUrl: content.seo.canonicalUrl,
    ogImage: content.seo.ogImage,
    robotsIndex: content.seo.robotsIndex,
    robotsFollow: content.seo.robotsFollow,
  };
}

export type StagingPageProvider =
  CmsPageProvider<StagingStandardPageContent> & {
    cleanup(): Promise<void>;
  };

export function createStagingPageProvider(input: {
  baseUrl: string;
  cookie: string;
}): StagingPageProvider {
  const trpc = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${input.baseUrl.replace(/\/$/, "")}/api/trpc`,
        headers: { Cookie: input.cookie },
      }),
    ],
  });
  const actualIds = new Map<string, string>();
  const logicalIds = new Map<string, string>();

  const actualId = (logicalId: string) => actualIds.get(logicalId);
  const logicalId = (id: string) => logicalIds.get(id) ?? id;

  async function readActual(id: string) {
    const response = await trpc.content.pages.byId.query({ pageId: id });
    return (response.data ?? null) as ApiPage | null;
  }

  async function readLogical(logicalId: string) {
    const id = actualId(logicalId);
    return id ? readActual(id) : null;
  }

  async function guarded<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      portableError(error);
    }
  }

  const provider: StagingPageProvider = {
    capabilities,
    async getDraft(lookup) {
      if (!("id" in lookup) || !lookup.id) return null;
      const page = await readLogical(lookup.id);
      return page ? pageDocument(page, lookup.id) : null;
    },
    async getPublished(lookup) {
      if (!("slug" in lookup) || !lookup.slug) return null;
      const page = (await trpc.content.pages.bySlug.query({
        slug: lookup.slug,
      })) as ApiPage | null;
      return page
        ? pageDocument(page, logicalId(page._id ?? page.id ?? ""))
        : null;
    },
    async createDraft(createInput) {
      const response = await guarded(() =>
        trpc.content.pages.create.mutate({
          ...inputFromContent(createInput.content),
          status: "draft",
        }),
      );
      const page = response.data as ApiPage | null;
      if (!page) throw new Error("Staging page create returned no document.");
      const document = pageDocument(page);
      const requestedId = createInput.id ?? document.id;
      actualIds.set(requestedId, document.id);
      logicalIds.set(document.id, requestedId);
      return pageDocument(page, requestedId);
    },
    async saveDraft(saveInput) {
      const id = actualId(saveInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      await guarded(() =>
        trpc.content.pages.update.mutate({
          pageId: id,
          expectedVersion: saveInput.expectedVersion,
          ...inputFromContent(saveInput.content),
          createRedirect: false,
        }),
      );
      const page = await readActual(id);
      if (!page) throw new Error("Staging page disappeared after save.");
      return pageDocument(page, saveInput.id);
    },
    async publish(publishInput) {
      const id = actualId(publishInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      const result = await guarded(() =>
        trpc.content.pages.publish.mutate({
          pageId: id,
          expectedVersion: publishInput.expectedVersion,
          note: publishInput.note,
        }),
      );
      const page = await readActual(id);
      if (!page) throw new Error("Staging page disappeared after publish.");
      const revisions = await provider.listRevisions(publishInput.id);
      const publishedRevisionId = (result as { publishedRevisionId?: string })
        .publishedRevisionId;
      const revision = revisions.find(
        (candidate) => candidate.id === publishedRevisionId,
      );
      if (!revision)
        throw new Error("Staging publish returned no matching revision.");
      return { document: pageDocument(page, publishInput.id), revision };
    },
    async schedule(scheduleInput) {
      const id = actualId(scheduleInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      await guarded(() =>
        trpc.content.pages.schedule.mutate({
          pageId: id,
          expectedVersion: scheduleInput.expectedVersion,
          scheduledAt: scheduleInput.scheduledAt,
          note: scheduleInput.note,
        }),
      );
      const page = await readActual(id);
      if (!page) throw new Error("Staging page disappeared after schedule.");
      return pageDocument(page, scheduleInput.id);
    },
    async unschedule(unscheduleInput) {
      const id = actualId(unscheduleInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      await guarded(() =>
        trpc.content.pages.unschedule.mutate({
          pageId: id,
          expectedVersion: unscheduleInput.expectedVersion,
        }),
      );
      const page = await readActual(id);
      if (!page) throw new Error("Staging page disappeared after unschedule.");
      return pageDocument(page, unscheduleInput.id);
    },
    async unpublish(unpublishInput) {
      const id = actualId(unpublishInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      await guarded(() =>
        trpc.content.pages.unpublish.mutate({
          pageId: id,
          expectedVersion: unpublishInput.expectedVersion,
        }),
      );
      const page = await readActual(id);
      if (!page) throw new Error("Staging page disappeared after unpublish.");
      return pageDocument(page, unpublishInput.id);
    },
    async listRevisions(logicalId) {
      const id = actualId(logicalId);
      if (!id) return [];
      const revisions = (await trpc.content.pages.revisions.query({
        pageId: id,
      })) as ApiRevision[];
      return revisions.map(
        (revision): CmsPageRevision<StagingStandardPageContent> => ({
          id: revision.id,
          documentId: logicalId,
          version: revision.version,
          content: revisionContent(revision.snapshot),
          note: revision.note ?? "",
          createdAt: iso(revision.createdAt),
          createdBy: revision.createdBy ?? "staging-api",
        }),
      );
    },
    async restore(restoreInput) {
      const id = actualId(restoreInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      await guarded(() =>
        trpc.content.pages.restore.mutate({
          pageId: id,
          revisionId: restoreInput.revisionId,
          expectedVersion: restoreInput.expectedVersion,
        }),
      );
      const page = await readActual(id);
      if (!page) throw new Error("Staging page disappeared after restore.");
      return pageDocument(page, restoreInput.id);
    },
    async delete(deleteInput) {
      const id = actualId(deleteInput.id);
      if (!id) throw new Error("Staging conformance document is not mapped.");
      const page = await readActual(id);
      if (!page) throw new Error("Staging page is already absent.");
      await guarded(() =>
        trpc.content.pages.delete.mutate({
          pageId: id,
          expectedVersion: deleteInput.expectedVersion,
        }),
      );
      return pageDocument(page, deleteInput.id);
    },
    async cleanup() {
      const failures: string[] = [];
      for (const [logicalId, id] of [...actualIds.entries()].reverse()) {
        try {
          const page = await readActual(id);
          if (page)
            await trpc.content.pages.delete.mutate({
              pageId: id,
              expectedVersion: page.version,
            });
          actualIds.delete(logicalId);
          logicalIds.delete(id);
        } catch {
          failures.push(logicalId);
        }
      }
      if (failures.length)
        throw new Error(
          `Staging provider cleanup failed for ${failures.length} document(s).`,
        );
    },
  };

  return provider;
}
