import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, PackageOpen, PackagePlus, Plus, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { useTRPC } from "@/utils/trpc";

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN");
}

export function InventoryPage() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({
      sort: "updatedAt",
      order: "desc",
    }),
  );
  const products = productsQuery.data?.data ?? [];
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword) ||
        product._id.toLowerCase().includes(keyword),
    );
  }, [products, search]);
  const totalQuantity = products.reduce(
    (total, product) => total + Number(product.quantity ?? 0),
    0,
  );
  const totalSold = products.reduce(
    (total, product) => total + Number(product.soldQuantity ?? 0),
    0,
  );

  return (
    <AdminShell hideHeading legacyContentFrame title="Quản lý nhập xuất">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold leading-8 tracking-normal">
                Nhập xuất kho
              </h1>
              <span className="hidden items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:flex">
                {filteredProducts.length}/{products.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Theo dõi tồn kho từ dữ liệu sản phẩm đã migrate sang D1.
            </p>
          </div>
          <Link
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            search={{ productId: undefined }}
            to="/admin/inventory/new"
          >
            <Plus aria-hidden className="mr-2 size-4" />
            Thêm nhập xuất
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="rounded-md border bg-background shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Tổng sản phẩm
              </p>
              <p className="mt-2 text-2xl font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border bg-background shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Tổng tồn kho
              </p>
              <p className="mt-2 text-2xl font-bold">{totalQuantity}</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border bg-background shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Đã bán
              </p>
              <p className="mt-2 text-2xl font-bold">{totalSold}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-md border bg-background shadow-sm">
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="relative w-full max-w-sm">
                <Search
                  aria-hidden
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="h-10 rounded-md pl-9"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã sản phẩm"
                  value={search}
                />
              </div>
            </div>

            {productsQuery.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Đang tải...
              </div>
            ) : filteredProducts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="min-w-80 px-4 py-3 font-medium">
                        Sản phẩm
                      </th>
                      <th className="px-4 py-3 font-medium">Tồn kho</th>
                      <th className="px-4 py-3 font-medium">Đã bán</th>
                      <th className="px-4 py-3 font-medium">Trạng thái</th>
                      <th className="px-4 py-3 font-medium">Cập nhật</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        className="border-b align-top last:border-b-0"
                        key={product._id}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{product.name}</div>
                          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {product._id}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {Number(product.quantity ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          {Number(product.soldQuantity ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              product.isDeleted
                                ? "inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
                                : product.isActive
                                  ? "inline-flex items-center rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                                  : "inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {product.isDeleted
                              ? "Đã xóa"
                              : product.isActive
                                ? "Đang bán"
                                : "Tạm ẩn"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(product.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                            search={{ productId: product._id }}
                            to="/admin/inventory/new"
                          >
                            Cập nhật
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
                <PackageOpen
                  aria-hidden
                  className="size-8 text-muted-foreground"
                />
                <div>
                  <h2 className="text-sm font-medium">Không có sản phẩm</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dữ liệu tồn kho sẽ xuất hiện sau khi migrate sản phẩm.
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

export function AddInventoryPage({
  initialProductId,
}: {
  initialProductId?: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({
      sort: "name",
      order: "asc",
    }),
  );
  const products = productsQuery.data?.data ?? [];
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId ?? "",
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product._id === selectedProductId),
    [products, selectedProductId],
  );
  const [quantity, setQuantity] = useState("");
  const [mode, setMode] = useState<"set" | "in" | "out">("set");
  const updateProduct = useMutation(
    trpc.products.update.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries(trpc.products.adminList.queryFilter());
        if (result.statusCode === 200) {
          toast.success("Đã cập nhật tồn kho.");
          setQuantity("");
          return;
        }
        toast.error(result.message);
      },
    }),
  );
  const currentQuantity = Number(selectedProduct?.quantity ?? 0);
  const quantityNumber = Number(quantity || 0);
  const nextQuantity =
    mode === "in"
      ? currentQuantity + quantityNumber
      : mode === "out"
        ? Math.max(currentQuantity - quantityNumber, 0)
        : quantityNumber;

  function submitInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !selectedProductId ||
      !selectedProduct ||
      !Number.isFinite(nextQuantity)
    ) {
      return;
    }

    updateProduct.mutate({
      productId: selectedProductId,
      quantity: nextQuantity,
    });
  }

  return (
    <AdminShell hideHeading legacyContentFrame title="Thêm nhập xuất">
      <div className="mx-auto my-14 flex w-full max-w-3xl flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold leading-8 tracking-normal">
                Thêm nhập xuất
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cập nhật số lượng tồn kho trên sản phẩm trong D1.
            </p>
          </div>
          <Link
            className="inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
            to="/admin/inventory"
          >
            <ArrowLeft aria-hidden className="mr-2 size-4" />
            Danh sách kho
          </Link>
        </div>

        <Card className="rounded-md border bg-background shadow-sm">
          <CardContent className="p-5">
            <form className="grid gap-5" onSubmit={submitInventory}>
              <div className="grid gap-2">
                <Label htmlFor="product">Sản phẩm</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={productsQuery.isLoading}
                  id="product"
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  value={selectedProductId}
                >
                  <option value="">Chọn sản phẩm</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mode">Loại cập nhật</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  id="mode"
                  onChange={(event) =>
                    setMode(event.target.value as "set" | "in" | "out")
                  }
                  value={mode}
                >
                  <option value="set">Đặt lại tồn kho</option>
                  <option value="in">Nhập thêm</option>
                  <option value="out">Xuất kho</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="quantity">Số lượng</Label>
                <Input
                  id="quantity"
                  min={0}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                  type="number"
                  value={quantity}
                />
              </div>

              {selectedProduct ? (
                <div className="rounded-md border bg-muted/30 p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <PackagePlus
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                    {selectedProduct.name}
                  </div>
                  <div className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-3">
                    <div>
                      Hiện tại:{" "}
                      <span className="font-medium text-foreground">
                        {currentQuantity}
                      </span>
                    </div>
                    <div>
                      Sau cập nhật:{" "}
                      <span className="font-medium text-foreground">
                        {nextQuantity}
                      </span>
                    </div>
                    <div>
                      Đã bán:{" "}
                      <span className="font-medium text-foreground">
                        {Number(selectedProduct.soldQuantity ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Link
                  className="inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                  to="/admin/inventory"
                >
                  Hủy
                </Link>
                <Button
                  disabled={
                    !selectedProductId || !quantity || updateProduct.isPending
                  }
                  type="submit"
                >
                  {updateProduct.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
