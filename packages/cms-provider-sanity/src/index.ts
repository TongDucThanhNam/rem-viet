import {
  CmsError,
  type CmsProviderCapabilities,
  type CmsVisualEditingCapabilities,
} from "@agency/cms-core";
import type {
  CmsGlobalContentProvider,
  CmsGlobalDocument,
  CmsGlobalRevision,
  CmsPageContent,
  CmsPageDocument,
  CmsPageProvider,
  CmsPageRevision,
  CreateDraftInput,
  DeleteDraftInput,
  PageLookup,
  PublishDraftInput,
  RestoreRevisionInput,
  SaveDraftInput,
  ScheduleDraftInput,
  UnpublishDraftInput,
  UnscheduleDraftInput,
} from "@agency/cms-runtime";

export const SANITY_PROVIDER_STATUS = "experimental" as const;
export const SANITY_RECOMMENDED_API_VERSION = "2026-07-01";

export type SanityPerspective = "drafts" | "published" | "raw";

export interface SanityClientPort {
  config(): { dataset?: string; projectId?: string };
  fetch<T>(
    query: string,
    params?: Record<string, unknown>,
    options?: {
      filterResponse?: boolean;
      perspective?: SanityPerspective;
      resultSourceMap?: "withKeyArraySelector";
      useCdn?: boolean;
    },
  ): Promise<T>;
  request<T>(input: {
    uri: string;
    method: "POST";
    body: unknown;
    query?: Record<string, string>;
  }): Promise<T>;
}

export type SanityPageRecord<TEncodedContent = unknown> = {
  _createdAt: string;
  _id: string;
  _rev: string;
  _type: string;
  _updatedAt: string;
  agencyId: string;
  content: TEncodedContent;
  schemaVersion: number;
  updatedBy: string;
  version: number;
};

export type SanityCmsProviderOptions<TContent extends CmsPageContent> = {
  client: SanityClientPort;
  parseContent: (value: unknown) => TContent;
  /** Code-owned GROQ expression used to project `content` on reads. */
  contentProjection?: string;
  createId?: () => string;
  documentType?: string;
  encodeContent?: (content: TContent) => unknown;
  now?: () => Date;
  publishedId?: (agencyId: string) => string;
  /** Advertise only when a signed, durable webhook receiver is deployed. */
  webhooks?: boolean;
};

export type SanityGlobalRecord<TEncodedContent = unknown> = {
  _createdAt: string;
  _id: string;
  _rev: string;
  _type: string;
  _updatedAt: string;
  content: TEncodedContent;
  globalKey: string;
  updatedBy: string;
  version: number;
};

export type SanityGlobalRevisionRecord<TEncodedContent = unknown> = {
  _createdAt: string;
  _id: string;
  _rev: string;
  _type: string;
  _updatedAt: string;
  createdBy: string;
  globalKey: string;
  note: string;
  snapshot: TEncodedContent;
  version: number;
};

export type SanityGlobalContentProviderOptions<TContent> = {
  client: SanityClientPort;
  parseContent: (value: unknown) => TContent;
  documentType?: string;
  encodeContent?: (content: TContent) => unknown;
  revisionDocumentType?: string;
};

export const sanityCmsCapabilities: CmsProviderCapabilities = Object.freeze({
  supported: [
    "content.readDraft",
    "content.write",
    "content.publish",
    "content.delete",
  ],
});

export const sanityGlobalContentCapabilities: CmsProviderCapabilities =
  Object.freeze({
    supported: ["content.readDraft", "content.write", "content.restore"],
  });

export function createSanityVisualEditingCapabilities(input?: {
  webhooks?: boolean;
}): CmsVisualEditingCapabilities {
  return Object.freeze({
    draftMode: true,
    livePreview: true,
    clickToEdit: true,
    sectionReorder: true,
    responsivePreview: true,
    webhooks: input?.webhooks === true,
    localization: false,
  });
}

export const sanityVisualEditingCapabilities =
  createSanityVisualEditingCapabilities();

export function createSanityPublishedClientOverlay() {
  return Object.freeze({
    apiVersion: SANITY_RECOMMENDED_API_VERSION,
    perspective: "published" as const,
    useCdn: true,
    stega: Object.freeze({ enabled: false }),
  });
}

export function createSanityPreviewClientOverlay(studioUrl: string) {
  const normalizedStudioUrl = normalizeHttpUrl(studioUrl, "studioUrl");
  return Object.freeze({
    apiVersion: SANITY_RECOMMENDED_API_VERSION,
    perspective: "drafts" as const,
    useCdn: false,
    stega: Object.freeze({ enabled: true, studioUrl: normalizedStudioUrl }),
  });
}

export function createSanityPresentationConfig(input: {
  previewUrl: string;
  allowOrigins: readonly string[];
  enablePath?: string;
  disablePath?: string;
}) {
  const initial = normalizeHttpUrl(input.previewUrl, "previewUrl");
  const allowOrigins = input.allowOrigins.map(
    (origin) => new URL(normalizeHttpUrl(origin, "allowOrigins")).origin,
  );
  if (new Set(allowOrigins).size !== allowOrigins.length) {
    validation("Sanity Presentation origins must be unique.");
  }
  return Object.freeze({
    allowOrigins: Object.freeze(allowOrigins),
    previewUrl: Object.freeze({
      initial,
      previewMode: Object.freeze({
        enable: normalizePath(input.enablePath ?? "/api/draft-mode/enable"),
        disable: normalizePath(input.disablePath ?? "/api/draft-mode/disable"),
      }),
    }),
  });
}

export function addSanityArrayKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const encoded = addSanityArrayKeys(entry);
      if (!isRecord(encoded)) return encoded;
      const key =
        typeof encoded._key === "string" && encoded._key
          ? encoded._key
          : typeof encoded.id === "string" && encoded.id
            ? encoded.id
            : `item-${index}`;
      return { ...encoded, _key: key };
    });
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      addSanityArrayKeys(entry),
    ]),
  );
}

export function stripSanityArrayKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSanityValue(entry, true));
  }
  return stripSanityValue(value, false);
}

function stripSanityValue(value: unknown, arrayEntry: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSanityValue(entry, true));
  }
  if (!isRecord(value)) return value;
  const normalized = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_key" && key !== "_type")
      .map(([key, entry]) => [key, stripSanityValue(entry, false)]),
  );
  if (
    arrayEntry &&
    typeof value._key === "string" &&
    value._key &&
    typeof normalized.id !== "string"
  ) {
    normalized.id = value._key;
  }
  return normalized;
}

export class SanityCmsGlobalContentProvider<
  TContent,
> implements CmsGlobalContentProvider<TContent> {
  readonly capabilities = sanityGlobalContentCapabilities;

  readonly #client: SanityClientPort;
  readonly #dataset: string;
  readonly #documentType: string;
  readonly #encodeContent: (content: TContent) => unknown;
  readonly #parseContent: (value: unknown) => TContent;
  readonly #revisionDocumentType: string;

  constructor(options: SanityGlobalContentProviderOptions<TContent>) {
    this.#client = options.client;
    this.#dataset = options.client.config().dataset?.trim() ?? "";
    if (!this.#dataset) validation("Sanity client dataset is required.");
    this.#documentType = options.documentType ?? "agencyGlobal";
    this.#revisionDocumentType =
      options.revisionDocumentType ?? "agencyGlobalRevision";
    for (const documentType of [
      this.#documentType,
      this.#revisionDocumentType,
    ]) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(documentType)) {
        validation("Sanity documentType must be a portable schema identifier.");
      }
    }
    if (this.#documentType === this.#revisionDocumentType) {
      validation("Sanity global document types must be distinct.");
    }
    this.#parseContent = options.parseContent;
    this.#encodeContent =
      options.encodeContent ?? ((content) => addSanityArrayKeys(content));
  }

  async get(input: { key: string }) {
    const key = normalizeGlobalKey(input.key);
    const record = await this.#fetchRaw<SanityGlobalRecord>(
      await sanityGlobalDocumentId(key),
    );
    return record ? this.#document(record) : null;
  }

  async save(input: {
    key: string;
    expectedVersion: number | null;
    content: TContent;
    actorId: string;
    note?: string;
  }) {
    const key = normalizeGlobalKey(input.key);
    const documentId = await sanityGlobalDocumentId(key);
    const current = await this.#fetchRaw<SanityGlobalRecord>(documentId);
    if (!current && input.expectedVersion !== null) {
      globalConflict(input.expectedVersion, 0);
    }
    if (current && input.expectedVersion !== current.version) {
      globalConflict(input.expectedVersion ?? 0, current.version);
    }

    const content = this.#parseContent(input.content);
    const encoded = this.#encodeContent(content);
    const version = (current?.version ?? 0) + 1;
    const revisionId = await sanityGlobalRevisionId(key, version);
    const currentMutation = current
      ? {
          patch: {
            id: current._id,
            ifRevisionID: current._rev,
            set: {
              content: encoded,
              globalKey: key,
              updatedBy: input.actorId,
              version,
            },
          },
        }
      : {
          create: {
            _id: documentId,
            _type: this.#documentType,
            content: encoded,
            globalKey: key,
            updatedBy: input.actorId,
            version,
          },
        };
    await this.#mutate([
      currentMutation,
      {
        create: {
          _id: revisionId,
          _type: this.#revisionDocumentType,
          createdBy: input.actorId,
          globalKey: key,
          note: input.note ?? "",
          snapshot: encoded,
          version,
        },
      },
    ]);
    const saved = await this.#fetchRaw<SanityGlobalRecord>(documentId);
    if (!saved) notFound(key);
    return this.#document(saved);
  }

  async listRevisions(keyInput: string) {
    const key = normalizeGlobalKey(keyInput);
    const records = await this.#client.fetch<SanityGlobalRevisionRecord[]>(
      `*[_type == $revisionType && globalKey == $key] | order(version desc)`,
      { key, revisionType: this.#revisionDocumentType },
      { perspective: "raw", useCdn: false },
    );
    return records.map((record) => this.#revision(record));
  }

  async restore(input: {
    key: string;
    revisionId: string;
    expectedVersion: number;
    actorId: string;
    note?: string;
  }) {
    const key = normalizeGlobalKey(input.key);
    const current = await this.get({ key });
    if (!current) notFound(key);
    if (current.version !== input.expectedVersion) {
      globalConflict(input.expectedVersion, current.version);
    }
    const revision = await this.#fetchRaw<SanityGlobalRevisionRecord>(
      input.revisionId,
    );
    if (
      !revision ||
      revision._type !== this.#revisionDocumentType ||
      revision.globalKey !== key
    ) {
      notFound(input.revisionId);
    }
    return this.save({
      key,
      expectedVersion: input.expectedVersion,
      content: this.#parseContent(stripSanityArrayKeys(revision.snapshot)),
      actorId: input.actorId,
      note: input.note ?? `Restore ${input.revisionId}`,
    });
  }

  #document(record: SanityGlobalRecord): CmsGlobalDocument<TContent> {
    return {
      key: record.globalKey,
      content: this.#parseContent(stripSanityArrayKeys(record.content)),
      version: record.version,
      createdAt: record._createdAt,
      updatedAt: record._updatedAt,
      updatedBy: record.updatedBy,
    };
  }

  #revision(record: SanityGlobalRevisionRecord): CmsGlobalRevision<TContent> {
    return {
      id: record._id,
      key: record.globalKey,
      version: record.version,
      content: this.#parseContent(stripSanityArrayKeys(record.snapshot)),
      note: record.note,
      createdAt: record._createdAt,
      createdBy: record.createdBy,
    };
  }

  #fetchRaw<T>(id: string) {
    return this.#client.fetch<T | null>(
      `*[_id == $id][0]`,
      { id },
      { perspective: "raw", useCdn: false },
    );
  }

  #mutate(mutations: readonly unknown[]) {
    return this.#request(
      `/data/mutate/${this.#dataset}`,
      { mutations },
      { returnDocuments: "true", visibility: "sync" },
    );
  }

  async #request(uri: string, body: unknown, query?: Record<string, string>) {
    try {
      return await this.#client.request({ body, method: "POST", query, uri });
    } catch (error) {
      const statusCode =
        isRecord(error) && typeof error.statusCode === "number"
          ? error.statusCode
          : null;
      if (statusCode === 409) {
        throw new CmsError({
          code: "CONFLICT",
          message: "Sanity rejected a stale global content revision.",
          retryable: true,
        });
      }
      throw error;
    }
  }
}

export function createSanityCmsGlobalContentProvider<TContent>(
  options: SanityGlobalContentProviderOptions<TContent>,
) {
  return new SanityCmsGlobalContentProvider(options);
}

export class SanityCmsPageProvider<
  TContent extends CmsPageContent,
> implements CmsPageProvider<TContent> {
  readonly capabilities = sanityCmsCapabilities;
  readonly visualEditingCapabilities: CmsVisualEditingCapabilities;
  readonly #client: SanityClientPort;
  readonly #createId: () => string;
  readonly #contentProjection: string;
  readonly #dataset: string;
  readonly #documentType: string;
  readonly #encodeContent: (content: TContent) => unknown;
  readonly #now: () => Date;
  readonly #parseContent: (value: unknown) => TContent;
  readonly #publishedId: (agencyId: string) => string;

  constructor(options: SanityCmsProviderOptions<TContent>) {
    this.visualEditingCapabilities = createSanityVisualEditingCapabilities({
      webhooks: options.webhooks,
    });
    this.#client = options.client;
    this.#dataset = options.client.config().dataset?.trim() ?? "";
    if (!this.#dataset) validation("Sanity client dataset is required.");
    this.#documentType = options.documentType ?? "agencyPage";
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(this.#documentType)) {
      validation("Sanity documentType must be a portable schema identifier.");
    }
    this.#parseContent = options.parseContent;
    this.#contentProjection = normalizeContentProjection(
      options.contentProjection,
    );
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#encodeContent =
      options.encodeContent ?? ((content) => addSanityArrayKeys(content));
    this.#now = options.now ?? (() => new Date());
    this.#publishedId = options.publishedId ?? defaultPublishedId;
  }

  async getDraft(lookup: PageLookup) {
    const record = await this.#fetchByLookup(lookup, "drafts");
    return record ? this.#document(record, "draft") : null;
  }

  async getPublished(lookup: PageLookup) {
    const record = await this.#fetchByLookup(lookup, "published");
    return record ? this.#document(record, "published") : null;
  }

  async createDraft(input: CreateDraftInput<TContent>) {
    const agencyId = input.id ?? this.#createId();
    const content = this.#parseContent(input.content);
    const publishedId = this.#publishedId(agencyId);
    const timestamp = this.#now().toISOString();
    await this.#actions([
      {
        actionType: "sanity.action.document.create",
        document: {
          _id: draftId(publishedId),
          _type: this.#documentType,
          agencyId,
          content: this.#encodeContent(content),
          schemaVersion: input.schemaVersion ?? 1,
          updatedBy: input.actorId,
          version: 1,
        },
        ifExists: "fail",
        publishedId,
      },
    ]);
    return this.#requireRawDraft(agencyId, timestamp);
  }

  async saveDraft(input: SaveDraftInput<TContent>) {
    const current = await this.#effective(input.id);
    assertVersion(current, input.expectedVersion);
    const content = this.#parseContent(input.content);
    const publishedId = this.#publishedId(input.id);
    const existingDraft = await this.#fetchRaw(draftId(publishedId));
    const set = {
      agencyId: input.id,
      content: this.#encodeContent(content),
      schemaVersion: current.schemaVersion,
      updatedBy: input.actorId,
      version: current.version + 1,
    };
    if (existingDraft) {
      await this.#mutate([
        {
          patch: {
            id: existingDraft._id,
            ifRevisionID: existingDraft._rev,
            set,
          },
        },
      ]);
    } else {
      await this.#actions([
        {
          actionType: "sanity.action.document.edit",
          draftId: draftId(publishedId),
          patch: { set },
          publishedId,
        },
      ]);
    }
    return this.#requireRawDraft(input.id);
  }

  async publish(input: PublishDraftInput) {
    const current = await this.#effective(input.id);
    assertVersion(current, input.expectedVersion);
    const publishedId = this.#publishedId(input.id);
    const sourceDraft = await this.#fetchRaw(draftId(publishedId));
    if (!sourceDraft) notFound(`draft:${input.id}`);
    const version = current.version + 1;
    await this.#actions([
      {
        actionType: "sanity.action.document.edit",
        draftId: sourceDraft._id,
        patch: { set: { updatedBy: input.actorId, version } },
        publishedId,
      },
      {
        actionType: "sanity.action.document.publish",
        draftId: sourceDraft._id,
        publishedId,
      },
    ]);
    const record = await this.#fetchRaw(publishedId);
    if (!record) notFound(`published:${input.id}`);
    const document = this.#document(record, "published");
    const revision: CmsPageRevision<TContent> = {
      id: record._rev,
      documentId: input.id,
      version,
      content: document.content,
      note: input.note ?? "",
      createdAt: record._updatedAt,
      createdBy: input.actorId,
    };
    return { document, revision };
  }

  async unpublish(input: UnpublishDraftInput) {
    const current = await this.#effective(input.id);
    assertVersion(current, input.expectedVersion);
    const publishedId = this.#publishedId(input.id);
    await this.#actions([
      {
        actionType: "sanity.action.document.edit",
        draftId: draftId(publishedId),
        patch: {
          set: { updatedBy: input.actorId, version: current.version + 1 },
        },
        publishedId,
      },
      {
        actionType: "sanity.action.document.unpublish",
        draftId: draftId(publishedId),
        publishedId,
      },
    ]);
    return this.#requireRawDraft(input.id);
  }

  async delete(input: DeleteDraftInput) {
    const current = await this.#effective(input.id);
    assertVersion(current, input.expectedVersion);
    const publishedId = this.#publishedId(input.id);
    await this.#actions([
      {
        actionType: "sanity.action.document.delete",
        includeVersions: [draftId(publishedId)],
        publishedId,
      },
    ]);
    return {
      ...current,
      version: current.version + 1,
      updatedBy: input.actorId,
    };
  }

  schedule(_input: ScheduleDraftInput): Promise<CmsPageDocument<TContent>> {
    return Promise.reject(unsupported("schedule", "Content Releases"));
  }

  unschedule(_input: UnscheduleDraftInput): Promise<CmsPageDocument<TContent>> {
    return Promise.reject(unsupported("unschedule", "Content Releases"));
  }

  listRevisions(_id: string): Promise<CmsPageRevision<TContent>[]> {
    return Promise.reject(unsupported("listRevisions", "History API"));
  }

  restore(_input: RestoreRevisionInput): Promise<CmsPageDocument<TContent>> {
    return Promise.reject(unsupported("restore", "History API"));
  }

  async #effective(id: string) {
    const document = await this.getDraft({ id });
    if (!document) notFound(id);
    return document;
  }

  async #fetchByLookup(lookup: PageLookup, perspective: SanityPerspective) {
    const byId = "id" in lookup;
    return this.#client.fetch<SanityPageRecord | null>(
      byId
        ? `*[_type == $documentType && agencyId == $value][0]{..., "content": ${this.#contentProjection}}`
        : `*[_type == $documentType && content.slug == $value][0]{..., "content": ${this.#contentProjection}}`,
      {
        documentType: this.#documentType,
        value: byId ? lookup.id : lookup.slug,
      },
      { perspective, useCdn: perspective === "published" },
    );
  }

  #fetchRaw(id: string) {
    return this.#client.fetch<SanityPageRecord | null>(
      `*[_id == $id][0]{..., "content": ${this.#contentProjection}}`,
      { id },
      { perspective: "raw", useCdn: false },
    );
  }

  async #requireRawDraft(agencyId: string, fallbackCreatedAt?: string) {
    const record = await this.#fetchRaw(draftId(this.#publishedId(agencyId)));
    if (!record) notFound(`draft:${agencyId}`);
    if (fallbackCreatedAt && !record._createdAt)
      record._createdAt = fallbackCreatedAt;
    return this.#document(record, "draft");
  }

  #document(
    record: SanityPageRecord,
    status: CmsPageDocument<TContent>["status"],
  ): CmsPageDocument<TContent> {
    return {
      id: record.agencyId,
      schemaVersion: record.schemaVersion,
      version: record.version,
      status,
      content: this.#parseContent(stripSanityArrayKeys(record.content)),
      publishedRevisionId: status === "published" ? record._rev : null,
      scheduledAt: null,
      createdAt: record._createdAt,
      updatedAt: record._updatedAt,
      updatedBy: record.updatedBy,
    };
  }

  #actions(actions: readonly unknown[]) {
    return this.#request(`/data/actions/${this.#dataset}`, { actions });
  }

  #mutate(mutations: readonly unknown[]) {
    return this.#request(
      `/data/mutate/${this.#dataset}`,
      { mutations },
      {
        returnDocuments: "true",
        visibility: "sync",
      },
    );
  }

  async #request(uri: string, body: unknown, query?: Record<string, string>) {
    try {
      return await this.#client.request({ body, method: "POST", query, uri });
    } catch (error) {
      const statusCode =
        isRecord(error) && typeof error.statusCode === "number"
          ? error.statusCode
          : null;
      if (statusCode === 409) {
        throw new CmsError({
          code: "CONFLICT",
          message: "Sanity rejected a stale document revision.",
          retryable: true,
        });
      }
      throw error;
    }
  }
}

function normalizeContentProjection(value: string | undefined) {
  const projection = value?.trim() || "content";
  if (
    !projection.startsWith("content") ||
    projection.includes(";") ||
    projection.includes("\0")
  ) {
    validation(
      "Sanity contentProjection must be a code-owned GROQ content expression.",
    );
  }
  return projection;
}

export function createSanityCmsPageProvider<TContent extends CmsPageContent>(
  options: SanityCmsProviderOptions<TContent>,
) {
  return new SanityCmsPageProvider(options);
}

function defaultPublishedId(agencyId: string) {
  const value = `agency-page-${agencyId}`;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    validation("CMS id cannot be converted to a safe Sanity document id.");
  }
  return value;
}

function draftId(publishedId: string) {
  return `drafts.${publishedId}`;
}

function assertVersion(document: CmsPageDocument, expectedVersion: number) {
  if (document.version !== expectedVersion) {
    throw new CmsError({
      code: "CONFLICT",
      message: `Expected CMS version ${expectedVersion}, received ${document.version}.`,
      retryable: true,
    });
  }
}

function normalizeGlobalKey(value: string) {
  const key = value.trim();
  if (!key || key.length > 160) {
    validation("CMS global content keys must contain 1 to 160 characters.");
  }
  return key;
}

async function sanityGlobalKeyDigest(key: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sanityGlobalDocumentId(key: string) {
  return `agency-global-${await sanityGlobalKeyDigest(key)}`;
}

async function sanityGlobalRevisionId(key: string, version: number) {
  return `agency-global-revision-${await sanityGlobalKeyDigest(key)}-${version}`;
}

function globalConflict(expectedVersion: number, actualVersion: number): never {
  throw new CmsError({
    code: "CONFLICT",
    message: `Expected CMS version ${expectedVersion}, received ${actualVersion}.`,
    retryable: true,
  });
}

function notFound(id: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `Sanity CMS document ${id} was not found.`,
    retryable: false,
  });
}

function unsupported(operation: string, nativeBoundary: string) {
  return new CmsError({
    code: "CAPABILITY_UNAVAILABLE",
    message: `Sanity ${operation} remains disabled until ${nativeBoundary} conformance is proven.`,
    retryable: false,
  });
}

function validation(message: string): never {
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
  });
}

function normalizeHttpUrl(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    validation(`${name} must be an absolute HTTP(S) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    validation(`${name} must use HTTP(S).`);
  }
  return url.toString().replace(/\/$/, "");
}

function normalizePath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    validation("Sanity draft-mode endpoints must be same-origin paths.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
