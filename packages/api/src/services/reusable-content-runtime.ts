import {
  cmsReusableContentReferenceSchema,
  type CmsJsonValue,
  type CmsReusableContentReference,
  type CmsReusableContentUsageSource,
} from "@agency/cms-core";
import type { CloudflareD1Database } from "@agency/cms-provider-cloudflare";
import {
  createCmsReusableContentRuntime,
  type CmsReusableContentData,
} from "@agency/cms-runtime";
import {
  pageBlockListSchema,
  pageRevisionSnapshotSchema,
  standardPageBlockSchema,
  type StandardPageBlock,
} from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";
import { z } from "zod";

import type { CmsActor } from "./content-revisions";
import { createRemVietCollectionProvider } from "./standard-page-runtime";

const reusableContentIdSchema = z.string().trim().min(1).max(128);
const reusableContentKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const concreteStandardPageBlockSchema = standardPageBlockSchema.refine(
  (block) => block.type !== "reusableContent",
  "A reusable fragment must contain a concrete standard-page block.",
);

export const reusableContentCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  key: reusableContentKeySchema,
  description: z.string().trim().max(500).default(""),
  value: concreteStandardPageBlockSchema,
  status: z.enum(["draft", "published"]).default("draft"),
});

export const reusableContentUpdateInputSchema = z.object({
  fragmentId: reusableContentIdSchema,
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  key: reusableContentKeySchema.optional(),
  description: z.string().trim().max(500).optional(),
  value: concreteStandardPageBlockSchema.optional(),
});

export const reusableContentIdInputSchema = z.object({
  fragmentId: reusableContentIdSchema,
});

export const reusableContentVersionInputSchema =
  reusableContentIdInputSchema.extend({
    expectedVersion: z.number().int().positive(),
    note: z.string().trim().max(500).optional(),
  });

export const reusableContentRestoreInputSchema =
  reusableContentVersionInputSchema.extend({
    revisionId: reusableContentIdSchema,
  });

export const reusableContentResolveInputSchema = z.object({
  reference: cmsReusableContentReferenceSchema.refine(
    (reference) => reference.contentType === "standard-page-block",
    "Reusable standard-page blocks require the standard-page-block content type.",
  ),
  mode: z.enum(["draft", "published"]).default("draft"),
  blockId: reusableContentIdSchema.optional(),
});

function runtime(actor?: CmsActor) {
  return createCmsReusableContentRuntime(
    createRemVietCollectionProvider(actor),
  );
}

function jsonBlock(block: StandardPageBlock): CmsJsonValue {
  return JSON.parse(JSON.stringify(block)) as CmsJsonValue;
}

function fragmentData(input: {
  title: string;
  key: string;
  description: string;
  value: StandardPageBlock;
}): CmsReusableContentData {
  return {
    title: input.title,
    key: input.key,
    description: input.description,
    contentType: "standard-page-block",
    value: jsonBlock(input.value),
  };
}

function parsedFragmentBlock(value: CmsJsonValue, blockId?: string) {
  const parsed = concreteStandardPageBlockSchema.parse(value);
  return blockId ? { ...parsed, id: blockId } : parsed;
}

type PageUsageRow = {
  id: string;
  blocks: unknown;
  publishedSnapshot: unknown | null;
};

function databaseBinding() {
  return env.DB as unknown as CloudflareD1Database;
}

function parseStoredBlocks(value: unknown) {
  const decoded =
    typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  return pageBlockListSchema.parse(decoded);
}

function parsePublishedBlocks(value: unknown) {
  if (value === null) return null;
  const decoded =
    typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  return pageRevisionSnapshotSchema.parse(decoded).blocks;
}

async function standardPageUsageSources(): Promise<
  readonly CmsReusableContentUsageSource[]
> {
  const rows = await databaseBinding()
    .prepare(
      `SELECT p.id, p.blocks, r.snapshot AS publishedSnapshot
       FROM pages p
       LEFT JOIN page_revisions r ON r.id = p.published_revision_id`,
    )
    .all<PageUsageRow>();
  return rows.results.flatMap((row) => {
    const published = parsePublishedBlocks(row.publishedSnapshot);
    return [
      {
        sourceType: "standard-page-draft",
        sourceId: row.id,
        value: jsonBlockArray(parseStoredBlocks(row.blocks)),
      },
      ...(published
        ? [
            {
              sourceType: "standard-page-published",
              sourceId: row.id,
              value: jsonBlockArray(published),
            },
          ]
        : []),
    ];
  });
}

function jsonBlockArray(blocks: readonly unknown[]) {
  return JSON.parse(JSON.stringify(blocks)) as CmsJsonValue;
}

export async function listReusableContent(input?: {
  status?: "draft" | "published";
}) {
  return runtime().list({
    status: input?.status ?? "draft",
    contentType: "standard-page-block",
  });
}

export async function getReusableContent(fragmentId: string) {
  return runtime().getDraft(fragmentId);
}

export async function createReusableContent(
  input: z.infer<typeof reusableContentCreateInputSchema>,
  actor: CmsActor,
) {
  const cms = runtime(actor);
  const created = await cms.createDraft({
    actorId: actor.userId,
    data: fragmentData(input),
  });
  return input.status === "published"
    ? (
        await cms.publish({
          id: created.id,
          expectedVersion: created.version,
          actorId: actor.userId,
          note: "Initial publish",
        })
      ).document
    : created;
}

export async function updateReusableContent(
  input: z.infer<typeof reusableContentUpdateInputSchema>,
  actor: CmsActor,
) {
  const cms = runtime(actor);
  const current = await cms.getDraft(input.fragmentId);
  if (!current) throw new Error("Reusable content not found");
  return cms.saveDraft({
    id: current.id,
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    data: fragmentData({
      title: input.title ?? current.data.title,
      key: input.key ?? current.data.key,
      description: input.description ?? current.data.description,
      value: input.value ?? parsedFragmentBlock(current.data.value),
    }),
  });
}

export async function publishReusableContent(
  input: z.infer<typeof reusableContentVersionInputSchema>,
  actor: CmsActor,
) {
  return runtime(actor).publish({
    id: input.fragmentId,
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    note: input.note,
  });
}

export async function unpublishReusableContent(
  input: z.infer<typeof reusableContentVersionInputSchema>,
  actor: CmsActor,
) {
  return runtime(actor).unpublish({
    id: input.fragmentId,
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    sources: await standardPageUsageSources(),
  });
}

export async function restoreReusableContent(
  input: z.infer<typeof reusableContentRestoreInputSchema>,
  actor: CmsActor,
) {
  return runtime(actor).restore({
    id: input.fragmentId,
    revisionId: input.revisionId,
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
  });
}

export async function deleteReusableContent(
  input: z.infer<typeof reusableContentVersionInputSchema>,
  actor: CmsActor,
) {
  return runtime(actor).delete({
    id: input.fragmentId,
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    sources: await standardPageUsageSources(),
  });
}

export async function listReusableContentRevisions(fragmentId: string) {
  return runtime().revisions(fragmentId);
}

export async function reusableContentUsageGraph() {
  return runtime().usageGraph({
    mode: "all",
    sources: await standardPageUsageSources(),
  });
}

export async function resolveReusableStandardPageBlock(input: {
  reference: CmsReusableContentReference;
  mode?: "draft" | "published";
  blockId?: string;
}) {
  const resolution = await runtime().resolve({
    value: input.reference,
    mode: input.mode ?? "draft",
  });
  return {
    block: parsedFragmentBlock(resolution.value, input.blockId),
    usages: resolution.usages,
  };
}

export async function detachReusableStandardPageBlock(input: {
  reference: CmsReusableContentReference;
  mode?: "draft" | "published";
  blockId?: string;
}) {
  const detached = await runtime().detach({
    reference: input.reference,
    mode: input.mode ?? "draft",
  });
  return {
    block: parsedFragmentBlock(detached.value, input.blockId),
    detachedFrom: detached.source,
  };
}
