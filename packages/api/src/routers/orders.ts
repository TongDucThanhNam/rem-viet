import {
  createCartOrder,
  createCartOrderInputSchema,
  createNewsletterInputSchema,
  createNewsletterSubscription,
  createProductOrder,
  createProductOrderInputSchema,
  listOrders,
  updateOrderStatus,
  updateOrderStatusInputSchema,
} from "../services/orders";
import { protectedProcedure, publicProcedure, router } from "../index";

export const ordersRouter = router({
  list: protectedProcedure.query(() => listOrders()),
  updateStatus: protectedProcedure
    .input(updateOrderStatusInputSchema)
    .mutation(({ input }) => updateOrderStatus(input)),
  createCart: publicProcedure
    .input(createCartOrderInputSchema)
    .mutation(({ input }) => createCartOrder(input)),
  createProduct: publicProcedure
    .input(createProductOrderInputSchema)
    .mutation(({ input }) => createProductOrder(input)),
  newsletter: publicProcedure
    .input(createNewsletterInputSchema)
    .mutation(({ input }) => createNewsletterSubscription(input)),
});
