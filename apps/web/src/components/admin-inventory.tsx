import { Button, buttonVariants } from "@rem-viet/ui/components/button";
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
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  PackageOpen,
  PackagePlus,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AdminPageHeader,
  AsyncState,
  FormSection,
  MetricCard,
  StatusBadge,
} from "@/components/admin-ui";
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
    <AdminShell hideHeading>
      <div className="grid gap-5">
        <AdminPageHeader
          actions={
            <Link
              className={buttonVariants({ size: "sm" })}
              search={{ productId: undefined }}
              to="/admin/inventory/new"
            >
              <Plus aria-hidden className="size-4" />
              Thêm nhập xuất
            </Link>
          }
          eyebrow={`${filteredProducts.length} trên ${products.length} sản phẩm`}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            context="Bản ghi trong danh mục"
            icon={PackageOpen}
            label="Tổng sản phẩm"
            value={String(products.length)}
          />
          <MetricCard
            context="Đơn vị đang ghi nhận"
            icon={PackagePlus}
            label="Tổng tồn kho"
            value={String(totalQuantity)}
          />
          <MetricCard
            context="Đơn vị đã bán"
            icon={PackageOpen}
            label="Đã bán"
            value={String(totalSold)}
          />
        </div>

        <div className="overflow-hidden border bg-background">
          <div className="border-b p-4">
            <div className="relative w-full max-w-sm">
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Tìm kiếm tồn kho"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên hoặc mã sản phẩm"
                value={search}
              />
            </div>
          </div>

          {productsQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Đang tải tồn kho…
            </div>
          ) : productsQuery.isError ? (
            <AsyncState
              action={
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => productsQuery.refetch()}
                >
                  Thử lại
                </Button>
              }
              description="Kết nối dữ liệu gặp sự cố. Hãy thử tải lại."
              title="Không thể tải tồn kho"
              tone="error"
            />
          ) : filteredProducts.length ? (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-80">Sản phẩm</TableHead>
                    <TableHead>Tồn kho</TableHead>
                    <TableHead>Đã bán</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow className="align-top" key={product._id}>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {product._id}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {Number(product.quantity ?? 0)}
                      </TableCell>
                      <TableCell>{Number(product.soldQuantity ?? 0)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={
                            product.isDeleted
                              ? "destructive"
                              : product.isActive
                                ? "success"
                                : "warning"
                          }
                        >
                          {product.isDeleted
                            ? "Đã xóa"
                            : product.isActive
                              ? "Đang bán"
                              : "Tạm ẩn"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{formatDate(product.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          className={buttonVariants({
                            size: "sm",
                            variant: "outline",
                          })}
                          search={{ productId: product._id }}
                          to="/admin/inventory/new"
                        >
                          Cập nhật
                        </Link>
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
                  ? "Không có sản phẩm phù hợp với từ khóa hiện tại."
                  : "Dữ liệu tồn kho sẽ xuất hiện khi danh mục có sản phẩm."
              }
              title={search ? "Không tìm thấy sản phẩm" : "Không có sản phẩm"}
            />
          )}
        </div>
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
        await queryClient.invalidateQueries(
          trpc.products.adminList.queryFilter(),
        );
        if (result.statusCode === 200) {
          toast.success("Đã cập nhật tồn kho.");
          setQuantity("");
          return;
        }
        toast.error(result.message);
      },
      onError: (error) => toast.error(error.message),
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
    <AdminShell
      actions={
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          to="/admin/inventory"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Danh sách kho
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-3xl">
        <FormSection
          description="Chọn sản phẩm, cách điều chỉnh và số lượng cần ghi nhận."
          title="Thông tin cập nhật"
        >
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
              <div className="border bg-muted/30 p-4 text-sm">
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

            <div className="sticky bottom-0 z-10 flex justify-end gap-2 border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
              <Link
                className={buttonVariants({ variant: "outline" })}
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
        </FormSection>
      </div>
    </AdminShell>
  );
}
