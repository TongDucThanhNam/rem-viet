import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin-shell";
import type { CmsPostFormValues } from "@/components/cms-post-form";
import PostEditorWorkspace from "@/components/post-editor-workspace";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts/new")({
  component: NewPostRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
});

function NewPostRoute() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createPost = useMutation(
    trpc.content.posts.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.content.posts.adminList.queryFilter(),
        );
        toast.success("Đã tạo bài viết.");
        navigate({ to: "/admin/posts" });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <AdminPage>
      <PostEditorWorkspace
        documentId="new"
        formProps={{
          isSubmitting: createPost.isPending,
          submitLabel: "Tạo bài viết",
          onSubmit: (values: CmsPostFormValues) => {
            createPost.mutate(values);
          },
        }}
      />
    </AdminPage>
  );
}
