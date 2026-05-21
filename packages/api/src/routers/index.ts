import { protectedProcedure, publicProcedure, router } from "../index";
import { categoriesRouter } from "./categories";
import { logsRouter } from "./logs";
import { ordersRouter } from "./orders";
import { postsRouter } from "./posts";
import { productsRouter } from "./products";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  orders: ordersRouter,
  posts: postsRouter,
  products: productsRouter,
  categories: categoriesRouter,
  logs: logsRouter,
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
