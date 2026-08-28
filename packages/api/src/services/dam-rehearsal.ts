import { CmsError } from "@rem-viet/cms";
import type {
  CloudflareD1Database,
  CloudflareR2MediaBucket,
} from "@agency/cms-provider-cloudflare";
import { env } from "@rem-viet/env/server";
import { z } from "zod";

import {
  createPage,
  createRemVietMediaProvider,
  deletePage,
  getPageById,
  updatePage,
} from "./content";
import type { CmsActor } from "./content-revisions";
import {
  signPrivateMediaDelivery,
  verifyPrivateMediaDelivery,
} from "./media-delivery";

export const startDamRehearsalConfirmation = "RUN_STAGING_DAM_REHEARSAL";
export const completeDamRehearsalConfirmation =
  "COMPLETE_STAGING_DAM_REHEARSAL";

export const startDamRehearsalInputSchema = z.object({
  confirmation: z.literal(startDamRehearsalConfirmation),
});

const rehearsalObjectKeySchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|webp)$/,
  );

export const damRehearsalStateSchema = z.object({
  rehearsalId: z.string().uuid(),
  rootFolderId: z.string().uuid(),
  childFolderId: z.string().uuid(),
  primaryAssetId: z.string().uuid(),
  primaryKey: rehearsalObjectKeySchema,
  duplicateKey: rehearsalObjectKeySchema,
  replacementAssetId: z.string().uuid(),
  replacementKey: rehearsalObjectKeySchema,
  variantKey: rehearsalObjectKeySchema,
  pageId: z.string().uuid(),
  pageSlug: z.string().regex(/^cms-dam-rehearsal-[0-9a-f-]{36}$/),
});

export const completeDamRehearsalInputSchema = z.object({
  confirmation: z.literal(completeDamRehearsalConfirmation),
  state: damRehearsalStateSchema,
  proof: z.object({
    expires: z.string().regex(/^\d{13}$/),
    signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }),
});

type DamRehearsalState = z.infer<typeof damRehearsalStateSchema>;
type PartialDamRehearsalState = Omit<DamRehearsalState, "pageId"> & {
  pageId?: string;
};

const pngBody = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  ),
  (character) => character.charCodeAt(0),
);

function storage() {
  const bucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket }).PRODUCT_IMAGES;
  if (!bucket) {
    throw new CmsError({
      code: "CAPABILITY_UNAVAILABLE",
      message: "The staging R2 media binding is not configured.",
      retryable: false,
    });
  }
  return {
    database: env.DB as unknown as CloudflareD1Database,
    bucket: bucket as unknown as CloudflareR2MediaBucket,
  };
}

function assertAllowed(actor: CmsActor) {
  if (env.RELEASE_STAGE !== "staging" || actor.role !== "owner") {
    throw new CmsError({
      code: "FORBIDDEN",
      message: "The DAM rehearsal is restricted to an owner on staging.",
      retryable: false,
    });
  }
}

function folderName(kind: "root" | "child", rehearsalId: string) {
  return `DAM rehearsal ${kind} ${rehearsalId}`;
}

function isRehearsalAsset(
  asset: { metadata: Readonly<Record<string, unknown>> },
  rehearsalId: string,
) {
  return asset.metadata.rehearsalId === rehearsalId;
}

function createState(): PartialDamRehearsalState {
  const rehearsalId = crypto.randomUUID();
  return {
    rehearsalId,
    rootFolderId: crypto.randomUUID(),
    childFolderId: crypto.randomUUID(),
    primaryAssetId: crypto.randomUUID(),
    primaryKey: `${crypto.randomUUID()}.png`,
    duplicateKey: `${crypto.randomUUID()}.png`,
    replacementAssetId: crypto.randomUUID(),
    replacementKey: `${crypto.randomUUID()}.png`,
    variantKey: `${crypto.randomUUID()}.webp`,
    pageSlug: `cms-dam-rehearsal-${rehearsalId}`,
  };
}

function rehearsalProofKey(state: DamRehearsalState) {
  return [
    "staging-dam-rehearsal-v1",
    state.rehearsalId,
    state.rootFolderId,
    state.childFolderId,
    state.primaryAssetId,
    state.primaryKey,
    state.duplicateKey,
    state.replacementAssetId,
    state.replacementKey,
    state.variantKey,
    state.pageId,
    state.pageSlug,
  ].join("\n");
}

async function createRehearsalProof(state: DamRehearsalState) {
  const signed = await signPrivateMediaDelivery({
    key: rehearsalProofKey(state),
    url: "/_cms/dam-rehearsal",
    expiresAt: new Date(Date.now() + 900_000),
    secret: env.BETTER_AUTH_SECRET,
  });
  const url = new URL(signed, "https://cms.invalid");
  return {
    expires: url.searchParams.get("expires")!,
    signature: url.searchParams.get("signature")!,
  };
}

async function cleanupRehearsal(
  state: PartialDamRehearsalState,
  actor: CmsActor,
) {
  const { database, bucket } = storage();
  if (state.pageId) {
    const page = await database
      .prepare("SELECT id, slug FROM pages WHERE id = ? LIMIT 1")
      .bind(state.pageId)
      .first<{ id: string; slug: string }>();
    if (page?.slug === state.pageSlug) {
      await deletePage({ pageId: page.id }, actor);
    }
  }

  const provider = createRemVietMediaProvider(actor);
  for (const id of [state.replacementAssetId, state.primaryAssetId]) {
    const asset = await provider.getAsset(id);
    if (asset && isRehearsalAsset(asset, state.rehearsalId)) {
      await provider.delete({ id, actorId: actor.userId, force: true });
    }
  }
  await Promise.all([
    bucket.delete(state.duplicateKey),
    bucket.delete(state.variantKey),
  ]);

  const folders = await provider.listFolders();
  const child = folders.find((folder) => folder.id === state.childFolderId);
  if (
    child?.name === folderName("child", state.rehearsalId) &&
    child.parentId === state.rootFolderId
  ) {
    await database
      .prepare("DELETE FROM cms_media_folders WHERE id = ? AND name = ?")
      .bind(child.id, child.name)
      .run();
  }
  const refreshedFolders = await provider.listFolders();
  const root = refreshedFolders.find(
    (folder) => folder.id === state.rootFolderId,
  );
  if (
    root?.name === folderName("root", state.rehearsalId) &&
    root.parentId === null
  ) {
    await database
      .prepare("DELETE FROM cms_media_folders WHERE id = ? AND name = ?")
      .bind(root.id, root.name)
      .run();
  }
}

function providerForRehearsal(input: {
  actor: CmsActor;
  state: PartialDamRehearsalState;
  onVariantQueued?: (variantId: string) => void;
}) {
  return createRemVietMediaProvider(input.actor, undefined, {
    deliveryAdapter: {
      sign: ({ key, url, expiresAt }) =>
        signPrivateMediaDelivery({
          key,
          url,
          expiresAt,
          secret: env.BETTER_AUTH_SECRET,
        }),
    },
    enqueueVariant: ({ variant }) => {
      input.onVariantQueued?.(variant.id);
    },
    replaceUsage: async ({ from, to }) => {
      if (!input.state.pageId) return 0;
      if (
        !isRehearsalAsset(from, input.state.rehearsalId) ||
        !isRehearsalAsset(to, input.state.rehearsalId)
      ) {
        return 0;
      }
      const existing = await getPageById({ pageId: input.state.pageId });
      if (
        existing.data?.slug !== input.state.pageSlug ||
        existing.data.ogImage !== from.url
      ) {
        return 0;
      }
      const updated = await updatePage(
        {
          pageId: input.state.pageId,
          ogImage: to.url,
          expectedVersion: existing.data.version,
          createRedirect: false,
        },
        input.actor,
      );
      return updated.data?.ogImage === to.url ? 1 : 0;
    },
  });
}

export async function startDamRehearsal(
  _input: z.infer<typeof startDamRehearsalInputSchema>,
  actor: CmsActor,
) {
  assertAllowed(actor);
  const state = createState();
  const { bucket } = storage();
  let queuedVariantId = "";
  const provider = providerForRehearsal({
    actor,
    state,
    onVariantQueued: (variantId) => {
      queuedVariantId = variantId;
    },
  });

  try {
    const root = await provider.createFolder({
      id: state.rootFolderId,
      name: folderName("root", state.rehearsalId),
      actorId: actor.userId,
    });
    const child = await provider.createFolder({
      id: state.childFolderId,
      name: folderName("child", state.rehearsalId),
      parentId: root.id,
      actorId: actor.userId,
    });
    const primary = await provider.uploadAsset({
      id: state.primaryAssetId,
      key: state.primaryKey,
      url: `/api/media/${state.primaryKey}`,
      altText: "Staging DAM private delivery rehearsal",
      size: pngBody.byteLength,
      mimeType: "image/png",
      width: 1,
      height: 1,
      folderId: child.id,
      tags: ["dam-rehearsal", "private-r2"],
      contentHash: `receipt:${state.rehearsalId}:primary`,
      visibility: "private",
      metadata: { rehearsalId: state.rehearsalId, phase: "primary" },
      body: pngBody,
      actorId: actor.userId,
    });
    const duplicate = await provider.uploadAsset({
      key: state.duplicateKey,
      url: `/api/media/${state.duplicateKey}`,
      size: pngBody.byteLength,
      mimeType: "image/png",
      contentHash: `receipt:${state.rehearsalId}:primary`,
      body: pngBody,
      actorId: actor.userId,
    });
    const updated = await provider.updateAsset({
      id: primary.asset.id,
      actorId: actor.userId,
      patch: {
        focalPoint: { x: 0.25, y: 0.75 },
        metadata: {
          rehearsalId: state.rehearsalId,
          phase: "primary",
          campaign: "staging-dam-receipt",
        },
        localizedMetadata: { vi: { alt: "Ảnh diễn tập DAM riêng tư" } },
        copyright: "Rèm Vina staging receipt",
        license: "Synthetic test asset",
      },
    });
    const filtered = await provider.listAssets({
      folderId: child.id,
      tags: ["dam-rehearsal", "private-r2"],
      visibility: "private",
      status: "active",
    });
    const pending = await provider.requestVariant({
      assetId: primary.asset.id,
      request: {
        name: `receipt-${state.rehearsalId.slice(0, 8)}`,
        width: 1,
        height: 1,
        format: "webp",
        fit: "cover",
      },
      actorId: actor.userId,
    });
    await bucket.put(state.variantKey, pngBody, {
      httpMetadata: { contentType: "image/webp" },
    });
    const ready = await provider.completeVariant({
      variantId: pending.id,
      key: state.variantKey,
      url: `/api/media/${state.variantKey}`,
      actorId: actor.userId,
    });
    const page = await createPage(
      {
        title: `Synthetic DAM rehearsal ${state.rehearsalId}`,
        slug: state.pageSlug,
        folder: "",
        template: "standard",
        blocks: [],
        status: "draft",
        seoTitle: "",
        seoDescription: "",
        canonicalUrl: "",
        ogImage: primary.asset.url,
        robotsIndex: false,
        robotsFollow: false,
      },
      actor,
    );
    if (!page.data) throw new Error("Could not create the DAM usage fixture.");
    state.pageId = page.data.id;
    const usage = await provider.getUsage(primary.asset.id);
    const replacement = await provider.uploadAsset({
      id: state.replacementAssetId,
      key: state.replacementKey,
      url: `/api/media/${state.replacementKey}`,
      altText: "Staging DAM replacement rehearsal",
      size: pngBody.byteLength,
      mimeType: "image/png",
      width: 1,
      height: 1,
      folderId: child.id,
      tags: ["dam-rehearsal", "replacement"],
      contentHash: `receipt:${state.rehearsalId}:replacement`,
      visibility: "public",
      metadata: { rehearsalId: state.rehearsalId, phase: "replacement" },
      body: pngBody,
      actorId: actor.userId,
    });
    const signedUrl = await provider.getDeliveryUrl({
      assetId: primary.asset.id,
      expiresInSeconds: 300,
    });
    const completeState = damRehearsalStateSchema.parse(state);
    const proof = await createRehearsalProof(completeState);

    return {
      state: completeState,
      proof,
      directUrl: primary.asset.url,
      signedUrl,
      evidence: {
        foldersAndFilters:
          filtered.length === 1 && filtered[0]?.id === primary.asset.id,
        duplicateDetection:
          duplicate.deduplicated && duplicate.asset.id === primary.asset.id,
        metadataAndFocalPoint:
          updated.focalPoint?.x === 0.25 &&
          updated.localizedMetadata.vi?.alt === "Ảnh diễn tập DAM riêng tư",
        asyncVariants:
          queuedVariantId === pending.id &&
          pending.status === "pending" &&
          ready.status === "ready",
        usageFound: usage.some(
          (reference) =>
            reference.type === "page" && reference.id === completeState.pageId,
        ),
        replacementPrepared: replacement.asset.id === state.replacementAssetId,
      },
    };
  } catch (error) {
    await cleanupRehearsal(state, actor);
    throw error;
  }
}

export async function completeDamRehearsal(
  input: z.infer<typeof completeDamRehearsalInputSchema>,
  actor: CmsActor,
) {
  assertAllowed(actor);
  const state = damRehearsalStateSchema.parse(input.state);
  if (
    !(await verifyPrivateMediaDelivery({
      key: rehearsalProofKey(state),
      expires: input.proof.expires,
      signature: input.proof.signature,
      secret: env.BETTER_AUTH_SECRET,
    }))
  ) {
    throw new CmsError({
      code: "FORBIDDEN",
      message: "The scoped DAM rehearsal proof is invalid or expired.",
      retryable: false,
    });
  }
  const provider = providerForRehearsal({ actor, state });
  let replacementCount = 0;
  let retentionBlocked = false;
  let restored = false;
  let forcePurged = false;

  try {
    const [primary, replacement] = await Promise.all([
      provider.getAsset(state.primaryAssetId),
      provider.getAsset(state.replacementAssetId),
    ]);
    if (
      !primary ||
      !replacement ||
      !isRehearsalAsset(primary, state.rehearsalId) ||
      !isRehearsalAsset(replacement, state.rehearsalId)
    ) {
      throw new CmsError({
        code: "NOT_FOUND",
        message: "The scoped DAM rehearsal assets were not found.",
        retryable: false,
      });
    }
    replacementCount = (
      await provider.replaceAsset({
        fromAssetId: state.primaryAssetId,
        toAssetId: state.replacementAssetId,
        actorId: actor.userId,
      })
    ).replaced;
    const pageAfterReplace = await getPageById({ pageId: state.pageId });
    if (
      replacementCount !== 1 ||
      pageAfterReplace.data?.slug !== state.pageSlug ||
      pageAfterReplace.data.ogImage !== replacement.url
    ) {
      throw new Error("The scoped DAM global replacement did not persist.");
    }
    await provider.trashAsset({
      id: state.replacementAssetId,
      actorId: actor.userId,
      retentionDays: 30,
    });
    const restoredAsset = await provider.restoreAsset({
      id: state.replacementAssetId,
      actorId: actor.userId,
    });
    restored = restoredAsset.status === "active" && !restoredAsset.purgeAt;
    await provider.trashAsset({
      id: state.replacementAssetId,
      actorId: actor.userId,
      retentionDays: 30,
    });
    try {
      await provider.purgeAsset({
        id: state.replacementAssetId,
        actorId: actor.userId,
      });
    } catch (error) {
      retentionBlocked = error instanceof CmsError && error.code === "CONFLICT";
    }
    if (!retentionBlocked) {
      throw new Error("DAM retention did not block an early purge.");
    }
    await provider.purgeAsset({
      id: state.replacementAssetId,
      actorId: actor.userId,
      force: true,
    });
    forcePurged = !(await provider.getAsset(state.replacementAssetId));
    return {
      evidence: {
        usageAndReplace: replacementCount === 1,
        trashRestoreRetention: restored && retentionBlocked && forcePurged,
      },
      cleaned: true,
    };
  } finally {
    await cleanupRehearsal(state, actor);
  }
}
