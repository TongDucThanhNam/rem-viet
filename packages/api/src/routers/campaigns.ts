import { capabilityProcedure, router } from "../index";
import {
  createLocalizedCampaign,
  createLocalizedCampaignInputSchema,
  deleteLocalizedCampaign,
  getLocalizedCampaignDraft,
  listLocalizedCampaignRevisions,
  listLocalizedCampaigns,
  listLocalizedCampaignsInputSchema,
  localizedCampaignIdentityInputSchema,
  mutateLocalizedCampaignInputSchema,
  publishLocalizedCampaign,
  restoreLocalizedCampaignInputSchema,
  restoreLocalizedCampaignRevision,
  saveLocalizedCampaign,
  saveLocalizedCampaignInputSchema,
  scheduleLocalizedCampaign,
  scheduleLocalizedCampaignInputSchema,
  unpublishLocalizedCampaign,
  unscheduleLocalizedCampaign,
} from "../services/localized-campaigns";
import type { CmsActor } from "../services/content-revisions";
import { runCmsWorkflow } from "../workflow-error";

type StaffContext = {
  actor: CmsActor;
  requestId: string;
};

function actorFromContext(ctx: StaffContext): CmsActor {
  return { ...ctx.actor, requestId: ctx.requestId };
}

export const campaignsRouter = router({
  list: capabilityProcedure("content.readDraft")
    .input(listLocalizedCampaignsInputSchema)
    .query(({ ctx, input }) =>
      listLocalizedCampaigns(input, actorFromContext(ctx)),
    ),
  byId: capabilityProcedure("content.readDraft")
    .input(localizedCampaignIdentityInputSchema)
    .query(({ ctx, input }) =>
      getLocalizedCampaignDraft(input, actorFromContext(ctx)),
    ),
  revisions: capabilityProcedure("content.readDraft")
    .input(localizedCampaignIdentityInputSchema)
    .query(({ ctx, input }) =>
      listLocalizedCampaignRevisions(input, actorFromContext(ctx)),
    ),
  create: capabilityProcedure("content.write")
    .input(createLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        createLocalizedCampaign(input, actorFromContext(ctx)),
      ),
    ),
  save: capabilityProcedure("content.write")
    .input(saveLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => saveLocalizedCampaign(input, actorFromContext(ctx))),
    ),
  schedule: capabilityProcedure("content.write")
    .input(scheduleLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        scheduleLocalizedCampaign(input, actorFromContext(ctx)),
      ),
    ),
  unschedule: capabilityProcedure("content.write")
    .input(mutateLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        unscheduleLocalizedCampaign(input, actorFromContext(ctx)),
      ),
    ),
  publish: capabilityProcedure("content.publish")
    .input(mutateLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        publishLocalizedCampaign(input, actorFromContext(ctx)),
      ),
    ),
  unpublish: capabilityProcedure("content.publish")
    .input(mutateLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        unpublishLocalizedCampaign(input, actorFromContext(ctx)),
      ),
    ),
  restore: capabilityProcedure("content.write")
    .input(restoreLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        restoreLocalizedCampaignRevision(input, actorFromContext(ctx)),
      ),
    ),
  delete: capabilityProcedure("content.delete")
    .input(mutateLocalizedCampaignInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        deleteLocalizedCampaign(input, actorFromContext(ctx)),
      ),
    ),
});
