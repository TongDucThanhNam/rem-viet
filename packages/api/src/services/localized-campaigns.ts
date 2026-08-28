import { REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION } from "@agency/cms-template-rem-viet";
import { z } from "zod";

import type { CmsActor } from "./content-revisions";
import { createRemVietCollectionProvider } from "./standard-page-runtime";

export const localizedCampaignLocaleSchema = z.enum(["vi-VN", "en-US"]);

export const localizedCampaignDataSchema = z.object({
  code: z.string().trim().min(1).max(160),
  headline: z.string().trim().min(1).max(160),
});

const localizedCampaignIdentitySchema = z.object({
  id: z.string().trim().min(1).max(128),
  locale: localizedCampaignLocaleSchema,
});

export const listLocalizedCampaignsInputSchema = z.object({
  locale: localizedCampaignLocaleSchema.default("vi-VN"),
  filterField: z.enum(["code", "headline"]).optional(),
  filterOperator: z.enum(["contains", "equals"]).optional(),
  filterValue: z.string().trim().max(160).optional(),
});

export const localizedCampaignIdentityInputSchema =
  localizedCampaignIdentitySchema;

export const createLocalizedCampaignInputSchema = z.object({
  locale: localizedCampaignLocaleSchema,
  data: localizedCampaignDataSchema,
});

export const saveLocalizedCampaignInputSchema =
  localizedCampaignIdentitySchema.extend({
    expectedVersion: z.number().int().nonnegative(),
    data: localizedCampaignDataSchema,
  });

export const mutateLocalizedCampaignInputSchema =
  localizedCampaignIdentitySchema.extend({
    expectedVersion: z.number().int().nonnegative(),
    note: z.string().trim().max(500).optional(),
  });

export const scheduleLocalizedCampaignInputSchema =
  mutateLocalizedCampaignInputSchema.extend({
    scheduledAt: z.string().datetime({ offset: true }),
  });

export const restoreLocalizedCampaignInputSchema =
  mutateLocalizedCampaignInputSchema.extend({
    revisionId: z.string().trim().min(1).max(128),
  });

function provider(actor?: CmsActor) {
  return createRemVietCollectionProvider(actor);
}

function target(input: { id: string; locale: string }) {
  return {
    collection: REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION,
    id: input.id,
    locale: input.locale,
  };
}

export async function listLocalizedCampaigns(
  input: z.infer<typeof listLocalizedCampaignsInputSchema>,
  actor: CmsActor,
) {
  const filterValue = input.filterValue?.trim();
  return provider(actor).list({
    collection: REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION,
    locale: input.locale,
    actorId: actor.userId,
    ...(input.filterField && input.filterOperator && filterValue
      ? {
          filters: [
            {
              field: input.filterField,
              operator: input.filterOperator,
              value: filterValue,
            },
          ],
        }
      : {}),
    sort: { field: "updatedAt", direction: "desc" },
    pagination: { limit: 100, offset: 0 },
  });
}

export async function getLocalizedCampaignDraft(
  input: z.infer<typeof localizedCampaignIdentityInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).getDraft({
    ...target(input),
    actorId: actor.userId,
    fallback: "none",
  });
}

export async function createLocalizedCampaign(
  input: z.infer<typeof createLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).createDraft({
    collection: REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION,
    locale: input.locale,
    data: input.data,
    actorId: actor.userId,
  });
}

export async function saveLocalizedCampaign(
  input: z.infer<typeof saveLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).saveDraft({
    ...target(input),
    expectedVersion: input.expectedVersion,
    data: input.data,
    actorId: actor.userId,
  });
}

export async function scheduleLocalizedCampaign(
  input: z.infer<typeof scheduleLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).schedule({
    ...target(input),
    expectedVersion: input.expectedVersion,
    scheduledAt: input.scheduledAt,
    actorId: actor.userId,
    note: input.note,
  });
}

export async function unscheduleLocalizedCampaign(
  input: z.infer<typeof mutateLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).unschedule({
    ...target(input),
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    note: input.note,
  });
}

export async function publishLocalizedCampaign(
  input: z.infer<typeof mutateLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).publish({
    ...target(input),
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    note: input.note,
  });
}

export async function unpublishLocalizedCampaign(
  input: z.infer<typeof mutateLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).unpublish({
    ...target(input),
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    note: input.note,
  });
}

export async function listLocalizedCampaignRevisions(
  input: z.infer<typeof localizedCampaignIdentityInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).listRevisions({
    ...target(input),
    actorId: actor.userId,
  });
}

export async function restoreLocalizedCampaignRevision(
  input: z.infer<typeof restoreLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).restore({
    ...target(input),
    expectedVersion: input.expectedVersion,
    revisionId: input.revisionId,
    actorId: actor.userId,
    note: input.note,
  });
}

export async function deleteLocalizedCampaign(
  input: z.infer<typeof mutateLocalizedCampaignInputSchema>,
  actor: CmsActor,
) {
  return provider(actor).delete({
    ...target(input),
    expectedVersion: input.expectedVersion,
    actorId: actor.userId,
    note: input.note,
  });
}
