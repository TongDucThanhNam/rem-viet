import {
  adminGetPostBySlug,
  adminListPosts,
  adminListPostsInputSchema,
  createPost,
  createPostInputSchema,
  deletePost,
  getPostById,
  getPostBySlug,
  listPosts,
  listPostsInputSchema,
  postIdInputSchema,
  postSlugInputSchema,
  updatePost,
  updatePostInputSchema,
} from "../services/posts";
import { protectedProcedure, publicProcedure, router } from "../index";

export const postsRouter = router({
  list: publicProcedure.input(listPostsInputSchema).query(({ input }) => listPosts(input)),
  bySlug: publicProcedure.input(postSlugInputSchema).query(({ input }) => getPostBySlug(input)),
  adminList: protectedProcedure
    .input(adminListPostsInputSchema)
    .query(({ input }) => adminListPosts(input)),
  adminBySlug: protectedProcedure
    .input(postSlugInputSchema)
    .query(({ input }) => adminGetPostBySlug(input)),
  byId: protectedProcedure
    .input(postIdInputSchema)
    .query(({ input }) => getPostById(input)),
  create: protectedProcedure
    .input(createPostInputSchema)
    .mutation(({ input }) => createPost(input)),
  update: protectedProcedure
    .input(updatePostInputSchema)
    .mutation(({ input }) => updatePost(input)),
  delete: protectedProcedure
    .input(postIdInputSchema)
    .mutation(({ input }) => deletePost(input)),
});
