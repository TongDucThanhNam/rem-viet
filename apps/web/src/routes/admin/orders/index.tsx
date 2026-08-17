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
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AdminPageHeader,
  AsyncState,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/orders/")({
  component: AdminOrdersRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.q === "string" && search.q.trim() ? { q: search.q } : {}),
    ...(orderStatuses.includes(search.status as OrderStatus)
      ? { status: search.status as OrderStatus }
      : {}),
  }),
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN");
}

function orderTypeLabel(type: string) {
  return type === "product" ? "Mua ngay" : "Giỏ hàng";
}

const orderStatuses = ["new", "processing", "completed", "cancelled"] as const;

type OrderStatus = (typeof orderStatuses)[number];

function orderStatusLabel(status: string) {
  switch (status) {
    case "processing":
      return "Đang xử lý";
    case "completed":
      return "Hoàn tất";
    case "cancelled":
      return "Đã huỷ";
    default:
      return "Mới";
  }
}

function paymentLabel(payment: Record<string, unknown> | null) {
  if (!payment) {
    return "Chưa có";
  }

  const method = String(payment.method ?? "cod").toUpperCase();
  const status = String(payment.status ?? "pending");

  return `${method} · ${status}`;
}

function variantLabel(variants?: Record<string, string>) {
  const entries = Object.entries(variants ?? {});

  if (!entries.length) {
    return "";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join(" · ");
}

function AdminOrdersRoute() {
  const trpc = useTRPC();
  const navigate = useNavigate({ from: Route.fullPath });
  const { q = "", status } = Route.useSearch();
  const ordersQuery = useQuery(trpc.orders.list.queryOptions());
  const updateStatus = useMutation(
    trpc.orders.updateStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Đã cập nhật trạng thái đơn hàng.");
        void ordersQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Không thể cập nhật đơn hàng.");
      },
    }),
  );
  const orders = ordersQuery.data ?? [];
  const filteredOrders = useMemo(() => {
    const keyword = q.trim().toLowerCase();

    return orders.filter((order) => {
      if (status && order.status !== status) return false;
      if (!keyword) return true;

      return [
        order._id,
        order.firstName,
        order.lastName,
        order.phoneNumber,
        order.address,
        ...order.items.map((item) => item.name),
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [orders, q, status]);

  function updateSearch(next: { q?: string; status?: OrderStatus | "" }) {
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

  function changeOrderStatus(orderId: string, status: OrderStatus) {
    updateStatus.mutate({ orderId, status });
  }

  return (
    <AdminShell hideHeading>
      <div className="grid gap-5">
        <AdminPageHeader
          actions={
            <Link
              className={buttonVariants({ size: "sm" })}
              to="/admin/orders/new"
            >
              <Plus aria-hidden className="size-4" />
              Thêm đơn hàng
            </Link>
          }
          eyebrow={`${filteredOrders.length} trên ${orders.length} đơn hàng`}
        />

        <section
          aria-label="Công cụ danh sách đơn hàng"
          className="flex flex-col gap-3 border p-3 md:flex-row md:items-end"
        >
          <div className="relative w-full md:max-w-md">
            <Input
              aria-label="Tìm kiếm đơn hàng"
              className="pr-9"
              placeholder="Mã đơn, khách hàng, số điện thoại hoặc sản phẩm"
              value={q}
              onChange={(event) => updateSearch({ q: event.target.value })}
            />
            <Search
              aria-hidden
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Trạng thái
            <select
              aria-label="Lọc trạng thái đơn hàng"
              className="h-9 min-w-44 border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              value={status ?? ""}
              onChange={(event) =>
                updateSearch({ status: event.target.value as OrderStatus | "" })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {orderStatuses.map((option) => (
                <option key={option} value={option}>
                  {orderStatusLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <div className="overflow-hidden border bg-background">
          {ordersQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground" role="status">
              Đang tải đơn hàng…
            </div>
          ) : ordersQuery.isError ? (
            <AsyncState
              action={
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => ordersQuery.refetch()}
                >
                  Thử lại
                </Button>
              }
              description="Kết nối dữ liệu gặp sự cố. Hãy thử tải lại trang."
              title="Không thể tải đơn hàng"
              tone="error"
            />
          ) : filteredOrders.length ? (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">Khách hàng</TableHead>
                    <TableHead className="min-w-72">Sản phẩm</TableHead>
                    <TableHead className="min-w-36">Loại</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="min-w-36">Thanh toán</TableHead>
                    <TableHead className="text-right">Tổng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow className="align-top" key={order._id}>
                      <TableCell>
                        <div className="font-medium">
                          {order.lastName} {order.firstName}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {order.phoneNumber}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {order.address}, {order.district}, {order.city}
                        </div>
                        {order.cartId ? (
                          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                            cartId: {order.cartId}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          {order.items.map((item, index) => (
                            <div
                              key={`${order._id}-${item.productId}-${index}`}
                            >
                              <span className="font-medium">{item.name}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                x {item.quantity}
                              </span>
                              {variantLabel(item.variants) ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {variantLabel(item.variants)}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{orderTypeLabel(order.type)}</TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={
                            order.status === "completed"
                              ? "success"
                              : order.status === "cancelled"
                                ? "destructive"
                                : order.status === "processing"
                                  ? "warning"
                                  : "info"
                          }
                        >
                          {orderStatusLabel(order.status)}
                        </StatusBadge>
                        <select
                          aria-label={`Trạng thái đơn hàng ${order._id}`}
                          className="mt-2 h-8 border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          disabled={updateStatus.isPending}
                          value={order.status}
                          onChange={(event) =>
                            changeOrderStatus(
                              order._id,
                              event.target.value as OrderStatus,
                            )
                          }
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {orderStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>{paymentLabel(order.payment)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(order.total ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <AsyncState
              description={
                q || status
                  ? "Không có đơn hàng phù hợp. Hãy đổi từ khóa hoặc trạng thái."
                  : "Đơn hàng mới sẽ hiển thị tại đây để đội ngũ xử lý."
              }
              title={
                q || status ? "Không tìm thấy đơn hàng" : "Chưa có đơn hàng"
              }
            />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
