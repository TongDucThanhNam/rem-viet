import { CmsError, type CmsProviderCapabilities } from "@agency/cms-core";
import type {
  CmsDamAsset,
  CmsDamAssetFilter,
  CmsDamDeliveryAdapter,
  CmsDamFolder,
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
  PostgresCmsClient,
  PostgresCmsDatabase,
  PostgresCmsQueryExecutor,
} from "./index";
import type { S3CmsObjectStorage } from "./s3";

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
type StoredDamAsset = Mutable<
  Omit<CmsDamAsset, "usageReferences" | "variants">
>;

type StoredDamState = {
  assets: StoredDamAsset[];
  folders: CmsDamFolder[];
  variants: CmsDamVariant[];
};

export type PostgresCmsMediaProviderOptions = Readonly<{
  database: PostgresCmsDatabase;
  storage: Pick<S3CmsObjectStorage, "put" | "delete">;
  namespace?: string;
  createId?: () => string;
  now?: () => Date;
  resolveUsage?: (
    record: Omit<CmsMediaRecord, "usageReferences">,
  ) =>
    | readonly CmsMediaUsageReference[]
    | Promise<readonly CmsMediaUsageReference[]>;
  replaceUsage?: (input: {
    from: CmsDamAsset;
    to: CmsDamAsset;
    actorId: string;
  }) => number | Promise<number>;
  enqueueVariant?: CmsDamVariantQueue;
  deliveryAdapter?: CmsDamDeliveryAdapter;
  trashRetentionDays?: number;
}>;

const emptyState = (): StoredDamState => ({
  assets: [],
  folders: [],
  variants: [],
});

function failure(
  code:
    | "CAPABILITY_UNAVAILABLE"
    | "CONFLICT"
    | "MIGRATION_FAILED"
    | "NOT_FOUND"
    | "VALIDATION_FAILED",
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new CmsError({ code, message, retryable: false, details });
}

function mediaNotFound(id: string): never {
  return failure("NOT_FOUND", `Media ${id} was not found.`, { id });
}

function parseState(payload: unknown): StoredDamState {
  let value = payload;
  try {
    if (typeof value === "string") value = JSON.parse(value);
  } catch {
    return failure(
      "MIGRATION_FAILED",
      "PostgreSQL DAM state is not valid JSON.",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failure("MIGRATION_FAILED", "PostgreSQL DAM state is invalid.");
  }
  const state = value as Partial<StoredDamState>;
  if (
    !Array.isArray(state.assets) ||
    !Array.isArray(state.folders) ||
    !Array.isArray(state.variants)
  ) {
    return failure("MIGRATION_FAILED", "PostgreSQL DAM state is incomplete.");
  }
  return structuredClone({
    assets: state.assets,
    folders: state.folders,
    variants: state.variants,
  });
}

function safeNamespace(value: string) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(value)) {
    return failure(
      "VALIDATION_FAILED",
      "PostgreSQL DAM namespace must be a safe lowercase identifier.",
    );
  }
  return value;
}

function validId(value: string, label: string) {
  const id = value.trim();
  if (!id || id.length > 128) {
    return failure(
      "VALIDATION_FAILED",
      `${label} must contain between 1 and 128 characters.`,
    );
  }
  return id;
}

function normalizeTags(input: readonly string[] | undefined) {
  const tags = [
    ...new Set((input ?? []).map((tag) => tag.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
  if (tags.length > 50 || tags.some((tag) => tag.length > 80)) {
    return failure(
      "VALIDATION_FAILED",
      "DAM assets support at most 50 tags of 80 characters.",
    );
  }
  return tags;
}

function normalizeRecord(
  value: Readonly<Record<string, unknown>> | undefined,
  label: string,
) {
  try {
    const serialized = JSON.stringify(value ?? {});
    if (serialized.length > 32_768) {
      return failure("VALIDATION_FAILED", `${label} is too large.`);
    }
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CmsError) throw error;
    return failure(
      "VALIDATION_FAILED",
      `${label} must be JSON-compatible object data.`,
    );
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
    return failure(
      "VALIDATION_FAILED",
      "DAM focal point coordinates must be between 0 and 1.",
    );
  }
  return { x: value.x, y: value.y } as const;
}

function normalizeTimestamp(value: string | null | undefined, label: string) {
  if (value === undefined || value === null) return value;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return failure("VALIDATION_FAILED", `${label} must be an ISO date.`);
  }
  return new Date(timestamp).toISOString();
}

function normalizeDimension(value: number | null | undefined, label: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 16_384) {
    return failure(
      "VALIDATION_FAILED",
      `${label} must be between 1 and 16384 pixels.`,
    );
  }
  return value;
}

function assertUpload(input: {
  id?: string;
  key: string;
  url: string;
  size: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
}) {
  if (input.id !== undefined) validId(input.id, "DAM asset id");
  if (!input.key.trim() || input.key.length > 1_024) {
    failure("VALIDATION_FAILED", "DAM object key is invalid.");
  }
  if (!input.url.trim() || input.url.length > 4_096) {
    failure("VALIDATION_FAILED", "DAM delivery URL is invalid.");
  }
  if (!Number.isInteger(input.size) || input.size < 0) {
    failure("VALIDATION_FAILED", "DAM asset size must be a positive integer.");
  }
  if (!input.mimeType.trim() || input.mimeType.length > 255) {
    failure("VALIDATION_FAILED", "DAM MIME type is invalid.");
  }
  normalizeDimension(input.width, "DAM image width");
  normalizeDimension(input.height, "DAM image height");
}

async function rollbackQuietly(client: PostgresCmsClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction error.
  }
}

function legacyRecord(
  asset: StoredDamAsset,
): Omit<CmsMediaRecord, "usageReferences"> {
  return {
    id: asset.id,
    key: asset.key,
    url: asset.url,
    altText: asset.altText,
    size: asset.size,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export class PostgresCmsMediaProvider
  implements CmsMediaProvider, CmsDamProvider
{
  readonly capabilities: CmsProviderCapabilities = Object.freeze({
    supported: ["media.manage", "media.delete"],
  });

  readonly #database: PostgresCmsDatabase;
  readonly #storage: PostgresCmsMediaProviderOptions["storage"];
  readonly #namespace: string;
  readonly #createId: () => string;
  readonly #now: () => Date;
  readonly #resolveUsage: NonNullable<
    PostgresCmsMediaProviderOptions["resolveUsage"]
  >;
  readonly #replaceUsage?: PostgresCmsMediaProviderOptions["replaceUsage"];
  readonly #enqueueVariant?: CmsDamVariantQueue;
  readonly #deliveryAdapter?: CmsDamDeliveryAdapter;
  readonly #trashRetentionDays: number;

  constructor(options: PostgresCmsMediaProviderOptions) {
    this.#database = options.database;
    this.#storage = options.storage;
    this.#namespace = safeNamespace(options.namespace ?? "default");
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
      failure(
        "VALIDATION_FAILED",
        "DAM trash retention must be between 1 and 3650 days.",
      );
    }
  }

  async #load(executor: PostgresCmsQueryExecutor, lock = false) {
    const result = await executor.query<{ payload: unknown }>(
      `SELECT payload FROM agency_cms_postgres_dam_state
       WHERE namespace = $1${lock ? " FOR UPDATE" : ""}`,
      [this.#namespace],
    );
    return result.rows[0] ? parseState(result.rows[0].payload) : null;
  }

  async #read() {
    return (await this.#load(this.#database)) ?? emptyState();
  }

  async #mutate<T>(operation: (state: StoredDamState) => T | Promise<T>) {
    const client = await this.#database.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `agency-cms-dam:${this.#namespace}`,
      ]);
      let state = await this.#load(client, true);
      if (!state) {
        state = emptyState();
        await client.query(
          `INSERT INTO agency_cms_postgres_dam_state
             (namespace, schema_version, payload, updated_at)
           VALUES ($1, 1, $2::jsonb, $3)
           ON CONFLICT (namespace) DO NOTHING`,
          [this.#namespace, JSON.stringify(state), this.#now().toISOString()],
        );
        state = (await this.#load(client, true)) ?? state;
      }
      const result = await operation(state);
      await client.query(
        `UPDATE agency_cms_postgres_dam_state
         SET payload = $1::jsonb, schema_version = 1, updated_at = $2
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

  async #usage(asset: StoredDamAsset) {
    return [...(await this.#resolveUsage(legacyRecord(asset)))];
  }

  async #compose(asset: StoredDamAsset, state?: StoredDamState) {
    const source = state ?? (await this.#read());
    return {
      ...structuredClone(asset),
      usageReferences: await this.#usage(asset),
      variants: source.variants
        .filter((variant) => variant.assetId === asset.id)
        .sort((left, right) =>
          left.createdAt === right.createdAt
            ? left.id.localeCompare(right.id)
            : left.createdAt.localeCompare(right.createdAt),
        )
        .map((variant) => structuredClone(variant)),
    } satisfies CmsDamAsset;
  }

  async list(): Promise<CmsMediaRecord[]> {
    return this.listAssets({ status: "active" });
  }

  async get(id: string) {
    return this.getAsset(id);
  }

  async getAsset(id: string) {
    const state = await this.#read();
    const asset = state.assets.find((candidate) => candidate.id === id);
    return asset ? this.#compose(asset, state) : null;
  }

  async listAssets(filter: CmsDamAssetFilter = {}) {
    const state = await this.#read();
    const query = filter.query?.trim().toLocaleLowerCase();
    const matches = state.assets
      .filter(
        (asset) =>
          (filter.folderId === undefined ||
            asset.folderId === filter.folderId) &&
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
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return Promise.all(matches.map((asset) => this.#compose(asset, state)));
  }

  async getUsage(id: string) {
    const asset = await this.getAsset(id);
    if (!asset) mediaNotFound(id);
    return [...asset.usageReferences];
  }

  async listFolders() {
    const state = await this.#read();
    return state.folders
      .map((folder) => structuredClone(folder))
      .sort((left, right) =>
        left.name === right.name
          ? left.id.localeCompare(right.id)
          : left.name.localeCompare(right.name),
      );
  }

  async createFolder(input: {
    id?: string;
    name: string;
    parentId?: string | null;
    actorId: string;
  }) {
    const id = validId(input.id ?? this.#createId(), "DAM folder id");
    const name = input.name.trim();
    if (!name || name.length > 120) {
      failure("VALIDATION_FAILED", "DAM folder name is invalid.");
    }
    return this.#mutate((state) => {
      const parentId = input.parentId ?? null;
      if (parentId && !state.folders.some((folder) => folder.id === parentId)) {
        failure("VALIDATION_FAILED", "DAM parent folder was not found.");
      }
      if (
        state.folders.some(
          (folder) =>
            folder.id === id ||
            (folder.parentId === parentId && folder.name === name),
        )
      ) {
        failure("VALIDATION_FAILED", "DAM folder already exists.");
      }
      const now = this.#now().toISOString();
      const folder = { id, name, parentId, createdAt: now, updatedAt: now };
      state.folders.push(folder);
      return structuredClone(folder);
    });
  }

  async upload(input: UploadMediaInput) {
    const result = await this.#upload({
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
    return result.asset;
  }

  async uploadAsset(input: CmsDamUploadInput) {
    if (!/^[A-Za-z0-9:_-]{8,256}$/.test(input.contentHash)) {
      failure("VALIDATION_FAILED", "DAM content hash is invalid.");
    }
    return this.#upload(input);
  }

  async #upload(
    input: Omit<CmsDamUploadInput, "contentHash"> & {
      contentHash: string | null;
    },
  ) {
    assertUpload(input);
    const initial = await this.#read();
    const existing = input.contentHash
      ? initial.assets.find((asset) => asset.contentHash === input.contentHash)
      : undefined;
    if (existing) {
      return {
        asset: await this.#compose(existing, initial),
        deduplicated: true,
      };
    }

    await this.#storage.put(input.key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
    try {
      const result = await this.#mutate((state) => {
        const duplicate = input.contentHash
          ? state.assets.find(
              (asset) => asset.contentHash === input.contentHash,
            )
          : undefined;
        if (duplicate) {
          return { asset: structuredClone(duplicate), deduplicated: true };
        }
        const id = validId(input.id ?? this.#createId(), "DAM asset id");
        if (state.assets.some((asset) => asset.id === id)) {
          failure("VALIDATION_FAILED", `DAM asset ${id} already exists.`);
        }
        const folderId = input.folderId ?? null;
        if (
          folderId &&
          !state.folders.some((folder) => folder.id === folderId)
        ) {
          failure("VALIDATION_FAILED", "DAM asset folder was not found.");
        }
        const now = this.#now().toISOString();
        const asset: StoredDamAsset = {
          id,
          key: input.key,
          url: input.url,
          altText: input.altText ?? "",
          size: input.size,
          mimeType: input.mimeType,
          width: normalizeDimension(input.width, "DAM image width"),
          height: normalizeDimension(input.height, "DAM image height"),
          folderId,
          tags: normalizeTags(input.tags),
          contentHash: input.contentHash,
          visibility: input.visibility ?? "public",
          status: "active",
          focalPoint: normalizeFocalPoint(input.focalPoint) ?? null,
          metadata: normalizeRecord(input.metadata, "DAM metadata"),
          localizedMetadata: normalizeRecord(
            input.localizedMetadata,
            "DAM localized metadata",
          ) as Record<string, Record<string, unknown>>,
          copyright: input.copyright ?? "",
          license: input.license ?? "",
          expiresAt: normalizeTimestamp(input.expiresAt, "DAM expiry") ?? null,
          trashedAt: null,
          purgeAt: null,
          createdAt: now,
          updatedAt: now,
        };
        state.assets.push(asset);
        return { asset: structuredClone(asset), deduplicated: false };
      });
      if (result.deduplicated && result.asset.key !== input.key) {
        await this.#storage.delete(input.key);
      }
      return {
        asset: await this.#compose(result.asset),
        deduplicated: result.deduplicated,
      };
    } catch (error) {
      await this.#storage.delete(input.key);
      throw error;
    }
  }

  async updateMetadata(input: UpdateMediaMetadataInput) {
    return this.updateAsset({
      id: input.id,
      patch: { altText: input.altText },
      actorId: input.actorId,
    });
  }

  #patchAsset(
    state: StoredDamState,
    asset: StoredDamAsset,
    patch: CmsDamMetadataPatch,
  ) {
    const folderId =
      patch.folderId === undefined ? asset.folderId : patch.folderId;
    if (folderId && !state.folders.some((folder) => folder.id === folderId)) {
      failure("VALIDATION_FAILED", "DAM asset folder was not found.");
    }
    asset.altText = patch.altText ?? asset.altText;
    asset.folderId = folderId;
    asset.tags =
      patch.tags === undefined ? asset.tags : normalizeTags(patch.tags);
    asset.visibility = patch.visibility ?? asset.visibility;
    asset.focalPoint =
      patch.focalPoint === undefined
        ? asset.focalPoint
        : (normalizeFocalPoint(patch.focalPoint) ?? null);
    asset.metadata =
      patch.metadata === undefined
        ? asset.metadata
        : normalizeRecord(patch.metadata, "DAM metadata");
    asset.localizedMetadata =
      patch.localizedMetadata === undefined
        ? asset.localizedMetadata
        : (normalizeRecord(
            patch.localizedMetadata,
            "DAM localized metadata",
          ) as Record<string, Record<string, unknown>>);
    asset.copyright = patch.copyright ?? asset.copyright;
    asset.license = patch.license ?? asset.license;
    asset.expiresAt =
      patch.expiresAt === undefined
        ? asset.expiresAt
        : (normalizeTimestamp(patch.expiresAt, "DAM expiry") ?? null);
    asset.updatedAt = this.#now().toISOString();
  }

  async updateAsset(input: {
    id: string;
    patch: CmsDamMetadataPatch;
    actorId: string;
  }) {
    const stored = await this.#mutate((state) => {
      const asset = state.assets.find((candidate) => candidate.id === input.id);
      if (!asset) mediaNotFound(input.id);
      this.#patchAsset(state, asset, input.patch);
      return structuredClone(asset);
    });
    return this.#compose(stored);
  }

  async bulkUpdateAssets(input: {
    ids: readonly string[];
    patch: CmsDamMetadataPatch;
    actorId: string;
  }) {
    const ids = [...new Set(input.ids)];
    if (!ids.length || ids.length > 100) {
      failure(
        "VALIDATION_FAILED",
        "Bulk DAM updates require 1 to 100 unique assets.",
      );
    }
    const stored = await this.#mutate((state) => {
      const assets = ids.map((id) =>
        state.assets.find((candidate) => candidate.id === id),
      );
      if (assets.some((asset) => !asset)) {
        failure(
          "VALIDATION_FAILED",
          "Bulk DAM update includes a missing asset.",
        );
      }
      return (assets as StoredDamAsset[]).map((asset) => {
        this.#patchAsset(state, asset, input.patch);
        return structuredClone(asset);
      });
    });
    return Promise.all(stored.map((asset) => this.#compose(asset)));
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
    if (!this.#enqueueVariant) {
      failure(
        "CAPABILITY_UNAVAILABLE",
        "This DAM provider has no variant job queue.",
      );
    }
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(input.request.name)) {
      failure("VALIDATION_FAILED", "DAM variant name is invalid.");
    }
    const width = normalizeDimension(input.request.width, "DAM variant width");
    const height = normalizeDimension(
      input.request.height,
      "DAM variant height",
    );
    const variant = await this.#mutate((state) => {
      const asset = state.assets.find(
        (candidate) => candidate.id === input.assetId,
      );
      if (!asset) mediaNotFound(input.assetId);
      if (asset.status !== "active" || !asset.mimeType.startsWith("image/")) {
        failure(
          "VALIDATION_FAILED",
          "Only active images can create DAM variants.",
        );
      }
      if (
        state.variants.some(
          (candidate) =>
            candidate.assetId === input.assetId &&
            candidate.name === input.request.name,
        )
      ) {
        failure(
          "VALIDATION_FAILED",
          `Variant "${input.request.name}" already exists for this asset.`,
        );
      }
      const now = this.#now().toISOString();
      const created: CmsDamVariant = {
        id: validId(this.#createId(), "DAM variant id"),
        assetId: input.assetId,
        name: input.request.name,
        width,
        height,
        format: input.request.format,
        fit: input.request.fit ?? "cover",
        status: "pending",
        key: null,
        url: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
      state.variants.push(created);
      return structuredClone(created);
    });
    const asset = (await this.getAsset(input.assetId))!;
    try {
      await this.#enqueueVariant({ asset, variant } satisfies CmsDamVariantJob);
    } catch (error) {
      await this.failVariant({
        variantId: variant.id,
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
    return this.#mutate((state) => {
      const variant = state.variants.find(
        (candidate) => candidate.id === input.variantId,
      );
      if (!variant) mediaNotFound(input.variantId);
      const updated: CmsDamVariant = {
        ...variant,
        status: "ready",
        key: input.key,
        url: input.url,
        error: null,
        updatedAt: this.#now().toISOString(),
      };
      state.variants[state.variants.indexOf(variant)] = updated;
      return structuredClone(updated);
    });
  }

  async failVariant(input: {
    variantId: string;
    error: string;
    actorId: string;
  }) {
    return this.#mutate((state) => {
      const variant = state.variants.find(
        (candidate) => candidate.id === input.variantId,
      );
      if (!variant) mediaNotFound(input.variantId);
      const updated: CmsDamVariant = {
        ...variant,
        status: "failed",
        key: null,
        url: null,
        error: input.error
          .replace(/(password|secret|token)\s*=\s*[^\s,;]+/gi, "$1=[redacted]")
          .slice(0, 500),
        updatedAt: this.#now().toISOString(),
      };
      state.variants[state.variants.indexOf(variant)] = updated;
      return structuredClone(updated);
    });
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
    if (!this.#deliveryAdapter) {
      failure(
        "CAPABILITY_UNAVAILABLE",
        "Private DAM delivery is not configured.",
      );
    }
    const seconds = input.expiresInSeconds ?? 300;
    if (!Number.isInteger(seconds) || seconds < 30 || seconds > 3_600) {
      failure(
        "VALIDATION_FAILED",
        "Private DAM delivery expiry must be between 30 and 3600 seconds.",
      );
    }
    return this.#deliveryAdapter.sign({
      key: asset.key,
      url: asset.url,
      expiresAt: new Date(this.#now().getTime() + seconds * 1_000),
    });
  }

  async replaceAsset(input: {
    fromAssetId: string;
    toAssetId: string;
    actorId: string;
  }) {
    if (!this.#replaceUsage) {
      failure(
        "CAPABILITY_UNAVAILABLE",
        "Global DAM replacement is not configured.",
      );
    }
    if (input.fromAssetId === input.toAssetId) {
      failure("VALIDATION_FAILED", "Replacement assets must differ.");
    }
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
    if (!Number.isInteger(replaced) || replaced < 0) {
      failure(
        "VALIDATION_FAILED",
        "DAM replacement returned an invalid count.",
      );
    }
    return { replaced };
  }

  async trashAsset(input: {
    id: string;
    actorId: string;
    retentionDays?: number;
  }) {
    const retentionDays = input.retentionDays ?? this.#trashRetentionDays;
    if (
      !Number.isInteger(retentionDays) ||
      retentionDays < 1 ||
      retentionDays > 3650
    ) {
      failure(
        "VALIDATION_FAILED",
        "DAM trash retention must be between 1 and 3650 days.",
      );
    }
    const stored = await this.#mutate((state) => {
      const asset = state.assets.find((candidate) => candidate.id === input.id);
      if (!asset) mediaNotFound(input.id);
      const now = this.#now();
      asset.status = "trashed";
      asset.trashedAt = now.toISOString();
      asset.purgeAt = new Date(
        now.getTime() + retentionDays * 86_400_000,
      ).toISOString();
      asset.updatedAt = now.toISOString();
      return structuredClone(asset);
    });
    return this.#compose(stored);
  }

  async restoreAsset(input: { id: string; actorId: string }) {
    const stored = await this.#mutate((state) => {
      const asset = state.assets.find((candidate) => candidate.id === input.id);
      if (!asset) mediaNotFound(input.id);
      if (asset.status !== "trashed") {
        failure(
          "VALIDATION_FAILED",
          "Only trashed DAM assets can be restored.",
        );
      }
      asset.status = "active";
      asset.trashedAt = null;
      asset.purgeAt = null;
      asset.updatedAt = this.#now().toISOString();
      return structuredClone(asset);
    });
    return this.#compose(stored);
  }

  async purgeAsset(input: { id: string; actorId: string; force?: boolean }) {
    const result = await this.#mutate(async (state) => {
      const index = state.assets.findIndex(
        (candidate) => candidate.id === input.id,
      );
      const asset = state.assets[index];
      if (!asset) mediaNotFound(input.id);
      if (asset.status !== "trashed" && !input.force) {
        failure("VALIDATION_FAILED", "Only trashed DAM assets can be purged.");
      }
      if (
        !input.force &&
        (!asset.purgeAt || Date.parse(asset.purgeAt) > this.#now().getTime())
      ) {
        failure("CONFLICT", "DAM retention has not elapsed.", {
          purgeAt: asset.purgeAt,
        });
      }
      const composed = await this.#compose(asset, state);
      if (composed.usageReferences.length && !input.force) {
        failure(
          "CONFLICT",
          `Media is referenced in ${composed.usageReferences.length} location(s).`,
        );
      }
      state.assets.splice(index, 1);
      state.variants = state.variants.filter(
        (variant) => variant.assetId !== input.id,
      );
      return composed;
    });
    await this.#deleteObjects(result);
    return result;
  }

  async delete(input: DeleteMediaInput) {
    const result = await this.#mutate(async (state) => {
      const index = state.assets.findIndex(
        (candidate) => candidate.id === input.id,
      );
      const asset = state.assets[index];
      if (!asset) mediaNotFound(input.id);
      const composed = await this.#compose(asset, state);
      if (composed.usageReferences.length && !input.force) {
        failure(
          "CONFLICT",
          `Media is referenced in ${composed.usageReferences.length} location(s).`,
          { usageReferences: composed.usageReferences },
        );
      }
      state.assets.splice(index, 1);
      state.variants = state.variants.filter(
        (variant) => variant.assetId !== input.id,
      );
      return composed;
    });
    await this.#deleteObjects(result);
    return result;
  }

  async #deleteObjects(asset: CmsDamAsset) {
    const keys = [
      asset.key,
      ...asset.variants.flatMap((variant) =>
        variant.key ? [variant.key] : [],
      ),
    ];
    for (const key of keys) await this.#storage.delete(key);
  }
}

export function createPostgresCmsMediaProvider(
  options: PostgresCmsMediaProviderOptions,
) {
  return new PostgresCmsMediaProvider(options);
}
