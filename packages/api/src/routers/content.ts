import { roleHasCapability, type CmsCapability } from "@rem-viet/cms";

import { capabilityProcedure, publicProcedure, router } from "../index";
import {
  createMediaRecord,
  createMediaInputSchema,
  createPage,
  createPageInputSchema,
  adminListPages,
  deleteMedia,
  deletePage,
  deletePageInputSchema,
  getMenuByLocation,
  getPageById,
  getPageBySlug,
  getSiteSettings,
  globalRevisionInputSchema,
  listMedia,
  listMenuRevisions,
  listMenus,
  listPages,
  listSiteSettingsRevisions,
  listPagesInputSchema,
  mediaIdInputSchema,
  menuLocationInputSchema,
  menuRevisionInputSchema,
  pageIdInputSchema,
  pageSlugInputSchema,
  updateMedia,
  updateMediaInputSchema,
  updateMenu,
  updateMenuInputSchema,
  updatePage,
  updatePageInputSchema,
  updateSiteSettings,
  updateSiteSettingsInputSchema,
  restoreMenuRevision,
  restoreSiteSettingsRevision,
} from "../services/content";
import {
  listPageRevisions,
  pageRevisionInputSchema,
  publishPage,
  publishPageInputSchema,
  restorePageRevision,
  schedulePage,
  schedulePageInputSchema,
  unschedulePage,
  unschedulePageInputSchema,
  unpublishPage,
  unpublishPageInputSchema,
  type CmsActor,
} from "../services/content-revisions";
import { postsRouter } from "./posts";
import { runCmsWorkflow } from "../workflow-error";
import {
  decideEditorialReview,
  decideEditorialReviewInputSchema,
  editorialReviewTargetSchema,
  getEditorialReviewState,
  listEditorialReviewQueue,
  requestEditorialReview,
  requestEditorialReviewInputSchema,
} from "../services/editorial-reviews";
import {
  createRemVietHomePage,
  deleteRemVietHomePage,
  isRemVietHomePage,
  listRemVietHomeRevisions,
  publishRemVietHomePage,
  restoreRemVietHomeRevision,
  scheduleRemVietHomePage,
  unscheduleRemVietHomePage,
  unpublishRemVietHomePage,
  canUseRemVietHomeDraftUpdate,
  saveRemVietHomeDraft,
} from "../services/home-page-runtime";
import {
  canUseRemVietStandardDraftUpdate,
  createRemVietStandardPage,
  createRemVietStandardPageProvider,
  deleteRemVietStandardPage,
  hasRemVietStandardPageProviderBinding,
  isRemVietStandardPage,
  listRemVietStandardPageRevisions,
  publishRemVietStandardPage,
  restoreRemVietStandardPageRevision,
  saveRemVietStandardPageDraft,
  scheduleRemVietStandardPage,
  unscheduleRemVietStandardPage,
  unpublishRemVietStandardPage,
} from "../services/standard-page-runtime";

type StaffContext = {
  requestId: string;
  session: { user: { id: string; email?: string | null } };
  staffRole: "owner" | "admin" | "editor";
};

function actorFromContext(ctx: StaffContext): CmsActor {
  return {
    userId: ctx.session.user.id,
    email: ctx.session.user.email ?? "",
    role: ctx.staffRole,
    requestId: ctx.requestId,
  };
}

export const pagesRouter = router({
  capabilities: capabilityProcedure("content.readDraft").query(({ ctx }) => {
    const provider = createRemVietStandardPageProvider().capabilities;
    return {
      provider,
      granted: provider.supported.filter(
        (capability): capability is CmsCapability =>
          roleHasCapability(ctx.staffRole, capability),
      ),
    };
  }),
  list: publicProcedure
    .input(listPagesInputSchema)
    .query(({ input }) => listPages(input)),
  bySlug: publicProcedure
    .input(pageSlugInputSchema)
    .query(({ input }) => getPageBySlug(input)),
  adminList: capabilityProcedure("content.readDraft")
    .input(listPagesInputSchema)
    .query(({ input }) => adminListPages(input)),
  byId: capabilityProcedure("content.readDraft")
    .input(pageIdInputSchema)
    .query(({ input }) => getPageById(input)),
  revisions: capabilityProcedure("content.readDraft")
    .input(pageIdInputSchema)
    .query(async ({ input }) => {
      if (await isRemVietHomePage(input.pageId)) {
        return listRemVietHomeRevisions(input.pageId);
      }
      return (await isRemVietStandardPage(input.pageId))
        ? listRemVietStandardPageRevisions(input.pageId)
        : listPageRevisions(input.pageId);
    }),
  create: capabilityProcedure("content.write")
    .input(createPageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        const actor = actorFromContext(ctx);
        if (input.template === "landing" && input.slug === "home") {
          const created = await createRemVietHomePage(input, actor);
          const reloaded = await getPageById({ pageId: created.id });
          return {
            ...reloaded,
            message:
              input.status === "published"
                ? "Page created and published"
                : "Page created",
            statusCode: 201,
          };
        }
        if (
          input.template === "standard" &&
          hasRemVietStandardPageProviderBinding()
        ) {
          const created = await createRemVietStandardPage(input, actor);
          const reloaded = await getPageById({ pageId: created.id });
          return {
            ...reloaded,
            message:
              input.status === "published"
                ? "Page created and published"
                : "Page created",
            statusCode: 201,
          };
        }
        return createPage(input, actor);
      }),
    ),
  update: capabilityProcedure("content.write")
    .input(updatePageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        if (
          canUseRemVietHomeDraftUpdate(input) &&
          (await isRemVietHomePage(input.pageId))
        ) {
          await saveRemVietHomeDraft(input, actorFromContext(ctx));
          const reloaded = await getPageById({ pageId: input.pageId });
          return { ...reloaded, message: "Page updated" };
        }
        if (
          (await isRemVietStandardPage(input.pageId)) &&
          (await canUseRemVietStandardDraftUpdate(input))
        ) {
          const saved = await saveRemVietStandardPageDraft(
            input,
            actorFromContext(ctx),
          );
          if (input.status === "published") {
            await publishRemVietStandardPage(
              { pageId: input.pageId, expectedVersion: saved.version },
              actorFromContext(ctx),
            );
          }
          const reloaded = await getPageById({ pageId: input.pageId });
          return { ...reloaded, message: "Page updated" };
        }
        return updatePage(input, actorFromContext(ctx));
      }),
    ),
  publish: capabilityProcedure("content.publish")
    .input(publishPageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(
        async () => {
          if (await isRemVietHomePage(input.pageId)) {
            return publishRemVietHomePage(input, actorFromContext(ctx));
          }
          return (await isRemVietStandardPage(input.pageId))
            ? publishRemVietStandardPage(input, actorFromContext(ctx))
            : publishPage(input, actorFromContext(ctx));
        },
        {
          category: "publish",
          operation: "page.publish.interactive",
          source: "request",
          entityType: "page",
          entityId: input.pageId,
          requestId: ctx.requestId,
          recoverable: true,
        },
      ),
    ),
  unpublish: capabilityProcedure("content.publish")
    .input(unpublishPageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        if (await isRemVietHomePage(input.pageId)) {
          return unpublishRemVietHomePage(input, actorFromContext(ctx));
        }
        return (await isRemVietStandardPage(input.pageId))
          ? unpublishRemVietStandardPage(input, actorFromContext(ctx))
          : unpublishPage(input, actorFromContext(ctx));
      }),
    ),
  restore: capabilityProcedure("content.restore")
    .input(pageRevisionInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        if (await isRemVietHomePage(input.pageId)) {
          return restoreRemVietHomeRevision(input, actorFromContext(ctx));
        }
        return (await isRemVietStandardPage(input.pageId))
          ? restoreRemVietStandardPageRevision(input, actorFromContext(ctx))
          : restorePageRevision(input, actorFromContext(ctx));
      }),
    ),
  schedule: capabilityProcedure("content.schedule")
    .input(schedulePageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        if (await isRemVietHomePage(input.pageId)) {
          return scheduleRemVietHomePage(input, actorFromContext(ctx));
        }
        return (await isRemVietStandardPage(input.pageId))
          ? scheduleRemVietStandardPage(input, actorFromContext(ctx))
          : schedulePage(input, actorFromContext(ctx));
      }),
    ),
  unschedule: capabilityProcedure("content.schedule")
    .input(unschedulePageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        if (await isRemVietHomePage(input.pageId)) {
          return unscheduleRemVietHomePage(input, actorFromContext(ctx));
        }
        return (await isRemVietStandardPage(input.pageId))
          ? unscheduleRemVietStandardPage(input, actorFromContext(ctx))
          : unschedulePage(input, actorFromContext(ctx));
      }),
    ),
  delete: capabilityProcedure("content.delete")
    .input(deletePageInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(async () => {
        const existing = await getPageById({ pageId: input.pageId });
        if (await isRemVietHomePage(input.pageId)) {
          await deleteRemVietHomePage(input, actorFromContext(ctx));
        } else if (await isRemVietStandardPage(input.pageId)) {
          await deleteRemVietStandardPage(input, actorFromContext(ctx));
        } else {
          return deletePage(input, actorFromContext(ctx));
        }
        return {
          ...existing,
          message: "Page deleted",
          statusCode: existing.data ? 200 : 404,
        };
      }),
    ),
});

export const mediaRouter = router({
  list: capabilityProcedure("media.manage").query(() => listMedia()),
  create: capabilityProcedure("media.manage")
    .input(createMediaInputSchema)
    .mutation(({ ctx, input }) =>
      createMediaRecord(input, actorFromContext(ctx)),
    ),
  update: capabilityProcedure("media.manage")
    .input(updateMediaInputSchema)
    .mutation(({ ctx, input }) => updateMedia(input, actorFromContext(ctx))),
  delete: capabilityProcedure("media.delete")
    .input(mediaIdInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => deleteMedia(input, actorFromContext(ctx))),
    ),
});

export const menusRouter = router({
  list: publicProcedure.query(() => listMenus()),
  byLocation: publicProcedure
    .input(menuLocationInputSchema)
    .query(({ input }) => getMenuByLocation(input)),
  revisions: capabilityProcedure("settings.manage")
    .input(menuLocationInputSchema)
    .query(({ input }) => listMenuRevisions(input)),
  update: capabilityProcedure("settings.manage")
    .input(updateMenuInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => updateMenu(input, actorFromContext(ctx))),
    ),
  restore: capabilityProcedure("settings.manage")
    .input(menuRevisionInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => restoreMenuRevision(input, actorFromContext(ctx))),
    ),
});

export const siteSettingsRouter = router({
  get: publicProcedure.query(() => getSiteSettings()),
  revisions: capabilityProcedure("settings.manage").query(() =>
    listSiteSettingsRevisions(),
  ),
  update: capabilityProcedure("settings.manage")
    .input(updateSiteSettingsInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => updateSiteSettings(input, actorFromContext(ctx))),
    ),
  restore: capabilityProcedure("settings.manage")
    .input(globalRevisionInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        restoreSiteSettingsRevision(input, actorFromContext(ctx)),
      ),
    ),
});

export const editorialReviewsRouter = router({
  byDocument: capabilityProcedure("content.readDraft")
    .input(editorialReviewTargetSchema)
    .query(({ input }) => getEditorialReviewState(input)),
  queue: capabilityProcedure("content.review.decide").query(() =>
    listEditorialReviewQueue(),
  ),
  request: capabilityProcedure("content.review.request")
    .input(requestEditorialReviewInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() =>
        requestEditorialReview(input, actorFromContext(ctx)),
      ),
    ),
  decide: capabilityProcedure("content.review.decide")
    .input(decideEditorialReviewInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => decideEditorialReview(input, actorFromContext(ctx))),
    ),
});

export const contentRouter = router({
  posts: postsRouter,
  pages: pagesRouter,
  reviews: editorialReviewsRouter,
  media: mediaRouter,
  menus: menusRouter,
  siteSettings: siteSettingsRouter,
});
