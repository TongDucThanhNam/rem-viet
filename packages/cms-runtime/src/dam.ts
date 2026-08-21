import { CmsError, type CmsProviderCapabilities } from "@agency/cms-core";

import type { CmsMediaUsageReference } from "./index.js";

export type CmsDamAssetVisibility = "public" | "private";
export type CmsDamAssetStatus = "active" | "trashed";
export type CmsDamVariantStatus = "pending" | "ready" | "failed";

export type CmsDamFocalPoint = Readonly<{ x: number; y: number }>;

export type CmsDamFolder = Readonly<{
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CmsDamVariant = Readonly<{
  id: string;
  assetId: string;
  name: string;
  width: number | null;
  height: number | null;
  format: "avif" | "webp" | "jpeg" | "png";
  fit: "cover" | "contain" | "crop";
  status: CmsDamVariantStatus;
  key: string | null;
  url: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CmsDamAsset = Readonly<{
  id: string;
  key: string;
  url: string;
  altText: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  folderId: string | null;
  tags: readonly string[];
  contentHash: string | null;
  visibility: CmsDamAssetVisibility;
  status: CmsDamAssetStatus;
  focalPoint: CmsDamFocalPoint | null;
  metadata: Readonly<Record<string, unknown>>;
  localizedMetadata: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  copyright: string;
  license: string;
  expiresAt: string | null;
  trashedAt: string | null;
  purgeAt: string | null;
  createdAt: string;
  updatedAt: string;
  usageReferences: readonly CmsMediaUsageReference[];
  variants: readonly CmsDamVariant[];
}>;

export type CmsDamAssetFilter = Readonly<{
  folderId?: string | null;
  tags?: readonly string[];
  mimeType?: string;
  query?: string;
  status?: CmsDamAssetStatus;
  visibility?: CmsDamAssetVisibility;
}>;

export type CmsDamUploadInput = Readonly<{
  id?: string;
  key: string;
  url: string;
  altText?: string;
  size: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  folderId?: string | null;
  tags?: readonly string[];
  contentHash: string;
  visibility?: CmsDamAssetVisibility;
  focalPoint?: CmsDamFocalPoint | null;
  metadata?: Readonly<Record<string, unknown>>;
  localizedMetadata?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  copyright?: string;
  license?: string;
  expiresAt?: string | null;
  body: unknown;
  actorId: string;
}>;

export type CmsDamMetadataPatch = Readonly<{
  altText?: string;
  folderId?: string | null;
  tags?: readonly string[];
  visibility?: CmsDamAssetVisibility;
  focalPoint?: CmsDamFocalPoint | null;
  metadata?: Readonly<Record<string, unknown>>;
  localizedMetadata?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  copyright?: string;
  license?: string;
  expiresAt?: string | null;
}>;

export type CmsDamVariantRequest = Readonly<{
  name: string;
  width?: number | null;
  height?: number | null;
  format: CmsDamVariant["format"];
  fit?: CmsDamVariant["fit"];
}>;

export type CmsDamVariantJob = Readonly<{
  asset: CmsDamAsset;
  variant: CmsDamVariant;
}>;

export interface CmsDamProvider {
  readonly capabilities: CmsProviderCapabilities;
  listAssets(filter?: CmsDamAssetFilter): Promise<readonly CmsDamAsset[]>;
  getAsset(id: string): Promise<CmsDamAsset | null>;
  listFolders(): Promise<readonly CmsDamFolder[]>;
  createFolder(input: {
    id?: string;
    name: string;
    parentId?: string | null;
    actorId: string;
  }): Promise<CmsDamFolder>;
  uploadAsset(input: CmsDamUploadInput): Promise<{
    asset: CmsDamAsset;
    deduplicated: boolean;
  }>;
  updateAsset(input: {
    id: string;
    patch: CmsDamMetadataPatch;
    actorId: string;
  }): Promise<CmsDamAsset>;
  bulkUpdateAssets(input: {
    ids: readonly string[];
    patch: CmsDamMetadataPatch;
    actorId: string;
  }): Promise<readonly CmsDamAsset[]>;
  requestVariant(input: {
    assetId: string;
    request: CmsDamVariantRequest;
    actorId: string;
  }): Promise<CmsDamVariant>;
  completeVariant(input: {
    variantId: string;
    key: string;
    url: string;
    actorId: string;
  }): Promise<CmsDamVariant>;
  failVariant(input: {
    variantId: string;
    error: string;
    actorId: string;
  }): Promise<CmsDamVariant>;
  getDeliveryUrl(input: {
    assetId: string;
    expiresInSeconds?: number;
  }): Promise<string>;
  getUsage(id: string): Promise<readonly CmsMediaUsageReference[]>;
  replaceAsset(input: {
    fromAssetId: string;
    toAssetId: string;
    actorId: string;
  }): Promise<{ replaced: number }>;
  trashAsset(input: {
    id: string;
    actorId: string;
    retentionDays?: number;
  }): Promise<CmsDamAsset>;
  restoreAsset(input: { id: string; actorId: string }): Promise<CmsDamAsset>;
  purgeAsset(input: {
    id: string;
    actorId: string;
    force?: boolean;
  }): Promise<CmsDamAsset>;
}

export type CmsDamDeliveryAdapter = Readonly<{
  sign(input: {
    key: string;
    url: string;
    expiresAt: Date;
  }): string | Promise<string>;
}>;

export type CmsDamVariantQueue = (
  job: CmsDamVariantJob,
) => void | Promise<void>;

export type CmsDamTransformAdapter = Readonly<{
  id: string;
  buildVariantUrl(job: CmsDamVariantJob): string | Promise<string>;
}>;

export type CmsDamConformanceEvidence = Readonly<{
  foldersAndFilters: true;
  duplicateDetection: true;
  metadataAndFocalPoint: true;
  privateDelivery: true;
  asyncVariants: true;
  trashRestoreRetention: true;
  usageAndReplace: true;
}>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`DAM conformance failed: ${message}`);
}

/** Exercises the required DAM v2 behavior without depending on a storage vendor. */
export async function runDamProviderConformance(input: {
  provider: CmsDamProvider;
  body?: unknown;
  actorId?: string;
}): Promise<CmsDamConformanceEvidence> {
  const actorId = input.actorId ?? "dam-conformance";
  const body = input.body ?? new Uint8Array([1, 2, 3]);
  assert(
    (await input.provider.listAssets()).length === 0,
    "storage is not empty",
  );
  const root = await input.provider.createFolder({
    id: "dam-root",
    name: "Campaigns",
    actorId,
  });
  const child = await input.provider.createFolder({
    id: "dam-child",
    name: "Launch",
    parentId: root.id,
    actorId,
  });
  const first = await input.provider.uploadAsset({
    id: "dam-primary",
    key: "media/dam-primary.png",
    url: "/media/dam-primary.png",
    altText: "Primary",
    size: 3,
    mimeType: "image/png",
    width: 100,
    height: 80,
    folderId: child.id,
    tags: ["launch", "hero"],
    contentHash: "sha256:primary",
    visibility: "private",
    body,
    actorId,
  });
  assert(!first.deduplicated, "first upload was deduplicated");
  const duplicate = await input.provider.uploadAsset({
    id: "dam-duplicate",
    key: "media/dam-duplicate.png",
    url: "/media/dam-duplicate.png",
    size: 3,
    mimeType: "image/png",
    contentHash: "sha256:primary",
    body,
    actorId,
  });
  assert(
    duplicate.deduplicated && duplicate.asset.id === first.asset.id,
    "content hash did not reuse the canonical asset",
  );
  const updated = await input.provider.updateAsset({
    id: first.asset.id,
    actorId,
    patch: {
      focalPoint: { x: 0.25, y: 0.75 },
      metadata: { campaign: "launch" },
      localizedMetadata: { vi: { alt: "Ảnh chính" } },
      copyright: "Agency",
      license: "Client use",
    },
  });
  assert(updated.focalPoint?.x === 0.25, "focal point was not persisted");
  assert(
    (await input.provider.listAssets({ folderId: child.id, tags: ["hero"] }))
      .length === 1,
    "folder/tag filtering failed",
  );
  const pending = await input.provider.requestVariant({
    assetId: first.asset.id,
    request: { name: "card", width: 640, format: "webp", fit: "cover" },
    actorId,
  });
  assert(pending.status === "pending" && !pending.url, "variant ran inline");
  const ready = await input.provider.completeVariant({
    variantId: pending.id,
    key: "variants/dam-primary/card.webp",
    url: "/variants/dam-primary/card.webp",
    actorId,
  });
  assert(ready.status === "ready", "variant completion was not persisted");
  const delivery = await input.provider.getDeliveryUrl({
    assetId: first.asset.id,
    expiresInSeconds: 60,
  });
  assert(delivery !== first.asset.url, "private delivery was not signed");
  assert(
    (await input.provider.getUsage(first.asset.id)).length > 0,
    "usage missing",
  );

  const replacement = await input.provider.uploadAsset({
    id: "dam-replacement",
    key: "media/dam-replacement.png",
    url: "/media/dam-replacement.png",
    size: 3,
    mimeType: "image/png",
    contentHash: "sha256:replacement",
    body,
    actorId,
  });
  assert(
    (
      await input.provider.replaceAsset({
        fromAssetId: first.asset.id,
        toAssetId: replacement.asset.id,
        actorId,
      })
    ).replaced > 0,
    "global replace reported no replacements",
  );
  const trashed = await input.provider.trashAsset({
    id: replacement.asset.id,
    actorId,
    retentionDays: 30,
  });
  assert(
    trashed.status === "trashed" && trashed.purgeAt,
    "trash state missing",
  );
  const restored = await input.provider.restoreAsset({
    id: replacement.asset.id,
    actorId,
  });
  assert(restored.status === "active" && !restored.purgeAt, "restore failed");
  await input.provider.trashAsset({ id: replacement.asset.id, actorId });
  let retentionBlocked = false;
  try {
    await input.provider.purgeAsset({ id: replacement.asset.id, actorId });
  } catch (error) {
    retentionBlocked = error instanceof CmsError && error.code === "CONFLICT";
  }
  assert(retentionBlocked, "retention did not block early purge");
  await input.provider.purgeAsset({
    id: replacement.asset.id,
    actorId,
    force: true,
  });
  assert(
    !(await input.provider.getAsset(replacement.asset.id)),
    "purge failed",
  );

  return {
    foldersAndFilters: true,
    duplicateDetection: true,
    metadataAndFocalPoint: true,
    privateDelivery: true,
    asyncVariants: true,
    trashRestoreRetention: true,
    usageAndReplace: true,
  };
}
