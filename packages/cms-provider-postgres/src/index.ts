import { Pool, type PoolConfig } from "pg";
import {
  assertCmsRelationshipIntegrity,
  collectCmsRelationshipReferences,
  CmsError,
  migrateCollectionData,
  nullifyCmsRelationshipTarget,
  parseCmsCollectionData,
  parseCmsCollectionDataAsync,
  serializeCmsCollectionDataForRead,
  type CmsBuiltInField,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
  type CmsProviderCapabilities,
} from "@agency/cms-core";
import type {
  CmsAtomicImportOperation,
  CmsCollectionAction,
  CmsCollectionDocument,
  CmsCollectionFilter,
  CmsCollectionPage,
  CmsCollectionProvider,
  CmsCollectionPortabilityProvider,
  CmsCollectionRevision,
  CmsCollectionVersionInput,
  CreateCmsCollectionDraftInput,
  ListCmsCollectionDocumentsInput,
  RestoreCmsCollectionRevisionInput,
  SaveCmsCollectionDraftInput,
  ScheduleCmsCollectionDraftInput,
} from "@agency/cms-runtime";

export const postgresCmsStorageCapabilities = Object.freeze({
  schedule: true,
  media: true,
  webhook: false,
  release: false,
  localization: true,
  transaction: true,
  search: false,
});

export const postgresCmsCapabilities: CmsProviderCapabilities = Object.freeze({
  supported: [
    "content.readDraft",
    "content.write",
    "content.publish",
    "content.schedule",
    "content.restore",
    "content.delete",
  ],
});

export type PostgresCmsQueryResult<TRow extends Record<string, unknown>> =
  Readonly<{ rows: readonly TRow[] }>;

export interface PostgresCmsQueryExecutor {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresCmsQueryResult<TRow>>;
}

export interface PostgresCmsClient extends PostgresCmsQueryExecutor {
  release(): void;
}

export interface PostgresCmsDatabase extends PostgresCmsQueryExecutor {
  connect(): Promise<PostgresCmsClient>;
}

export function createPostgresCmsDatabase(input?: PoolConfig) {
  return new Pool(input) as PostgresCmsDatabase;
}

const postgresSchema = `
CREATE TABLE IF NOT EXISTS agency_cms_postgres_state (
  namespace TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS agency_cms_postgres_dam_state (
  namespace TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
`;

export async function applyPostgresCmsMigrations(
  database: PostgresCmsDatabase,
) {
  await database.query(postgresSchema);
}

type StoredDocument = {
  collection: string;
  id: string;
  locale: string;
  schemaVersion: number;
  version: number;
  status: "draft" | "published";
  data: Record<string, unknown>;
  publishedRevisionId: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

type StoredRevision = {
  id: string;
  collection: string;
  documentId: string;
  locale: string;
  schemaVersion: number;
  version: number;
  data: Record<string, unknown>;
  note: string;
  createdAt: string;
  createdBy: string;
};

type StoredState = {
  documents: StoredDocument[];
  revisions: StoredRevision[];
};

type PostgresCmsAuthorizationContext = Readonly<{
  action: CmsCollectionAction;
  collection: CmsCollectionDefinition;
  actorId: string | undefined;
}>;

export type PostgresCmsCollectionProviderOptions = Readonly<{
  database: PostgresCmsDatabase;
  registry: CmsCollectionRegistry;
  namespace?: string;
  createId?: () => string;
  now?: () => Date;
  authorize?: (
    context: PostgresCmsAuthorizationContext,
  ) => void | Promise<void>;
}>;

function cmsError(
  code: "VALIDATION_FAILED" | "NOT_FOUND" | "CONFLICT" | "MIGRATION_FAILED",
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new CmsError({ code, message, retryable: false, details });
}

function parseStoredState(value: unknown): StoredState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return cmsError(
      "MIGRATION_FAILED",
      "PostgreSQL CMS state is not an object.",
    );
  }
  const state = value as Partial<StoredState>;
  if (!Array.isArray(state.documents) || !Array.isArray(state.revisions)) {
    return cmsError("MIGRATION_FAILED", "PostgreSQL CMS state is incomplete.");
  }
  return {
    documents: structuredClone(state.documents),
    revisions: structuredClone(state.revisions),
  };
}

function decodeState(payload: unknown) {
  try {
    return parseStoredState(
      typeof payload === "string" ? JSON.parse(payload) : payload,
    );
  } catch (error) {
    if (error instanceof CmsError) throw error;
    return cmsError(
      "MIGRATION_FAILED",
      "PostgreSQL CMS state is not valid JSON.",
    );
  }
}

function safeNamespace(value: string) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(value)) {
    return cmsError(
      "VALIDATION_FAILED",
      "PostgreSQL CMS namespace must be a safe lowercase identifier.",
    );
  }
  return value;
}

function definitionFor(registry: CmsCollectionRegistry, slug: string) {
  if (!registry.has(slug)) {
    return cmsError("NOT_FOUND", `Collection \"${slug}\" is not registered.`, {
      collection: slug,
    });
  }
  return registry.get(slug) as CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >;
}

function localeFor(
  definition: CmsCollectionDefinition,
  locale: string | undefined,
) {
  if (!definition.localization) {
    if (locale !== undefined) {
      return cmsError(
        "VALIDATION_FAILED",
        `Collection \"${definition.slug}\" has localization disabled.`,
      );
    }
    return "";
  }
  if (!locale || !definition.localization.locales.includes(locale)) {
    return cmsError(
      "VALIDATION_FAILED",
      `Collection \"${definition.slug}\" requires a supported locale.`,
      { locale: locale ?? null, locales: definition.localization.locales },
    );
  }
  return locale;
}

function assertDocumentId(value: string) {
  if (!value.trim() || value.length > 128) {
    return cmsError(
      "VALIDATION_FAILED",
      "CMS document id must contain between 1 and 128 characters.",
    );
  }
  return value;
}

function parsedData(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  data: unknown,
  schemaVersion = definition.schemaVersion,
) {
  const migrated = migrateCollectionData<Record<string, unknown>>(
    definition,
    data,
    schemaVersion,
  );
  return parseCmsCollectionData(definition, migrated);
}

async function parsedMutationData(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  data: unknown,
  context: {
    readonly operation: "create" | "update";
    readonly actorId: string;
    readonly documentId: string;
    readonly locale: string | null;
    readonly previousData: Readonly<Record<string, unknown>> | null;
  },
  schemaVersion = definition.schemaVersion,
) {
  const migrated = migrateCollectionData<Record<string, unknown>>(
    definition,
    data,
    schemaVersion,
  );
  return parseCmsCollectionDataAsync(definition, migrated, context);
}

function documentFromStored(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  document: StoredDocument,
  fallbackFrom: string | null = null,
): CmsCollectionDocument {
  return {
    id: document.id,
    collection: document.collection,
    schemaVersion: definition.schemaVersion,
    version: document.version,
    status: document.status,
    locale: document.locale || null,
    fallbackFrom,
    data: parsedData(definition, document.data, document.schemaVersion),
    publishedRevisionId: document.publishedRevisionId,
    scheduledAt: document.scheduledAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  };
}

function revisionFromStored(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  revision: StoredRevision,
): CmsCollectionRevision {
  return {
    id: revision.id,
    collection: revision.collection,
    documentId: revision.documentId,
    schemaVersion: definition.schemaVersion,
    version: revision.version,
    locale: revision.locale || null,
    data: parsedData(definition, revision.data, revision.schemaVersion),
    note: revision.note,
    createdAt: revision.createdAt,
    createdBy: revision.createdBy,
  };
}

async function documentForRead(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  document: CmsCollectionDocument,
  actorId: string | undefined,
): Promise<CmsCollectionDocument> {
  return {
    ...document,
    data: (await serializeCmsCollectionDataForRead(definition, document.data, {
      actorId,
      documentId: document.id,
      locale: document.locale,
    })) as Record<string, unknown>,
  };
}

async function revisionForRead(
  definition: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>,
  revision: CmsCollectionRevision,
  actorId: string | undefined,
): Promise<CmsCollectionRevision> {
  return {
    ...revision,
    data: (await serializeCmsCollectionDataForRead(definition, revision.data, {
      actorId,
      documentId: revision.documentId,
      locale: revision.locale,
    })) as Record<string, unknown>,
  };
}

function valueForField(document: CmsCollectionDocument, field: string) {
  if (field === "id") return document.id;
  if (field === "status") return document.status;
  if (field === "createdAt") return document.createdAt;
  if (field === "updatedAt") return document.updatedAt;
  return document.data[field];
}

function compareValues(left: unknown, right: unknown) {
  if (Object.is(left, right)) return 0;
  if (left === undefined || left === null) return 1;
  if (right === undefined || right === null) return -1;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
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
      if (typeof actual === "string" && typeof filter.value === "string") {
        return actual.toLowerCase().includes(filter.value.toLowerCase());
      }
      return Array.isArray(actual) && actual.includes(filter.value);
    case "greaterThan":
      return compareValues(actual, filter.value) > 0;
    case "greaterThanOrEqual":
      return compareValues(actual, filter.value) >= 0;
    case "lessThan":
      return compareValues(actual, filter.value) < 0;
    case "lessThanOrEqual":
      return compareValues(actual, filter.value) <= 0;
  }
}

function sameTarget(
  value: Pick<StoredDocument, "collection" | "id" | "locale">,
  target: { collection: string; id: string; locale: string },
) {
  return (
    value.collection === target.collection &&
    value.id === target.id &&
    value.locale === target.locale
  );
}

function findDocument(
  state: StoredState,
  target: { collection: string; id: string; locale: string },
) {
  return state.documents.find((document) => sameTarget(document, target));
}

function documentNotFound(target: { collection: string; id: string }) {
  return cmsError(
    "NOT_FOUND",
    `Document \"${target.collection}/${target.id}\" was not found.`,
    target,
  );
}

function assertVersion(document: StoredDocument, expectedVersion: number) {
  if (document.version !== expectedVersion) {
    return cmsError(
      "CONFLICT",
      `Expected version ${expectedVersion}, received ${document.version}.`,
      { expectedVersion, actualVersion: document.version },
    );
  }
}

function assertUniqueFields(
  definition: CmsCollectionDefinition,
  state: StoredState,
  target: { id: string; locale: string },
  data: Record<string, unknown>,
) {
  for (const field of definition.fields.filter(({ unique }) => unique)) {
    const candidate = data[field.name];
    if (candidate === undefined || candidate === null) continue;
    const duplicate = state.documents.find(
      (document) =>
        document.collection === definition.slug &&
        document.locale === target.locale &&
        document.id !== target.id &&
        Object.is(document.data[field.name], candidate),
    );
    if (duplicate) {
      cmsError(
        "CONFLICT",
        `Field \"${definition.slug}.${field.name}\" must be unique.`,
        { collection: definition.slug, field: field.name },
      );
    }
  }
}

function relationshipTargetKey(collection: string, id: string, locale: string) {
  return `${collection}\u0000${id}\u0000${locale}`;
}

async function assertStateRelationshipIntegrity(input: {
  registry: CmsCollectionRegistry;
  collection: CmsCollectionDefinition<string, readonly CmsBuiltInField[]>;
  data: Readonly<Record<string, unknown>>;
  locale: string;
  state: StoredState;
  plannedTargets?: ReadonlySet<string>;
}) {
  await assertCmsRelationshipIntegrity({
    registry: input.registry,
    collection: input.collection,
    data: input.data,
    targetExists: ({ collection, id, localeBehavior }) => {
      const target = definitionFor(input.registry, collection);
      const existsAt = (locale: string) =>
        Boolean(
          input.plannedTargets?.has(
            relationshipTargetKey(collection, id, locale),
          ) || findDocument(input.state, { collection, id, locale }),
        );
      if (!target.localization) return existsAt("");
      if (localeBehavior === "any") {
        return target.localization.locales.some(existsAt);
      }
      return existsAt(
        localeBehavior === "default"
          ? target.localization.defaultLocale
          : input.locale,
      );
    },
  });
}

async function rollbackQuietly(client: PostgresCmsClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original provider error.
  }
}

export class PostgresCmsCollectionProvider implements CmsCollectionPortabilityProvider {
  readonly registry: CmsCollectionRegistry;
  readonly capabilities = postgresCmsCapabilities;
  readonly #database: PostgresCmsDatabase;
  readonly #namespace: string;
  readonly #createId: () => string;
  readonly #now: () => Date;
  readonly #authorize?: PostgresCmsCollectionProviderOptions["authorize"];

  constructor(options: PostgresCmsCollectionProviderOptions) {
    this.#database = options.database;
    this.registry = options.registry;
    this.#namespace = safeNamespace(options.namespace ?? "default");
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
    this.#authorize = options.authorize;
  }

  async #authorized(
    action: CmsCollectionAction,
    definition: CmsCollectionDefinition,
    actorId: string | undefined,
  ) {
    await this.#authorize?.({ action, collection: definition, actorId });
  }

  async #load(executor: PostgresCmsQueryExecutor, lockNamespace = false) {
    if (lockNamespace) {
      await executor.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        this.#namespace,
      ]);
    }
    const result = await executor.query<{ payload: unknown }>(
      `SELECT payload
       FROM agency_cms_postgres_state
       WHERE namespace = $1
       LIMIT 1${lockNamespace ? " FOR UPDATE" : ""}`,
      [this.#namespace],
    );
    if (!result.rows.length) {
      const empty = { documents: [], revisions: [] } satisfies StoredState;
      await executor.query(
        `INSERT INTO agency_cms_postgres_state (
          namespace, schema_version, payload, updated_at
        ) VALUES ($1, 1, $2::jsonb, $3::timestamptz)
        ON CONFLICT (namespace) DO NOTHING`,
        [this.#namespace, JSON.stringify(empty), this.#now().toISOString()],
      );
      return empty;
    }
    return decodeState(result.rows[0]?.payload);
  }

  async #read() {
    return this.#load(this.#database);
  }

  async #mutate<T>(operation: (state: StoredState) => T | Promise<T>) {
    const client = await this.#database.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      const state = await this.#load(client, true);
      const result = await operation(state);
      await client.query(
        `UPDATE agency_cms_postgres_state
         SET schema_version = 1,
             payload = $1::jsonb,
             updated_at = $2::timestamptz
         WHERE namespace = $3`,
        [JSON.stringify(state), this.#now().toISOString(), this.#namespace],
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getDraft(input: Parameters<CmsCollectionProvider["getDraft"]>[0]) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const requestedLocale = localeFor(definition, input.locale);
    const state = await this.#read();
    let document = findDocument(state, {
      collection: input.collection,
      id: input.id,
      locale: requestedLocale,
    });
    let fallbackFrom: string | null = null;
    if (
      !document &&
      input.fallback === "default" &&
      definition.localization &&
      requestedLocale !== definition.localization.defaultLocale
    ) {
      document = findDocument(state, {
        collection: input.collection,
        id: input.id,
        locale: definition.localization.defaultLocale,
      });
      if (document) fallbackFrom = requestedLocale;
    }
    return document
      ? documentForRead(
          definition,
          documentFromStored(definition, document, fallbackFrom),
          input.actorId,
        )
      : null;
  }

  async getPublished(
    input: Parameters<CmsCollectionProvider["getPublished"]>[0],
  ) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const requestedLocale = localeFor(definition, input.locale);
    const state = await this.#read();
    let resolvedLocale = requestedLocale;
    let document = findDocument(state, {
      collection: input.collection,
      id: input.id,
      locale: resolvedLocale,
    });
    if (
      (!document?.publishedRevisionId ||
        !state.revisions.some(
          ({ id }) => id === document?.publishedRevisionId,
        )) &&
      input.fallback === "default" &&
      definition.localization &&
      requestedLocale !== definition.localization.defaultLocale
    ) {
      resolvedLocale = definition.localization.defaultLocale;
      document = findDocument(state, {
        collection: input.collection,
        id: input.id,
        locale: resolvedLocale,
      });
    }
    if (!document?.publishedRevisionId) return null;
    const revision = state.revisions.find(
      ({ id }) => id === document.publishedRevisionId,
    );
    if (!revision) return null;
    return documentForRead(
      definition,
      {
        ...documentFromStored(definition, document),
        version: revision.version,
        status: "published" as const,
        data: revisionFromStored(definition, revision).data,
        fallbackFrom:
          resolvedLocale === requestedLocale ? null : requestedLocale,
        scheduledAt: null,
        updatedAt: revision.createdAt,
        updatedBy: revision.createdBy,
      },
      input.actorId,
    );
  }

  async list(input: ListCmsCollectionDocumentsInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const systemFields = new Set(["id", "createdAt", "updatedAt", "status"]);
    const queryFields = [
      ...(input.filters?.map(({ field }) => field) ?? []),
      ...(input.sort ? [input.sort.field] : []),
    ];
    for (const fieldName of queryFields) {
      const field = definition.fields.find(({ name }) => name === fieldName);
      if (!systemFields.has(fieldName) && !field) {
        throw new CmsError({
          code: "VALIDATION_FAILED",
          message: `Unknown query field "${fieldName}" for collection "${definition.slug}".`,
          retryable: false,
        });
      }
      if (field?.access?.read) {
        throw new CmsError({
          code: "FORBIDDEN",
          message: `Access-controlled field "${fieldName}" cannot be used for collection queries.`,
          retryable: false,
        });
      }
      if (field?.kind === "virtual" || field?.kind === "join") {
        throw new CmsError({
          code: "CAPABILITY_UNAVAILABLE",
          message: `Derived field "${fieldName}" is not queryable by this provider.`,
          retryable: false,
        });
      }
    }
    const state = await this.#read();
    const documents = (
      await Promise.all(
        state.documents
          .filter(
            (document) =>
              document.collection === input.collection &&
              document.locale === locale,
          )
          .map(async (document) => {
            if (input.status !== "published") {
              return documentForRead(
                definition,
                documentFromStored(definition, document),
                input.actorId,
              );
            }
            const revision = state.revisions.find(
              ({ id }) => id === document.publishedRevisionId,
            );
            if (!revision) return null;
            return documentForRead(
              definition,
              {
                ...documentFromStored(definition, document),
                version: revision.version,
                status: "published" as const,
                data: revisionFromStored(definition, revision).data,
                scheduledAt: null,
                updatedAt: revision.createdAt,
                updatedBy: revision.createdBy,
              },
              input.actorId,
            );
          }),
      )
    )
      .filter(
        (document): document is CmsCollectionDocument => document !== null,
      )
      .filter((document) =>
        (input.filters ?? []).every((filter) =>
          matchesFilter(document, filter),
        ),
      );
    const direction = input.sort?.direction === "asc" ? 1 : -1;
    const sortField = input.sort?.field ?? "updatedAt";
    documents.sort(
      (left, right) =>
        compareValues(
          valueForField(left, sortField),
          valueForField(right, sortField),
        ) * direction,
    );
    const offset = Math.max(0, input.pagination?.offset ?? 0);
    const limit = Math.min(100, Math.max(1, input.pagination?.limit ?? 25));
    return {
      documents: documents.slice(offset, offset + limit),
      total: documents.length,
      limit,
      offset,
      hasMore: offset + limit < documents.length,
    } satisfies CmsCollectionPage;
  }

  async createDraft(input: CreateCmsCollectionDraftInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("create", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const id = assertDocumentId(input.id ?? this.#createId());
    return this.#mutate(async (state) => {
      const target = { collection: input.collection, id, locale };
      if (findDocument(state, target)) {
        cmsError("CONFLICT", `Document \"${input.collection}/${id}\" exists.`);
      }
      const data = await parsedMutationData(definition, input.data, {
        operation: "create",
        actorId: input.actorId,
        documentId: id,
        locale: locale || null,
        previousData: null,
      });
      assertUniqueFields(definition, state, target, data);
      await assertStateRelationshipIntegrity({
        registry: this.registry,
        collection: definition,
        data,
        locale,
        state,
      });
      const timestamp = this.#now().toISOString();
      const document: StoredDocument = {
        ...target,
        schemaVersion: definition.schemaVersion,
        version: 1,
        status: "draft",
        data,
        publishedRevisionId: null,
        scheduledAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: input.actorId,
      };
      state.documents.push(document);
      return documentForRead(
        definition,
        documentFromStored(definition, document),
        input.actorId,
      );
    });
  }

  async saveDraft(input: SaveCmsCollectionDraftInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("update", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    return this.#mutate(async (state) => {
      const target = { collection: input.collection, id: input.id, locale };
      const document = findDocument(state, target) ?? documentNotFound(target);
      assertVersion(document, input.expectedVersion);
      const previousData = parsedData(
        definition,
        document.data,
        document.schemaVersion,
      );
      const data = await parsedMutationData(definition, input.data, {
        operation: "update",
        actorId: input.actorId,
        documentId: input.id,
        locale: locale || null,
        previousData,
      });
      assertUniqueFields(definition, state, target, data);
      await assertStateRelationshipIntegrity({
        registry: this.registry,
        collection: definition,
        data,
        locale,
        state,
      });
      document.data = data;
      document.schemaVersion = definition.schemaVersion;
      document.version += 1;
      document.status = "draft";
      document.scheduledAt = null;
      document.updatedAt = this.#now().toISOString();
      document.updatedBy = input.actorId;
      return documentForRead(
        definition,
        documentFromStored(definition, document),
        input.actorId,
      );
    });
  }

  async schedule(input: ScheduleCmsCollectionDraftInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("publish", definition, input.actorId);
    if (!definition.lifecycle.scheduling) {
      return cmsError(
        "VALIDATION_FAILED",
        `Collection \"${definition.slug}\" has scheduling disabled.`,
      );
    }
    const scheduledAt = new Date(input.scheduledAt);
    if (
      Number.isNaN(scheduledAt.valueOf()) ||
      scheduledAt.valueOf() <= this.#now().valueOf()
    ) {
      return cmsError(
        "VALIDATION_FAILED",
        "Scheduled publication must be in the future.",
      );
    }
    return this.#versionedMutation(input, (document) => {
      document.scheduledAt = scheduledAt.toISOString();
      document.status = "draft";
    });
  }

  async unschedule(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("publish", definition, input.actorId);
    return this.#versionedMutation(input, (document) => {
      document.scheduledAt = null;
      document.status = "draft";
    });
  }

  async publish(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("publish", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    return this.#mutate(async (state) => {
      const target = { collection: input.collection, id: input.id, locale };
      const document = findDocument(state, target) ?? documentNotFound(target);
      assertVersion(document, input.expectedVersion);
      const publishedData = parsedData(
        definition,
        document.data,
        document.schemaVersion,
      );
      await assertStateRelationshipIntegrity({
        registry: this.registry,
        collection: definition,
        data: publishedData,
        locale,
        state,
      });
      const timestamp = this.#now().toISOString();
      const revision: StoredRevision = {
        id: this.#createId(),
        collection: input.collection,
        documentId: input.id,
        locale,
        schemaVersion: definition.schemaVersion,
        version: document.version + 1,
        data: publishedData,
        note: input.note ?? "Published",
        createdAt: timestamp,
        createdBy: input.actorId,
      };
      document.version = revision.version;
      document.schemaVersion = definition.schemaVersion;
      document.status = "published";
      document.publishedRevisionId = revision.id;
      document.scheduledAt = null;
      document.updatedAt = timestamp;
      document.updatedBy = input.actorId;
      state.revisions.push(revision);
      return {
        document: await documentForRead(
          definition,
          documentFromStored(definition, document),
          input.actorId,
        ),
        revision: await revisionForRead(
          definition,
          revisionFromStored(definition, revision),
          input.actorId,
        ),
      };
    });
  }

  async unpublish(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("publish", definition, input.actorId);
    return this.#versionedMutation(input, (document) => {
      document.status = "draft";
      document.publishedRevisionId = null;
      document.scheduledAt = null;
    });
  }

  async listRevisions(
    input: Parameters<CmsCollectionProvider["listRevisions"]>[0],
  ) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("read", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    const state = await this.#read();
    return Promise.all(
      state.revisions
        .filter(
          (revision) =>
            revision.collection === input.collection &&
            revision.documentId === input.id &&
            revision.locale === locale,
        )
        .sort((left, right) => right.version - left.version)
        .map((revision) =>
          revisionForRead(
            definition,
            revisionFromStored(definition, revision),
            input.actorId,
          ),
        ),
    );
  }

  async restore(input: RestoreCmsCollectionRevisionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("update", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    return this.#mutate(async (state) => {
      const target = { collection: input.collection, id: input.id, locale };
      const document = findDocument(state, target) ?? documentNotFound(target);
      assertVersion(document, input.expectedVersion);
      const revision = state.revisions.find(
        (candidate) =>
          candidate.id === input.revisionId &&
          candidate.collection === input.collection &&
          candidate.documentId === input.id &&
          candidate.locale === locale,
      );
      if (!revision) {
        return cmsError(
          "NOT_FOUND",
          `Revision \"${input.revisionId}\" was not found.`,
        );
      }
      const previousData = parsedData(
        definition,
        document.data,
        document.schemaVersion,
      );
      document.data = await parsedMutationData(
        definition,
        revision.data,
        {
          operation: "update",
          actorId: input.actorId,
          documentId: input.id,
          locale: locale || null,
          previousData,
        },
        revision.schemaVersion,
      );
      assertUniqueFields(definition, state, target, document.data);
      await assertStateRelationshipIntegrity({
        registry: this.registry,
        collection: definition,
        data: document.data,
        locale,
        state,
      });
      document.schemaVersion = definition.schemaVersion;
      document.version += 1;
      document.status = "draft";
      document.scheduledAt = null;
      document.updatedAt = this.#now().toISOString();
      document.updatedBy = input.actorId;
      return documentForRead(
        definition,
        documentFromStored(definition, document),
        input.actorId,
      );
    });
  }

  /** Applies a fully preflighted portability plan in one libSQL transaction. */
  async applyImportAtomically(input: {
    actorId: string;
    operations: readonly CmsAtomicImportOperation[];
  }) {
    const plannedTargets = new Set<string>();
    for (const operation of input.operations) {
      const definition = definitionFor(this.registry, operation.collection);
      const locale = localeFor(definition, operation.locale ?? undefined);
      const key = relationshipTargetKey(
        operation.collection,
        operation.id,
        locale,
      );
      if (plannedTargets.has(key)) {
        return cmsError(
          "VALIDATION_FAILED",
          `Import contains duplicate document "${operation.collection}/${operation.id}".`,
        );
      }
      plannedTargets.add(key);
    }

    await this.#mutate(async (state) => {
      for (const operation of input.operations) {
        const definition = definitionFor(this.registry, operation.collection);
        const locale = localeFor(definition, operation.locale ?? undefined);
        const target = {
          collection: operation.collection,
          id: operation.id,
          locale,
        };
        const current = findDocument(state, target);
        await this.#authorized(
          operation.kind === "create" ? "create" : "update",
          definition,
          input.actorId,
        );
        if (operation.publishedData) {
          await this.#authorized("publish", definition, input.actorId);
        }
        if (
          operation.schemaVersion !== definition.schemaVersion ||
          (operation.kind === "create" &&
            (current || operation.expectedVersion !== null)) ||
          (operation.kind === "update" &&
            (!current || current.version !== operation.expectedVersion))
        ) {
          return cmsError(
            "CONFLICT",
            `Import precondition changed for "${operation.collection}/${operation.id}".`,
          );
        }
        const previousData = current
          ? parsedData(definition, current.data, current.schemaVersion)
          : null;
        const data = await parsedMutationData(definition, operation.data, {
          operation: operation.kind,
          actorId: input.actorId,
          documentId: operation.id,
          locale: locale || null,
          previousData,
        });
        const publishedData = operation.publishedData
          ? await parsedMutationData(definition, operation.publishedData, {
              operation: operation.kind,
              actorId: input.actorId,
              documentId: operation.id,
              locale: locale || null,
              previousData,
            })
          : null;
        assertUniqueFields(definition, state, target, data);
        for (const source of [
          data,
          ...(publishedData ? [publishedData] : []),
        ]) {
          await assertStateRelationshipIntegrity({
            registry: this.registry,
            collection: definition,
            data: source,
            locale,
            state,
            plannedTargets,
          });
        }
        if (
          operation.scheduledAt !== null &&
          (!definition.lifecycle.scheduling ||
            !Number.isFinite(Date.parse(operation.scheduledAt)))
        ) {
          return cmsError(
            "VALIDATION_FAILED",
            `Imported schedule for "${operation.collection}/${operation.id}" is invalid.`,
          );
        }

        const timestamp = this.#now().toISOString();
        const nextVersion = current ? current.version + 1 : 1;
        const revisionId = publishedData ? this.#createId() : null;
        const document: StoredDocument = current ?? {
          ...target,
          schemaVersion: definition.schemaVersion,
          version: nextVersion,
          status: "draft",
          data,
          publishedRevisionId: null,
          scheduledAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          updatedBy: input.actorId,
        };
        document.schemaVersion = definition.schemaVersion;
        document.version = nextVersion;
        document.status = publishedData ? "published" : "draft";
        document.data = data;
        document.publishedRevisionId = revisionId;
        document.scheduledAt = publishedData ? null : operation.scheduledAt;
        document.updatedAt = timestamp;
        document.updatedBy = input.actorId;
        if (!current) state.documents.push(document);
        if (publishedData && revisionId) {
          state.revisions.push({
            id: revisionId,
            collection: operation.collection,
            documentId: operation.id,
            locale,
            schemaVersion: definition.schemaVersion,
            version: nextVersion,
            data: publishedData,
            note: "Imported publication",
            createdAt: timestamp,
            createdBy: input.actorId,
          });
        }
      }
    });
  }

  async delete(input: CmsCollectionVersionInput) {
    const definition = definitionFor(this.registry, input.collection);
    await this.#authorized("delete", definition, input.actorId);
    const locale = localeFor(definition, input.locale);
    return this.#mutate(async (state) => {
      const target = { collection: input.collection, id: input.id, locale };
      const index = state.documents.findIndex((document) =>
        sameTarget(document, target),
      );
      if (index < 0) return documentNotFound(target);
      const document = state.documents[index]!;
      assertVersion(document, input.expectedVersion);
      if (
        definition.localization &&
        locale === definition.localization.defaultLocale &&
        state.documents.some(
          (candidate) =>
            candidate.collection === input.collection &&
            candidate.id === input.id &&
            candidate.locale !== locale,
        )
      ) {
        return cmsError(
          "CONFLICT",
          `Delete localized variants before the default locale "${locale}".`,
        );
      }
      const hasAlternateTargetLocale = definition.localization
        ? state.documents.some(
            (candidate) =>
              candidate.collection === input.collection &&
              candidate.id === input.id &&
              candidate.locale !== locale,
          )
        : false;
      const targetsDeletedLocale = (
        reference: ReturnType<typeof collectCmsRelationshipReferences>[number],
        sourceLocale: string,
      ) => {
        if (reference.localeBehavior === "same") {
          return sourceLocale === locale;
        }
        if (reference.localeBehavior === "default") {
          return locale === definition.localization?.defaultLocale;
        }
        return !hasAlternateTargetLocale;
      };
      for (const source of state.documents) {
        if (source.collection === input.collection && source.id === input.id) {
          continue;
        }
        const sourceDefinition = definitionFor(
          this.registry,
          source.collection,
        );
        if (source.publishedRevisionId) {
          const revision = state.revisions.find(
            ({ id }) => id === source.publishedRevisionId,
          );
          const publishedReferences = revision
            ? collectCmsRelationshipReferences(
                sourceDefinition,
                parsedData(
                  sourceDefinition,
                  revision.data,
                  revision.schemaVersion,
                ),
              ).filter(
                (reference) =>
                  reference.targetCollection === input.collection &&
                  reference.targetId === input.id &&
                  targetsDeletedLocale(reference, source.locale),
              )
            : [];
          if (publishedReferences.length) {
            throw new CmsError({
              code: "CONFLICT",
              message: `Published document "${source.collection}/${source.id}" still references this document.`,
              retryable: false,
              details: { references: publishedReferences },
            });
          }
        }
        const sourceData = parsedData(
          sourceDefinition,
          source.data,
          source.schemaVersion,
        );
        const references = collectCmsRelationshipReferences(
          sourceDefinition,
          sourceData,
        ).filter(
          (reference) =>
            reference.targetCollection === input.collection &&
            reference.targetId === input.id &&
            targetsDeletedLocale(reference, source.locale),
        );
        if (!references.length) continue;
        if (references.some(({ onDelete }) => onDelete === "restrict")) {
          throw new CmsError({
            code: "CONFLICT",
            message: `Document "${input.collection}/${input.id}" is still referenced.`,
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
        source.data = parseCmsCollectionData(sourceDefinition, nullified.data);
        source.schemaVersion = sourceDefinition.schemaVersion;
        source.version += 1;
        source.updatedAt = this.#now().toISOString();
        source.updatedBy = input.actorId;
      }
      state.documents.splice(index, 1);
      state.revisions = state.revisions.filter(
        (revision) =>
          revision.collection !== input.collection ||
          revision.documentId !== input.id ||
          revision.locale !== locale,
      );
      return documentForRead(
        definition,
        documentFromStored(definition, document),
        input.actorId,
      );
    });
  }

  async #versionedMutation(
    input: CmsCollectionVersionInput,
    change: (document: StoredDocument) => void,
  ) {
    const definition = definitionFor(this.registry, input.collection);
    const locale = localeFor(definition, input.locale);
    return this.#mutate(async (state) => {
      const target = { collection: input.collection, id: input.id, locale };
      const document = findDocument(state, target) ?? documentNotFound(target);
      assertVersion(document, input.expectedVersion);
      change(document);
      document.version += 1;
      document.updatedAt = this.#now().toISOString();
      document.updatedBy = input.actorId;
      return documentForRead(
        definition,
        documentFromStored(definition, document),
        input.actorId,
      );
    });
  }
}

export function createPostgresCmsCollectionProvider(
  options: PostgresCmsCollectionProviderOptions,
) {
  return new PostgresCmsCollectionProvider(options);
}

export * from "./media";
