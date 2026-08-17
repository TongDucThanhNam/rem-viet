import {
  CmsError,
  decideCmsEditorialReviewInputSchema,
  requestCmsEditorialReviewInputSchema,
  type CmsBlock,
  type CmsEditorialReviewTarget,
  type CmsProviderCapabilities,
  type DecideCmsEditorialReviewInput,
  type RequestCmsEditorialReviewInput,
} from "@agency/cms-core";
import type {
  CmsEditorialReviewDocument,
  CmsEditorialReviewEvent,
  CmsEditorialReviewState,
  CmsEditorialReviewWorkflow,
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
  UnscheduleDraftInput,
  UnpublishDraftInput,
} from "@agency/cms-runtime";
import { deriveCmsEditorialReviewState } from "@agency/cms-runtime";

export type D1Value = string | number | null | ArrayBuffer;

export type D1RunResult = {
  success: boolean;
  meta?: { changes?: number };
};

export interface CloudflareD1PreparedStatement {
  bind(...values: D1Value[]): CloudflareD1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResult>;
}

export interface CloudflareD1Database {
  prepare(query: string): CloudflareD1PreparedStatement;
  batch(statements: CloudflareD1PreparedStatement[]): Promise<D1RunResult[]>;
  exec(query: string): Promise<unknown>;
}

export const CLOUDFLARE_CMS_SCHEMA_VERSION = 1;

export const cloudflareCmsMigrations = [
  {
    id: "0001_pages_and_revisions",
    sql: `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'standard',
  blocks TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  og_image TEXT NOT NULL DEFAULT '',
  robots_index INTEGER NOT NULL DEFAULT 1,
  robots_follow INTEGER NOT NULL DEFAULT 1,
  published_revision_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  published_at INTEGER,
  scheduled_at INTEGER,
  scheduled_by TEXT NOT NULL DEFAULT '',
  schedule_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_idx ON pages(slug);
CREATE INDEX IF NOT EXISTS pages_status_idx ON pages(status);
CREATE TABLE IF NOT EXISTS page_revisions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS page_revisions_page_id_idx ON page_revisions(page_id);
CREATE UNIQUE INDEX IF NOT EXISTS page_revisions_page_version_unique
  ON page_revisions(page_id, version);
CREATE TABLE IF NOT EXISTS cms_provider_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);`,
  },
  {
    id: "0002_page_scheduling",
    sql: "",
  },
  {
    id: "0003_media_metadata",
    sql: `
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT '',
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS media_key_idx ON media(key);
CREATE INDEX IF NOT EXISTS media_mime_type_idx ON media(mime_type);`,
  },
  {
    id: "0004_global_content",
    sql: `
CREATE TABLE IF NOT EXISTS cms_globals (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cms_global_revisions (
  id TEXT PRIMARY KEY,
  global_key TEXT NOT NULL REFERENCES cms_globals(key) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_global_revisions_key_idx
  ON cms_global_revisions(global_key);
CREATE UNIQUE INDEX IF NOT EXISTS cms_global_revisions_key_version_unique
  ON cms_global_revisions(global_key, version);`,
  },
  {
    id: "0005_editorial_reviews",
    sql: `
CREATE TABLE IF NOT EXISTS cms_review_events (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN ('requested', 'changes_requested', 'approved', 'published')
  ),
  version INTEGER NOT NULL CHECK (version >= 0),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  actor_id TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_review_events_document_idx
  ON cms_review_events(document_type, document_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cms_review_events_action_unique
  ON cms_review_events(document_type, document_id, version, action);`,
  },
] as const;

async function ensureColumn(
  database: CloudflareD1Database,
  table: string,
  column: string,
  definition: string,
) {
  const { results } = await database
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  if (results.some(({ name }) => name === column)) return;
  await database
    .prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    .run();
}

export async function applyCloudflareCmsMigrations(
  database: CloudflareD1Database,
) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS cms_provider_migrations (
        id TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )`,
    )
    .run();

  for (const migration of cloudflareCmsMigrations) {
    const applied = await database
      .prepare("SELECT id FROM cms_provider_migrations WHERE id = ? LIMIT 1")
      .bind(migration.id)
      .first<{ id: string }>();
    if (applied) continue;

    for (const statement of migration.sql
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)) {
      await database.prepare(statement).run();
    }
    if (migration.id === "0002_page_scheduling") {
      await ensureColumn(database, "pages", "published_at", "INTEGER");
      await ensureColumn(database, "pages", "scheduled_at", "INTEGER");
      await ensureColumn(
        database,
        "pages",
        "scheduled_by",
        "TEXT NOT NULL DEFAULT ''",
      );
      await ensureColumn(
        database,
        "pages",
        "schedule_note",
        "TEXT NOT NULL DEFAULT ''",
      );
    }
    await database
      .prepare(
        "INSERT OR IGNORE INTO cms_provider_migrations (id, applied_at) VALUES (?, ?)",
      )
      .bind(migration.id, Date.now())
      .run();
  }

  return { applied: cloudflareCmsMigrations.map(({ id }) => id) };
}

type PageRow = {
  id: string;
  slug: string;
  title: string;
  template: "landing" | "standard";
  blocks: string | unknown[];
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: number | boolean;
  robotsFollow: number | boolean;
  publishedRevisionId: string | null;
  publishedAt: number | null;
  scheduledAt: number | null;
  scheduledBy: string;
  scheduleNote: string;
  version: number;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
};

type RevisionRow = {
  id: string;
  documentId: string;
  version: number;
  snapshot: string | unknown;
  note: string;
  createdBy: string;
  createdAt: number;
};

const pageColumns = `
  id, slug, title, template, blocks, status,
  seo_title AS seoTitle,
  seo_description AS seoDescription,
  canonical_url AS canonicalUrl,
  og_image AS ogImage,
  robots_index AS robotsIndex,
  robots_follow AS robotsFollow,
  published_revision_id AS publishedRevisionId,
  published_at AS publishedAt,
  scheduled_at AS scheduledAt,
  scheduled_by AS scheduledBy,
  schedule_note AS scheduleNote,
  version, updated_by AS updatedBy,
  created_at AS createdAt, updated_at AS updatedAt`;

function decodeJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Cloudflare CMS row contains invalid JSON.",
      retryable: false,
    });
  }
}

function conflict(expected: number, actual: number): never {
  throw new CmsError({
    code: "CONFLICT",
    message: `Content changed since it was loaded (expected version ${expected}, found ${actual}).`,
    retryable: false,
    details: { expectedVersion: expected, actualVersion: actual },
  });
}

function normalizeFutureSchedule(value: string, now: Date) {
  const scheduledAt = new Date(value);
  if (
    Number.isNaN(scheduledAt.getTime()) ||
    scheduledAt.getTime() <= now.getTime()
  ) {
    throw new CmsError({
      code: "VALIDATION_FAILED",
      message: "Scheduled publication must be a valid future date.",
      retryable: false,
      details: { scheduledAt: value },
    });
  }
  return scheduledAt.toISOString();
}

function notFound(id: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `Page ${id} was not found.`,
    retryable: false,
    details: { id },
  });
}

function contentFromRow<TContent extends CmsPageContent>(
  row: PageRow,
  parseContent: (value: unknown) => TContent,
) {
  return parseContent({
    title: row.title,
    slug: row.slug,
    template: row.template,
    blocks: decodeJson(row.blocks),
    seo: {
      title: row.seoTitle,
      description: row.seoDescription,
      canonicalUrl: row.canonicalUrl,
      ogImage: row.ogImage,
      robotsIndex: Boolean(row.robotsIndex),
      robotsFollow: Boolean(row.robotsFollow),
    },
  });
}

function documentFromRow<TContent extends CmsPageContent>(
  row: PageRow,
  parseContent: (value: unknown) => TContent,
): CmsPageDocument<TContent> {
  return {
    id: row.id,
    schemaVersion: CLOUDFLARE_CMS_SCHEMA_VERSION,
    version: Number(row.version),
    status: row.status,
    content: contentFromRow(row, parseContent),
    publishedRevisionId: row.publishedRevisionId,
    scheduledAt:
      row.scheduledAt === null
        ? null
        : new Date(Number(row.scheduledAt)).toISOString(),
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
    updatedBy: row.updatedBy,
  };
}

function revisionFromRow<TContent extends CmsPageContent>(
  row: RevisionRow,
  parseContent: (value: unknown) => TContent,
): CmsPageRevision<TContent> {
  return {
    id: row.id,
    documentId: row.documentId,
    version: Number(row.version),
    content: parseContent(decodeJson(row.snapshot)),
    note: row.note,
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    createdBy: row.createdBy,
  };
}

function valuesForContent<TContent extends CmsPageContent>(
  content: TContent,
  encodeBlocks: (content: TContent) => unknown,
) {
  return [
    content.slug,
    content.title,
    content.template,
    JSON.stringify(encodeBlocks(content)),
    content.seo.title,
    content.seo.description,
    content.seo.canonicalUrl,
    content.seo.ogImage,
    content.seo.robotsIndex ? 1 : 0,
    content.seo.robotsFollow ? 1 : 0,
  ] satisfies D1Value[];
}

type ReviewDocumentRow = {
  documentId: string;
  publishedRevisionId: string | null;
  status: "draft" | "published";
  version: number;
};

type ReviewEventRow = {
  action: "approved" | "changes_requested" | "published" | "requested";
  actorId: string;
  documentId: string;
  documentType: string;
  note: string;
  occurredAt: number;
  version: number;
};

function reviewEventFromRow(row: ReviewEventRow): CmsEditorialReviewEvent {
  return {
    action: row.action,
    actorId: row.actorId,
    documentId: row.documentId,
    documentType: row.documentType,
    note: row.note,
    occurredAt: new Date(Number(row.occurredAt)).toISOString(),
    version: Number(row.version),
  };
}

function reviewValidation(message: string): never {
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
  });
}

function reviewConflict(message: string): never {
  throw new CmsError({ code: "CONFLICT", message, retryable: false });
}

/** D1-backed, immutable editorial review workflow for the page provider. */
export class CloudflareCmsEditorialReviewProvider implements CmsEditorialReviewWorkflow {
  readonly #database: CloudflareD1Database;
  readonly #createId: () => string;
  readonly #now: () => Date;

  constructor(options: {
    database: CloudflareD1Database;
    createId?: () => string;
    now?: () => Date;
  }) {
    this.#database = options.database;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
  }

  async #document(
    target: CmsEditorialReviewTarget,
  ): Promise<CmsEditorialReviewDocument> {
    if (target.documentType !== "page") {
      throw new CmsError({
        code: "CAPABILITY_UNAVAILABLE",
        message: `Cloudflare page reviews do not support ${target.documentType}.`,
        retryable: false,
      });
    }
    const row = await this.#database
      .prepare(
        `SELECT id AS documentId, version, status,
          published_revision_id AS publishedRevisionId
         FROM pages WHERE id = ? LIMIT 1`,
      )
      .bind(target.documentId)
      .first<ReviewDocumentRow>();
    if (!row) notFound(target.documentId);
    return {
      documentId: row.documentId,
      documentType: target.documentType,
      publishedRevisionId: row.publishedRevisionId,
      status: row.status,
      version: Number(row.version),
    };
  }

  async #events(
    target: CmsEditorialReviewTarget,
  ): Promise<CmsEditorialReviewEvent[]> {
    const { results } = await this.#database
      .prepare(
        `SELECT document_type AS documentType, document_id AS documentId,
          action, version, note, actor_id AS actorId, occurred_at AS occurredAt
         FROM cms_review_events
         WHERE document_type = ? AND document_id = ?
         ORDER BY occurred_at DESC, rowid DESC`,
      )
      .bind(target.documentType, target.documentId)
      .all<ReviewEventRow>();
    return results.map(reviewEventFromRow);
  }

  async getState(
    target: CmsEditorialReviewTarget,
  ): Promise<CmsEditorialReviewState> {
    return deriveCmsEditorialReviewState(
      await this.#document(target),
      await this.#events(target),
    );
  }

  async requestReview(
    input: RequestCmsEditorialReviewInput,
  ): Promise<CmsEditorialReviewState> {
    const parsed = requestCmsEditorialReviewInputSchema.safeParse(input);
    if (!parsed.success) reviewValidation("Invalid editorial review request.");
    const value = parsed.data;
    const document = await this.#document(value);
    if (document.version !== value.expectedVersion) {
      conflict(value.expectedVersion, document.version);
    }
    const current = await this.getState(value);
    if (
      current.status === "requested" &&
      current.reviewVersion === document.version
    ) {
      return current;
    }
    if (current.reviewVersion === document.version) {
      reviewConflict(
        current.status === "approved"
          ? "This version is already approved."
          : "Save a new version before requesting review again.",
      );
    }

    let result: D1RunResult;
    try {
      result = await this.#database
        .prepare(
          `INSERT INTO cms_review_events
            (id, document_type, document_id, action, version, note, actor_id, occurred_at)
           SELECT ?, 'page', id, 'requested', version, ?, ?, ? FROM pages
           WHERE id = ? AND version = ?
             AND NOT EXISTS (
               SELECT 1 FROM cms_review_events
               WHERE document_type = 'page' AND document_id = pages.id
                 AND version = pages.version
                 AND action IN ('requested', 'changes_requested', 'approved')
             )`,
        )
        .bind(
          this.#createId(),
          value.note,
          value.actorId,
          this.#now().getTime(),
          value.documentId,
          value.expectedVersion,
        )
        .run();
    } catch (error) {
      const latest = await this.getState(value);
      if (
        latest.status === "requested" &&
        latest.reviewVersion === value.expectedVersion
      ) {
        return latest;
      }
      throw error;
    }
    if ((result.meta?.changes ?? 0) !== 1) {
      const latestDocument = await this.#document(value);
      if (latestDocument.version !== value.expectedVersion) {
        conflict(value.expectedVersion, latestDocument.version);
      }
      const latest = await this.getState(value);
      if (
        latest.status === "requested" &&
        latest.reviewVersion === value.expectedVersion
      ) {
        return latest;
      }
      reviewConflict("This version can no longer be sent for review.");
    }
    return this.getState(value);
  }

  async decideReview(
    input: DecideCmsEditorialReviewInput,
  ): Promise<CmsEditorialReviewState> {
    const parsed = decideCmsEditorialReviewInputSchema.safeParse(input);
    if (!parsed.success) reviewValidation("Invalid editorial review decision.");
    const value = parsed.data;
    const document = await this.#document(value);
    if (document.version !== value.expectedVersion) {
      conflict(value.expectedVersion, document.version);
    }
    const current = await this.getState(value);
    if (
      current.status !== "requested" ||
      current.reviewVersion !== document.version ||
      current.stale
    ) {
      reviewConflict("Only the current requested version can be reviewed.");
    }

    const result = await this.#database
      .prepare(
        `INSERT INTO cms_review_events
          (id, document_type, document_id, action, version, note, actor_id, occurred_at)
         SELECT ?, 'page', id, ?, version, ?, ?, ? FROM pages
         WHERE id = ? AND version = ?
           AND (
             SELECT action FROM cms_review_events
             WHERE document_type = 'page' AND document_id = pages.id
               AND action IN ('requested', 'changes_requested', 'approved')
             ORDER BY occurred_at DESC, rowid DESC LIMIT 1
           ) = 'requested'
           AND (
             SELECT version FROM cms_review_events
             WHERE document_type = 'page' AND document_id = pages.id
               AND action IN ('requested', 'changes_requested', 'approved')
             ORDER BY occurred_at DESC, rowid DESC LIMIT 1
           ) = pages.version`,
      )
      .bind(
        this.#createId(),
        value.decision,
        value.note,
        value.actorId,
        this.#now().getTime(),
        value.documentId,
        value.expectedVersion,
      )
      .run();
    if ((result.meta?.changes ?? 0) !== 1) {
      const latestDocument = await this.#document(value);
      if (latestDocument.version !== value.expectedVersion) {
        conflict(value.expectedVersion, latestDocument.version);
      }
      reviewConflict("Only the current requested version can be reviewed.");
    }
    return this.getState(value);
  }

  async listPending(input: { limit?: number } = {}) {
    const requestedLimit = Number.isInteger(input.limit) ? input.limit! : 50;
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const { results } = await this.#database
      .prepare(
        `WITH ranked_reviews AS (
          SELECT document_type AS documentType, document_id AS documentId,
            action, version, note, actor_id AS actorId, occurred_at AS occurredAt,
            row_number() OVER (
              PARTITION BY document_type, document_id
              ORDER BY occurred_at DESC, rowid DESC
            ) AS reviewRank
          FROM cms_review_events
          WHERE action IN ('requested', 'changes_requested', 'approved')
        )
        SELECT documentType, documentId, action, version, note, actorId, occurredAt
        FROM ranked_reviews
        WHERE reviewRank = 1 AND action = 'requested'
        ORDER BY occurredAt DESC`,
      )
      .all<ReviewEventRow>();
    const states = await Promise.all(
      results.map(async (row) => {
        try {
          return await this.getState({
            documentId: row.documentId,
            documentType: row.documentType,
          });
        } catch (error) {
          if (error instanceof CmsError && error.code === "NOT_FOUND") {
            return null;
          }
          throw error;
        }
      }),
    );
    return states
      .filter(
        (state): state is CmsEditorialReviewState =>
          state !== null && state.status === "requested" && !state.stale,
      )
      .slice(0, limit);
  }

  preparePublicationStatement(input: {
    actorId: string;
    documentId: string;
    occurredAt: Date;
    reviewVersion: number;
  }) {
    return this.#database
      .prepare(
        `INSERT OR IGNORE INTO cms_review_events
          (id, document_type, document_id, action, version, note, actor_id, occurred_at)
         VALUES (?, 'page', ?, 'published', ?, '', ?, ?)`,
      )
      .bind(
        this.#createId(),
        input.documentId,
        input.reviewVersion,
        input.actorId,
        input.occurredAt.getTime(),
      );
  }
}

export function createCloudflareCmsEditorialReviewProvider(options: {
  database: CloudflareD1Database;
  createId?: () => string;
  now?: () => Date;
}) {
  return new CloudflareCmsEditorialReviewProvider(options);
}

export type CloudflareCmsMutationEvent<
  TContent extends CmsPageContent = CmsPageContent,
> = {
  action:
    | "create"
    | "save"
    | "publish"
    | "unpublish"
    | "restore"
    | "schedule"
    | "unschedule"
    | "delete";
  actorId: string;
  after: TContent | null;
  before: TContent | null;
  documentId: string;
  previousPublishedRevisionId?: string | null;
  previousScheduledAt?: string | null;
  revisionId?: string;
  scheduledAt?: string | null;
  timestamp: Date;
  version: number;
};

export type CloudflareCmsProviderOptions<TContent extends CmsPageContent> = {
  database: CloudflareD1Database;
  parseContent: (value: unknown) => TContent;
  createId?: () => string;
  encodeBlocks?: (content: TContent) => unknown;
  encodeRevision?: (content: TContent) => unknown;
  now?: () => Date;
  prepareMutationStatements?: (
    event: CloudflareCmsMutationEvent<TContent>,
  ) =>
    | CloudflareD1PreparedStatement
    | readonly CloudflareD1PreparedStatement[]
    | null;
};

export class CloudflareCmsPageProvider<
  TContent extends CmsPageContent<CmsBlock>,
> implements CmsPageProvider<TContent> {
  readonly capabilities: CmsProviderCapabilities = {
    supported: [
      "content.readDraft",
      "content.write",
      "content.review.request",
      "content.review.decide",
      "content.publish",
      "content.schedule",
      "content.restore",
      "content.delete",
    ],
  };
  readonly reviews: CloudflareCmsEditorialReviewProvider;

  readonly #database: CloudflareD1Database;
  readonly #parseContent: (value: unknown) => TContent;
  readonly #createId: () => string;
  readonly #encodeBlocks: (content: TContent) => unknown;
  readonly #encodeRevision: (content: TContent) => unknown;
  readonly #now: () => Date;
  readonly #prepareMutationStatements?: (
    event: CloudflareCmsMutationEvent<TContent>,
  ) =>
    | CloudflareD1PreparedStatement
    | readonly CloudflareD1PreparedStatement[]
    | null;

  constructor(options: CloudflareCmsProviderOptions<TContent>) {
    this.#database = options.database;
    this.#parseContent = options.parseContent;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#encodeBlocks = options.encodeBlocks ?? ((content) => content.blocks);
    this.#encodeRevision = options.encodeRevision ?? ((content) => content);
    this.#now = options.now ?? (() => new Date());
    this.#prepareMutationStatements = options.prepareMutationStatements;
    this.reviews = createCloudflareCmsEditorialReviewProvider({
      database: this.#database,
      createId: this.#createId,
      now: this.#now,
    });
  }

  #mutationStatements(event: CloudflareCmsMutationEvent<TContent>) {
    const prepared = this.#prepareMutationStatements?.(event);
    if (!prepared) return [];
    return Array.isArray(prepared) ? [...prepared] : [prepared];
  }

  async #batch(statements: CloudflareD1PreparedStatement[]) {
    try {
      return await this.#database.batch(statements);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /unique constraint|constraint failed.*pages\.(id|slug)/i.test(message)
      ) {
        throw new CmsError({
          code: "CONFLICT",
          message: "A CMS page with that identifier or slug already exists.",
          retryable: false,
        });
      }
      throw error;
    }
  }

  async getDraft(lookup: PageLookup) {
    const predicate = lookup.id ? "id = ?" : "slug = ?";
    const value = lookup.id ?? lookup.slug;
    const row = await this.#database
      .prepare(`SELECT ${pageColumns} FROM pages WHERE ${predicate} LIMIT 1`)
      .bind(value)
      .first<PageRow>();

    return row ? documentFromRow(row, this.#parseContent) : null;
  }

  async getPublished(lookup: PageLookup) {
    const predicate = lookup.id
      ? "p.id = ?"
      : "json_extract(r.snapshot, '$.slug') = ?";
    const value = lookup.id ?? lookup.slug;
    const row = await this.#database
      .prepare(
        `SELECT p.id AS documentId, r.id, r.version, r.snapshot,
          r.note, r.created_by AS createdBy, r.created_at AS createdAt
         FROM pages p
         INNER JOIN page_revisions r ON r.id = p.published_revision_id
         WHERE p.status = 'published' AND ${predicate}
         LIMIT 1`,
      )
      .bind(value)
      .first<RevisionRow>();

    if (!row) return null;
    const revision = revisionFromRow(row, this.#parseContent);
    return {
      id: revision.documentId,
      schemaVersion: CLOUDFLARE_CMS_SCHEMA_VERSION,
      version: revision.version,
      status: "published" as const,
      content: revision.content,
      publishedRevisionId: revision.id,
      scheduledAt: null,
      createdAt: revision.createdAt,
      updatedAt: revision.createdAt,
      updatedBy: revision.createdBy,
    };
  }

  async createDraft(input: CreateDraftInput<TContent>) {
    const content = this.#parseContent(input.content);
    const id = input.id ?? this.#createId();
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const insert = this.#database
      .prepare(
        `INSERT INTO pages (
          id, slug, title, template, blocks, status,
          seo_title, seo_description, canonical_url, og_image,
          robots_index, robots_follow, published_revision_id,
          version, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?)`,
      )
      .bind(
        id,
        ...valuesForContent(content, this.#encodeBlocks),
        input.actorId,
        now,
        now,
      );
    const mutations = this.#mutationStatements({
      action: "create",
      actorId: input.actorId,
      after: content,
      before: null,
      documentId: id,
      previousPublishedRevisionId: null,
      previousScheduledAt: null,
      timestamp,
      version: 1,
    });
    const [result] = await this.#batch([insert, ...mutations]);

    if (!result?.success) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "Could not create the Cloudflare CMS page draft.",
        retryable: false,
      });
    }
    return (await this.getDraft({ id }))!;
  }

  async saveDraft(input: SaveDraftInput<TContent>) {
    const current = await this.getDraft({ id: input.id });
    if (!current) notFound(input.id);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }

    const content = this.#parseContent(input.content);
    const nextVersion = current.version + 1;
    const timestamp = this.#now();
    const update = this.#database
      .prepare(
        `UPDATE pages SET
          slug = ?, title = ?, template = ?, blocks = ?,
          seo_title = ?, seo_description = ?, canonical_url = ?, og_image = ?,
          robots_index = ?, robots_follow = ?, version = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND version = ?`,
      )
      .bind(
        ...valuesForContent(content, this.#encodeBlocks),
        nextVersion,
        input.actorId,
        timestamp.getTime(),
        input.id,
        input.expectedVersion,
      );
    const mutations = this.#mutationStatements({
      action: "save",
      actorId: input.actorId,
      after: content,
      before: current.content,
      documentId: input.id,
      previousPublishedRevisionId: current.publishedRevisionId,
      previousScheduledAt: current.scheduledAt,
      timestamp,
      version: nextVersion,
    });
    const [result] = await this.#batch([update, ...mutations]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.getDraft({ id: input.id });
      if (!latest) notFound(input.id);
      conflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft({ id: input.id }))!;
  }

  async schedule(input: ScheduleDraftInput) {
    const timestamp = this.#now();
    const scheduledAt = normalizeFutureSchedule(input.scheduledAt, timestamp);
    return this.#setSchedule(input, scheduledAt, timestamp);
  }

  async unschedule(input: UnscheduleDraftInput) {
    return this.#setSchedule(input, null, this.#now());
  }

  async #setSchedule(
    input: ScheduleDraftInput | UnscheduleDraftInput,
    scheduledAt: string | null,
    timestamp: Date,
  ) {
    const current = await this.getDraft({ id: input.id });
    if (!current) notFound(input.id);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }

    const nextVersion = current.version + 1;
    const note = "note" in input ? (input.note ?? "") : "";
    const update = this.#database
      .prepare(
        `UPDATE pages SET scheduled_at = ?, scheduled_by = ?, schedule_note = ?,
          version = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND version = ?`,
      )
      .bind(
        scheduledAt === null ? null : new Date(scheduledAt).getTime(),
        scheduledAt === null ? "" : input.actorId,
        scheduledAt === null ? "" : note,
        nextVersion,
        input.actorId,
        timestamp.getTime(),
        input.id,
        input.expectedVersion,
      );
    const mutations = this.#mutationStatements({
      action: scheduledAt === null ? "unschedule" : "schedule",
      actorId: input.actorId,
      after: current.content,
      before: current.content,
      documentId: input.id,
      previousPublishedRevisionId: current.publishedRevisionId,
      previousScheduledAt: current.scheduledAt,
      scheduledAt,
      timestamp,
      version: nextVersion,
    });
    const [result] = await this.#batch([update, ...mutations]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.getDraft({ id: input.id });
      if (!latest) notFound(input.id);
      conflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft({ id: input.id }))!;
  }

  async publish(input: PublishDraftInput) {
    const current = await this.getDraft({ id: input.id });
    if (!current) notFound(input.id);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }

    const revisionId = this.#createId();
    const nextVersion = current.version + 1;
    const now = this.#now().getTime();
    const statements = [
      this.#database
        .prepare(
          `INSERT INTO page_revisions
            (id, page_id, version, snapshot, note, created_by, created_at)
           SELECT ?, id, ?, ?, ?, ?, ? FROM pages
           WHERE id = ? AND version = ?`,
        )
        .bind(
          revisionId,
          nextVersion,
          JSON.stringify(this.#encodeRevision(current.content)),
          input.note ?? "",
          input.actorId,
          now,
          input.id,
          input.expectedVersion,
        ),
      this.#database
        .prepare(
          `UPDATE pages SET status = 'published', published_revision_id = ?,
            published_at = ?, scheduled_at = NULL, scheduled_by = '', schedule_note = '',
            version = ?, updated_by = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .bind(
          revisionId,
          now,
          nextVersion,
          input.actorId,
          now,
          input.id,
          input.expectedVersion,
        ),
    ];
    const mutations = this.#mutationStatements({
      action: "publish",
      actorId: input.actorId,
      after: current.content,
      before: current.content,
      documentId: input.id,
      previousPublishedRevisionId: current.publishedRevisionId,
      previousScheduledAt: current.scheduledAt,
      revisionId,
      timestamp: new Date(now),
      version: nextVersion,
    });
    statements.push(
      this.reviews.preparePublicationStatement({
        actorId: input.actorId,
        documentId: input.id,
        occurredAt: new Date(now),
        reviewVersion: current.version,
      }),
      ...mutations,
    );
    const results = await this.#batch(statements);
    if (
      (results[0]?.meta?.changes ?? 0) !== 1 ||
      (results[1]?.meta?.changes ?? 0) !== 1
    ) {
      const latest = await this.getDraft({ id: input.id });
      if (!latest) notFound(input.id);
      conflict(input.expectedVersion, latest.version);
    }

    const document = (await this.getDraft({ id: input.id }))!;
    const revisions = await this.listRevisions(input.id);
    const revision = revisions.find(({ id }) => id === revisionId);
    if (!revision) {
      throw new CmsError({
        code: "NOT_FOUND",
        message: "Published revision could not be reloaded.",
        retryable: true,
      });
    }
    return { document, revision };
  }

  async unpublish(input: UnpublishDraftInput) {
    const current = await this.getDraft({ id: input.id });
    if (!current) notFound(input.id);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }

    const nextVersion = current.version + 1;
    const timestamp = this.#now();
    const update = this.#database
      .prepare(
        `UPDATE pages SET status = 'draft', published_revision_id = NULL,
          published_at = NULL, version = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND version = ?`,
      )
      .bind(
        nextVersion,
        input.actorId,
        timestamp.getTime(),
        input.id,
        input.expectedVersion,
      );
    const mutations = this.#mutationStatements({
      action: "unpublish",
      actorId: input.actorId,
      after: current.content,
      before: current.content,
      documentId: input.id,
      previousPublishedRevisionId: current.publishedRevisionId,
      previousScheduledAt: current.scheduledAt,
      timestamp,
      version: nextVersion,
    });
    const [result] = await this.#batch([update, ...mutations]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.getDraft({ id: input.id });
      if (!latest) notFound(input.id);
      conflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft({ id: input.id }))!;
  }

  async listRevisions(id: string) {
    const { results } = await this.#database
      .prepare(
        `SELECT id, page_id AS documentId, version, snapshot, note,
          created_by AS createdBy, created_at AS createdAt
         FROM page_revisions WHERE page_id = ? ORDER BY version DESC`,
      )
      .bind(id)
      .all<RevisionRow>();
    return results.map((row) => revisionFromRow(row, this.#parseContent));
  }

  async restore(input: RestoreRevisionInput) {
    const current = await this.getDraft({ id: input.id });
    if (!current) notFound(input.id);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }
    const row = await this.#database
      .prepare(
        `SELECT id, page_id AS documentId, version, snapshot, note,
          created_by AS createdBy, created_at AS createdAt
         FROM page_revisions WHERE id = ? AND page_id = ? LIMIT 1`,
      )
      .bind(input.revisionId, input.id)
      .first<RevisionRow>();
    if (!row) notFound(input.revisionId);

    const content = revisionFromRow(row, this.#parseContent).content;
    const nextVersion = current.version + 1;
    const timestamp = this.#now();
    const update = this.#database
      .prepare(
        `UPDATE pages SET
          slug = ?, title = ?, template = ?, blocks = ?,
          seo_title = ?, seo_description = ?, canonical_url = ?, og_image = ?,
          robots_index = ?, robots_follow = ?, version = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND version = ?`,
      )
      .bind(
        ...valuesForContent(content, this.#encodeBlocks),
        nextVersion,
        input.actorId,
        timestamp.getTime(),
        input.id,
        input.expectedVersion,
      );
    const mutations = this.#mutationStatements({
      action: "restore",
      actorId: input.actorId,
      after: content,
      before: current.content,
      documentId: input.id,
      previousPublishedRevisionId: current.publishedRevisionId,
      previousScheduledAt: current.scheduledAt,
      revisionId: input.revisionId,
      timestamp,
      version: nextVersion,
    });
    const [result] = await this.#batch([update, ...mutations]);
    if ((result?.meta?.changes ?? 0) !== 1) {
      const latest = await this.getDraft({ id: input.id });
      if (!latest) notFound(input.id);
      conflict(input.expectedVersion, latest.version);
    }
    return (await this.getDraft({ id: input.id }))!;
  }

  async delete(input: DeleteDraftInput) {
    const current = await this.getDraft({ id: input.id });
    if (!current) notFound(input.id);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }

    const timestamp = this.#now();
    const deleteRevisions = this.#database
      .prepare("DELETE FROM page_revisions WHERE page_id = ?")
      .bind(input.id);
    const deleteDocument = this.#database
      .prepare("DELETE FROM pages WHERE id = ? AND version = ?")
      .bind(input.id, input.expectedVersion);
    const mutations = this.#mutationStatements({
      action: "delete",
      actorId: input.actorId,
      after: null,
      before: current.content,
      documentId: input.id,
      previousPublishedRevisionId: current.publishedRevisionId,
      previousScheduledAt: current.scheduledAt,
      timestamp,
      version: current.version,
    });
    const results = await this.#batch([
      deleteRevisions,
      deleteDocument,
      ...mutations,
    ]);
    if ((results[1]?.meta?.changes ?? 0) !== 1) {
      const latest = await this.getDraft({ id: input.id });
      if (!latest) notFound(input.id);
      conflict(input.expectedVersion, latest.version);
    }
    return current;
  }
}

export function createCloudflareCmsPageProvider<
  TContent extends CmsPageContent<CmsBlock>,
>(options: CloudflareCmsProviderOptions<TContent>) {
  return new CloudflareCmsPageProvider(options);
}

type GlobalRow = {
  key: string;
  content: string;
  version: number;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
};

type GlobalRevisionRow = {
  id: string;
  globalKey: string;
  version: number;
  snapshot: string;
  note: string;
  createdBy: string;
  createdAt: number;
};

const globalColumns = `
  key, content, version, updated_by AS updatedBy,
  created_at AS createdAt, updated_at AS updatedAt
`;

function globalNotFound(key: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `CMS global content was not found: ${key}`,
    retryable: false,
  });
}

export type CloudflareCmsGlobalProviderOptions<TContent> = {
  database: CloudflareD1Database;
  parseContent: (value: unknown) => TContent;
  createId?: () => string;
  now?: () => Date;
};

export class CloudflareCmsGlobalContentProvider<
  TContent,
> implements CmsGlobalContentProvider<TContent> {
  readonly capabilities: CmsProviderCapabilities = {
    supported: ["content.readDraft", "content.write", "content.restore"],
  };

  readonly #database: CloudflareD1Database;
  readonly #parseContent: (value: unknown) => TContent;
  readonly #createId: () => string;
  readonly #now: () => Date;

  constructor(options: CloudflareCmsGlobalProviderOptions<TContent>) {
    this.#database = options.database;
    this.#parseContent = options.parseContent;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
  }

  #document(row: GlobalRow): CmsGlobalDocument<TContent> {
    return {
      key: row.key,
      content: this.#parseContent(decodeJson(row.content)),
      version: Number(row.version),
      createdAt: new Date(Number(row.createdAt)).toISOString(),
      updatedAt: new Date(Number(row.updatedAt)).toISOString(),
      updatedBy: row.updatedBy,
    };
  }

  #revision(row: GlobalRevisionRow): CmsGlobalRevision<TContent> {
    return {
      id: row.id,
      key: row.globalKey,
      version: Number(row.version),
      content: this.#parseContent(decodeJson(row.snapshot)),
      note: row.note,
      createdAt: new Date(Number(row.createdAt)).toISOString(),
      createdBy: row.createdBy,
    };
  }

  async get(input: { key: string }) {
    const row = await this.#database
      .prepare(`SELECT ${globalColumns} FROM cms_globals WHERE key = ? LIMIT 1`)
      .bind(input.key)
      .first<GlobalRow>();
    return row ? this.#document(row) : null;
  }

  async save(input: {
    key: string;
    expectedVersion: number | null;
    content: TContent;
    actorId: string;
    note?: string;
  }) {
    const key = input.key.trim();
    if (!key || key.length > 160) {
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "CMS global content keys must contain 1 to 160 characters.",
        retryable: false,
      });
    }
    const current = await this.get({ key });
    if (!current && input.expectedVersion !== null) {
      conflict(input.expectedVersion, 0);
    }
    if (current && input.expectedVersion !== current.version) {
      conflict(input.expectedVersion ?? 0, current.version);
    }

    const content = this.#parseContent(input.content);
    const snapshot = JSON.stringify(content);
    const version = (current?.version ?? 0) + 1;
    const timestamp = this.#now().getTime();
    const documentStatement = current
      ? this.#database
          .prepare(
            `UPDATE cms_globals SET content = ?, version = ?,
              updated_by = ?, updated_at = ?
             WHERE key = ? AND version = ?`,
          )
          .bind(
            snapshot,
            version,
            input.actorId,
            timestamp,
            key,
            input.expectedVersion,
          )
      : this.#database
          .prepare(
            `INSERT INTO cms_globals (
              key, content, version, updated_by, created_at, updated_at
            ) VALUES (?, ?, 1, ?, ?, ?)`,
          )
          .bind(key, snapshot, input.actorId, timestamp, timestamp);
    const revisionStatement = this.#database
      .prepare(
        `INSERT INTO cms_global_revisions (
          id, global_key, version, snapshot, note, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        this.#createId(),
        key,
        version,
        snapshot,
        input.note ?? "",
        input.actorId,
        timestamp,
      );

    let results: D1RunResult[];
    try {
      results = await this.#database.batch([
        documentStatement,
        revisionStatement,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unique constraint|constraint failed.*cms_global/i.test(message)) {
        const latest = await this.get({ key });
        conflict(input.expectedVersion ?? 0, latest?.version ?? 0);
      }
      throw error;
    }
    if ((results[0]?.meta?.changes ?? 0) !== 1) {
      const latest = await this.get({ key });
      conflict(input.expectedVersion ?? 0, latest?.version ?? 0);
    }
    return (await this.get({ key }))!;
  }

  async listRevisions(key: string) {
    const { results } = await this.#database
      .prepare(
        `SELECT id, global_key AS globalKey, version, snapshot, note,
          created_by AS createdBy, created_at AS createdAt
         FROM cms_global_revisions WHERE global_key = ?
         ORDER BY version DESC`,
      )
      .bind(key)
      .all<GlobalRevisionRow>();
    return results.map((row) => this.#revision(row));
  }

  async restore(input: {
    key: string;
    revisionId: string;
    expectedVersion: number;
    actorId: string;
    note?: string;
  }) {
    const current = await this.get({ key: input.key });
    if (!current) globalNotFound(input.key);
    if (current.version !== input.expectedVersion) {
      conflict(input.expectedVersion, current.version);
    }
    const row = await this.#database
      .prepare(
        `SELECT id, global_key AS globalKey, version, snapshot, note,
          created_by AS createdBy, created_at AS createdAt
         FROM cms_global_revisions
         WHERE id = ? AND global_key = ? LIMIT 1`,
      )
      .bind(input.revisionId, input.key)
      .first<GlobalRevisionRow>();
    if (!row) globalNotFound(input.revisionId);
    return this.save({
      key: input.key,
      expectedVersion: input.expectedVersion,
      content: this.#revision(row).content,
      actorId: input.actorId,
      note: input.note ?? `Restore ${input.revisionId}`,
    });
  }
}

export function createCloudflareCmsGlobalContentProvider<TContent>(
  options: CloudflareCmsGlobalProviderOptions<TContent>,
) {
  return new CloudflareCmsGlobalContentProvider(options);
}

export * from "./media";
