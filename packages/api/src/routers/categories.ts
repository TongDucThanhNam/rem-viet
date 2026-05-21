import {
  categoryIdInputSchema,
  createCategory,
  createCategoryInputSchema,
  deleteCategory,
  listCategories,
  updateCategory,
  updateCategoryInputSchema,
} from "../services/categories";
import { protectedProcedure, publicProcedure, router } from "../index";

export const categoriesRouter = router({
  list: publicProcedure.query(() => listCategories()),
  create: protectedProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input }) => createCategory(input)),
  update: protectedProcedure
    .input(updateCategoryInputSchema)
    .mutation(({ input }) => updateCategory(input)),
  delete: protectedProcedure
    .input(categoryIdInputSchema)
    .mutation(({ input }) => deleteCategory(input)),
});
