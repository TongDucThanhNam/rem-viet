import { buttonVariants } from "@rem-viet/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import CmsPostForm, {
  type CmsPostFormValues,
} from "@/components/cms-post-form";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts/$postId/edit")({
  component: EditPostRoute,
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

function EditPostRoute() {
  const { postId } = Route.useParams();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const postQuery = useQuery(
    trpc.content.posts.byId.queryOptions({ postId }),
  );
  const updatePost = useMutation(
    trpc.content.posts.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.content.posts.adminList.queryFilter(),
        );
        queryClient.invalidateQueries(
          trpc.content.posts.byId.queryFilter({ postId }),
        );
        toast.success("Đã cập nhật bài viết.");
        navigate({ to: "/admin/posts" });
      },
    }),
  );
  const post = postQuery.data?.data;

  return (
    <AdminShell title="Sửa bài viết">
      {postQuery.isLoading ? (
        <div className="mx-auto min-h-80 w-full max-w-4xl animate-pulse rounded-md border bg-muted/30" />
      ) : post ? (
        <CmsPostForm
          key={post._id}
          initialValues={{
            title: post.title,
            slug: post.slug,
            description: post.description,
            coverImage: post.coverImage,
            tags: post.tags,
            content:
              typeof post.content === "string"
                ? post.content
                : JSON.stringify(post.content, null, 2),
            status: post.status,
            publishDate: post.publishDate,
            seoTitle: post.seoTitle,
            seoDescription: post.seoDescription,
          }}
          isSubmitting={updatePost.isPending}
          submitLabel="Lưu thay đổi"
          onSubmit={(values: CmsPostFormValues) => {
            updatePost.mutate({
              postId,
              ...values,
            });
          }}
        />
      ) : (
        <div className="mx-auto flex min-h-80 w-full max-w-4xl flex-col items-center justify-center gap-3 border text-center">
          <FileText aria-hidden className="size-8 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-medium">Không tìm thấy bài viết</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bản ghi này không còn tồn tại.
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: "secondary" })}
            to="/admin/posts"
          >
            Quay lại danh sách
          </Link>
        </div>
      )}
    </AdminShell>
  );
}
