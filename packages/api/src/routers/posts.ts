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
import {
  listPostRevisions,
  postRevisionInputSchema,
  publishPost,
  publishPostInputSchema,
  restorePostRevision,
  schedulePost,
  schedulePostInputSchema,
  unschedulePost,
  unschedulePostInputSchema,
  unpublishPost,
  unpublishPostInputSchema,
  type CmsActor,
} from "../services/content-revisions";
import { capabilityProcedure, publicProcedure, router } from "../index";
import { runCmsWorkflow } from "../workflow-error";

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

export const postsRouter = router({
  list: publicProcedure
    .input(listPostsInputSchema)
    .query(({ input }) => listPosts(input)),
  bySlug: publicProcedure
    .input(postSlugInputSchema)
    .query(({ input }) => getPostBySlug(input)),
  adminList: capabilityProcedure("content.readDraft")
    .input(adminListPostsInputSchema)
    .query(({ input }) => adminListPosts(input)),
  adminBySlug: capabilityProcedure("content.readDraft")
    .input(postSlugInputSchema)
    .query(({ input }) => adminGetPostBySlug(input)),
  byId: capabilityProcedure("content.readDraft")
    .input(postIdInputSchema)
    .query(({ input }) => getPostById(input)),
  revisions: capabilityProcedure("content.readDraft")
    .input(postIdInputSchema)
    .query(({ input }) => listPostRevisions(input.postId)),
  create: capabilityProcedure("content.write")
    .input(createPostInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => createPost(input, actorFromContext(ctx))),
    ),
  update: capabilityProcedure("content.write")
    .input(updatePostInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => updatePost(input, actorFromContext(ctx))),
    ),
  publish: capabilityProcedure("content.publish")
    .input(publishPostInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => publishPost(input, actorFromContext(ctx)), {
        category: "publish",
        operation: "post.publish.interactive",
        source: "request",
        entityType: "post",
        entityId: input.postId,
        requestId: ctx.requestId,
        recoverable: true,
      }),
    ),
  unpublish: capabilityProcedure("content.publish")
    .input(unpublishPostInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => unpublishPost(input, actorFromContext(ctx))),
    ),
  restore: capabilityProcedure("content.restore")
    .input(postRevisionInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => restorePostRevision(input, actorFromContext(ctx))),
    ),
  schedule: capabilityProcedure("content.schedule")
    .input(schedulePostInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => schedulePost(input, actorFromContext(ctx))),
    ),
  unschedule: capabilityProcedure("content.schedule")
    .input(unschedulePostInputSchema)
    .mutation(({ ctx, input }) =>
      runCmsWorkflow(() => unschedulePost(input, actorFromContext(ctx))),
    ),
  delete: capabilityProcedure("content.delete")
    .input(postIdInputSchema)
    .mutation(({ ctx, input }) => deletePost(input, actorFromContext(ctx))),
});
