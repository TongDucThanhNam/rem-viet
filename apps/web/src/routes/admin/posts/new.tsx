import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import CmsPostForm, {
  type CmsPostFormValues,
} from "@/components/cms-post-form";
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
    }),
  );

  return (
    <AdminShell title="Thêm bài viết">
      <CmsPostForm
        isSubmitting={createPost.isPending}
        submitLabel="Tạo bài viết"
        onSubmit={(values: CmsPostFormValues) => {
          createPost.mutate(values);
        }}
      />
    </AdminShell>
  );
}
