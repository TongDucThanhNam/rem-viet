import { getPostBySlug, listPosts, listPostsInputSchema, postSlugInputSchema } from "../services/posts";
import { publicProcedure, router } from "../index";

export const postsRouter = router({
  list: publicProcedure.input(listPostsInputSchema).query(({ input }) => listPosts(input)),
  bySlug: publicProcedure.input(postSlugInputSchema).query(({ input }) => getPostBySlug(input)),
});
