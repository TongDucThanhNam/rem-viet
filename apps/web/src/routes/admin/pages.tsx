import type { PageBlock } from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { cn } from "@rem-viet/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import MediaPickerField from "@/components/media-picker-field";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/pages")({
  component: AdminPagesRoute,
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

type PageRow = {
  _id: string;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
};

const emptyBlocks: PageBlock[] = [
  {
    type: "hero",
    title: "Tiêu đề trang",
    subtitle: "Mô tả ngắn cho hero",
    image: "",
  },
];

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN");
}

function AdminPagesRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pagesQuery = useQuery(
    trpc.content.pages.adminList.queryOptions({}),
  );
  const [editingPage, setEditingPage] = useState<PageRow | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [blocksJson, setBlocksJson] = useState(
    JSON.stringify(emptyBlocks, null, 2),
  );
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pages = (pagesQuery.data ?? []) as PageRow[];
  const sortedPages = useMemo(
    () =>
      [...pages].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    [pages],
  );
  const createPage = useMutation(
    trpc.content.pages.create.mutationOptions({
      onSuccess: () => {
        resetForm();
        queryClient.invalidateQueries(
          trpc.content.pages.adminList.queryFilter(),
        );
        toast.success("Đã tạo page.");
      },
    }),
  );
  const updatePage = useMutation(
    trpc.content.pages.update.mutationOptions({
      onSuccess: () => {
        resetForm();
        queryClient.invalidateQueries(
          trpc.content.pages.adminList.queryFilter(),
        );
        toast.success("Đã cập nhật page.");
      },
    }),
  );
  const deletePage = useMutation(
    trpc.content.pages.delete.mutationOptions({
      onSuccess: () => {
        resetForm();
        queryClient.invalidateQueries(
          trpc.content.pages.adminList.queryFilter(),
        );
        toast.success("Đã xóa page.");
      },
    }),
  );

  useEffect(() => {
    if (!editingPage) {
      return;
    }

    setTitle(editingPage.title);
    setSlug(editingPage.slug);
    setStatus(editingPage.status);
    setBlocksJson(JSON.stringify(editingPage.blocks ?? [], null, 2));
    setSeoTitle(editingPage.seoTitle);
    setSeoDescription(editingPage.seoDescription);
  }, [editingPage]);

  function resetForm() {
    setEditingPage(null);
    setTitle("");
    setSlug("");
    setStatus("draft");
    setBlocksJson(JSON.stringify(emptyBlocks, null, 2));
    setSeoTitle("");
    setSeoDescription("");
    setError(null);
  }

  function parseBlocks() {
    try {
      const parsed = JSON.parse(blocksJson) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error("Blocks phải là JSON array.");
      }

      return parsed as PageBlock[];
    } catch (parseError) {
      throw new Error(
        parseError instanceof Error
          ? parseError.message
          : "Blocks JSON không hợp lệ.",
      );
    }
  }

  function insertImageIntoBlocks(url: string) {
    if (!url) {
      return;
    }

    try {
      const parsed = JSON.parse(blocksJson) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error("Blocks phải là JSON array.");
      }

      const blocks = parsed as PageBlock[];
      const heroBlock = blocks.find((block) => block.type === "hero");

      if (heroBlock?.type === "hero") {
        heroBlock.image = url;
      } else {
        blocks.unshift({
          image: url,
          subtitle: "",
          title: title || "Hero",
          type: "hero",
        });
      }

      setBlocksJson(JSON.stringify(blocks, null, 2));
      setError(null);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Blocks JSON không hợp lệ.",
      );
    }
  }

  function submitPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextTitle = title.trim();

    if (!nextTitle) {
      setError("Tiêu đề là bắt buộc.");
      return;
    }

    let blocks: PageBlock[];

    try {
      blocks = parseBlocks();
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Blocks JSON không hợp lệ.",
      );
      return;
    }

    const payload = {
      title: nextTitle,
      slug: slug.trim() || undefined,
      status,
      blocks,
      seoTitle,
      seoDescription,
    };

    if (editingPage) {
      updatePage.mutate({
        pageId: editingPage._id,
        ...payload,
      });
      return;
    }

    createPage.mutate(payload);
  }

  return (
    <AdminShell hideHeading legacyContentFrame title="Pages">
      <div className="mx-auto my-14 grid w-full max-w-[95rem] gap-4 lg:grid-cols-[1fr_30rem] lg:px-6">
        <section className="grid content-start gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-8 tracking-normal">
                Pages
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Quản lý pages bằng JSON blocks V1.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={resetForm}>
              <Plus aria-hidden />
              Tạo mới
            </Button>
          </div>

          <Card className="rounded-md border bg-background">
            <CardContent className="p-0">
              {pagesQuery.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Đang tải...
                </div>
              ) : sortedPages.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="border-b bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Title</th>
                        <th className="px-4 py-3 font-semibold">Slug</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Updated</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPages.map((page) => (
                        <tr className="border-b last:border-b-0" key={page._id}>
                          <td className="px-4 py-3 font-medium">
                            {page.title}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {page.slug}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize",
                                page.status === "published"
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-amber-500/10 text-amber-700",
                              )}
                            >
                              {page.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(page.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-4">
                              <Button
                                className="h-auto w-auto bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingPage(page)}
                              >
                                Edit
                              </Button>
                              <Button
                                className="h-auto w-auto bg-transparent p-0 text-pink-600 hover:bg-transparent"
                                disabled={deletePage.isPending}
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  if (window.confirm(`Xóa ${page.title}?`)) {
                                    deletePage.mutate({ pageId: page._id });
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
                  <FileText
                    aria-hidden
                    className="size-8 text-muted-foreground"
                  />
                  <div>
                    <h2 className="text-sm font-medium">Chưa có page</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Page mới sẽ hiển thị ở đây.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <form className="grid content-start gap-4" onSubmit={submitPage}>
          <Card className="rounded-md border bg-background">
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {editingPage ? "Sửa page" : "Tạo page"}
                </h2>
                {editingPage ? (
                  <Button
                    aria-label="Hủy edit"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="page-title">Title</Label>
                <Input
                  id="page-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-slug">Slug</Label>
                <Input
                  id="page-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-status">Status</Label>
                <select
                  className="h-8 rounded-none border border-input bg-background px-2.5 text-xs outline-none"
                  id="page-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as "draft" | "published")
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-blocks">Blocks JSON</Label>
                <textarea
                  className="min-h-72 rounded-none border border-input bg-background px-2.5 py-2 font-mono text-xs leading-6 outline-none"
                  id="page-blocks"
                  value={blocksJson}
                  onChange={(event) => setBlocksJson(event.target.value)}
                />
              </div>
              <MediaPickerField
                helpText="Chọn ảnh để chèn vào hero.image trong blocks JSON."
                id="page-image-helper"
                label="Chèn ảnh vào blocks"
                value=""
                onChange={insertImageIntoBlocks}
              />
              <div className="grid gap-2">
                <Label htmlFor="page-seo-title">SEO title</Label>
                <Input
                  id="page-seo-title"
                  value={seoTitle}
                  onChange={(event) => setSeoTitle(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-seo-description">SEO description</Label>
                <textarea
                  className="min-h-20 rounded-none border border-input bg-background px-2.5 py-2 text-xs outline-none"
                  id="page-seo-description"
                  value={seoDescription}
                  onChange={(event) => setSeoDescription(event.target.value)}
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button
                disabled={createPage.isPending || updatePage.isPending}
                type="submit"
              >
                {editingPage ? "Lưu page" : "Tạo page"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </AdminShell>
  );
}
