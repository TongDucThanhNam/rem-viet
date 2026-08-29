import {
  CmsError,
  buildCmsReusableContentUsageGraph,
  collectCmsReusableContentReferences,
  defineCollection,
  defineFeatureModule,
  detachCmsReusableContent,
  jsonField,
  parseCmsCollectionData,
  resolveCmsReusableContent,
  textField,
  type CmsJsonValue,
  type CmsReusableContentLoader,
  type CmsReusableContentReference,
  type CmsReusableContentUsageGraph,
  type CmsReusableContentUsageSource,
} from "@agency/cms-core";

import type {
  CmsCollectionDocument,
  CmsCollectionProvider,
  CmsCollectionRevision,
} from "./collections.js";

export const CMS_REUSABLE_CONTENT_COLLECTION = "cms-reusable-content";
export const CMS_REUSABLE_CONTENT_MODULE_ID = "cms-reusable-content";

export const cmsReusableContentCollection = defineCollection({
  slug: CMS_REUSABLE_CONTENT_COLLECTION,
  labels: { singular: "Reusable fragment", plural: "Reusable fragments" },
  schemaVersion: 1,
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      indexed: true,
      validation: { minLength: 1, maxLength: 200 },
    }),
    textField({
      name: "key",
      label: "Stable key",
      required: true,
      indexed: true,
      unique: true,
      validation: {
        minLength: 1,
        maxLength: 128,
        pattern: "^[a-z0-9]+(?:[._-][a-z0-9]+)*$",
      },
    }),
    textField({
      name: "description",
      label: "Description",
      required: true,
      defaultValue: "",
      multiline: true,
      validation: { maxLength: 500 },
    }),
    textField({
      name: "contentType",
      label: "Content type",
      required: true,
      indexed: true,
      validation: {
        minLength: 1,
        maxLength: 128,
        pattern: "^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$",
      },
    }),
    jsonField({ name: "value", label: "Content", required: true }),
  ],
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: {
    read: ["content.readDraft"],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "key", "contentType"],
  },
});

export const cmsReusableContentModule = defineFeatureModule({
  id: CMS_REUSABLE_CONTENT_MODULE_ID,
  collections: [cmsReusableContentCollection],
  permissions: [
    {
      id: "cms-reusable-content/edit",
      capability: "content.write",
      collection: CMS_REUSABLE_CONTENT_COLLECTION,
      operations: ["create", "update", "restore"],
      description: "Editors may author reusable content fragments.",
    },
    {
      id: "cms-reusable-content/publish",
      capability: "content.publish",
      collection: CMS_REUSABLE_CONTENT_COLLECTION,
      operations: ["publish", "unpublish"],
    },
  ],
  migrations: [
    {
      id: "cms-reusable-content/v1",
      from: 0,
      to: 1,
      migrate: (state) => state,
    },
  ],
  admin: [
    {
      id: "cms-reusable-content/navigation",
      collection: CMS_REUSABLE_CONTENT_COLLECTION,
      placement: "navigation",
      label: "Reusable content",
    },
  ],
});

export type CmsReusableContentData = Readonly<{
  title: string;
  key: string;
  description: string;
  contentType: string;
  value: CmsJsonValue;
}>;

export type CmsReusableContentDocument = Readonly<{
  id: string;
  version: number;
  status: "draft" | "published";
  data: CmsReusableContentData;
  publishedRevisionId: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}>;

export type CmsReusableContentRevision = Readonly<{
  id: string;
  documentId: string;
  version: number;
  data: CmsReusableContentData;
  note: string;
  createdAt: string;
  createdBy: string;
}>;

function reusableData(value: Readonly<Record<string, unknown>>) {
  return parseCmsCollectionData(cmsReusableContentCollection, value);
}

function reusableDocument(
  document: CmsCollectionDocument,
): CmsReusableContentDocument {
  return Object.freeze({
    id: document.id,
    version: document.version,
    status: document.status,
    data: reusableData(document.data),
    publishedRevisionId: document.publishedRevisionId,
    scheduledAt: document.scheduledAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  });
}

function reusableRevision(
  revision: CmsCollectionRevision,
): CmsReusableContentRevision {
  return Object.freeze({
    id: revision.id,
    documentId: revision.documentId,
    version: revision.version,
    data: reusableData(revision.data),
    note: revision.note,
    createdAt: revision.createdAt,
    createdBy: revision.createdBy,
  });
}

async function listAll(
  provider: CmsCollectionProvider,
  status: "draft" | "published" = "draft",
) {
  const documents: CmsCollectionDocument[] = [];
  let offset = 0;
  do {
    const page = await provider.list({
      collection: CMS_REUSABLE_CONTENT_COLLECTION,
      status,
      pagination: { limit: 100, offset },
      sort: { field: "updatedAt", direction: "desc" },
    });
    documents.push(...page.documents);
    offset += page.documents.length;
    if (!page.hasMore || page.documents.length === 0) break;
  } while (true);
  return documents;
}

function fragmentSources(
  documents: readonly CmsCollectionDocument[],
  sourceType = "reusable-fragment",
) {
  return documents.map((document) => {
    const data = reusableData(document.data);
    return {
      sourceType,
      sourceId: document.id,
      value: data.value,
    } satisfies CmsReusableContentUsageSource;
  });
}

function graphError(message: string, details: Record<string, unknown>) {
  return new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
    details,
  });
}

async function assertValidFragmentGraph(input: {
  provider: CmsCollectionProvider;
  id?: string;
  data: CmsReusableContentData;
  requirePublishedTargets?: boolean;
}) {
  const documents = await listAll(
    input.provider,
    input.requirePublishedTargets ? "published" : "draft",
  );
  const candidateId = input.id ?? "__new_reusable_fragment__";
  const candidates = [
    ...documents.filter((document) => document.id !== input.id),
  ];
  const known = new Map(
    candidates.map((document) => [document.id, reusableData(document.data)]),
  );
  known.set(candidateId, input.data);

  const dangling = [] as Array<{
    fragmentId: string;
    path: string;
    reason: "missing" | "content-type" | "revision";
  }>;
  for (const reference of collectCmsReusableContentReferences(
    input.data.value,
  )) {
    const target = known.get(reference.fragmentId);
    if (!target) {
      dangling.push({
        fragmentId: reference.fragmentId,
        path: reference.path,
        reason: "missing",
      });
      continue;
    }
    if (target.contentType !== reference.contentType) {
      dangling.push({
        fragmentId: reference.fragmentId,
        path: reference.path,
        reason: "content-type",
      });
      continue;
    }
    if (reference.revisionId) {
      const revisions = await input.provider.listRevisions({
        collection: CMS_REUSABLE_CONTENT_COLLECTION,
        id: reference.fragmentId,
      });
      if (!revisions.some((revision) => revision.id === reference.revisionId)) {
        dangling.push({
          fragmentId: reference.fragmentId,
          path: reference.path,
          reason: "revision",
        });
      }
    }
  }
  if (dangling.length) {
    throw graphError(
      input.requirePublishedTargets
        ? "Reusable content cannot publish with private or invalid dependencies."
        : "Reusable content contains invalid dependencies.",
      { dangling },
    );
  }

  const graph = buildCmsReusableContentUsageGraph([
    ...fragmentSources(candidates),
    {
      sourceType: "reusable-fragment",
      sourceId: candidateId,
      value: input.data.value,
    },
  ]);
  if (graph.cycles.length) {
    throw graphError("Reusable-content reference cycle detected.", {
      cycles: graph.cycles,
    });
  }
}

export type CmsReusableContentRuntime = ReturnType<
  typeof createCmsReusableContentRuntime
>;

/**
 * First-class reusable-content lifecycle over the portable collection provider.
 * The same runtime therefore works with local, Cloudflare D1, and Postgres.
 */
export function createCmsReusableContentRuntime(
  provider: CmsCollectionProvider,
) {
  const target = (id: string) => ({
    collection: CMS_REUSABLE_CONTENT_COLLECTION,
    id,
  });

  const getDraft = async (id: string) => {
    const document = await provider.getDraft(target(id));
    return document ? reusableDocument(document) : null;
  };
  const getPublished = async (id: string) => {
    const document = await provider.getPublished(target(id));
    return document ? reusableDocument(document) : null;
  };
  const revisions = async (id: string) =>
    (
      await provider.listRevisions({
        collection: CMS_REUSABLE_CONTENT_COLLECTION,
        id,
      })
    ).map(reusableRevision);

  const createLoader = (
    mode: "draft" | "published" = "published",
  ): CmsReusableContentLoader => {
    return async (reference: CmsReusableContentReference) => {
      if (reference.revisionId) {
        const revision = (await revisions(reference.fragmentId)).find(
          (candidate) => candidate.id === reference.revisionId,
        );
        return revision
          ? {
              fragmentId: revision.documentId,
              contentType: revision.data.contentType,
              revisionId: revision.id,
              value: revision.data.value,
            }
          : null;
      }
      const document =
        mode === "draft"
          ? await getDraft(reference.fragmentId)
          : await getPublished(reference.fragmentId);
      if (!document) return null;
      const revisionId =
        mode === "draft"
          ? `draft:${document.version}`
          : document.publishedRevisionId;
      if (!revisionId) return null;
      return {
        fragmentId: document.id,
        contentType: document.data.contentType,
        revisionId,
        value: document.data.value,
      };
    };
  };

  return Object.freeze({
    async list(input?: {
      status?: "draft" | "published";
      contentType?: string;
    }) {
      const documents = await listAll(provider, input?.status ?? "draft");
      return documents
        .map(reusableDocument)
        .filter(
          (document) =>
            !input?.contentType ||
            document.data.contentType === input.contentType,
        );
    },
    getDraft,
    getPublished,
    revisions,
    async createDraft(input: {
      id?: string;
      data: CmsReusableContentData;
      actorId: string;
    }) {
      const data = reusableData(input.data);
      await assertValidFragmentGraph({ provider, id: input.id, data });
      return reusableDocument(
        await provider.createDraft({
          collection: CMS_REUSABLE_CONTENT_COLLECTION,
          id: input.id,
          data,
          actorId: input.actorId,
        }),
      );
    },
    async saveDraft(input: {
      id: string;
      expectedVersion: number;
      data: CmsReusableContentData;
      actorId: string;
    }) {
      const data = reusableData(input.data);
      await assertValidFragmentGraph({ provider, id: input.id, data });
      return reusableDocument(
        await provider.saveDraft({
          collection: CMS_REUSABLE_CONTENT_COLLECTION,
          id: input.id,
          expectedVersion: input.expectedVersion,
          data,
          actorId: input.actorId,
        }),
      );
    },
    async publish(input: {
      id: string;
      expectedVersion: number;
      actorId: string;
      note?: string;
    }) {
      const document = await getDraft(input.id);
      if (!document) {
        throw new CmsError({
          code: "NOT_FOUND",
          message: `Reusable-content fragment "${input.id}" was not found.`,
          retryable: false,
        });
      }
      await assertValidFragmentGraph({
        provider,
        id: input.id,
        data: document.data,
        requirePublishedTargets: true,
      });
      const published = await provider.publish({
        collection: CMS_REUSABLE_CONTENT_COLLECTION,
        ...input,
      });
      return {
        document: reusableDocument(published.document),
        revision: reusableRevision(published.revision),
      };
    },
    async unpublish(input: {
      id: string;
      expectedVersion: number;
      actorId: string;
      sources?: readonly CmsReusableContentUsageSource[];
    }) {
      const documents = await listAll(provider, "published");
      const graph = buildCmsReusableContentUsageGraph([
        ...fragmentSources(
          documents.filter((document) => document.id !== input.id),
          "reusable-fragment-published",
        ),
        ...(input.sources ?? []),
      ]);
      const syncedInbound = (graph.byFragment[input.id] ?? []).filter(
        (usage) => usage.revisionId === null,
      );
      if (syncedInbound.length) {
        throw new CmsError({
          code: "CONFLICT",
          message: `Reusable-content fragment "${input.id}" has synced published usages.`,
          retryable: false,
          details: { usages: syncedInbound },
        });
      }
      return reusableDocument(
        await provider.unpublish({
          collection: CMS_REUSABLE_CONTENT_COLLECTION,
          id: input.id,
          expectedVersion: input.expectedVersion,
          actorId: input.actorId,
        }),
      );
    },
    async restore(input: {
      id: string;
      revisionId: string;
      expectedVersion: number;
      actorId: string;
    }) {
      const revision = (await revisions(input.id)).find(
        (candidate) => candidate.id === input.revisionId,
      );
      if (!revision) {
        throw new CmsError({
          code: "NOT_FOUND",
          message: `Reusable-content revision "${input.revisionId}" was not found.`,
          retryable: false,
        });
      }
      await assertValidFragmentGraph({
        provider,
        id: input.id,
        data: revision.data,
      });
      return reusableDocument(
        await provider.restore({
          collection: CMS_REUSABLE_CONTENT_COLLECTION,
          ...input,
        }),
      );
    },
    async delete(input: {
      id: string;
      expectedVersion: number;
      actorId: string;
      sources?: readonly CmsReusableContentUsageSource[];
    }) {
      const documents = await listAll(provider, "draft");
      const publishedDocuments = await listAll(provider, "published");
      const graph = buildCmsReusableContentUsageGraph([
        ...fragmentSources(
          documents.filter((document) => document.id !== input.id),
        ),
        ...fragmentSources(
          publishedDocuments.filter((document) => document.id !== input.id),
          "reusable-fragment-published",
        ),
        ...(input.sources ?? []),
      ]);
      const inbound = graph.byFragment[input.id] ?? [];
      if (inbound.length) {
        throw new CmsError({
          code: "CONFLICT",
          message: `Reusable-content fragment "${input.id}" is still in use.`,
          retryable: false,
          details: { usages: inbound },
        });
      }
      return reusableDocument(
        await provider.delete({
          collection: CMS_REUSABLE_CONTENT_COLLECTION,
          id: input.id,
          expectedVersion: input.expectedVersion,
          actorId: input.actorId,
        }),
      );
    },
    createLoader,
    async detach(input: {
      reference: CmsReusableContentReference;
      mode?: "draft" | "published";
      maxDepth?: number;
      now?: () => Date;
    }) {
      return detachCmsReusableContent({
        reference: input.reference,
        load: createLoader(input.mode),
        maxDepth: input.maxDepth,
        now: input.now,
      });
    },
    async resolve<TValue extends CmsJsonValue>(input: {
      value: TValue;
      mode?: "draft" | "published";
      maxDepth?: number;
    }) {
      return resolveCmsReusableContent({
        value: input.value,
        load: createLoader(input.mode),
        maxDepth: input.maxDepth,
      });
    },
    async usageGraph(input?: {
      mode?: "all" | "draft" | "published";
      sources?: readonly CmsReusableContentUsageSource[];
    }): Promise<CmsReusableContentUsageGraph> {
      const mode = input?.mode ?? "all";
      const draftDocuments =
        mode === "published" ? [] : await listAll(provider, "draft");
      const publishedDocuments =
        mode === "draft" ? [] : await listAll(provider, "published");
      return buildCmsReusableContentUsageGraph([
        ...fragmentSources(draftDocuments),
        ...fragmentSources(publishedDocuments, "reusable-fragment-published"),
        ...(input?.sources ?? []),
      ]);
    },
  });
}
