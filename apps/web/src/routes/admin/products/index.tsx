import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rem-viet/ui/components/dropdown-menu";
import { Input } from "@rem-viet/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { cn } from "@rem-viet/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowUpDown,
  Check,
  Columns3,
  Download,
  Edit,
  Eye,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import AdminShell from "@/components/admin-shell";
import {
  AdminPageHeader,
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { formatProductPrice, parseProductPrice } from "@/lib/price";
import { useTRPC } from "@/utils/trpc";

type ProductListStatus = "all" | "active" | "disabled" | "deleted";
type ProductListSort =
  "updated-desc" | "updated-asc" | "name-asc" | "price-desc";
type ProductListSearch = {
  page?: number;
  q?: string;
  sort?: ProductListSort;
  status?: ProductListStatus;
};

export const Route = createFileRoute("/admin/products/")({
  component: AdminProductsRoute,
  validateSearch: (search: Record<string, unknown>): ProductListSearch => {
    const page = Number(search.page);
    const q = typeof search.q === "string" ? search.q : "";
    const sort: ProductListSort | undefined =
      search.sort === "updated-asc" ||
      search.sort === "name-asc" ||
      search.sort === "price-desc"
        ? search.sort
        : undefined;
    const status: ProductListStatus | undefined =
      search.status === "active" ||
      search.status === "disabled" ||
      search.status === "deleted"
        ? search.status
        : undefined;

    return {
      ...(Number.isInteger(page) && page > 1 ? { page } : {}),
      ...(q.trim() ? { q } : {}),
      ...(sort ? { sort } : {}),
      ...(status ? { status } : {}),
    };
  },
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

  return `${parsed.getDate()}/${parsed.getMonth() + 1}/${parsed.getFullYear()}`;
}

function AdminProductsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    page = 1,
    q: search = "",
    sort: sortMode = "updated-desc",
    status: statusFilter = "all",
  } = Route.useSearch();
  const [visibleColumnUids, setVisibleColumnUids] = useState<
    ProductColumnUid[]
  >(() => productsColumns.map((column) => column.uid));
  const rowsPerPage = 10;
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({
      sort: "updatedAt",
      order: "desc",
    }),
  );
  const deleteProduct = useMutation(
    trpc.products.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.products.adminList.queryFilter());
      },
    }),
  );
  const products = (productsQuery.data?.data ?? []) as ProductTableRow[];
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const nextProducts = products.filter((product) => {
      const matchesSearch = keyword
        ? [product.name, product.description, product.price].some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(keyword),
          )
        : true;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? product.isActive && !product.isDeleted
            : statusFilter === "disabled"
              ? !product.isActive && !product.isDeleted
              : product.isDeleted;

      return matchesSearch && matchesStatus;
    });

    return [...nextProducts].sort((left, right) => {
      if (sortMode === "updated-asc") {
        return (
          new Date(left.updatedAt).getTime() -
          new Date(right.updatedAt).getTime()
        );
      }

      if (sortMode === "name-asc") {
        return left.name.localeCompare(right.name, "vi");
      }

      if (sortMode === "price-desc") {
        return priceValue(right.price) - priceValue(left.price);
      }

      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
  }, [products, search, sortMode, statusFilter]);
  const pages = Math.max(Math.ceil(filteredProducts.length / rowsPerPage), 1);
  const currentPage = Math.min(page, pages);
  const visiblePageNumbers = visiblePages(currentPage, pages);
  const visibleProducts = filteredProducts.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );
  const visibleColumns = productsColumns.filter((column) =>
    visibleColumnUids.includes(column.uid),
  );

  function toggleColumn(columnUid: ProductColumnUid) {
    if (columnUid === "actions") {
      return;
    }

    setVisibleColumnUids((current) =>
      current.includes(columnUid)
        ? current.filter((uid) => uid !== columnUid)
        : [...current, columnUid],
    );
  }

  function updateListSearch(
    next: Partial<{
      page: number;
      q: string;
      sort: typeof sortMode;
      status: typeof statusFilter;
    }>,
  ) {
    navigate({
      replace: true,
      search: (current) => {
        const merged = { ...current, ...next };

        return {
          ...(merged.page && merged.page > 1 ? { page: merged.page } : {}),
          ...(merged.q?.trim() ? { q: merged.q } : {}),
          ...(merged.sort && merged.sort !== "updated-desc"
            ? { sort: merged.sort }
            : {}),
          ...(merged.status && merged.status !== "all"
            ? { status: merged.status }
            : {}),
        };
      },
    });
  }

  function exportProductsCsv() {
    const rows = filteredProducts.map((product) => ({
      id: product._id,
      name: product.name,
      description: product.description ?? "",
      price: product.price ?? "",
      soldQuantity: product.soldQuantity,
      status:
        product.isActive && !product.isDeleted
          ? "Đang bán"
          : product.isDeleted
            ? "Đã xóa"
            : "Tạm ẩn",
      updatedAt: product.updatedAt,
    }));
    const header = [
      "ID",
      "Tên sản phẩm",
      "Mô tả",
      "Giá",
      "Đã bán",
      "Trạng thái",
      "Cập nhật lúc",
    ];
    const csv = [
      header,
      ...rows.map((row) => [
        row.id,
        row.name,
        row.description,
        row.price,
        row.soldQuantity,
        row.status,
        row.updatedAt,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "rem-viet-products.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderProductCell(
    product: ProductTableRow,
    columnUid: ProductColumnUid,
  ) {
    switch (columnUid) {
      case "name":
        return <p className="truncate">{product.name}</p>;
      case "description":
        return (
          <p className="truncate text-muted-foreground">
            {product.description}
          </p>
        );
      case "price":
        return formatProductPrice(product.price);
      case "soldQuantity":
        return product.soldQuantity;
      case "isActive":
        return (
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
        );
      case "updatedAt":
        return formatDate(product.updatedAt);
      case "actions":
        return (
          <div
            className="flex items-center justify-end gap-1 md:justify-center"
            data-product-actions
          >
            <Link
              aria-label={`Xem ${product.name}`}
              className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              params={{ productId: product._id }}
              title="Xem sản phẩm"
              to="/admin/products/$productId"
            >
              <Eye aria-hidden className="size-5" />
            </Link>
            <Link
              aria-label={`Sửa ${product.name}`}
              className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              params={{ productId: product._id }}
              title="Sửa sản phẩm"
              to="/admin/products/$productId/edit"
            >
              <Edit aria-hidden className="size-5" />
            </Link>
            <ConfirmDestructiveAction
              description={
                <>
                  Sản phẩm <strong>{product.name}</strong> sẽ bị xóa khỏi danh
                  sách vận hành. Bạn có chắc muốn tiếp tục?
                </>
              }
              pending={deleteProduct.isPending}
              title={`Xóa “${product.name}”?`}
              trigger={
                <Button
                  aria-label={`Xóa ${product.name}`}
                  className="text-destructive hover:text-destructive"
                  size="icon-sm"
                  title="Xóa sản phẩm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden className="size-5" />
                </Button>
              }
              onConfirm={async () => {
                await deleteProduct.mutateAsync({
                  productId: product._id,
                });
              }}
            />
          </div>
        );
    }
  }

  return (
    <AdminShell hideHeading>
      <div className="grid gap-5">
        <AdminPageHeader
          actions={
            <>
              <Button
                disabled={filteredProducts.length === 0}
                size="sm"
                type="button"
                variant="outline"
                onClick={exportProductsCsv}
              >
                <Download aria-hidden className="size-3.5" />
                Xuất CSV
              </Button>
              <Link
                className={buttonVariants({ className: "gap-1", size: "sm" })}
                to="/admin/products/new"
              >
                <Plus aria-hidden className="size-3.5" />
                Thêm sản phẩm
              </Link>
            </>
          }
          eyebrow={`${filteredProducts.length} trên ${products.length} sản phẩm`}
        />

        {deleteProduct.isError ? (
          <div
            className="border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            Không thể xóa sản phẩm. Dữ liệu hiện tại vẫn được giữ nguyên.
          </div>
        ) : null}

        <section
          aria-label="Công cụ danh sách"
          className="grid gap-3 border p-3"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Input
                aria-label="Tìm kiếm sản phẩm"
                className="h-9 pr-9"
                placeholder="Tìm theo tên, mô tả hoặc giá"
                value={search}
                onChange={(event) =>
                  updateListSearch({ page: 1, q: event.target.value })
                }
              />
              <Search
                aria-hidden
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({
                    className: "bg-muted text-foreground",
                    size: "sm",
                    variant: "secondary",
                  })}
                >
                  <SlidersHorizontal aria-hidden className="size-3.5" />
                  Lọc
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Trạng thái</DropdownMenuLabel>
                  {statusOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => {
                        updateListSearch({ page: 1, status: option.value });
                      }}
                    >
                      <span>{option.label}</span>
                      {statusFilter === option.value ? (
                        <Check
                          aria-hidden
                          className="ml-auto size-4 text-primary"
                        />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({
                    className: "bg-muted text-foreground",
                    size: "sm",
                    variant: "secondary",
                  })}
                >
                  <ArrowUpDown aria-hidden className="size-3.5" />
                  Sắp xếp
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Sắp xếp</DropdownMenuLabel>
                  {sortOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => {
                        updateListSearch({ page: 1, sort: option.value });
                      }}
                    >
                      <span>{option.label}</span>
                      {sortMode === option.value ? (
                        <Check
                          aria-hidden
                          className="ml-auto size-4 text-primary"
                        />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({
                    className: "bg-muted text-foreground",
                    size: "sm",
                    variant: "secondary",
                  })}
                >
                  <Columns3 aria-hidden className="size-3.5" />
                  Chọn cột
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Cột hiển thị</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {productsColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      checked={visibleColumnUids.includes(column.uid)}
                      disabled={column.uid === "actions"}
                      key={column.uid}
                      onCheckedChange={() => toggleColumn(column.uid)}
                    >
                      {column.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tìm kiếm, bộ lọc, sắp xếp và trang hiện tại được lưu trên URL để có
            thể chia sẻ hoặc quay lại đúng trạng thái.
          </p>
        </section>

        <div className="overflow-hidden border bg-background">
          {productsQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Đang tải danh sách sản phẩm…
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
              description="Kết nối dữ liệu gặp sự cố. Các bộ lọc hiện tại vẫn được giữ lại."
              title="Không thể tải sản phẩm"
              tone="error"
            />
          ) : visibleProducts.length ? (
            <>
              <ul
                aria-label="Danh sách sản phẩm trên thiết bị nhỏ"
                className="divide-y md:hidden"
                data-product-mobile-list
              >
                {visibleProducts.map((product) => (
                  <li
                    className="grid gap-4 p-4"
                    data-product-card
                    key={product._id}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-medium">
                          {product.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {product.description || "Chưa có mô tả"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {renderProductCell(product, "isActive")}
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Giá</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {renderProductCell(product, "price")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Đã bán</dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {renderProductCell(product, "soldQuantity")}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Cập nhật</dt>
                        <dd className="mt-1 font-medium">
                          {renderProductCell(product, "updatedAt")}
                        </dd>
                      </div>
                    </dl>

                    <div className="border-t pt-3">
                      {renderProductCell(product, "actions")}
                    </div>
                  </li>
                ))}
              </ul>

              <div
                className="hidden overflow-x-auto md:block"
                data-product-table
              >
                <Table className="min-w-[56rem] table-fixed">
                  <TableHeader className="bg-muted/40 text-muted-foreground">
                    <TableRow>
                      {visibleColumns.map((column) => (
                        <TableHead
                          className={cn(
                            "font-semibold",
                            column.uid === "name" && "w-1/4 min-w-[100px]",
                            column.uid === "description" && "w-1/6",
                            column.uid === "price" && "w-[12%] min-w-[90px]",
                            column.uid === "soldQuantity" &&
                              "w-[10%] min-w-[80px]",
                            column.uid === "isActive" && "w-[10%] min-w-[80px]",
                            column.uid === "updatedAt" && "w-1/6 min-w-[80px]",
                            column.uid === "actions" &&
                              "w-[10%] min-w-[72px] text-center",
                          )}
                          key={column.uid}
                        >
                          {column.uid === "actions" ? (
                            <span className="sr-only">{column.name}</span>
                          ) : (
                            <span className="truncate">{column.name}</span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProducts.map((product) => (
                      <TableRow
                        aria-label={`Sản phẩm ${product.name}`}
                        key={product._id}
                      >
                        {visibleColumns.map((column) => (
                          <TableCell key={column.uid}>
                            {renderProductCell(product, column.uid)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-center justify-between gap-2 px-2 py-2 sm:flex-row">
                <div className="flex flex-wrap items-center gap-1">
                  {visiblePageNumbers.map((pageNumber, index) =>
                    pageNumber === "ellipsis" ? (
                      <span
                        aria-hidden
                        className="inline-flex size-8 items-center justify-center text-sm text-muted-foreground"
                        key={`ellipsis-${index}`}
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        className={cn(
                          "size-8 rounded-md",
                          currentPage === pageNumber &&
                            "bg-primary text-primary-foreground",
                        )}
                        key={pageNumber}
                        size="icon"
                        type="button"
                        variant={
                          currentPage === pageNumber ? "default" : "outline"
                        }
                        onClick={() => updateListSearch({ page: pageNumber })}
                      >
                        {pageNumber}
                      </Button>
                    ),
                  )}
                </div>
                <div className="flex items-center justify-end gap-6">
                  <span className="text-xs text-muted-foreground">
                    {visibleProducts.length}/{filteredProducts.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <Button
                      disabled={currentPage === 1}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        updateListSearch({ page: Math.max(currentPage - 1, 1) })
                      }
                    >
                      Trang trước
                    </Button>
                    <Button
                      disabled={currentPage === pages}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        updateListSearch({
                          page: Math.min(currentPage + 1, pages),
                        })
                      }
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <AsyncState
              action={
                search || statusFilter !== "all" ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateListSearch({ page: 1, q: "", status: "all" })
                    }
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <Link
                    className={buttonVariants({ size: "sm" })}
                    to="/admin/products/new"
                  >
                    <Plus aria-hidden className="size-3.5" />
                    Thêm sản phẩm
                  </Link>
                )
              }
              description={
                search || statusFilter !== "all"
                  ? "Không có sản phẩm phù hợp. Hãy đổi từ khóa hoặc bộ lọc trạng thái."
                  : "Tạo sản phẩm đầu tiên để bắt đầu quản lý danh mục bán hàng."
              }
              title={
                search || statusFilter !== "all"
                  ? "Không tìm thấy sản phẩm"
                  : "Chưa có sản phẩm"
              }
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}

const productsColumns = [
  { name: "Tên sản phẩm", uid: "name" },
  { name: "Mô tả", uid: "description" },
  { name: "Giá", uid: "price" },
  { name: "Đã bán", uid: "soldQuantity" },
  { name: "Trạng thái", uid: "isActive" },
  { name: "Cập nhật", uid: "updatedAt" },
  { name: "Thao tác", uid: "actions" },
] as const;

type ProductColumnUid = (typeof productsColumns)[number]["uid"];

type ProductTableRow = {
  _id: string;
  name: string;
  description?: string | null;
  price?: string | null;
  soldQuantity: number;
  isActive: boolean;
  isDeleted: boolean;
  updatedAt: string;
};

const statusOptions = [
  { label: "Tất cả", value: "all" },
  { label: "Đang bán", value: "active" },
  { label: "Tạm ẩn", value: "disabled" },
  { label: "Đã xóa", value: "deleted" },
] as const;

const sortOptions = [
  { label: "Mới cập nhật", value: "updated-desc" },
  { label: "Cũ trước", value: "updated-asc" },
  { label: "Tên A-Z", value: "name-asc" },
  { label: "Giá cao trước", value: "price-desc" },
] as const;

function priceValue(price?: string | null) {
  return parseProductPrice(price);
}

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""');

  return `"${text}"`;
}

function visiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageNumbers: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, clampedPage - 1);
  const end = Math.min(totalPages - 1, clampedPage + 1);

  if (start > 2) {
    pageNumbers.push("ellipsis");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }

  if (end < totalPages - 1) {
    pageNumbers.push("ellipsis");
  }

  pageNumbers.push(totalPages);

  return pageNumbers;
}
