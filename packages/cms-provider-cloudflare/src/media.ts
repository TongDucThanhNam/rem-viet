import { CmsError, type CmsProviderCapabilities } from "@agency/cms-core";
import type {
  CmsDamAsset,
  CmsDamAssetFilter,
  CmsDamDeliveryAdapter,
  CmsDamMetadataPatch,
  CmsDamProvider,
  CmsDamUploadInput,
  CmsDamVariant,
  CmsDamVariantJob,
  CmsDamVariantQueue,
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
  folderId: string | null;
  tags: string;
  contentHash: string | null;
  visibility: "public" | "private";
  status: "active" | "trashed";
  focalX: number | null;
  focalY: number | null;
  metadata: string;
  localizedMetadata: string;
  copyright: string;
  license: string;
  expiresAt: number | null;
  trashedAt: number | null;
  purgeAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type FolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
};

type VariantRow = {
  id: string;
  assetId: string;
  name: string;
  width: number | null;
  height: number | null;
  format: CmsDamVariant["format"];
  fit: CmsDamVariant["fit"];
  status: CmsDamVariant["status"];
  key: string | null;
  url: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

const mediaColumns = `id, key, url, alt_text AS altText, size,
  mime_type AS mimeType, width, height, folder_id AS folderId, tags,
  content_hash AS contentHash, visibility, asset_status AS status,
  focal_x AS focalX, focal_y AS focalY, custom_metadata AS metadata,
  localized_metadata AS localizedMetadata, copyright, license,
  expires_at AS expiresAt, trashed_at AS trashedAt, purge_at AS purgeAt,
  created_at AS createdAt, updated_at AS updatedAt`;
const folderColumns = `id, name, parent_id AS parentId,
  created_at AS createdAt, updated_at AS updatedAt`;
const variantColumns = `id, asset_id AS assetId, name, width, height, format,
  fit, status, object_key AS key, url, error,
  created_at AS createdAt, updated_at AS updatedAt`;

function mediaNotFound(id: string): never {
  throw new CmsError({
    code: "NOT_FOUND",
    message: `Media ${id} was not found.`,
    retryable: false,
    details: { id },
  });
}

function validation(message: string, details?: Record<string, unknown>): never {
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
    details,
  });
}

function capability(message: string): never {
  throw new CmsError({
    code: "CAPABILITY_UNAVAILABLE",
    message,
    retryable: false,
  });
}

function parseJsonRecord(value: string, field: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw 0;
    return parsed as Record<string, unknown>;
  } catch {
    return validation(`Stored DAM ${field} is invalid.`);
  }
}

function parseTags(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      parsed.some((tag) => typeof tag !== "string")
    ) {
      throw 0;
    }
    return parsed as string[];
  } catch {
    return validation("Stored DAM tags are invalid.");
  }
}

function normalizeTags(input: readonly string[] | undefined) {
  const tags = [
    ...new Set((input ?? []).map((tag) => tag.trim()).filter(Boolean)),
  ];
  if (tags.length > 50 || tags.some((tag) => tag.length > 80)) {
    return validation("DAM assets support at most 50 tags of 80 characters.");
  }
  return tags.sort((left, right) => left.localeCompare(right));
}

function normalizeRecord(
  value: Readonly<Record<string, unknown>> | undefined,
  field: string,
) {
  try {
    const serialized = JSON.stringify(value ?? {});
    if (serialized.length > 32_768) return validation(`${field} is too large.`);
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw 0;
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CmsError) throw error;
    return validation(`${field} must be JSON-compatible object data.`);
  }
}

function normalizeFocalPoint(value: CmsDamMetadataPatch["focalPoint"]) {
  if (value === undefined || value === null) return value;
  if (
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    value.x < 0 ||
    value.x > 1 ||
    value.y < 0 ||
    value.y > 1
  ) {
    return validation("DAM focal point coordinates must be between 0 and 1.");
  }
  return { x: value.x, y: value.y } as const;
}

function timestamp(value: string | null | undefined, field: string) {
  if (value === undefined || value === null) return value;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed))
    return validation(`${field} must be an ISO date.`);
  return parsed;
}

function folderFromRow(row: FolderRow) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
  };
}

function variantFromRow(row: VariantRow): CmsDamVariant {
  return {
    id: row.id,
    assetId: row.assetId,
    name: row.name,
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    format: row.format,
    fit: row.fit,
    status: row.status,
    key: row.key,
    url: row.url,
    error: row.error,
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
  };
}

function assetFromRow(
  row: MediaRow,
  usageReferences: readonly CmsMediaUsageReference[],
  variants: readonly CmsDamVariant[],
): CmsDamAsset {
  return {
    id: row.id,
    key: row.key,
    url: row.url,
    altText: row.altText,
    size: Number(row.size),
    mimeType: row.mimeType,
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    folderId: row.folderId,
    tags: parseTags(row.tags),
    contentHash: row.contentHash,
    visibility: row.visibility,
    status: row.status,
    focalPoint:
      row.focalX === null || row.focalY === null
        ? null
        : { x: Number(row.focalX), y: Number(row.focalY) },
    metadata: parseJsonRecord(row.metadata, "metadata"),
    localizedMetadata: parseJsonRecord(
      row.localizedMetadata,
      "localized metadata",
    ) as Record<string, Record<string, unknown>>,
    copyright: row.copyright,
    license: row.license,
    expiresAt:
      row.expiresAt === null
        ? null
        : new Date(Number(row.expiresAt)).toISOString(),
    trashedAt:
      row.trashedAt === null
        ? null
        : new Date(Number(row.trashedAt)).toISOString(),
    purgeAt:
      row.purgeAt === null ? null : new Date(Number(row.purgeAt)).toISOString(),
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
    usageReferences,
    variants,
  };
}

export type CloudflareCmsMediaMutationEvent = {
  action: "upload" | "update" | "delete" | "forceDelete";
  actorId: string;
  before: CmsMediaRecord | null;
  after: CmsMediaRecord | null;
  timestamp: Date;
  usageReferences: readonly CmsMediaUsageReference[];
};

export type CloudflareCmsMediaProviderOptions = {
  database: CloudflareD1Database;
  bucket: CloudflareR2MediaBucket;
  createId?: () => string;
  now?: () => Date;
  resolveUsage?: (
    record: Omit<CmsMediaRecord, "usageReferences">,
  ) => Promise<CmsMediaUsageReference[]> | CmsMediaUsageReference[];
  replaceUsage?: (input: {
    from: CmsDamAsset;
    to: CmsDamAsset;
    actorId: string;
  }) => Promise<number> | number;
  enqueueVariant?: CmsDamVariantQueue;
  deliveryAdapter?: CmsDamDeliveryAdapter;
  trashRetentionDays?: number;
  prepareMutationStatements?: (
    event: CloudflareCmsMediaMutationEvent,
  ) =>
    | CloudflareD1PreparedStatement
    | readonly CloudflareD1PreparedStatement[]
    | null;
};

export class CloudflareCmsMediaProvider
  implements CmsMediaProvider, CmsDamProvider
{
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
  readonly #replaceUsage?: CloudflareCmsMediaProviderOptions["replaceUsage"];
  readonly #enqueueVariant?: CmsDamVariantQueue;
  readonly #deliveryAdapter?: CmsDamDeliveryAdapter;
  readonly #trashRetentionDays: number;
  readonly #prepareMutationStatements?: CloudflareCmsMediaProviderOptions["prepareMutationStatements"];

  constructor(options: CloudflareCmsMediaProviderOptions) {
    this.#database = options.database;
    this.#bucket = options.bucket;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
    this.#resolveUsage = options.resolveUsage ?? (() => []);
    this.#replaceUsage = options.replaceUsage;
    this.#enqueueVariant = options.enqueueVariant;
    this.#deliveryAdapter = options.deliveryAdapter;
    this.#trashRetentionDays = options.trashRetentionDays ?? 30;
    if (
      !Number.isInteger(this.#trashRetentionDays) ||
      this.#trashRetentionDays < 1 ||
      this.#trashRetentionDays > 3650
    ) {
      validation("DAM trash retention must be between 1 and 3650 days.");
    }
    this.#prepareMutationStatements = options.prepareMutationStatements;
  }

  #mutationStatements(event: CloudflareCmsMediaMutationEvent) {
    const prepared = this.#prepareMutationStatements?.(event);
    if (!prepared) return [];
    return Array.isArray(prepared) ? [...prepared] : [prepared];
  }

  async #variants(assetId: string) {
    const { results } = await this.#database
      .prepare(
        `SELECT ${variantColumns} FROM cms_media_variants
         WHERE asset_id = ? ORDER BY created_at, id`,
      )
      .bind(assetId)
      .all<VariantRow>();
    return results.map(variantFromRow);
  }

  async #withUsage(row: MediaRow) {
    const base = assetFromRow(row, [], await this.#variants(row.id));
    const {
      usageReferences: _usageReferences,
      variants: _variants,
      ...record
    } = base;
    return assetFromRow(row, await this.#resolveUsage(record), base.variants);
  }

  async #row(id: string) {
    return this.#database
      .prepare(`SELECT ${mediaColumns} FROM media WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<MediaRow>();
  }

  async #folderExists(id: string | null | undefined) {
    if (!id) return true;
    return Boolean(
      await this.#database
        .prepare("SELECT id FROM cms_media_folders WHERE id = ? LIMIT 1")
        .bind(id)
        .first<{ id: string }>(),
    );
  }

  async list(): Promise<CmsDamAsset[]> {
    return this.listAssets({ status: "active" });
  }

  async get(id: string) {
    return this.getAsset(id);
  }

  async getAsset(id: string) {
    const row = await this.#row(id);
    return row ? this.#withUsage(row) : null;
  }

  async listAssets(filter: CmsDamAssetFilter = {}) {
    const { results } = await this.#database
      .prepare(`SELECT ${mediaColumns} FROM media ORDER BY created_at DESC`)
      .all<MediaRow>();
    const assets = await Promise.all(
      results.map((row) => this.#withUsage(row)),
    );
    const query = filter.query?.trim().toLocaleLowerCase();
    return assets.filter(
      (asset) =>
        (filter.folderId === undefined || asset.folderId === filter.folderId) &&
        (!filter.tags?.length ||
          filter.tags.every((tag) => asset.tags.includes(tag))) &&
        (!filter.mimeType || asset.mimeType.startsWith(filter.mimeType)) &&
        (!filter.status || asset.status === filter.status) &&
        (!filter.visibility || asset.visibility === filter.visibility) &&
        (!query ||
          [asset.id, asset.key, asset.altText, ...asset.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
  }

  async getUsage(id: string) {
    const record = await this.getAsset(id);
    if (!record) mediaNotFound(id);
    return [...record.usageReferences];
  }

  async listFolders() {
    const { results } = await this.#database
      .prepare(
        `SELECT ${folderColumns} FROM cms_media_folders ORDER BY name, id`,
      )
      .all<FolderRow>();
    return results.map(folderFromRow);
  }

  async createFolder(input: {
    id?: string;
    name: string;
    parentId?: string | null;
    actorId: string;
  }) {
    const id = input.id ?? this.#createId();
    const name = input.name.trim();
    if (!id.trim() || id.length > 128 || !name || name.length > 120) {
      validation("DAM folder id and name are invalid.");
    }
    if (!(await this.#folderExists(input.parentId))) {
      validation("DAM parent folder was not found.");
    }
    const now = this.#now().getTime();
    try {
      await this.#database
        .prepare(
          `INSERT INTO cms_media_folders
             (id, name, parent_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(id, name, input.parentId ?? null, now, now)
        .run();
    } catch {
      validation("DAM folder already exists in this location.");
    }
    return folderFromRow({
      id,
      name,
      parentId: input.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async upload(input: UploadMediaInput) {
    const uploaded = await this.#insertAsset({
      ...input,
      contentHash: null,
      folderId: null,
      tags: [],
      visibility: "public",
      focalPoint: null,
      metadata: {},
      localizedMetadata: {},
      copyright: "",
      license: "",
      expiresAt: null,
    });
    return uploaded.asset;
  }

  async uploadAsset(input: CmsDamUploadInput) {
    if (!/^[A-Za-z0-9:_-]{8,256}$/.test(input.contentHash)) {
      validation("DAM content hash is invalid.");
    }
    const duplicate = await this.#database
      .prepare(
        `SELECT ${mediaColumns} FROM media WHERE content_hash = ? LIMIT 1`,
      )
      .bind(input.contentHash)
      .first<MediaRow>();
    if (duplicate) {
      return { asset: await this.#withUsage(duplicate), deduplicated: true };
    }
    return this.#insertAsset(input);
  }

  async #insertAsset(
    input: Omit<CmsDamUploadInput, "contentHash"> & {
      contentHash: string | null;
    },
  ) {
    if (!(await this.#folderExists(input.folderId))) {
      validation("DAM asset folder was not found.");
    }
    const id = input.id ?? this.#createId();
    const focalPoint = normalizeFocalPoint(input.focalPoint);
    const tags = normalizeTags(input.tags);
    const metadata = normalizeRecord(input.metadata, "DAM metadata");
    const localizedMetadata = normalizeRecord(
      input.localizedMetadata,
      "DAM localized metadata",
    );
    const expiresAt = timestamp(input.expiresAt, "DAM expiry");
    const timestampValue = this.#now();
    const now = timestampValue.getTime();
    const insert = this.#database
      .prepare(
        `INSERT INTO media (
          id, key, url, alt_text, size, mime_type, width, height,
          folder_id, tags, content_hash, visibility, asset_status,
          focal_x, focal_y, custom_metadata, localized_metadata,
          copyright, license, expires_at, trashed_at, purge_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .bind(
        id,
        input.key,
        input.url,
        input.altText ?? "",
        input.size,
        input.mimeType,
        input.width ?? null,
        input.height ?? null,
        input.folderId ?? null,
        JSON.stringify(tags),
        input.contentHash,
        input.visibility ?? "public",
        focalPoint?.x ?? null,
        focalPoint?.y ?? null,
        JSON.stringify(metadata),
        JSON.stringify(localizedMetadata),
        input.copyright ?? "",
        input.license ?? "",
        expiresAt ?? null,
        now,
        now,
      );
    const legacyRecord: CmsMediaRecord = {
      id,
      key: input.key,
      url: input.url,
      altText: input.altText ?? "",
      size: input.size,
      mimeType: input.mimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      createdAt: timestampValue.toISOString(),
      updatedAt: timestampValue.toISOString(),
      usageReferences: [],
    };
    const mutations = this.#mutationStatements({
      action: "upload",
      actorId: input.actorId,
      before: null,
      after: legacyRecord,
      timestamp: timestampValue,
      usageReferences: [],
    });
    await this.#bucket.put(input.key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
    try {
      const [result] = mutations.length
        ? await this.#database.batch([insert, ...mutations])
        : [await insert.run()];
      if ((result?.meta?.changes ?? 0) !== 1) throw new Error("insert failed");
    } catch (error) {
      await this.#bucket.delete(input.key);
      if (input.contentHash) {
        const duplicate = await this.#database
          .prepare(
            `SELECT ${mediaColumns} FROM media WHERE content_hash = ? LIMIT 1`,
          )
          .bind(input.contentHash)
          .first<MediaRow>();
        if (duplicate) {
          return {
            asset: await this.#withUsage(duplicate),
            deduplicated: true,
          };
        }
      }
      throw new CmsError({
        code: "VALIDATION_FAILED",
        message: "Could not persist uploaded media metadata.",
        retryable: true,
        details: {
          cause: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return { asset: (await this.getAsset(id))!, deduplicated: false };
  }

  async updateMetadata(input: UpdateMediaMetadataInput) {
    return this.updateAsset({
      id: input.id,
      patch: { altText: input.altText },
      actorId: input.actorId,
    });
  }

  async updateAsset(input: {
    id: string;
    patch: CmsDamMetadataPatch;
    actorId: string;
  }) {
    const current = await this.getAsset(input.id);
    if (!current) mediaNotFound(input.id);
    const nextFolder =
      input.patch.folderId === undefined
        ? current.folderId
        : input.patch.folderId;
    if (!(await this.#folderExists(nextFolder)))
      validation("DAM asset folder was not found.");
    const focalPoint =
      input.patch.focalPoint === undefined
        ? current.focalPoint
        : normalizeFocalPoint(input.patch.focalPoint);
    const tags =
      input.patch.tags === undefined
        ? current.tags
        : normalizeTags(input.patch.tags);
    const metadata =
      input.patch.metadata === undefined
        ? current.metadata
        : normalizeRecord(input.patch.metadata, "DAM metadata");
    const localizedMetadata =
      input.patch.localizedMetadata === undefined
        ? current.localizedMetadata
        : normalizeRecord(
            input.patch.localizedMetadata,
            "DAM localized metadata",
          );
    const expiresAt =
      input.patch.expiresAt === undefined
        ? current.expiresAt
          ? Date.parse(current.expiresAt)
          : null
        : (timestamp(input.patch.expiresAt, "DAM expiry") ?? null);
    const timestampValue = this.#now();
    const after: CmsMediaRecord = {
      ...current,
      altText: input.patch.altText ?? current.altText,
      updatedAt: timestampValue.toISOString(),
    };
    const update = this.#database
      .prepare(
        `UPDATE media SET alt_text = ?, folder_id = ?, tags = ?, visibility = ?,
          focal_x = ?, focal_y = ?, custom_metadata = ?, localized_metadata = ?,
          copyright = ?, license = ?, expires_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        after.altText,
        nextFolder,
        JSON.stringify(tags),
        input.patch.visibility ?? current.visibility,
        focalPoint?.x ?? null,
        focalPoint?.y ?? null,
        JSON.stringify(metadata),
        JSON.stringify(localizedMetadata),
        input.patch.copyright ?? current.copyright,
        input.patch.license ?? current.license,
        expiresAt,
        timestampValue.getTime(),
        input.id,
      );
    const mutations = this.#mutationStatements({
      action: "update",
      actorId: input.actorId,
      before: current,
      after,
      timestamp: timestampValue,
      usageReferences: current.usageReferences,
    });
    const [result] = mutations.length
      ? await this.#database.batch([update, ...mutations])
      : [await update.run()];
    if ((result?.meta?.changes ?? 0) !== 1) mediaNotFound(input.id);
    return (await this.getAsset(input.id))!;
  }

  async bulkUpdateAssets(input: {
    ids: readonly string[];
    patch: CmsDamMetadataPatch;
    actorId: string;
  }) {
    const ids = [...new Set(input.ids)];
    if (!ids.length || ids.length > 100)
      validation("Bulk DAM updates require 1 to 100 unique assets.");
    const existing = await Promise.all(ids.map((id) => this.getAsset(id)));
    if (existing.some((asset) => !asset))
      validation("Bulk DAM update includes a missing asset.");
    const updated: CmsDamAsset[] = [];
    for (const id of ids) {
      updated.push(
        await this.updateAsset({
          id,
          patch: input.patch,
          actorId: input.actorId,
        }),
      );
    }
    return updated;
  }

  async #variant(id: string) {
    const row = await this.#database
      .prepare(
        `SELECT ${variantColumns} FROM cms_media_variants WHERE id = ? LIMIT 1`,
      )
      .bind(id)
      .first<VariantRow>();
    return row ? variantFromRow(row) : null;
  }

  async requestVariant(input: {
    assetId: string;
    request: {
      name: string;
      width?: number | null;
      height?: number | null;
      format: CmsDamVariant["format"];
      fit?: CmsDamVariant["fit"];
    };
    actorId: string;
  }) {
    if (!this.#enqueueVariant)
      capability("This DAM provider has no variant job queue.");
    const asset = await this.getAsset(input.assetId);
    if (!asset) mediaNotFound(input.assetId);
    if (asset.status !== "active" || !asset.mimeType.startsWith("image/")) {
      validation("Only active images can create DAM variants.");
    }
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(input.request.name))
      validation("DAM variant name is invalid.");
    for (const dimension of [input.request.width, input.request.height]) {
      if (
        dimension !== undefined &&
        dimension !== null &&
        (!Number.isInteger(dimension) || dimension < 1 || dimension > 16_384)
      ) {
        validation(
          "DAM variant dimensions must be between 1 and 16384 pixels.",
        );
      }
    }
    const id = this.#createId();
    const now = this.#now().getTime();
    try {
      await this.#database
        .prepare(
          `INSERT INTO cms_media_variants
            (id, asset_id, name, width, height, format, fit, status,
             object_key, url, error, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?, ?)`,
        )
        .bind(
          id,
          asset.id,
          input.request.name,
          input.request.width ?? null,
          input.request.height ?? null,
          input.request.format,
          input.request.fit ?? "cover",
          now,
          now,
        )
        .run();
    } catch {
      validation(
        `Variant "${input.request.name}" already exists for this asset.`,
      );
    }
    const variant = (await this.#variant(id))!;
    try {
      await this.#enqueueVariant({ asset, variant } satisfies CmsDamVariantJob);
    } catch (error) {
      await this.failVariant({
        variantId: id,
        error:
          error instanceof Error ? error.message : "Variant enqueue failed.",
        actorId: input.actorId,
      });
      throw new CmsError({
        code: "CAPABILITY_UNAVAILABLE",
        message: "Could not enqueue the DAM variant job.",
        retryable: true,
      });
    }
    return variant;
  }

  async completeVariant(input: {
    variantId: string;
    key: string;
    url: string;
    actorId: string;
  }) {
    if (!(await this.#variant(input.variantId))) mediaNotFound(input.variantId);
    const now = this.#now().getTime();
    await this.#database
      .prepare(
        `UPDATE cms_media_variants SET status = 'ready', object_key = ?,
          url = ?, error = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(input.key, input.url, now, input.variantId)
      .run();
    return (await this.#variant(input.variantId))!;
  }

  async failVariant(input: {
    variantId: string;
    error: string;
    actorId: string;
  }) {
    if (!(await this.#variant(input.variantId))) mediaNotFound(input.variantId);
    const error = input.error
      .replace(/(password|secret|token)\s*=\s*[^\s,;]+/gi, "$1=[redacted]")
      .slice(0, 500);
    await this.#database
      .prepare(
        `UPDATE cms_media_variants SET status = 'failed', object_key = NULL,
          url = NULL, error = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(error, this.#now().getTime(), input.variantId)
      .run();
    return (await this.#variant(input.variantId))!;
  }

  async getDeliveryUrl(input: { assetId: string; expiresInSeconds?: number }) {
    const asset = await this.getAsset(input.assetId);
    if (!asset || asset.status !== "active") mediaNotFound(input.assetId);
    if (
      asset.expiresAt &&
      Date.parse(asset.expiresAt) <= this.#now().getTime()
    ) {
      mediaNotFound(input.assetId);
    }
    if (asset.visibility === "public") return asset.url;
    if (!this.#deliveryAdapter)
      capability("Private DAM delivery is not configured.");
    const seconds = input.expiresInSeconds ?? 300;
    if (!Number.isInteger(seconds) || seconds < 30 || seconds > 3600) {
      validation(
        "Private DAM delivery expiry must be between 30 and 3600 seconds.",
      );
    }
    return this.#deliveryAdapter.sign({
      key: asset.key,
      url: asset.url,
      expiresAt: new Date(this.#now().getTime() + seconds * 1000),
    });
  }

  async replaceAsset(input: {
    fromAssetId: string;
    toAssetId: string;
    actorId: string;
  }) {
    if (!this.#replaceUsage)
      capability("Global DAM replacement is not configured.");
    if (input.fromAssetId === input.toAssetId)
      validation("Replacement assets must differ.");
    const [from, to] = await Promise.all([
      this.getAsset(input.fromAssetId),
      this.getAsset(input.toAssetId),
    ]);
    if (!from) mediaNotFound(input.fromAssetId);
    if (!to || to.status !== "active") mediaNotFound(input.toAssetId);
    const replaced = await this.#replaceUsage({
      from,
      to,
      actorId: input.actorId,
    });
    if (!Number.isInteger(replaced) || replaced < 0)
      validation("DAM replacement returned an invalid count.");
    return { replaced };
  }

  async trashAsset(input: {
    id: string;
    actorId: string;
    retentionDays?: number;
  }) {
    const current = await this.getAsset(input.id);
    if (!current) mediaNotFound(input.id);
    const retentionDays = input.retentionDays ?? this.#trashRetentionDays;
    if (
      !Number.isInteger(retentionDays) ||
      retentionDays < 1 ||
      retentionDays > 3650
    ) {
      validation("DAM trash retention must be between 1 and 3650 days.");
    }
    const now = this.#now().getTime();
    await this.#database
      .prepare(
        `UPDATE media SET asset_status = 'trashed', trashed_at = ?,
          purge_at = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(now, now + retentionDays * 86_400_000, now, input.id)
      .run();
    return (await this.getAsset(input.id))!;
  }

  async restoreAsset(input: { id: string; actorId: string }) {
    const current = await this.getAsset(input.id);
    if (!current) mediaNotFound(input.id);
    if (current.status !== "trashed")
      validation("Only trashed DAM assets can be restored.");
    const now = this.#now().getTime();
    await this.#database
      .prepare(
        `UPDATE media SET asset_status = 'active', trashed_at = NULL,
          purge_at = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(now, input.id)
      .run();
    return (await this.getAsset(input.id))!;
  }

  async purgeAsset(input: { id: string; actorId: string; force?: boolean }) {
    const current = await this.getAsset(input.id);
    if (!current) mediaNotFound(input.id);
    if (current.status !== "trashed" && !input.force)
      validation("Only trashed DAM assets can be purged.");
    if (
      !input.force &&
      (!current.purgeAt || Date.parse(current.purgeAt) > this.#now().getTime())
    ) {
      throw new CmsError({
        code: "CONFLICT",
        message: "DAM retention has not elapsed.",
        retryable: false,
        details: { purgeAt: current.purgeAt },
      });
    }
    if (current.usageReferences.length && !input.force) {
      throw new CmsError({
        code: "CONFLICT",
        message: `Media is referenced in ${current.usageReferences.length} location(s).`,
        retryable: false,
      });
    }
    for (const key of [
      current.key,
      ...current.variants.flatMap((variant) =>
        variant.key ? [variant.key] : [],
      ),
    ]) {
      await this.#bucket.delete(key);
    }
    await this.#database.batch([
      this.#database
        .prepare("DELETE FROM cms_media_variants WHERE asset_id = ?")
        .bind(input.id),
      this.#database.prepare("DELETE FROM media WHERE id = ?").bind(input.id),
    ]);
    return current;
  }

  async delete(input: DeleteMediaInput) {
    const current = await this.getAsset(input.id);
    if (!current) mediaNotFound(input.id);
    if (current.usageReferences.length && !input.force) {
      throw new CmsError({
        code: "CONFLICT",
        message: `Media is referenced in ${current.usageReferences.length} location(s).`,
        retryable: false,
        details: { usageReferences: current.usageReferences },
      });
    }
    const timestampValue = this.#now();
    const remove = this.#database
      .prepare("DELETE FROM media WHERE id = ?")
      .bind(input.id);
    const mutations = this.#mutationStatements({
      action: input.force ? "forceDelete" : "delete",
      actorId: input.actorId,
      before: current,
      after: null,
      timestamp: timestampValue,
      usageReferences: current.usageReferences,
    });
    for (const key of [
      current.key,
      ...current.variants.flatMap((variant) =>
        variant.key ? [variant.key] : [],
      ),
    ]) {
      await this.#bucket.delete(key);
    }
    const statements = [
      this.#database
        .prepare("DELETE FROM cms_media_variants WHERE asset_id = ?")
        .bind(input.id),
      remove,
      ...mutations,
    ];
    const results = await this.#database.batch(statements);
    if ((results[1]?.meta?.changes ?? 0) !== 1) mediaNotFound(input.id);
    return current;
  }
}

export function createCloudflareCmsMediaProvider(
  options: CloudflareCmsMediaProviderOptions,
) {
  return new CloudflareCmsMediaProvider(options);
}
