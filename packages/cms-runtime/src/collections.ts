import {
  CmsError,
  type CmsCapability,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
} from "@agency/cms-core";

export type CmsCollectionAction =
  "read" | "create" | "update" | "delete" | "publish";

export type CmsLocaleFallbackPolicy = "none" | "default";

export type CmsCollectionLocaleInput = {
  readonly locale?: string;
};

export type CmsCollectionReadLocaleInput = CmsCollectionLocaleInput & {
  readonly fallback?: CmsLocaleFallbackPolicy;
};

export function assertCmsCollectionAccess(
  collection: CmsCollectionDefinition,
  action: CmsCollectionAction,
  granted: readonly CmsCapability[],
) {
  const missing = collection.access[action].filter(
    (capability) => !granted.includes(capability),
  );
  if (missing.length) {
    throw new CmsError({
      code: "FORBIDDEN",
      message: `Missing capabilities for ${action} on collection \"${collection.slug}\".`,
      retryable: false,
      details: { action, collection: collection.slug, missing },
    });
  }
}

export type CmsCollectionDocument<TData = Record<string, unknown>> = {
  readonly id: string;
  readonly collection: string;
  readonly schemaVersion: number;
  readonly version: number;
  readonly status: "draft" | "published";
  /** Null for collections with localization disabled. */
  readonly locale: string | null;
  /** Requested locale when a default-locale fallback supplied this result. */
  readonly fallbackFrom: string | null;
  readonly data: TData;
  readonly publishedRevisionId: string | null;
  readonly scheduledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
};

export type CmsCollectionRevision<TData = Record<string, unknown>> = {
  readonly id: string;
  readonly collection: string;
  readonly documentId: string;
  readonly schemaVersion: number;
  readonly version: number;
  readonly locale: string | null;
  readonly data: TData;
  readonly note: string;
  readonly createdAt: string;
  readonly createdBy: string;
};

export type CmsCollectionFilter = {
  readonly field: string;
  readonly operator:
    | "equals"
    | "notEquals"
    | "in"
    | "contains"
    | "greaterThan"
    | "greaterThanOrEqual"
    | "lessThan"
    | "lessThanOrEqual";
  readonly value: unknown;
};

export type ListCmsCollectionDocumentsInput = {
  readonly collection: string;
  readonly status?: "draft" | "published";
  readonly filters?: readonly CmsCollectionFilter[];
  readonly sort?: {
    readonly field: string;
    readonly direction: "asc" | "desc";
  };
  readonly pagination?: { readonly limit?: number; readonly offset?: number };
  readonly actorId?: string;
} & CmsCollectionLocaleInput;

export type CmsCollectionPage<TData = Record<string, unknown>> = {
  readonly documents: readonly CmsCollectionDocument<TData>[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
};

export type CreateCmsCollectionDraftInput<TData = unknown> = {
  readonly collection: string;
  readonly id?: string;
  readonly data: TData;
  readonly actorId: string;
} & CmsCollectionLocaleInput;

export type SaveCmsCollectionDraftInput<TData = unknown> = {
  readonly collection: string;
  readonly id: string;
  readonly expectedVersion: number;
  readonly data: TData;
  readonly actorId: string;
} & CmsCollectionLocaleInput;

export type CmsCollectionVersionInput = {
  readonly collection: string;
  readonly id: string;
  readonly expectedVersion: number;
  readonly actorId: string;
  readonly note?: string;
} & CmsCollectionLocaleInput;

export type ScheduleCmsCollectionDraftInput = CmsCollectionVersionInput & {
  readonly scheduledAt: string;
};

export type RestoreCmsCollectionRevisionInput = CmsCollectionVersionInput & {
  readonly revisionId: string;
};

export interface CmsCollectionProvider {
  readonly registry: CmsCollectionRegistry;
  getDraft(
    input: {
      collection: string;
      id: string;
      actorId?: string;
    } & CmsCollectionReadLocaleInput,
  ): Promise<CmsCollectionDocument | null>;
  getPublished(
    input: {
      collection: string;
      id: string;
      actorId?: string;
    } & CmsCollectionReadLocaleInput,
  ): Promise<CmsCollectionDocument | null>;
  list(input: ListCmsCollectionDocumentsInput): Promise<CmsCollectionPage>;
  createDraft(
    input: CreateCmsCollectionDraftInput,
  ): Promise<CmsCollectionDocument>;
  saveDraft(input: SaveCmsCollectionDraftInput): Promise<CmsCollectionDocument>;
  schedule(
    input: ScheduleCmsCollectionDraftInput,
  ): Promise<CmsCollectionDocument>;
  unschedule(input: CmsCollectionVersionInput): Promise<CmsCollectionDocument>;
  publish(input: CmsCollectionVersionInput): Promise<{
    document: CmsCollectionDocument;
    revision: CmsCollectionRevision;
  }>;
  unpublish(input: CmsCollectionVersionInput): Promise<CmsCollectionDocument>;
  listRevisions(
    input: {
      collection: string;
      id: string;
      actorId?: string;
    } & CmsCollectionLocaleInput,
  ): Promise<readonly CmsCollectionRevision[]>;
  restore(
    input: RestoreCmsCollectionRevisionInput,
  ): Promise<CmsCollectionDocument>;
  delete(input: CmsCollectionVersionInput): Promise<CmsCollectionDocument>;
}

export type CmsCollectionRuntime = Readonly<{
  registry: CmsCollectionRegistry;
  content: Pick<CmsCollectionProvider, "getDraft" | "getPublished" | "list">;
  drafts: Pick<CmsCollectionProvider, "createDraft" | "saveDraft">;
  publishing: Pick<
    CmsCollectionProvider,
    | "schedule"
    | "unschedule"
    | "publish"
    | "unpublish"
    | "listRevisions"
    | "restore"
  >;
  lifecycle: Pick<CmsCollectionProvider, "delete">;
}>;

export function createCmsCollectionRuntime(
  provider: CmsCollectionProvider,
): CmsCollectionRuntime {
  return Object.freeze({
    registry: provider.registry,
    content: provider,
    drafts: provider,
    publishing: provider,
    lifecycle: provider,
  });
}

export type CollectionProviderConformanceEvidence = {
  readonly draftIsolation: true;
  readonly filteredPagination: true;
  readonly optimisticConflict: true;
  readonly publish: true;
  readonly revisionRestore: true;
  readonly scheduling: true;
};

export async function runCollectionProviderConformance(input: {
  readonly provider: CmsCollectionProvider;
  readonly collection: string;
  readonly initial: Record<string, unknown>;
  readonly changed: Record<string, unknown>;
  readonly filter: CmsCollectionFilter;
  readonly actorId?: string;
  readonly documentId?: string;
  readonly locale?: string;
}): Promise<CollectionProviderConformanceEvidence> {
  const actorId = input.actorId ?? "collection-conformance";
  const id = input.documentId ?? "collection-conformance-document";
  const target = { collection: input.collection, id, locale: input.locale };
  if ((await input.provider.getDraft(target)) !== null) {
    throw new Error("Collection conformance requires empty storage.");
  }
  const created = await input.provider.createDraft({
    ...target,
    data: input.initial,
    actorId,
  });
  if ((await input.provider.getPublished(target)) !== null) {
    throw new Error("A new collection draft leaked to published reads.");
  }
  const list = await input.provider.list({
    collection: input.collection,
    locale: input.locale,
    filters: [input.filter],
    pagination: { limit: 1, offset: 0 },
  });
  if (list.total !== 1 || list.documents[0]?.id !== id) {
    throw new Error("Filtered collection pagination failed.");
  }
  const scheduled = await input.provider.schedule({
    ...target,
    expectedVersion: created.version,
    scheduledAt: "2099-01-01T00:00:00.000Z",
    actorId,
  });
  const unscheduled = await input.provider.unschedule({
    ...target,
    expectedVersion: scheduled.version,
    actorId,
  });
  const firstPublish = await input.provider.publish({
    ...target,
    expectedVersion: unscheduled.version,
    actorId,
  });
  const changed = await input.provider.saveDraft({
    ...target,
    expectedVersion: firstPublish.document.version,
    data: input.changed,
    actorId,
  });
  const publicBeforePublish = await input.provider.getPublished(target);
  if (
    JSON.stringify(publicBeforePublish?.data) !== JSON.stringify(created.data)
  ) {
    throw new Error("Collection draft save mutated the published snapshot.");
  }
  let conflict = false;
  try {
    await input.provider.saveDraft({
      ...target,
      expectedVersion: firstPublish.document.version,
      data: input.initial,
      actorId,
    });
  } catch (error) {
    conflict = error instanceof CmsError && error.code === "CONFLICT";
  }
  if (!conflict) throw new Error("Collection stale write was not rejected.");
  const secondPublish = await input.provider.publish({
    ...target,
    expectedVersion: changed.version,
    actorId,
  });
  const revisions = await input.provider.listRevisions(target);
  if (revisions.length !== 2)
    throw new Error("Collection revisions are incomplete.");
  const restored = await input.provider.restore({
    ...target,
    expectedVersion: secondPublish.document.version,
    revisionId: firstPublish.revision.id,
    actorId,
  });
  if (JSON.stringify(restored.data) !== JSON.stringify(created.data)) {
    throw new Error("Collection revision restore failed.");
  }
  return {
    draftIsolation: true,
    filteredPagination: true,
    optimisticConflict: true,
    publish: true,
    revisionRestore: true,
    scheduling: true,
  };
}
