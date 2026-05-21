import { Card, CardContent } from "@rem-viet/ui/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersRoute,
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

  function changeOrderStatus(orderId: string, status: OrderStatus) {
    updateStatus.mutate({ orderId, status });
  }

  return (
    <AdminShell hideHeading legacyContentFrame title="Quản lý đơn hàng">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex items-center gap-2">
          <h1 className="text-2xl font-bold leading-8 tracking-normal">
            Đơn hàng
          </h1>
          <span className="hidden items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:flex">
            {orders.length}
          </span>
        </div>

        <Card className="overflow-hidden rounded-md border bg-background shadow-sm">
          <CardContent className="p-0">
            {ordersQuery.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Đang tải...
              </div>
            ) : orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="min-w-64 px-4 py-3 font-medium">
                        Khách hàng
                      </th>
                      <th className="min-w-72 px-4 py-3 font-medium">
                        Sản phẩm
                      </th>
                      <th className="min-w-36 px-4 py-3 font-medium">Loại</th>
                      <th className="px-4 py-3 font-medium">Ngày tạo</th>
                      <th className="px-4 py-3 font-medium">Trạng thái</th>
                      <th className="min-w-36 px-4 py-3 font-medium">
                        Thanh toán
                      </th>
                      <th className="px-4 py-3 text-right font-medium">Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        className="border-b align-top last:border-b-0"
                        key={order._id}
                      >
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3">
                          {orderTypeLabel(order.type)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Trạng thái đơn hàng ${order._id}`}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none transition-colors hover:bg-muted focus:ring-2 focus:ring-ring"
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
                        </td>
                        <td className="px-4 py-3">
                          {paymentLabel(order.payment)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(Number(order.total ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
                <ShoppingBag
                  aria-hidden
                  className="size-8 text-muted-foreground"
                />
                <div>
                  <h2 className="text-sm font-medium">Chưa có đơn hàng</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Đơn hàng mới sẽ hiển thị tại đây.
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
