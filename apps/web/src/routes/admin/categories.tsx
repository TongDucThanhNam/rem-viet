import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Edit, FolderTree, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategoriesRoute,
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

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN");
}

function AdminCategoriesRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({
      limit: 200,
    }),
  );
  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();

    for (const product of products) {
      if (!product.categoryId) {
        continue;
      }

      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }

    return counts;
  }, [products]);
  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return categories;
    }

    return categories.filter((category) =>
      category.name.toLowerCase().includes(keyword),
    );
  }, [categories, search]);
  const createCategory = useMutation(
    trpc.categories.create.mutationOptions({
      onSuccess: () => {
        setName("");
        queryClient.invalidateQueries(trpc.categories.list.queryFilter());
        toast.success("Đã tạo danh mục.");
      },
    }),
  );
  const updateCategory = useMutation(
    trpc.categories.update.mutationOptions({
      onSuccess: () => {
        setName("");
        setEditingCategory(null);
        queryClient.invalidateQueries(trpc.categories.list.queryFilter());
        toast.success("Đã cập nhật danh mục.");
      },
    }),
  );
  const deleteCategory = useMutation(
    trpc.categories.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.categories.list.queryFilter());
        toast.success("Đã xóa danh mục.");
      },
    }),
  );

  function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = name.trim();

    if (!nextName) {
      return;
    }

    if (editingCategory) {
      updateCategory.mutate({
        categoryId: editingCategory._id,
        name: nextName,
      });
      return;
    }

    createCategory.mutate({ name: nextName });
  }

  function startEdit(category: { _id: string; name: string }) {
    setEditingCategory(category);
    setName(category.name);
  }

  function cancelEdit() {
    setEditingCategory(null);
    setName("");
  }

  return (
    <AdminShell hideHeading legacyContentFrame title="Danh mục sản phẩm">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold leading-8 tracking-normal">
                Danh mục
              </h1>
              <span className="hidden items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:flex">
                {filteredCategories.length}/{categories.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo, sửa và sắp xếp nhóm sản phẩm trong cửa hàng.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-10 rounded-xl pl-9"
              placeholder="Tìm danh mục..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden rounded-md border bg-background shadow-sm">
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
              onSubmit={submitCategory}
            >
              <div className="grid gap-2">
                <Label htmlFor="categoryName">
                  {editingCategory ? "Sửa danh mục" : "Thêm danh mục"}
                </Label>
                <Input
                  id="categoryName"
                  placeholder="Ví dụ: Lưới chống muỗi"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {editingCategory ? (
                  <Button
                    className="h-10 rounded-xl"
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    <X aria-hidden />
                    Hủy
                  </Button>
                ) : null}
                <Button
                  className="h-10 rounded-xl"
                  disabled={
                    createCategory.isPending || updateCategory.isPending
                  }
                  type="submit"
                >
                  <Plus aria-hidden />
                  {editingCategory ? "Lưu" : "Thêm"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-md border bg-background shadow-sm">
          <CardContent className="p-0">
            {categoriesQuery.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Đang tải...
              </div>
            ) : filteredCategories.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="min-w-64 px-4 py-3 font-semibold">
                        Tên danh mục
                      </th>
                      <th className="min-w-32 px-4 py-3 font-semibold">
                        Sản phẩm
                      </th>
                      <th className="min-w-44 px-4 py-3 font-semibold">
                        Cập nhật
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((category) => (
                      <tr
                        className="border-b last:border-b-0"
                        key={category._id}
                      >
                        <td className="px-4 py-3 font-medium">
                          {category.name}
                        </td>
                        <td className="px-4 py-3">
                          {productCountByCategory.get(category._id) ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(category.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-4">
                            <Button
                              className="h-auto w-auto bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                              title="Sửa"
                              type="button"
                              variant="ghost"
                              onClick={() => startEdit(category)}
                            >
                              <Edit aria-hidden className="size-5" />
                            </Button>
                            <Button
                              className="h-auto w-auto bg-transparent p-0 text-pink-600 hover:bg-transparent"
                              disabled={deleteCategory.isPending}
                              title="Xóa"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`Xóa ${category.name}?`)) {
                                  deleteCategory.mutate({
                                    categoryId: category._id,
                                  });
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
                <FolderTree
                  aria-hidden
                  className="size-8 text-muted-foreground"
                />
                <div>
                  <h2 className="text-sm font-medium">Chưa có danh mục</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Danh mục mới sẽ hiển thị tại đây.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
