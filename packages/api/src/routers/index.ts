import { protectedProcedure, publicProcedure, router } from "../index";
import { categoriesRouter } from "./categories";
import { contentRouter } from "./content";
import { governanceRouter } from "./governance";
import { logsRouter } from "./logs";
import { ordersRouter } from "./orders";
import { operationsRouter } from "./operations";
import { postsRouter } from "./posts";
import { productsRouter } from "./products";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  orders: ordersRouter,
  content: contentRouter,
  governance: governanceRouter,
  posts: postsRouter,
  products: productsRouter,
  categories: categoriesRouter,
  logs: logsRouter,
  operations: operationsRouter,
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
