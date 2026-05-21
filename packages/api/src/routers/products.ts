import {
  createProduct,
  createProductInputSchema,
  deleteProduct,
  getProductById,
  getProductWithVariantsById,
  listProducts,
  listProductsInputSchema,
  productIdInputSchema,
  publicProductIdInputSchema,
  updateProduct,
  updateProductInputSchema,
} from "../services/products";
import { protectedProcedure, publicProcedure, router } from "../index";

export const productsRouter = router({
  list: publicProcedure
    .input(listProductsInputSchema)
    .query(({ input }) => listProducts(input)),
  adminList: protectedProcedure
    .input(listProductsInputSchema)
    .query(({ input }) => listProducts({ ...input, includeInactive: true })),
  byId: publicProcedure
    .input(publicProductIdInputSchema)
    .query(({ input }) => getProductById(input)),
  withVariants: publicProcedure
    .input(publicProductIdInputSchema)
    .query(({ input }) => getProductWithVariantsById(input)),
  adminWithVariants: protectedProcedure
    .input(productIdInputSchema)
    .query(({ input }) =>
      getProductWithVariantsById({ ...input, includeInactive: true }),
    ),
  create: protectedProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),
  update: protectedProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),
  delete: protectedProcedure
    .input(productIdInputSchema)
    .mutation(({ input }) => deleteProduct(input)),
});
