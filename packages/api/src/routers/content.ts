import { protectedProcedure, publicProcedure, router } from "../index";
import {
  createMediaRecord,
  createMediaInputSchema,
  createPage,
  createPageInputSchema,
  adminListPages,
  deleteMedia,
  deletePage,
  getMenuByLocation,
  getPageById,
  getPageBySlug,
  getSiteSettings,
  listMedia,
  listMenus,
  listPages,
  listPagesInputSchema,
  mediaIdInputSchema,
  menuLocationInputSchema,
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
} from "../services/content";
import { postsRouter } from "./posts";

export const pagesRouter = router({
  list: publicProcedure.input(listPagesInputSchema).query(({ input }) => listPages(input)),
  bySlug: publicProcedure.input(pageSlugInputSchema).query(({ input }) => getPageBySlug(input)),
  adminList: protectedProcedure
    .input(listPagesInputSchema)
    .query(({ input }) => adminListPages(input)),
  byId: protectedProcedure
    .input(pageIdInputSchema)
    .query(({ input }) => getPageById(input)),
  create: protectedProcedure
    .input(createPageInputSchema)
    .mutation(({ input }) => createPage(input)),
  update: protectedProcedure
    .input(updatePageInputSchema)
    .mutation(({ input }) => updatePage(input)),
  delete: protectedProcedure
    .input(pageIdInputSchema)
    .mutation(({ input }) => deletePage(input)),
});

export const mediaRouter = router({
  list: protectedProcedure.query(() => listMedia()),
  create: protectedProcedure
    .input(createMediaInputSchema)
    .mutation(({ input }) => createMediaRecord(input)),
  update: protectedProcedure
    .input(updateMediaInputSchema)
    .mutation(({ input }) => updateMedia(input)),
  delete: protectedProcedure
    .input(mediaIdInputSchema)
    .mutation(({ input }) => deleteMedia(input)),
});

export const menusRouter = router({
  list: publicProcedure.query(() => listMenus()),
  byLocation: publicProcedure
    .input(menuLocationInputSchema)
    .query(({ input }) => getMenuByLocation(input)),
  update: protectedProcedure
    .input(updateMenuInputSchema)
    .mutation(({ input }) => updateMenu(input)),
});

export const siteSettingsRouter = router({
  get: publicProcedure.query(() => getSiteSettings()),
  update: protectedProcedure
    .input(updateSiteSettingsInputSchema)
    .mutation(({ input }) => updateSiteSettings(input)),
});

export const contentRouter = router({
  posts: postsRouter,
  pages: pagesRouter,
  media: mediaRouter,
  menus: menusRouter,
  siteSettings: siteSettingsRouter,
});
