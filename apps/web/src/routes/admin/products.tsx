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
import { cn } from "@rem-viet/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Check,
  Columns3,
  Download,
  Edit,
  Eye,
  PackageSearch,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { formatProductPrice, parseProductPrice } from "@/lib/price";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsRoute,
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled" | "deleted"
  >("all");
  const [sortMode, setSortMode] = useState<
    "updated-desc" | "updated-asc" | "name-asc" | "price-desc"
  >("updated-desc");
  const [visibleColumnUids, setVisibleColumnUids] = useState<
    ProductColumnUid[]
  >(() => productsColumns.map((column) => column.uid));
  const rowsPerPage = 4;
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
  const visiblePageNumbers = visiblePages(page, pages);
  const visibleProducts = filteredProducts.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
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

  function exportProductsCsv() {
    const rows = filteredProducts.map((product) => ({
      id: product._id,
      name: product.name,
      description: product.description ?? "",
      price: product.price ?? "",
      soldQuantity: product.soldQuantity,
      status:
        product.isActive && !product.isDeleted
          ? "Active"
          : product.isDeleted
            ? "Deleted"
            : "Disable",
      updatedAt: product.updatedAt,
    }));
    const header = [
      "ID",
      "Tên sản phẩm",
      "Mô tả",
      "Giá",
      "Đã bán",
      "Trạng thái",
      "UpdateAt",
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
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize",
              product.isActive && !product.isDeleted
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-red-500/10 text-red-700",
            )}
          >
            {product.isActive && !product.isDeleted ? "Active" : "Disable"}
          </span>
        );
      case "updatedAt":
        return formatDate(product.updatedAt);
      case "actions":
        return (
          <div className="flex items-center justify-center gap-4">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              params={{ productId: product._id }}
              title="Xem sản phẩm"
              to="/admin/products/$productId"
            >
              <Eye aria-hidden className="size-5" />
            </Link>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              params={{ productId: product._id }}
              title="Sửa sản phẩm"
              to="/admin/products/$productId/edit"
            >
              <Edit aria-hidden className="size-5" />
            </Link>
            <Button
              className="size-auto bg-transparent p-0 text-pink-600 hover:bg-transparent"
              disabled={deleteProduct.isPending}
              title="Xoá sản phẩm"
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Xóa ${product.name}?`)) {
                  deleteProduct.mutate({
                    productId: product._id,
                  });
                }
              }}
            >
              <Trash2 aria-hidden className="size-5" />
            </Button>
          </div>
        );
    }
  }

  return (
    <AdminShell hideHeading legacyContentFrame title="Sản phẩm">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex w-[226px] items-center gap-2">
            <h1 className="text-2xl font-bold leading-8 tracking-normal">
              Sản phẩm
            </h1>
            <span className="hidden items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:flex">
              {products.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              size="sm"
              type="button"
              onClick={exportProductsCsv}
            >
              <Download aria-hidden className="size-3.5" />
              Xuất file Excel
            </Button>
            <Link
              className={buttonVariants({ className: "gap-1", size: "sm" })}
              to="/admin/products/new"
            >
              Thêm sản phẩm
              <Plus aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-auto px-[6px] py-[4px]">
          <div className="flex items-center gap-4">
            <div className="relative min-w-[200px]">
              <Input
                className="h-8 pr-9"
                placeholder="Tìm kiếm"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
              />
              <Search
                aria-hidden
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </div>
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
                      setPage(1);
                      setStatusFilter(option.value);
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
                      setPage(1);
                      setSortMode(option.value);
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
          <div className="h-5 w-px shrink-0 bg-border" />
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {productsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Đang tải...</div>
          ) : visibleProducts.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      {visibleColumns.map((column) => (
                        <th
                          className={cn(
                            "px-4 py-3 font-semibold",
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
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => (
                      <tr
                        aria-label={`Row for ${product.name}`}
                        className="border-b last:border-b-0"
                        key={product._id}
                      >
                        {visibleColumns.map((column) => (
                          <td className="px-4 py-3" key={column.uid}>
                            {renderProductCell(product, column.uid)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                          page === pageNumber &&
                            "bg-primary text-primary-foreground",
                        )}
                        key={pageNumber}
                        size="icon"
                        type="button"
                        variant={page === pageNumber ? "default" : "outline"}
                        onClick={() => setPage(pageNumber)}
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
                      disabled={page === 1}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => setPage((value) => Math.max(value - 1, 1))}
                    >
                      Trang trước
                    </Button>
                    <Button
                      disabled={page === pages}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setPage((value) => Math.min(value + 1, pages))
                      }
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
              <PackageSearch
                aria-hidden
                className="size-8 text-muted-foreground"
              />
              <div>
                <h2 className="text-sm font-medium">Chưa có sản phẩm</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tạo sản phẩm đầu tiên để bắt đầu bán hàng.
                </p>
              </div>
            </div>
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
  { name: "UpdateAt", uid: "updatedAt" },
  { name: "Actions", uid: "actions" },
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
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "disabled" },
  { label: "Deleted", value: "deleted" },
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
