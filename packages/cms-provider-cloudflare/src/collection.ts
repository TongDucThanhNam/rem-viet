import {
  assertCmsRelationshipIntegrity,
  CmsError,
  collectCmsRelationshipReferences,
  migrateCollectionData,
  nullifyCmsRelationshipTarget,
  parseCmsCollectionData,
  type CmsBuiltInField,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
  type CmsExtensionRegistry,
  type CmsLifecycleOperation,
} from "@agency/cms-core";
import type {
  CmsCollectionAction,
  CmsCollectionDocument,
  CmsCollectionFilter,
  CmsCollectionPage,
  CmsCollectionProvider,
  CmsCollectionRevision,
  CmsCollectionVersionInput,
  CreateCmsCollectionDraftInput,
  ListCmsCollectionDocumentsInput,
  RestoreCmsCollectionRevisionInput,
  SaveCmsCollectionDraftInput,
  ScheduleCmsCollectionDraftInput,
} from "@agency/cms-runtime";

import type {
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
} from "./index.js";

type CollectionDocumentRow = {
  collection: string;
  id: string;
  locale: string;
  schemaVersion: number;
  version: number;
  status: "draft" | "published";
  data: string;
  publishedRevisionId: string | null;
  scheduledAt: number | null;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
};

type CollectionRevisionRow = {
  id: string;
  collection: string;
  documentId: string;
  locale: string;
  schemaVersion: number;
  version: number;
  snapshot: string;
  note: string;
  createdBy: string;
  createdAt: number;
};

const documentColumns = `
  collection_slug AS collection, id, locale, schema_version AS schemaVersion,
  version, status, data, published_revision_id AS publishedRevisionId,
  scheduled_at AS scheduledAt, updated_by AS updatedBy,
  created_at AS createdAt, updated_at AS updatedAt`;

const revisionColumns = `
  id, collection_slug AS collection, document_id AS documentId, locale,
  schema_version AS schemaVersion, version, snapshot, note,
  created_by AS createdBy, created_at AS createdAt`;

export type CloudflareCmsCollectionAuthorizationContext = {
  readonly action: CmsCollectionAction;
  readonly collection: CmsCollectionDefinition;
  readonly actorId: string | undefined;
};

export type CloudflareCmsCollectionMutationEvent = {
  readonly action:
    | "create"
    | "save"
    | "schedule"
    | "unschedule"
    | "publish"
    | "unpublish"
    | "restore"
    | "delete";
  readonly actorId: string;
  readonly collection: string;
  readonly documentId: string;
  readonly version: number;
  readonly timestamp: Date;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly revisionId?: string;
  readonly note?: string;
  readonly previousPublishedRevisionId?: string | null;
  readonly previousScheduledAt?: string | null;
  readonly scheduledAt?: string | null;
};

export type CloudflareCmsCollectionProviderOptions = {
  readonly database: CloudflareD1Database;
  /** Existing compatibility path for consumers without feature modules. */
  readonly registry?: CmsCollectionRegistry;
  /** Instance-scoped module registry; its collection registry becomes authoritative. */
  readonly extensions?: CmsExtensionRegistry;
  readonly createId?: () => string;
  readonly now?: () => Date;
  readonly authorize?: (
    context: CloudflareCmsCollectionAuthorizationContext,
  ) => void | Promise<void>;
  readonly prepareMutationStatements?: (
    event: CloudflareCmsCollectionMutationEvent,
  ) =>
    | CloudflareD1PreparedStatement
    | readonly CloudflareD1PreparedStatement[]
    | null;
};

function collectionNotFound(slug: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `Collection \"${slug}\" is not registered.`,
    retryable: false,
  });
}

function documentNotFound(collection: string, id: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `Document \"${collection}/${id}\" was not found.`,
    retryable: false,
  });
}

function versionConflict(
  expectedVersion: number,
  actualVersion: number,
): never {
  throw new CmsError({
    code: "CONFLICT",
    message: `Expected version ${expectedVersion}, received ${actualVersion}.`,
    retryable: false,
    details: { expectedVersion, actualVersion },
  });
}

function localeFor(
  definition: CmsCollectionDefinition,
  locale: string | undefined,
) {
  if (!definition.localization) {
    if (locale !== undefined) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Collection \"${definition.slug}\" has localization disabled.`,
        retryable: false,
      });
    }
    return "";
  }
  if (!locale || !definition.localization.locales.includes(locale)) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Collection \"${definition.slug}\" requires a supported locale.`,
      retryable: false,
      details: {
        locale: locale ?? null,
        locales: definition.localization.locales,
      },
    });
  }
  return locale;
}

function definitionFor(
  registry: CmsCollectionRegistry,
  slug: string,
): CmsCollectionDefinition<string, readonly CmsBuiltInField[]> {
  const definition = registry.collections.find(
    (collection) => collection.slug === slug,
  );
  if (!definition) collectionNotFound(slug);
  return definition as CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >;
}

function decodeData(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  value: string,
  schemaVersion: number,
) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: `Stored data for collection \"${definition.slug}\" is not valid JSON.`,
      retryable: false,
    });
  }
  const migrated = migrateCollectionData<Record<string, unknown>>(
    definition,
    decoded,
    schemaVersion,
  );
  return parseCmsCollectionData(definition, migrated);
}

function documentFromRow(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  row: CollectionDocumentRow,
  fallbackFrom: string | null = null,
): CmsCollectionDocument {
  return {
    id: row.id,
    collection: row.collection,
    schemaVersion: definition.schemaVersion,
    version: row.version,
    status: row.status,
    locale: row.locale || null,
    fallbackFrom,
    data: decodeData(definition, row.data, row.schemaVersion),
    publishedRevisionId: row.publishedRevisionId,
    scheduledAt:
      row.scheduledAt === null ? null : new Date(row.scheduledAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    updatedBy: row.updatedBy,
  };
}

function revisionFromRow(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  row: CollectionRevisionRow,
): CmsCollectionRevision {
  return {
    id: row.id,
    collection: row.collection,
    documentId: row.documentId,
    schemaVersion: definition.schemaVersion,
    version: row.version,
    locale: row.locale || null,
    data: decodeData(definition, row.snapshot, row.schemaVersion),
    note: row.note,
    createdBy: row.createdBy,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function valueForField(document: CmsCollectionDocument, field: string) {
  if (field === "id") return document.id;
  if (field === "createdAt") return document.createdAt;
  if (field === "updatedAt") return document.updatedAt;
  if (field === "status") return document.status;
  return document.data[field];
}

function matchesFilter(
  document: CmsCollectionDocument,
  filter: CmsCollectionFilter,
) {
  const actual = valueForField(document, filter.field);
  switch (filter.operator) {
    case "equals":
      return Object.is(actual, filter.value);
    case "notEquals":
      return !Object.is(actual, filter.value);
    case "in":
      return Array.isArray(filter.value) && filter.value.includes(actual);
    case "contains":
      return typeof actual === "string" && typeof filter.value === "string"
        ? actual.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase())
        : Array.isArray(actual) && actual.includes(filter.value);
    case "greaterThan":
      return typeof actual === typeof filter.value && actual! > filter.value!;
    case "greaterThanOrEqual":
      return typeof actual === typeof filter.value && actual! >= filter.value!;
    case "lessThan":
      return typeof actual === typeof filter.value && actual! < filter.value!;
    case "lessThanOrEqual":
      return typeof actual === typeof filter.value && actual! <= filter.value!;
  }
}

function compareValues(left: unknown, right: unknown) {
  if (Object.is(left, right)) return 0;
  if (left === undefined || left === null) return 1;
  if (right === undefined || right === null) return -1;
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  return String(left).localeCompare(String(right));
}

export class CloudflareCmsCollectionProvider implements CmsCollectionProvider {
  readonly registry: CmsCollectionRegistry;
  readonly #database: CloudflareD1Database;
  readonly #createId: () => string;
  readonly #now: () => Date;
  readonly #authorize?: CloudflareCmsCollectionProviderOptions["authorize"];
  readonly #extensions?: CmsExtensionRegistry;
  readonly #prepareMutationStatements?: CloudflareCmsCollectionProviderOptions["prepareMutationStatements"];

  constructor(options: CloudflareCmsCollectionProviderOptions) {
    this.#database = options.database;
    if (!options.registry && !options.extensions) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "A collection registry or extension registry is required.",
        retryable: false,
      });
    }
    if (
      options.registry &&
      options.extensions &&
      options.registry !== options.extensions.collections
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message:
          "Collection and extension registries must reference the same registry instance.",
        retryable: false,
      });
    }
    this.registry = options.extensions?.collections ?? options.registry!;
    this.#extensions = options.extensions;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
    this.#authorize = options.authorize;
    this.#prepareMutationStatements = options.prepareMutationStatements;
  }

  async #authorized(
    action: CmsCollectionAction,
    definition: CmsCollectionDefinition,
    actorId: string | undefined,
  ) {
    await this.#authorize?.({ action, collection: definition, actorId });
  }

  async #runHooks(
    operation: CmsLifecycleOperation,
    definition: CmsCollectionDefinition,
    input: {
      readonly actorId: string;
      readonly documentId: string;
      readonly locale: string | null;
      readonly data: Record<string, unknown> | null;
      readonly previousData: Record<string, unknown> | null;
    },
  ) {
    if (!this.#extensions) return input.data;
    let data = await this.#extensions.runHooks("validate", {
      operation,
      collection: definition,
      ...input,
    });
    data = await this.#extensions.runHooks(operation, {
      operation,
      collection: definition,
      ...input,
      data,
    });
    if (input.data !== null && data === null) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: `Lifecycle hooks cannot remove data during ${operation}.`,
        retryable: false,
      });
    }
    return data;
  }

  async #batch(statements: CloudflareD1PreparedStatement[]) {
    try {
      return await this.#database.batch(statements);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unique constraint|constraint failed/i.test(message)) {
        throw new CmsError({
          code: "CONFLICT",
          message: "A collection document or revision already exists.",
          retryable: false,
        });
      }
      throw error;
    }
  }

  #mutationStatements(event: CloudflareCmsCollectionMutationEvent) {
    const prepared = this.#prepareMutationStatements?.(event);
    if (!prepared) return [];
    return Array.isArray(prepared) ? [...prepared] : [prepared];
  }

  async #rawDocument(collection: string, id: string, locale = "") {
    return this.#database
      .prepare(
        `SELECT ${documentColumns} FROM cms_collection_documents
         WHERE collection_slug = ? AND id = ? AND locale = ? LIMIT 1`,
      )
      .bind(collection, id, locale)
      .first<CollectionDocumentRow>();
  }

  #overlaySharedFields(
    definition: CmsCollectionDefinition,
    localized: Record<string, unknown>,
    shared: Record<string, unknown>,
  ) {
    if (!definition.localization) return localized;
    const data = { ...localized };
    for (const field of definition.fields) {
      if (!field.localized && Object.hasOwn(shared, field.name)) {
        data[field.name] = shared[field.name];
      }
    }
    return data;
  }

  async #draftDataForLocale(
    definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
    id: string,
    locale: string,
    data: Record<string, unknown>,
  ) {
    if (
      !definition.localization ||
      locale === definition.localization.defaultLocale
    ) {
      return data;
    }
    const row = await this.#rawDocument(
      definition.slug,
      id,
      definition.localization.defaultLocale,
    );
    if (!row) {
      throw new CmsError({
        code: "CONFLICT",
        message: `Create the default locale \"${definition.localization.defaultLocale}\" before \"${locale}\".`,
        retryable: false,
      });
    }
    const shared = decodeData(definition, row.data, row.schemaVersion);
    return this.#overlaySharedFields(definition, data, shared);
  }

  async #publishedDataForLocale(
    definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
    id: string,
    locale: string,
    data: Record<string, unknown>,
    requireDefault = false,
  ) {
    if (
      !definition.localization ||
      locale === definition.localization.defaultLocale
    ) {
      return data;
    }
    const row = await this.#database
      .prepare(
        `SELECT r.id, r.collection_slug AS collection,
          r.document_id AS documentId, r.locale,
          r.schema_version AS schemaVersion, r.version, r.snapshot,
          r.note, r.created_by AS createdBy, r.created_at AS createdAt
         FROM cms_collection_documents d
         INNER JOIN cms_collection_revisions r ON r.id = d.published_revision_id
         WHERE d.collection_slug = ? AND d.id = ? AND d.locale = ?
           AND d.status = 'published' LIMIT 1`,
      )
      .bind(definition.slug, id, definition.localization.defaultLocale)
      .first<CollectionRevisionRow>();
    if (!row && requireDefault) {
      throw new CmsError({
        code: "CONFLICT",
        message: `Publish the default locale \"${definition.localization.defaultLocale}\" before \"${locale}\".`,
        retryable: false,
      });
    }
    if (!row) return data;
    const shared = revisionFromRow(definition, row).data;
    return this.#overlaySharedFields(definition, data, shared);
  }

  async #referencesValid(
    definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
    data: Record<string, unknown>,
    locale: string,
  ) {
    await assertCmsRelationshipIntegrity({
      registry: this.registry,
      collection: definition,
      data,
      targetExists: async ({ collection, id, localeBehavior }) => {
        const target = definitionFor(this.registry, collection);
        if (!target.localization) {
          return Boolean(await this.#rawDocument(collection, id));
        }
        if (localeBehavior === "any") {
          return Boolean(
            await this.#database
              .prepare(
                `SELECT id FROM cms_collection_documents
                 WHERE collection_slug = ? AND id = ? LIMIT 1`,
              )
              .bind(collection, id)
              .first<{ id: string }>(),
          );
        }
        const targetLocale =
          localeBehavior === "default"
            ? target.localization.defaultLocale
            : locale;
        return Boolean(await this.#rawDocument(collection, id, targetLocale));
      },
    });
  }

  async getDraft(input: {
    collection: string;
    id: string;
    actorId?: string;
    locale?: string;
    fallback?: "none" | "default";
  }) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    let row = await this.#rawDocument(input.collection, input.id, locale);
    let fallbackFrom: string | null = null;
    if (
      !row &&
      definition.localization &&
      input.fallback === "default" &&
      locale !== definition.localization.defaultLocale
    ) {
      row = await this.#rawDocument(
        input.collection,
        input.id,
        definition.localization.defaultLocale,
      );
      fallbackFrom = row ? locale : null;
    }
    if (!row) return null;
    const document = documentFromRow(definition, row, fallbackFrom);
    if (
      definition.localization &&
      row.locale !== definition.localization.defaultLocale
    ) {
      const data = await this.#draftDataForLocale(
        definition,
        row.id,
        row.locale,
        document.data,
      );
      return { ...document, data };
    }
    return document;
  }

  async getPublished(input: {
    collection: string;
    id: string;
    actorId?: string;
    locale?: string;
    fallback?: "none" | "default";
  }) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const requestedLocale = localeFor(definition, input.locale);
    let resolvedLocale = requestedLocale;
    let row = await this.#database
      .prepare(
        `SELECT r.id, r.collection_slug AS collection,
          r.document_id AS documentId, r.locale,
          r.schema_version AS schemaVersion,
          r.version, r.snapshot, r.note, r.created_by AS createdBy,
          r.created_at AS createdAt
         FROM cms_collection_documents d
         INNER JOIN cms_collection_revisions r ON r.id = d.published_revision_id
         WHERE d.collection_slug = ? AND d.id = ? AND d.locale = ?
           AND d.status = 'published'
         LIMIT 1`,
      )
      .bind(input.collection, input.id, requestedLocale)
      .first<CollectionRevisionRow>();
    if (
      !row &&
      definition.localization &&
      input.fallback === "default" &&
      requestedLocale !== definition.localization.defaultLocale
    ) {
      resolvedLocale = definition.localization.defaultLocale;
      row = await this.#database
        .prepare(
          `SELECT r.id, r.collection_slug AS collection,
            r.document_id AS documentId, r.locale,
            r.schema_version AS schemaVersion,
            r.version, r.snapshot, r.note, r.created_by AS createdBy,
            r.created_at AS createdAt
           FROM cms_collection_documents d
           INNER JOIN cms_collection_revisions r ON r.id = d.published_revision_id
           WHERE d.collection_slug = ? AND d.id = ? AND d.locale = ?
             AND d.status = 'published' LIMIT 1`,
        )
        .bind(input.collection, input.id, resolvedLocale)
        .first<CollectionRevisionRow>();
    }
    if (!row) return null;
    const revision = revisionFromRow(definition, row);
    const data = await this.#publishedDataForLocale(
      definition,
      input.id,
      resolvedLocale,
      revision.data,
    );
    return {
      id: revision.documentId,
      collection: revision.collection,
      schemaVersion: revision.schemaVersion,
      version: revision.version,
      status: "published" as const,
      data,
      locale: revision.locale,
      fallbackFrom: resolvedLocale === requestedLocale ? null : requestedLocale,
      publishedRevisionId: revision.id,
      scheduledAt: null,
      createdAt: revision.createdAt,
      updatedAt: revision.createdAt,
      updatedBy: revision.createdBy,
    };
  }

  async list(
    input: ListCmsCollectionDocumentsInput,
  ): Promise<CmsCollectionPage> {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const systemFields = new Set(["id", "createdAt", "updatedAt", "status"]);
    const fieldNames = new Set(definition.fields.map((field) => field.name));
    for (const field of [
      ...(input.filters?.map(({ field }) => field) ?? []),
      ...(input.sort ? [input.sort.field] : []),
    ]) {
      if (!systemFields.has(field) && !fieldNames.has(field)) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: `Unknown query field \"${field}\" for collection \"${definition.slug}\".`,
          retryable: false,
        });
      }
    }

    let documents: CmsCollectionDocument[];
    if ((input.status ?? "draft") === "published") {
      const rows = await this.#database
        .prepare(
          `SELECT r.id, r.collection_slug AS collection,
            r.document_id AS documentId, r.locale,
            r.schema_version AS schemaVersion,
            r.version, r.snapshot, r.note, r.created_by AS createdBy,
            r.created_at AS createdAt
           FROM cms_collection_documents d
           INNER JOIN cms_collection_revisions r ON r.id = d.published_revision_id
           WHERE d.collection_slug = ? AND d.locale = ?
             AND d.status = 'published'`,
        )
        .bind(input.collection, locale)
        .all<CollectionRevisionRow>();
      documents = await Promise.all(
        rows.results.map(async (row) => {
          const revision = revisionFromRow(definition, row);
          const data = await this.#publishedDataForLocale(
            definition,
            revision.documentId,
            locale,
            revision.data,
          );
          return {
            id: revision.documentId,
            collection: revision.collection,
            schemaVersion: revision.schemaVersion,
            version: revision.version,
            status: "published" as const,
            data,
            locale: revision.locale,
            fallbackFrom: null,
            publishedRevisionId: revision.id,
            scheduledAt: null,
            createdAt: revision.createdAt,
            updatedAt: revision.createdAt,
            updatedBy: revision.createdBy,
          };
        }),
      );
    } else {
      const rows = await this.#database
        .prepare(
          `SELECT ${documentColumns} FROM cms_collection_documents
           WHERE collection_slug = ? AND locale = ?`,
        )
        .bind(input.collection, locale)
        .all<CollectionDocumentRow>();
      documents = await Promise.all(
        rows.results.map(async (row) => {
          const document = documentFromRow(definition, row);
          const data = await this.#draftDataForLocale(
            definition,
            row.id,
            locale,
            document.data,
          );
          return { ...document, data };
        }),
      );
    }
    for (const filter of input.filters ?? []) {
      documents = documents.filter((document) =>
        matchesFilter(document, filter),
      );
    }
    const sort = input.sort ?? {
      field: "updatedAt",
      direction: "desc" as const,
    };
    documents.sort((left, right) => {
      const compared = compareValues(
        valueForField(left, sort.field),
        valueForField(right, sort.field),
      );
      return sort.direction === "asc" ? compared : -compared;
    });
    const limit = Math.min(100, Math.max(1, input.pagination?.limit ?? 25));
    const offset = Math.max(0, input.pagination?.offset ?? 0);
    const total = documents.length;
    return {
      documents: documents.slice(offset, offset + limit),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async createDraft(input: CreateCmsCollectionDraftInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("create", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const id = input.id ?? this.#createId();
    const localizedInput = await this.#draftDataForLocale(
      definition,
      id,
      locale,
      input.data as Record<string, unknown>,
    );
    const hookedData = await this.#runHooks("create", definition, {
      actorId: input.actorId,
      documentId: id,
      locale: locale || null,
      data: localizedInput,
      previousData: null,
    });
    const data = parseCmsCollectionData(definition, hookedData);
    await this.#referencesValid(definition, data, locale);
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const insert = this.#database
      .prepare(
        `INSERT INTO cms_collection_documents (
          collection_slug, id, locale, schema_version, version, status, data,
          published_revision_id, scheduled_at, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, 'draft', ?, NULL, NULL, ?, ?, ?)`,
      )
      .bind(
        definition.slug,
        id,
        locale,
        definition.schemaVersion,
        JSON.stringify(data),
        input.actorId,
        now,
        now,
      );
    const [result] = await this.#batch([
      insert,
      ...this.#mutationStatements({
        action: "create",
        actorId: input.actorId,
        collection: definition.slug,
        documentId: id,
        version: 1,
        timestamp,
        before: null,
        after: data,
        previousPublishedRevisionId: null,
        previousScheduledAt: null,
      }),
    ]);
    if (!result?.success) throw new Error("Collection draft insert failed.");
    return (await this.getDraft({
      collection: definition.slug,
      id,
      actorId: input.actorId,
      locale: input.locale,
    }))!;
  }

  async saveDraft(input: SaveCmsCollectionDraftInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("update", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const current = await this.#rawDocument(input.collection, input.id, locale);
    if (!current) documentNotFound(input.collection, input.id);
    if (current.version !== input.expectedVersion)
      versionConflict(input.expectedVersion, current.version);
    const before = decodeData(definition, current.data, current.schemaVersion);
    const localizedInput = await this.#draftDataForLocale(
      definition,
      input.id,
      locale,
      input.data as Record<string, unknown>,
    );
    const hookedData = await this.#runHooks("update", definition, {
      actorId: input.actorId,
      documentId: input.id,
      locale: locale || null,
      data: localizedInput,
      previousData: before,
    });
    const data = parseCmsCollectionData(definition, hookedData);
    await this.#referencesValid(definition, data, locale);
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const update = this.#database
      .prepare(
        `UPDATE cms_collection_documents
         SET schema_version = ?, data = ?, version = version + 1,
             updated_by = ?, updated_at = ?
         WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
      )
      .bind(
        definition.schemaVersion,
        JSON.stringify(data),
        input.actorId,
        now,
        input.collection,
        input.id,
        locale,
        input.expectedVersion,
      );
    const [result] = await this.#batch([
      update,
      ...this.#mutationStatements({
        action: "save",
        actorId: input.actorId,
        collection: input.collection,
        documentId: input.id,
        version: current.version + 1,
        timestamp,
        before,
        after: data,
        previousPublishedRevisionId: current.publishedRevisionId,
        previousScheduledAt:
          current.scheduledAt === null
            ? null
            : new Date(current.scheduledAt).toISOString(),
      }),
    ]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.#rawDocument(
        input.collection,
        input.id,
        locale,
      );
      if (!latest) documentNotFound(input.collection, input.id);
      versionConflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft(input))!;
  }

  async schedule(input: ScheduleCmsCollectionDraftInput) {
    const definition = definitionFor(this.registry, input.collection);
    if (!definition.lifecycle.scheduling) {
      throw new CmsError({
        code: "CAPABILITY_UNAVAILABLE",
        message: `Collection \"${definition.slug}\" does not support scheduling.`,
        retryable: false,
      });
    }
    const scheduled = new Date(input.scheduledAt);
    if (
      !Number.isFinite(scheduled.getTime()) ||
      scheduled.getTime() <= this.#now().getTime()
    ) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "Schedule time must be a valid future timestamp.",
        retryable: false,
      });
    }
    return this.#setSchedule(input, scheduled.getTime());
  }

  async unschedule(input: CmsCollectionVersionInput) {
    return this.#setSchedule(input, null);
  }

  async #setSchedule(
    input: CmsCollectionVersionInput,
    scheduledAt: number | null,
  ) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("update", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const current = await this.#rawDocument(input.collection, input.id, locale);
    if (!current) documentNotFound(input.collection, input.id);
    if (current.version !== input.expectedVersion)
      versionConflict(input.expectedVersion, current.version);
    const data = decodeData(definition, current.data, current.schemaVersion);
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const update = this.#database
      .prepare(
        `UPDATE cms_collection_documents
         SET scheduled_at = ?, version = version + 1, updated_by = ?, updated_at = ?
         WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
      )
      .bind(
        scheduledAt,
        input.actorId,
        now,
        input.collection,
        input.id,
        locale,
        input.expectedVersion,
      );
    const [result] = await this.#batch([
      update,
      ...this.#mutationStatements({
        action: scheduledAt === null ? "unschedule" : "schedule",
        actorId: input.actorId,
        collection: input.collection,
        documentId: input.id,
        version: current.version + 1,
        timestamp,
        before: data,
        after: data,
        previousPublishedRevisionId: current.publishedRevisionId,
        previousScheduledAt:
          current.scheduledAt === null
            ? null
            : new Date(current.scheduledAt).toISOString(),
        scheduledAt:
          scheduledAt === null ? null : new Date(scheduledAt).toISOString(),
        note: input.note,
      }),
    ]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.#rawDocument(
        input.collection,
        input.id,
        locale,
      );
      if (!latest) documentNotFound(input.collection, input.id);
      versionConflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft(input))!;
  }

  async publish(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("publish", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const current = await this.#rawDocument(input.collection, input.id, locale);
    if (!current) documentNotFound(input.collection, input.id);
    if (current.version !== input.expectedVersion)
      versionConflict(input.expectedVersion, current.version);
    const stored = decodeData(definition, current.data, current.schemaVersion);
    const before = await this.#publishedDataForLocale(
      definition,
      input.id,
      locale,
      stored,
      true,
    );
    const hookedData = await this.#runHooks("publish", definition, {
      actorId: input.actorId,
      documentId: input.id,
      locale: locale || null,
      data: before,
      previousData: before,
    });
    const data = parseCmsCollectionData(definition, hookedData);
    await this.#referencesValid(definition, data, locale);
    const version = current.version + 1;
    const revisionId = this.#createId();
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const results = await this.#batch([
      this.#database
        .prepare(
          `INSERT INTO cms_collection_revisions (
            id, collection_slug, document_id, locale, schema_version, version,
            snapshot, note, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          revisionId,
          input.collection,
          input.id,
          locale,
          definition.schemaVersion,
          version,
          JSON.stringify(data),
          input.note ?? "",
          input.actorId,
          now,
        ),
      this.#database
        .prepare(
          `UPDATE cms_collection_documents
           SET schema_version = ?, data = ?, version = ?, status = 'published',
               published_revision_id = ?, scheduled_at = NULL,
               updated_by = ?, updated_at = ?
           WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
        )
        .bind(
          definition.schemaVersion,
          JSON.stringify(data),
          version,
          revisionId,
          input.actorId,
          now,
          input.collection,
          input.id,
          locale,
          input.expectedVersion,
        ),
      ...this.#mutationStatements({
        action: "publish",
        actorId: input.actorId,
        collection: input.collection,
        documentId: input.id,
        version,
        timestamp,
        before,
        after: data,
        revisionId,
        note: input.note,
        previousPublishedRevisionId: current.publishedRevisionId,
        previousScheduledAt:
          current.scheduledAt === null
            ? null
            : new Date(current.scheduledAt).toISOString(),
        scheduledAt: null,
      }),
    ]);
    if ((results[1]?.meta?.changes ?? 0) !== 1) {
      const latest = await this.#rawDocument(
        input.collection,
        input.id,
        locale,
      );
      if (!latest) documentNotFound(input.collection, input.id);
      versionConflict(input.expectedVersion, latest.version);
    }
    const document = (await this.getDraft(input))!;
    const revision = (await this.#database
      .prepare(
        `SELECT ${revisionColumns} FROM cms_collection_revisions WHERE id = ? LIMIT 1`,
      )
      .bind(revisionId)
      .first<CollectionRevisionRow>())!;
    return { document, revision: revisionFromRow(definition, revision) };
  }

  async unpublish(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("publish", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const current = await this.#rawDocument(input.collection, input.id, locale);
    if (!current) documentNotFound(input.collection, input.id);
    if (current.version !== input.expectedVersion)
      versionConflict(input.expectedVersion, current.version);
    const data = decodeData(definition, current.data, current.schemaVersion);
    await this.#runHooks("unpublish", definition, {
      actorId: input.actorId,
      documentId: input.id,
      locale: locale || null,
      data,
      previousData: data,
    });
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const update = this.#database
      .prepare(
        `UPDATE cms_collection_documents
         SET status = 'draft', published_revision_id = NULL,
             version = version + 1, updated_by = ?, updated_at = ?
         WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
      )
      .bind(
        input.actorId,
        now,
        input.collection,
        input.id,
        locale,
        input.expectedVersion,
      );
    const [result] = await this.#batch([
      update,
      ...this.#mutationStatements({
        action: "unpublish",
        actorId: input.actorId,
        collection: input.collection,
        documentId: input.id,
        version: current.version + 1,
        timestamp,
        before: data,
        after: data,
        previousPublishedRevisionId: current.publishedRevisionId,
        previousScheduledAt:
          current.scheduledAt === null
            ? null
            : new Date(current.scheduledAt).toISOString(),
      }),
    ]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.#rawDocument(
        input.collection,
        input.id,
        locale,
      );
      if (!latest) documentNotFound(input.collection, input.id);
      versionConflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft(input))!;
  }

  async listRevisions(input: {
    collection: string;
    id: string;
    actorId?: string;
    locale?: string;
  }) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const rows = await this.#database
      .prepare(
        `SELECT ${revisionColumns} FROM cms_collection_revisions
         WHERE collection_slug = ? AND document_id = ? AND locale = ?
         ORDER BY version DESC`,
      )
      .bind(input.collection, input.id, locale)
      .all<CollectionRevisionRow>();
    return rows.results.map((row) => revisionFromRow(definition, row));
  }

  async restore(input: RestoreCmsCollectionRevisionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("update", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const current = await this.#rawDocument(input.collection, input.id, locale);
    if (!current) documentNotFound(input.collection, input.id);
    if (current.version !== input.expectedVersion)
      versionConflict(input.expectedVersion, current.version);
    const revision = await this.#database
      .prepare(
        `SELECT ${revisionColumns} FROM cms_collection_revisions
          WHERE id = ? AND collection_slug = ? AND document_id = ?
            AND locale = ? LIMIT 1`,
      )
      .bind(input.revisionId, input.collection, input.id, locale)
      .first<CollectionRevisionRow>();
    if (!revision) documentNotFound(input.collection, input.revisionId);
    const before = decodeData(definition, current.data, current.schemaVersion);
    const revisionData = await this.#draftDataForLocale(
      definition,
      input.id,
      locale,
      revisionFromRow(definition, revision).data,
    );
    const hookedData = await this.#runHooks("restore", definition, {
      actorId: input.actorId,
      documentId: input.id,
      locale: locale || null,
      data: revisionData,
      previousData: before,
    });
    const data = parseCmsCollectionData(definition, hookedData);
    await this.#referencesValid(definition, data, locale);
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const update = this.#database
      .prepare(
        `UPDATE cms_collection_documents
         SET schema_version = ?, data = ?, version = version + 1,
             scheduled_at = NULL, updated_by = ?, updated_at = ?
         WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
      )
      .bind(
        definition.schemaVersion,
        JSON.stringify(data),
        input.actorId,
        now,
        input.collection,
        input.id,
        locale,
        input.expectedVersion,
      );
    const [result] = await this.#batch([
      update,
      ...this.#mutationStatements({
        action: "restore",
        actorId: input.actorId,
        collection: input.collection,
        documentId: input.id,
        version: current.version + 1,
        timestamp,
        before,
        after: data,
        revisionId: input.revisionId,
        note: input.note,
        previousPublishedRevisionId: current.publishedRevisionId,
        previousScheduledAt:
          current.scheduledAt === null
            ? null
            : new Date(current.scheduledAt).toISOString(),
        scheduledAt: null,
      }),
    ]);
    if ((result?.meta?.changes ?? 0) !== 1)
      versionConflict(input.expectedVersion, current.version);
    return (await this.getDraft(input))!;
  }

  async delete(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("delete", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const current = await this.#rawDocument(input.collection, input.id, locale);
    if (!current) documentNotFound(input.collection, input.id);
    if (current.version !== input.expectedVersion)
      versionConflict(input.expectedVersion, current.version);
    const deletedDocument = documentFromRow(definition, current);
    if (
      definition.localization &&
      locale === definition.localization.defaultLocale
    ) {
      const translation = await this.#database
        .prepare(
          `SELECT locale FROM cms_collection_documents
           WHERE collection_slug = ? AND id = ? AND locale <> ? LIMIT 1`,
        )
        .bind(input.collection, input.id, locale)
        .first<{ locale: string }>();
      if (translation) {
        throw new CmsError({
          code: "CONFLICT",
          message: `Delete localized variants before the default locale \"${locale}\".`,
          retryable: false,
        });
      }
    }
    await this.#runHooks("delete", definition, {
      actorId: input.actorId,
      documentId: input.id,
      locale: locale || null,
      data: deletedDocument.data,
      previousData: deletedDocument.data,
    });

    const allRows = await this.#database
      .prepare(`SELECT ${documentColumns} FROM cms_collection_documents`)
      .all<CollectionDocumentRow>();
    const alternateTargetLocale = definition.localization
      ? await this.#database
          .prepare(
            `SELECT locale FROM cms_collection_documents
             WHERE collection_slug = ? AND id = ? AND locale <> ? LIMIT 1`,
          )
          .bind(input.collection, input.id, locale)
          .first<{ locale: string }>()
      : null;
    const targetsDeletedLocale = (
      reference: ReturnType<typeof collectCmsRelationshipReferences>[number],
      sourceLocale: string,
    ) => {
      if (reference.localeBehavior === "same") return sourceLocale === locale;
      if (reference.localeBehavior === "default") {
        return locale === definition.localization?.defaultLocale;
      }
      return !alternateTargetLocale;
    };
    const statements: CloudflareD1PreparedStatement[] = [];
    const now = this.#now().getTime();
    for (const row of allRows.results) {
      if (row.collection === input.collection && row.id === input.id) continue;
      const sourceDefinition = definitionFor(this.registry, row.collection);
      const sourceData = decodeData(
        sourceDefinition,
        row.data,
        row.schemaVersion,
      );
      if (row.publishedRevisionId) {
        const publishedRow = await this.#database
          .prepare(
            `SELECT ${revisionColumns} FROM cms_collection_revisions
             WHERE id = ? LIMIT 1`,
          )
          .bind(row.publishedRevisionId)
          .first<CollectionRevisionRow>();
        if (publishedRow) {
          const publishedData = revisionFromRow(
            sourceDefinition,
            publishedRow,
          ).data;
          const publishedReferences = collectCmsRelationshipReferences(
            sourceDefinition,
            publishedData,
          ).filter(
            (reference) =>
              reference.targetCollection === input.collection &&
              reference.targetId === input.id &&
              targetsDeletedLocale(reference, row.locale),
          );
          if (publishedReferences.length) {
            throw new CmsError({
              code: "CONFLICT",
              message: `Published document \"${row.collection}/${row.id}\" still references this document.`,
              retryable: false,
              details: { references: publishedReferences },
            });
          }
        }
      }
      const references = collectCmsRelationshipReferences(
        sourceDefinition,
        sourceData,
      ).filter(
        (reference) =>
          reference.targetCollection === input.collection &&
          reference.targetId === input.id &&
          targetsDeletedLocale(reference, row.locale),
      );
      if (!references.length) continue;
      if (references.some((reference) => reference.onDelete === "restrict")) {
        throw new CmsError({
          code: "CONFLICT",
          message: `Document \"${input.collection}/${input.id}\" is still referenced.`,
          retryable: false,
          details: { references },
        });
      }
      await this.#authorized("update", sourceDefinition, input.actorId);
      const nullified = nullifyCmsRelationshipTarget({
        collection: sourceDefinition,
        data: sourceData,
        targetCollection: input.collection,
        targetId: input.id,
      });
      if (!nullified.changedFields.length) continue;
      const parsed = parseCmsCollectionData(sourceDefinition, nullified.data);
      statements.push(
        this.#database
          .prepare(
            `UPDATE cms_collection_documents
             SET data = ?, schema_version = ?, version = version + 1,
                 updated_by = ?, updated_at = ?
              WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
          )
          .bind(
            JSON.stringify(parsed),
            sourceDefinition.schemaVersion,
            input.actorId,
            now,
            row.collection,
            row.id,
            row.locale,
            row.version,
          ),
      );
    }
    statements.push(
      this.#database
        .prepare(
          `DELETE FROM cms_collection_revisions
           WHERE collection_slug = ? AND document_id = ? AND locale = ?`,
        )
        .bind(input.collection, input.id, locale),
    );
    const deleteStatementIndex = statements.length;
    statements.push(
      this.#database
        .prepare(
          `DELETE FROM cms_collection_documents
           WHERE collection_slug = ? AND id = ? AND locale = ? AND version = ?`,
        )
        .bind(input.collection, input.id, locale, input.expectedVersion),
    );
    statements.push(
      ...this.#mutationStatements({
        action: "delete",
        actorId: input.actorId,
        collection: input.collection,
        documentId: input.id,
        version: current.version,
        timestamp: new Date(now),
        before: deletedDocument.data,
        after: null,
        previousPublishedRevisionId: current.publishedRevisionId,
        previousScheduledAt:
          current.scheduledAt === null
            ? null
            : new Date(current.scheduledAt).toISOString(),
      }),
    );
    const results = await this.#batch(statements);
    if ((results[deleteStatementIndex]?.meta?.changes ?? 0) !== 1) {
      const latest = await this.#rawDocument(
        input.collection,
        input.id,
        locale,
      );
      if (!latest) documentNotFound(input.collection, input.id);
      versionConflict(input.expectedVersion, latest.version);
    }
    return deletedDocument;
  }
}

export function createCloudflareCmsCollectionProvider(
  options: CloudflareCmsCollectionProviderOptions,
) {
  return new CloudflareCmsCollectionProvider(options);
}
