import { Card, CardContent } from "@rem-viet/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  PackageSearch,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { parseProductPrice } from "@/lib/price";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardRoute,
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

function AdminDashboardRoute() {
  const trpc = useTRPC();
  const [analysisType, setAnalysisType] = useState<"price" | "stock" | "sales">(
    "price",
  );
  const ordersQuery = useQuery(trpc.orders.list.queryOptions());
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({
      sort: "updatedAt",
      order: "desc",
    }),
  );
  const orders = ordersQuery.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const newOrders = orders.filter((order) => order.status === "new");
  const completedOrders = orders.filter((order) => order.status === "completed");
  const cancelledOrders = orders.filter((order) => order.status === "cancelled");
  const revenue = orders.reduce(
    (total, order) => total + Number(order.total ?? 0),
    0,
  );
  const completedRevenue = completedOrders.reduce(
    (total, order) => total + Number(order.total ?? 0),
    0,
  );
  const averageOrderValue = orders.length ? revenue / orders.length : 0;
  const productSales = products.reduce(
    (sum, product) => sum + (product.soldQuantity ?? 0),
    0,
  );
  const productStock = products.reduce(
    (sum, product) => sum + (product.quantity ?? 0),
    0,
  );
  const chartData = useMemo(
    () =>
      products.slice(0, 6).map((product) => ({
        name:
          product.name.length > 12
            ? `${product.name.slice(0, 12)}...`
            : product.name,
        price: parseProductPrice(product.price),
        stock: product.quantity ?? 0,
        sales: product.soldQuantity ?? 0,
      })),
    [products],
  );
  const recentOrders = orders.slice(0, 5);
  const activeProducts = products.filter(
    (product) => product.isActive && !product.isDeleted,
  );
  const hiddenProducts = products.filter(
    (product) => !product.isActive || product.isDeleted,
  );
  const lowStockProducts = products.filter(
    (product) => Number(product.quantity ?? 0) <= 5,
  );
  const customers = useMemo(() => {
    const customerMap = new Map<
      string,
      {
        name: string;
        phone: string;
        orders: number;
        total: number;
      }
    >();

    for (const order of orders) {
      const phone = order.phoneNumber || order.email || order._id;
      const name =
        [order.lastName, order.firstName].filter(Boolean).join(" ").trim() ||
        "Khách hàng";
      const current = customerMap.get(phone) ?? {
        name,
        phone,
        orders: 0,
        total: 0,
      };

      current.orders += 1;
      current.total += Number(order.total ?? 0);
      customerMap.set(phone, current);
    }

    return Array.from(customerMap.values()).sort((left, right) =>
      right.total === left.total
        ? right.orders - left.orders
        : right.total - left.total,
    );
  }, [orders]);
  const topCustomers = customers.slice(0, 6);

  return (
    <AdminShell hideHeading legacyContentFrame title="Báo cáo">
      <div className="h-full lg:px-6">
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap justify-center gap-4 px-4 pt-3 sm:pt-10 lg:px-0 xl:flex-nowrap xl:gap-6">
          <div className="mt-6 flex w-full flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold tracking-normal">Báo cáo</h3>
              <div className="grid w-full grid-cols-1 justify-center gap-5 md:grid-cols-2 2xl:grid-cols-3">
                <DashboardStatCard
                  detail={`${orders.length} Đơn hàng`}
                  icon={<TrendingUp aria-hidden className="size-5" />}
                  metric={formatCurrency(revenue)}
                  sections={[
                    [
                      "Đã hoàn thành",
                      formatCurrency(completedRevenue),
                      "Doanh thu",
                      "text-emerald-400",
                      "✓",
                    ],
                    [
                      "Trung bình",
                      formatCurrency(averageOrderValue),
                      "Mỗi đơn",
                      "text-sky-200",
                      "÷",
                    ],
                    [
                      "Khách hàng",
                      String(customers.length),
                      "Liên hệ",
                      "text-yellow-300",
                      "★",
                    ],
                  ]}
                  title="Doanh thu tháng"
                  tone="primary"
                  trend={`${orders.length} đơn`}
                />
                <DashboardStatCard
                  detail={`${formatCurrency(revenue)} Tổng doanh thu`}
                  icon={<ClipboardList aria-hidden className="size-5" />}
                  metric={`${orders.length}`}
                  metricSuffix="Đơn hàng"
                  sections={[
                    [
                      "Đơn hoàn thành",
                      String(completedOrders.length),
                      "Đơn hàng",
                      "text-green-500",
                      "✓",
                    ],
                    [
                      "Đơn hủy",
                      String(cancelledOrders.length),
                      "Đơn hàng",
                      "text-red-500",
                      "×",
                    ],
                    [
                      "Đơn mới",
                      String(newOrders.length),
                      "Cần xử lý",
                      "text-yellow-500",
                      "!",
                    ],
                  ]}
                  title="Báo cáo đơn hàng"
                  tone="blue"
                  trend={`${newOrders.length} mới`}
                />
                <DashboardStatCard
                  detail={`${productSales} Giao dịch trong tháng`}
                  icon={<PackageSearch aria-hidden className="size-5" />}
                  metric={`${products.length}`}
                  metricSuffix="Tổng sản phẩm"
                  sections={[
                    [
                      "Nhập kho",
                      String(productStock),
                      "Sản phẩm",
                      "text-emerald-400",
                      "↙",
                    ],
                    [
                      "Xuất kho",
                      String(productSales),
                      "Sản phẩm",
                      "text-red-400",
                      "↗",
                    ],
                    [
                      "Sản phẩm hot",
                      String(activeProducts.length),
                      "Mặt hàng",
                      "text-yellow-400",
                      "★",
                    ],
                    [
                      "Tồn thấp",
                      String(lowStockProducts.length),
                      "Mặt hàng",
                      "text-orange-300",
                      "!",
                    ],
                  ]}
                  title="Tình hình sản phẩm"
                  tone="primary"
                  trend={`${hiddenProducts.length} ẩn/xóa`}
                />
              </div>
            </div>

            <div className="flex h-full flex-col gap-2">
              <h3 className="text-xl font-semibold tracking-normal">
                Thống kê
              </h3>
              <ProductAnalysisCard
                analysisType={analysisType}
                data={chartData}
                onAnalysisTypeChange={setAnalysisType}
              />
            </div>
          </div>

          <aside className="mt-4 flex w-full flex-col gap-2 xl:max-w-md">
            <h3 className="text-xl font-semibold tracking-normal">Mục lục</h3>
            <div className="flex flex-col flex-wrap justify-center gap-4 md:flex-nowrap">
              <Card className="w-full rounded-xl bg-background px-4 py-6 shadow-md">
                <CardContent className="flex flex-col gap-6 py-5">
                  <div className="flex justify-center gap-2.5">
                    <div className="flex flex-col rounded-xl border-2 border-dashed border-divider px-6 py-2">
                      <span className="text-xl font-semibold">
                        Khách hàng thân thiết
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                    <span className="text-xs">
                      Danh sách khách hàng thân thiết
                    </span>
                    {topCustomers.length ? (
                      <div className="grid w-full gap-3">
                        {topCustomers.map((customer) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-md border p-3"
                            key={customer.phone}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {customer.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {customer.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {customer.orders} đơn
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-emerald-600">
                              {formatCurrency(customer.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Chưa có dữ liệu khách hàng.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full rounded-xl bg-background px-3 shadow-md">
                <CardContent className="flex flex-col gap-4 py-5">
                  <div className="flex justify-center gap-2.5">
                    <div className="flex flex-col rounded-xl border-2 border-dashed border-divider px-6 py-2">
                      <span className="text-xl font-semibold">
                        Các đơn hàng gần nhất
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    {ordersQuery.isLoading ? (
                      <div className="text-sm text-muted-foreground">
                        Đang tải...
                      </div>
                    ) : recentOrders.length ? (
                      recentOrders.map((order) => (
                        <div
                          className="grid w-full grid-cols-4 items-center gap-2"
                          key={order._id}
                        >
                          <div className="w-full">
                            <div className="grid size-10 place-items-center rounded-full border-2 border-secondary bg-muted text-xs font-semibold">
                              {[order.lastName, order.firstName]
                                .filter(Boolean)
                                .join("")
                                .slice(0, 2)
                                .toUpperCase() || "KH"}
                            </div>
                          </div>
                          <span className="truncate font-semibold">
                            {order.lastName} {order.firstName}
                          </span>
                          <div>
                            <span className="text-xs text-emerald-600">
                              {formatCurrency(Number(order.total ?? 0))}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Chưa có đơn hàng.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Card className="rounded-xl">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Đơn mới</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {newOrders.length}
                      </p>
                    </div>
                    <ShoppingBag
                      aria-hidden
                      className="size-7 text-muted-foreground"
                    />
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Khách hàng
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {customers.length}
                      </p>
                    </div>
                    <Users
                      aria-hidden
                      className="size-7 text-muted-foreground"
                    />
                  </CardContent>
                </Card>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}

function DashboardStatCard({
  detail,
  icon,
  metric,
  metricSuffix,
  sections,
  title,
  tone,
  trend,
}: {
  detail: string;
  icon: ReactNode;
  metric: string;
  metricSuffix?: string;
  sections: Array<[string, string, string, string, string]>;
  title: string;
  tone: "primary" | "blue";
  trend: string;
}) {
  const isPrimary = tone === "primary";

  return (
    <Card
      className={`w-full max-w-md rounded-xl shadow-md ${isPrimary ? "bg-primary text-primary-foreground" : "bg-blue-700 text-white"}`}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h1
            className={
              isPrimary ? "text-sm font-medium" : "text-lg font-semibold"
            }
          >
            {title}
          </h1>
          <div
            className={
              isPrimary ? "text-primary-foreground/70" : "text-white/70"
            }
          >
            {icon}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div
            className={
              metricSuffix ? "flex flex-col" : "flex items-center gap-2"
            }
          >
            <span className="text-2xl font-bold">{metric}</span>
            {metricSuffix ? (
              <span
                className={
                  isPrimary
                    ? "text-sm text-primary-foreground/70"
                    : "text-sm text-white/70"
                }
              >
                {metricSuffix}
              </span>
            ) : null}
          </div>
          <div className="flex items-center text-sm text-emerald-400">
            <span>{trend}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BarChart3
            aria-hidden
            className={
              isPrimary
                ? "size-4 text-primary-foreground/70"
                : "size-4 text-white/70"
            }
          />
          <span className={metricSuffix ? "text-lg font-semibold" : "text-sm"}>
            {detail}
          </span>
        </div>

        <div
          className={`grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3 ${sections.length > 3 ? "lg:grid-cols-4" : ""} ${isPrimary ? "border-primary-foreground/20" : "border-white/20"}`}
        >
          {sections.map(([label, value, unit, valueClass, marker]) => (
            <div className="flex flex-col" key={label}>
              <span
                className={
                  isPrimary
                    ? "text-xs text-primary-foreground/70"
                    : "text-xs text-white/70"
                }
              >
                {label}
              </span>
              <div className="flex items-center gap-1">
                <span className={`text-sm font-semibold ${valueClass}`}>
                  {marker}
                </span>
                <span className="text-sm">{value}</span>
              </div>
              <span
                className={
                  isPrimary
                    ? "text-xs text-primary-foreground/70"
                    : "text-xs text-white/70"
                }
              >
                {unit}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductAnalysisCard({
  analysisType,
  data,
  onAnalysisTypeChange,
}: {
  analysisType: "price" | "stock" | "sales";
  data: Array<{ name: string; price: number; stock: number; sales: number }>;
  onAnalysisTypeChange: (value: "price" | "stock" | "sales") => void;
}) {
  const maxValue = Math.max(...data.map((item) => item[analysisType]), 1);
  const [hoveredItemName, setHoveredItemName] = useState<string | null>(null);
  const hoveredItem = data.find((item) => item.name === hoveredItemName);
  const labelMap = {
    price: "Giá",
    stock: "Tồn kho",
    sales: "Doanh số",
  } as const;
  const valueFormatter =
    analysisType === "price"
      ? formatCurrency
      : (value: number) =>
          new Intl.NumberFormat("vi-VN", {
            maximumFractionDigits: 0,
          }).format(value);
  const yTicks = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

  return (
    <Card className="mx-auto w-full max-w-3xl rounded-xl">
      <CardContent className="grid gap-4">
        <div className="text-sm font-semibold">Phân tích sản phẩm</div>
        <label className="grid gap-2 text-sm">
          <span>Loại phân tích</span>
          <select
            aria-label="Loại phân tích"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={analysisType}
            onChange={(event) =>
              onAnalysisTypeChange(
                event.target.value as "price" | "stock" | "sales",
              )
            }
          >
            <option value="price">Giá</option>
            <option value="stock">Tồn kho</option>
            <option value="sales">Doanh số</option>
          </select>
        </label>
        {data.length ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-[#8884d8]" />
                <span>{labelMap[analysisType]}</span>
              </div>
              {hoveredItem ? (
                <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
                  <span className="font-medium text-foreground">
                    {hoveredItem.name}
                  </span>
                  <span className="ml-2">
                    {valueFormatter(hoveredItem[analysisType])}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="h-[300px] w-full overflow-x-auto">
              <div className="grid h-full min-w-[640px] grid-cols-[72px_1fr] grid-rows-[1fr_auto]">
                <div className="relative row-start-1 border-r border-muted-foreground/25">
                  {yTicks.map((tick, index) => (
                    <span
                      className="absolute right-3 -translate-y-1/2 text-[10px] text-muted-foreground"
                      key={`${tick}-${index}`}
                      style={{
                        top: `${(index / (yTicks.length - 1)) * 100}%`,
                      }}
                    >
                      {valueFormatter(Math.round(tick))}
                    </span>
                  ))}
                </div>
                <div className="relative row-start-1 border-b">
                  {yTicks.map((tick, index) => (
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-muted-foreground/20"
                      key={`${tick}-${index}`}
                      style={{
                        top: `${(index / (yTicks.length - 1)) * 100}%`,
                      }}
                    />
                  ))}
                  <div className="absolute inset-x-5 bottom-0 top-0 flex items-end gap-6">
                    {data.map((item) => {
                      const value = item[analysisType];

                      return (
                        <button
                          aria-label={`${item.name}: ${valueFormatter(value)}`}
                          className="group flex h-full min-w-20 flex-1 items-end justify-center"
                          key={item.name}
                          type="button"
                          onBlur={() => setHoveredItemName(null)}
                          onFocus={() => setHoveredItemName(item.name)}
                          onMouseEnter={() => setHoveredItemName(item.name)}
                          onMouseLeave={() => setHoveredItemName(null)}
                        >
                          <span
                            className="w-full rounded-t-sm bg-[#8884d8] transition-[height,filter] group-hover:brightness-110 group-focus-visible:brightness-110"
                            style={{
                              height: `${Math.max((value / maxValue) * 100, 4)}%`,
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="col-start-2 row-start-2 flex gap-6 px-5 pt-2">
                  {data.map((item) => (
                    <span
                      className="min-w-20 flex-1 text-center text-xs text-muted-foreground"
                      key={item.name}
                    >
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center border text-center text-sm text-muted-foreground">
            Chưa có sản phẩm để phân tích.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
