import type {
  CmsCollectionDefinition,
  CmsProviderCapabilities,
} from "@agency/cms-core";

import type {
  CmsCollectionDocument,
  CmsCollectionProvider,
  CmsCollectionRevision,
} from "./collections.js";
import type {
  CmsEditorialReviewWorkflow,
  CmsPageContent,
  CmsPageDocument,
  CmsPageProvider,
  CmsPageRevision,
  PageLookup,
} from "./index.js";

export type CmsPageCollectionAdapterOptions<TContent extends CmsPageContent> = {
  readonly provider: CmsCollectionProvider;
  readonly collection: CmsCollectionDefinition;
  readonly toData: (content: TContent) => Readonly<Record<string, unknown>>;
  readonly fromData: (data: Readonly<Record<string, unknown>>) => TContent;
  readonly reviews?: CmsEditorialReviewWorkflow;
};

function pageDocument<TContent extends CmsPageContent>(
  document: CmsCollectionDocument,
  fromData: (data: Readonly<Record<string, unknown>>) => TContent,
): CmsPageDocument<TContent> {
  return {
    id: document.id,
    schemaVersion: document.schemaVersion,
    version: document.version,
    status: document.status,
    content: fromData(document.data),
    publishedRevisionId: document.publishedRevisionId,
    scheduledAt: document.scheduledAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  };
}

function pageRevision<TContent extends CmsPageContent>(
  revision: CmsCollectionRevision,
  fromData: (data: Readonly<Record<string, unknown>>) => TContent,
): CmsPageRevision<TContent> {
  return {
    id: revision.id,
    documentId: revision.documentId,
    version: revision.version,
    content: fromData(revision.data),
    note: revision.note,
    createdAt: revision.createdAt,
    createdBy: revision.createdBy,
  };
}

export function createCmsPageCollectionAdapter<TContent extends CmsPageContent>(
  options: CmsPageCollectionAdapterOptions<TContent>,
): CmsPageProvider<TContent> {
  const collection = options.collection.slug;
  const capabilities: CmsProviderCapabilities = {
    supported: [
      "content.readDraft",
      "content.write",
      ...(options.reviews
        ? (["content.review.request", "content.review.decide"] as const)
        : []),
      "content.publish",
      ...(options.collection.lifecycle.scheduling
        ? (["content.schedule"] as const)
        : []),
      ...(options.collection.lifecycle.revisions
        ? (["content.restore"] as const)
        : []),
      "content.delete",
    ],
  };

  async function lookup(input: PageLookup, status: "draft" | "published") {
    if (input.id) {
      return status === "draft"
        ? options.provider.getDraft({ collection, id: input.id })
        : options.provider.getPublished({ collection, id: input.id });
    }
    const result = await options.provider.list({
      collection,
      status,
      filters: [{ field: "slug", operator: "equals", value: input.slug }],
      pagination: { limit: 1, offset: 0 },
    });
    return result.documents[0] ?? null;
  }

  return {
    capabilities,
    reviews: options.reviews,
    async getDraft(input) {
      const document = await lookup(input, "draft");
      return document ? pageDocument(document, options.fromData) : null;
    },
    async getPublished(input) {
      const document = await lookup(input, "published");
      return document ? pageDocument(document, options.fromData) : null;
    },
    async createDraft(input) {
      const document = await options.provider.createDraft({
        collection,
        id: input.id,
        data: options.toData(input.content),
        actorId: input.actorId,
      });
      return pageDocument(document, options.fromData);
    },
    async saveDraft(input) {
      const document = await options.provider.saveDraft({
        collection,
        id: input.id,
        expectedVersion: input.expectedVersion,
        data: options.toData(input.content),
        actorId: input.actorId,
      });
      return pageDocument(document, options.fromData);
    },
    async publish(input) {
      const result = await options.provider.publish({ collection, ...input });
      return {
        document: pageDocument(result.document, options.fromData),
        revision: pageRevision(result.revision, options.fromData),
      };
    },
    async schedule(input) {
      const document = await options.provider.schedule({
        collection,
        ...input,
      });
      return pageDocument(document, options.fromData);
    },
    async unschedule(input) {
      const document = await options.provider.unschedule({
        collection,
        ...input,
      });
      return pageDocument(document, options.fromData);
    },
    async unpublish(input) {
      const document = await options.provider.unpublish({
        collection,
        ...input,
      });
      return pageDocument(document, options.fromData);
    },
    async listRevisions(id) {
      const revisions = await options.provider.listRevisions({
        collection,
        id,
      });
      return revisions.map((revision) =>
        pageRevision(revision, options.fromData),
      );
    },
    async restore(input) {
      const document = await options.provider.restore({ collection, ...input });
      return pageDocument(document, options.fromData);
    },
    async delete(input) {
      const document = await options.provider.delete({ collection, ...input });
      return pageDocument(document, options.fromData);
    },
  };
}
