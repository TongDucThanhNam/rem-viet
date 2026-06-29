import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { cn } from "@rem-viet/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Edit, Eye, FileText, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts")({
  component: AdminPostsRoute,
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

type PostRow = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  status: "draft" | "published";
  publishDate?: string;
  updatedAt: string;
};

function formatDate(value?: string) {
  if (!value) {
    return "Chưa đặt";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN");
}

function postPublicPath(slug: string) {
  return `/bai-viet/${slug.endsWith(".html") ? slug : `${slug}.html`}`;
}

function AdminPostsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published"
  >("all");
  const postsQuery = useQuery(
    trpc.content.posts.adminList.queryOptions({}),
  );
  const deletePost = useMutation(
    trpc.content.posts.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.content.posts.adminList.queryFilter(),
        );
        toast.success("Đã xóa bài viết.");
      },
    }),
  );
  const posts = (postsQuery.data ?? []) as PostRow[];
  const filteredPosts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesSearch = keyword
        ? [post.title, post.slug, post.description]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      const matchesStatus =
        statusFilter === "all" ? true : post.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [posts, search, statusFilter]);

  return (
    <AdminShell hideHeading legacyContentFrame title="Bài viết">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold leading-8 tracking-normal">
                Bài viết
              </h1>
              <span className="hidden items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:flex">
                {filteredPosts.length}/{posts.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý bài blog public, draft và metadata SEO.
            </p>
          </div>
          <Link
            className={buttonVariants({ className: "gap-1", size: "sm" })}
            to="/admin/posts/new"
          >
            Thêm bài viết
            <Plus aria-hidden className="size-3.5" />
          </Link>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-10 pl-9"
              placeholder="Tìm bài viết..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="h-10 w-full rounded-none border border-input bg-background px-3 text-xs outline-none md:w-44"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "draft" | "published",
              )
            }
          >
            <option value="all">Tất cả</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {postsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Đang tải...
            </div>
          ) : filteredPosts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-1/3 px-4 py-3 font-semibold">
                      Tiêu đề
                    </th>
                    <th className="px-4 py-3 font-semibold">Slug</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Publish date</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post) => (
                    <tr className="border-b last:border-b-0" key={post._id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{post.title}</p>
                        {post.description ? (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {post.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {post.slug}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize",
                            post.status === "published"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-amber-500/10 text-amber-700",
                          )}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(post.publishDate)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(post.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-4">
                          <a
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            href={postPublicPath(post.slug)}
                            rel="noreferrer"
                            target="_blank"
                            title="Xem public"
                          >
                            <Eye aria-hidden className="size-5" />
                          </a>
                          <Link
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            params={{ postId: post._id }}
                            title="Sửa bài viết"
                            to="/admin/posts/$postId/edit"
                          >
                            <Edit aria-hidden className="size-5" />
                          </Link>
                          <Button
                            className="h-auto w-auto bg-transparent p-0 text-pink-600 hover:bg-transparent"
                            disabled={deletePost.isPending}
                            title="Xóa bài viết"
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Xóa ${post.title}?`)) {
                                deletePost.mutate({ postId: post._id });
                              }
                            }}
                          >
                            <Trash2 aria-hidden className="size-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText aria-hidden className="size-8 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-medium">Chưa có bài viết</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tạo draft đầu tiên để bắt đầu quản lý nội dung.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
