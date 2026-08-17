import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AdminPageHeader,
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts/")({
  component: AdminPostsRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.q === "string" && search.q.trim() ? { q: search.q } : {}),
    ...(search.status === "draft" || search.status === "published"
      ? { status: search.status }
      : {}),
  }),
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
  const { session } = Route.useRouteContext();
  const canDelete =
    session?.staffRole === "owner" || session?.staffRole === "admin";
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { q: search = "", status: statusFilter } = Route.useSearch();
  const postsQuery = useQuery(trpc.content.posts.adminList.queryOptions({}));
  const deletePost = useMutation(
    trpc.content.posts.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.content.posts.adminList.queryFilter(),
        );
        toast.success("Đã xóa bài viết.");
      },
      onError: (error) => toast.error(error.message),
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
        statusFilter === undefined ? true : post.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [posts, search, statusFilter]);

  function updateSearch(next: {
    q?: string;
    status?: "draft" | "published" | "";
  }) {
    navigate({
      replace: true,
      search: (current) => {
        const merged = { ...current, ...next };
        return {
          ...(merged.q?.trim() ? { q: merged.q } : {}),
          ...(merged.status ? { status: merged.status } : {}),
        };
      },
    });
  }

  return (
    <AdminShell hideHeading>
      <div className="grid gap-5">
        <AdminPageHeader
          actions={
            <Link
              className={buttonVariants({ className: "gap-1", size: "sm" })}
              to="/admin/posts/new"
            >
              <Plus aria-hidden className="size-3.5" />
              Thêm bài viết
            </Link>
          }
          eyebrow={`${filteredPosts.length} trên ${posts.length} bài viết`}
        />

        <section
          aria-label="Công cụ danh sách bài viết"
          className="flex flex-col gap-3 border p-3 md:flex-row md:items-end"
        >
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Tìm kiếm bài viết"
              className="pl-9"
              placeholder="Tìm tiêu đề, slug hoặc mô tả"
              value={search}
              onChange={(event) => updateSearch({ q: event.target.value })}
            />
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Trạng thái
            <select
              aria-label="Lọc trạng thái bài viết"
              className="h-9 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-44"
              value={statusFilter ?? ""}
              onChange={(event) =>
                updateSearch({
                  status: event.target.value as "draft" | "published" | "",
                })
              }
            >
              <option value="">Tất cả</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
            </select>
          </label>
        </section>

        <div className="overflow-hidden border bg-background">
          {postsQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Đang tải bài viết…
            </div>
          ) : postsQuery.isError ? (
            <AsyncState
              action={
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => postsQuery.refetch()}
                >
                  Thử lại
                </Button>
              }
              description="Kết nối dữ liệu gặp sự cố. Bộ lọc hiện tại vẫn được giữ lại."
              title="Không thể tải bài viết"
              tone="error"
            />
          ) : filteredPosts.length ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Tiêu đề</TableHead>
                    <TableHead>Đường dẫn</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày xuất bản</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Hành động</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post) => (
                    <TableRow key={post._id}>
                      <TableCell>
                        <p className="font-medium">{post.title}</p>
                        {post.description ? (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {post.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {post.slug}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={
                            post.status === "published" ? "success" : "warning"
                          }
                        >
                          {post.status === "published"
                            ? "Đã xuất bản"
                            : "Bản nháp"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{formatDate(post.publishDate)}</TableCell>
                      <TableCell>{formatDate(post.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {post.status === "published" ? (
                            <a
                              aria-label={`Xem public ${post.title}`}
                              className={buttonVariants({
                                size: "icon-sm",
                                variant: "ghost",
                              })}
                              href={postPublicPath(post.slug)}
                              rel="noreferrer"
                              target="_blank"
                              title="Xem public"
                            >
                              <Eye aria-hidden className="size-5" />
                            </a>
                          ) : (
                            <Link
                              aria-label={`Xem bản nháp ${post.title}`}
                              className={buttonVariants({
                                size: "icon-sm",
                                variant: "ghost",
                              })}
                              params={{ postId: post._id }}
                              target="_blank"
                              title="Xem bản nháp"
                              to="/admin/posts/$postId/preview"
                            >
                              <Eye aria-hidden className="size-5" />
                            </Link>
                          )}
                          <Link
                            aria-label={`Sửa ${post.title}`}
                            className={buttonVariants({
                              size: "icon-sm",
                              variant: "ghost",
                            })}
                            params={{ postId: post._id }}
                            title="Sửa bài viết"
                            to="/admin/posts/$postId/edit"
                          >
                            <Edit aria-hidden className="size-5" />
                          </Link>
                          {canDelete ? (
                            <ConfirmDestructiveAction
                              description={
                                <>
                                  Bài viết <strong>{post.title}</strong> sẽ bị
                                  xóa. Bạn có chắc muốn tiếp tục?
                                </>
                              }
                              pending={deletePost.isPending}
                              title={`Xóa “${post.title}”?`}
                              trigger={
                                <Button
                                  aria-label={`Xóa ${post.title}`}
                                  className="text-destructive hover:text-destructive"
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 aria-hidden className="size-4" />
                                </Button>
                              }
                              onConfirm={async () => {
                                await deletePost.mutateAsync({
                                  postId: post._id,
                                });
                              }}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <AsyncState
              action={
                search || statusFilter ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => updateSearch({ q: "", status: "" })}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <Link
                    className={buttonVariants({ size: "sm" })}
                    to="/admin/posts/new"
                  >
                    <Plus aria-hidden className="size-3.5" />
                    Thêm bài viết
                  </Link>
                )
              }
              description={
                search || statusFilter
                  ? "Không có bài viết phù hợp. Hãy đổi từ khóa hoặc trạng thái."
                  : "Tạo bản nháp đầu tiên để bắt đầu quản lý nội dung."
              }
              title={
                search || statusFilter
                  ? "Không tìm thấy bài viết"
                  : "Chưa có bài viết"
              }
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
