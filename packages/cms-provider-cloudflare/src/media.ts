import { CmsError, type CmsProviderCapabilities } from "@agency/cms-core";
import type {
  CmsMediaProvider,
  CmsMediaRecord,
  CmsMediaUsageReference,
  DeleteMediaInput,
  UpdateMediaMetadataInput,
  UploadMediaInput,
} from "@agency/cms-runtime";

import type {
  CloudflareD1Database,
  CloudflareD1PreparedStatement,
} from "./index";

export interface CloudflareR2MediaBucket {
  put(
    key: string,
    value: unknown,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

type MediaRow = {
  id: string;
  key: string;
  url: string;
  altText: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: number;
  updatedAt: number;
};

const mediaColumns = `id, key, url, alt_text AS altText, size,
  mime_type AS mimeType, width, height,
  created_at AS createdAt, updated_at AS updatedAt`;

function notFound(id: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `Media ${id} was not found.`,
    retryable: false,
    details: { id },
  });
}

function recordFromRow(
  row: MediaRow,
  usageReferences: CmsMediaUsageReference[],
): CmsMediaRecord {
  return {
    id: row.id,
    key: row.key,
    url: row.url,
    altText: row.altText,
    size: Number(row.size),
    mimeType: row.mimeType,
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
    usageReferences,
  };
}

export type CloudflareCmsMediaMutationEvent = {
  action: "upload" | "update" | "delete" | "forceDelete";
  actorId: string;
  before: CmsMediaRecord | null;
  after: CmsMediaRecord | null;
  timestamp: Date;
  usageReferences: CmsMediaUsageReference[];
};

export type CloudflareCmsMediaProviderOptions = {
  database: CloudflareD1Database;
  bucket: CloudflareR2MediaBucket;
  createId?: () => string;
  now?: () => Date;
  resolveUsage?: (
    record: Omit<CmsMediaRecord, "usageReferences">,
  ) => Promise<CmsMediaUsageReference[]> | CmsMediaUsageReference[];
  prepareMutationStatements?: (
    event: CloudflareCmsMediaMutationEvent,
  ) =>
    | CloudflareD1PreparedStatement
    | readonly CloudflareD1PreparedStatement[]
    | null;
};

export class CloudflareCmsMediaProvider implements CmsMediaProvider {
  readonly capabilities: CmsProviderCapabilities = {
    supported: ["media.manage", "media.delete"],
  };

  readonly #database: CloudflareD1Database;
  readonly #bucket: CloudflareR2MediaBucket;
  readonly #createId: () => string;
  readonly #now: () => Date;
  readonly #resolveUsage: NonNullable<
    CloudflareCmsMediaProviderOptions["resolveUsage"]
  >;
  readonly #prepareMutationStatements?: CloudflareCmsMediaProviderOptions["prepareMutationStatements"];

  constructor(options: CloudflareCmsMediaProviderOptions) {
    this.#database = options.database;
    this.#bucket = options.bucket;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
    this.#resolveUsage = options.resolveUsage ?? (() => []);
    this.#prepareMutationStatements = options.prepareMutationStatements;
  }

  #mutationStatements(event: CloudflareCmsMediaMutationEvent) {
    const prepared = this.#prepareMutationStatements?.(event);
    if (!prepared) return [];
    return Array.isArray(prepared) ? [...prepared] : [prepared];
  }

  async #withUsage(row: MediaRow) {
    const base = recordFromRow(row, []);
    const { usageReferences: _usageReferences, ...record } = base;
    return recordFromRow(row, await this.#resolveUsage(record));
  }

  async list() {
    const { results } = await this.#database
      .prepare(`SELECT ${mediaColumns} FROM media ORDER BY created_at DESC`)
      .all<MediaRow>();
    return Promise.all(results.map((row) => this.#withUsage(row)));
  }

  async get(id: string) {
    const row = await this.#database
      .prepare(`SELECT ${mediaColumns} FROM media WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<MediaRow>();
    return row ? this.#withUsage(row) : null;
  }

  async getUsage(id: string) {
    const record = await this.get(id);
    if (!record) notFound(id);
    return record.usageReferences;
  }

  async upload(input: UploadMediaInput) {
    const id = input.id ?? this.#createId();
    const timestamp = this.#now();
    const now = timestamp.getTime();
    const record: CmsMediaRecord = {
      id,
      key: input.key,
      url: input.url,
      altText: input.altText ?? "",
      size: input.size,
      mimeType: input.mimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
      usageReferences: [],
    };
    const insert = this.#database
      .prepare(
        `INSERT INTO media
          (id, key, url, alt_text, size, mime_type, width, height, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.key,
        input.url,
        record.altText,
        input.size,
        input.mimeType,
        record.width,
        record.height,
        now,
        now,
      );
    const mutations = this.#mutationStatements({
      action: "upload",
      actorId: input.actorId,
      before: null,
      after: record,
      timestamp,
      usageReferences: [],
    });

    await this.#bucket.put(input.key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
    try {
      const [result] = mutations.length
        ? await this.#database.batch([insert, ...mutations])
        : [await insert.run()];
      if ((result?.meta?.changes ?? 0) !== 1) {
        throw new Error("D1 did not create the media row.");
      }
    } catch (error) {
      await this.#bucket.delete(input.key);
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "Could not persist uploaded media metadata.",
        retryable: true,
        details: {
          cause: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return (await this.get(id))!;
  }

  async updateMetadata(input: UpdateMediaMetadataInput) {
    const current = await this.get(input.id);
    if (!current) notFound(input.id);
    const timestamp = this.#now();
    const after = {
      ...current,
      altText: input.altText,
      updatedAt: timestamp.toISOString(),
    };
    const update = this.#database
      .prepare("UPDATE media SET alt_text = ?, updated_at = ? WHERE id = ?")
      .bind(input.altText, timestamp.getTime(), input.id);
    const mutations = this.#mutationStatements({
      action: "update",
      actorId: input.actorId,
      before: current,
      after,
      timestamp,
      usageReferences: current.usageReferences,
    });
    const [result] = mutations.length
      ? await this.#database.batch([update, ...mutations])
      : [await update.run()];
    if ((result?.meta?.changes ?? 0) !== 1) notFound(input.id);
    return (await this.get(input.id))!;
  }

  async delete(input: DeleteMediaInput) {
    const current = await this.get(input.id);
    if (!current) notFound(input.id);
    if (current.usageReferences.length && !input.force) {
      throw new CmsError({
        code: "CONFLICT",
        message: `Media is referenced in ${current.usageReferences.length} location(s).`,
        retryable: false,
        details: { usageReferences: current.usageReferences },
      });
    }
    const timestamp = this.#now();
    const remove = this.#database
      .prepare("DELETE FROM media WHERE id = ?")
      .bind(input.id);
    const mutations = this.#mutationStatements({
      action: input.force ? "forceDelete" : "delete",
      actorId: input.actorId,
      before: current,
      after: null,
      timestamp,
      usageReferences: current.usageReferences,
    });

    await this.#bucket.delete(current.key);
    const [result] = mutations.length
      ? await this.#database.batch([remove, ...mutations])
      : [await remove.run()];
    if ((result?.meta?.changes ?? 0) !== 1) notFound(input.id);
    return current;
  }
}

export function createCloudflareCmsMediaProvider(
  options: CloudflareCmsMediaProviderOptions,
) {
  return new CloudflareCmsMediaProvider(options);
}
