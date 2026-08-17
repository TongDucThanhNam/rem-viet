import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Edit, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AdminPageHeader,
  AsyncState,
  ConfirmDestructiveAction,
  FormSection,
} from "@/components/admin-ui";
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
      onError: (error) => toast.error(error.message),
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
      onError: (error) => toast.error(error.message),
    }),
  );
  const deleteCategory = useMutation(
    trpc.categories.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.categories.list.queryFilter());
        toast.success("Đã xóa danh mục.");
      },
      onError: (error) => toast.error(error.message),
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
    <AdminShell hideHeading>
      <div className="grid gap-5">
        <AdminPageHeader
          eyebrow={`${filteredCategories.length} trên ${categories.length} danh mục`}
        />

        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Tìm kiếm danh mục"
            className="pl-9"
            placeholder="Tìm danh mục"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <FormSection
          description="Tên danh mục được dùng trực tiếp trong bộ chọn sản phẩm."
          title={editingCategory ? "Sửa danh mục" : "Thêm danh mục"}
        >
          <form
            className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
            onSubmit={submitCategory}
          >
            <div className="grid gap-2">
              <Label htmlFor="categoryName">Tên danh mục</Label>
              <Input
                id="categoryName"
                placeholder="Ví dụ: Lưới chống muỗi"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {editingCategory ? (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  <X aria-hidden />
                  Hủy
                </Button>
              ) : null}
              <Button
                disabled={createCategory.isPending || updateCategory.isPending}
                type="submit"
              >
                <Plus aria-hidden />
                {editingCategory ? "Lưu" : "Thêm"}
              </Button>
            </div>
          </form>
        </FormSection>

        <div className="overflow-hidden border bg-background">
          {categoriesQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Đang tải danh mục…
            </div>
          ) : categoriesQuery.isError ? (
            <AsyncState
              action={
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => categoriesQuery.refetch()}
                >
                  Thử lại
                </Button>
              }
              description="Kết nối dữ liệu gặp sự cố. Hãy thử tải lại."
              title="Không thể tải danh mục"
              tone="error"
            />
          ) : filteredCategories.length ? (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">Tên danh mục</TableHead>
                    <TableHead className="min-w-32">Sản phẩm</TableHead>
                    <TableHead className="min-w-44">Cập nhật</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Hành động</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category) => (
                    <TableRow key={category._id}>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        {productCountByCategory.get(category._id) ?? 0}
                      </TableCell>
                      <TableCell>{formatDate(category.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={`Sửa ${category.name}`}
                            size="icon-sm"
                            title="Sửa"
                            type="button"
                            variant="ghost"
                            onClick={() => startEdit(category)}
                          >
                            <Edit aria-hidden className="size-5" />
                          </Button>
                          <ConfirmDestructiveAction
                            description={
                              <>
                                Danh mục <strong>{category.name}</strong> sẽ bị
                                xóa. Sản phẩm hiện có không bị xóa.
                              </>
                            }
                            pending={deleteCategory.isPending}
                            title={`Xóa “${category.name}”?`}
                            trigger={
                              <Button
                                aria-label={`Xóa ${category.name}`}
                                className="text-destructive hover:text-destructive"
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 aria-hidden className="size-4" />
                              </Button>
                            }
                            onConfirm={async () => {
                              await deleteCategory.mutateAsync({
                                categoryId: category._id,
                              });
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <AsyncState
              description={
                search
                  ? "Không có danh mục phù hợp với từ khóa hiện tại."
                  : "Danh mục mới sẽ hiển thị tại đây."
              }
              title={search ? "Không tìm thấy danh mục" : "Chưa có danh mục"}
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
