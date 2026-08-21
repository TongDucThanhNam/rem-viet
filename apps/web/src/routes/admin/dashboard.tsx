import { Button } from "@rem-viet/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  Banknote,
  CalendarClock,
  ClipboardList,
  FilePenLine,
  Globe2,
  Image,
  PackageSearch,
  Plus,
  RefreshCw,
  ShoppingBag,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import AdminShell from "@/components/admin-shell";
import {
  AdminPageHeader,
  AsyncState,
  DashboardSkeleton,
  DashboardWidget,
  MetricCard,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { parseProductPrice } from "@/lib/price";
import { siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
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

type EditorialPage = {
  _id: string;
  scheduledAt: string | Date | null;
  slug: string;
  status: "draft" | "published";
  template: "landing" | "standard";
  title: string;
  updatedAt: string;
};

type EditorialPost = {
  _id: string;
  scheduledAt?: string | null;
  slug: string;
  status: "draft" | "published";
  title: string;
  updatedAt: string;
};

type EditorialReview = {
  assigneeIds: string[];
  documentId: string;
  documentType: "page" | "post";
  dueAt: string | null;
  note: string;
  overdue: boolean;
  requestedAt: string | Date | null;
  reviewVersion: number | null;
  slug: string;
  stale: boolean;
  title: string;
};

function AdminDashboardRoute() {
  const { session } = Route.useRouteContext();
  const trpc = useTRPC();
  const canReview =
    session?.capabilities.includes("content.review.decide") ?? false;
  const [analysisType, setAnalysisType] = useState<"price" | "stock" | "sales">(
    "price",
  );
  const ordersQuery = useQuery(trpc.orders.list.queryOptions());
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({ sort: "updatedAt", order: "desc" }),
  );
  const pagesQuery = useQuery(trpc.content.pages.adminList.queryOptions({}));
  const postsQuery = useQuery({
    ...trpc.content.posts.adminList.queryOptions({}),
    enabled: siteManifest.features.blog,
  });
  const reviewsQuery = useQuery({
    ...trpc.content.reviews.queue.queryOptions(),
    enabled: canReview,
  });
  const orders = ordersQuery.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const pages = (pagesQuery.data ?? []) as EditorialPage[];
  const posts = (postsQuery.data ?? []) as EditorialPost[];
  const newOrders = orders.filter((order) => order.status === "new");
  const completedOrders = orders.filter(
    (order) => order.status === "completed",
  );
  const cancelledOrders = orders.filter(
    (order) => order.status === "cancelled",
  );
  const revenue = orders.reduce(
    (total, order) => total + Number(order.total ?? 0),
    0,
  );
  const completedRevenue = completedOrders.reduce(
    (total, order) => total + Number(order.total ?? 0),
    0,
  );
  const averageOrderValue = orders.length ? revenue / orders.length : 0;
  const productStock = products.reduce(
    (sum, product) => sum + (product.quantity ?? 0),
    0,
  );
  const lowStockProducts = products.filter(
    (product) => Number(product.quantity ?? 0) <= 5,
  );
  const chartData = useMemo(
    () =>
      products.slice(0, 6).map((product) => ({
        name:
          product.name.length > 12
            ? `${product.name.slice(0, 12)}…`
            : product.name,
        price: parseProductPrice(product.price),
        stock: product.quantity ?? 0,
        sales: product.soldQuantity ?? 0,
      })),
    [products],
  );
  const customers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; orders: number; total: number }
    >();
    for (const order of orders) {
      const phone = order.phoneNumber || order.email || order._id;
      const name =
        [order.lastName, order.firstName].filter(Boolean).join(" ").trim() ||
        "Khách hàng";
      const current = map.get(phone) ?? { name, phone, orders: 0, total: 0 };
      current.orders += 1;
      current.total += Number(order.total ?? 0);
      map.set(phone, current);
    }
    return [...map.values()].sort((a, b) =>
      b.total === a.total ? b.orders - a.orders : b.total - a.total,
    );
  }, [orders]);
  const retry = () => {
    void ordersQuery.refetch();
    void productsQuery.refetch();
    void pagesQuery.refetch();
    if (siteManifest.features.blog) void postsQuery.refetch();
    if (canReview) void reviewsQuery.refetch();
  };
  const hasOrdersData = ordersQuery.data !== undefined;
  const hasProductsData = productsQuery.data !== undefined;
  const hasQueryError = ordersQuery.isError || productsQuery.isError;
  const isInitialLoading =
    !hasOrdersData &&
    !hasProductsData &&
    !hasQueryError &&
    (ordersQuery.isLoading || productsQuery.isLoading);
  const hasScopedIssue =
    hasQueryError ||
    (!hasOrdersData && !isInitialLoading) ||
    (!hasProductsData && !isInitialLoading);
  const hasEditorialError =
    pagesQuery.isError ||
    (siteManifest.features.blog && postsQuery.isError) ||
    (canReview && reviewsQuery.isError);
  const dataStatus =
    ordersQuery.isFetching ||
    productsQuery.isFetching ||
    pagesQuery.isFetching ||
    postsQuery.isFetching
      ? "Đang cập nhật dữ liệu…"
      : hasQueryError || hasEditorialError
        ? hasOrdersData || hasProductsData
          ? "Một phần dữ liệu chưa thể cập nhật"
          : "Chưa thể tải dữ liệu"
        : "Dữ liệu đã sẵn sàng";

  return (
    <AdminShell hideHeading>
      <div className="grid gap-5">
        <AdminPageHeader
          actions={
            <>
              <Button onClick={retry} variant="outline">
                <RefreshCw aria-hidden />
                Làm mới
              </Button>
              <Button render={<Link to="/admin/orders/new" />}>
                <Plus aria-hidden />
                Tạo đơn hàng
              </Button>
            </>
          }
          eyebrow={<span role="status">{dataStatus}</span>}
        />
        {hasScopedIssue ? (
          <DashboardDataNotice
            hasOrdersData={hasOrdersData}
            hasProductsData={hasProductsData}
            onRetry={retry}
            ordersError={ordersQuery.error}
            ordersLoading={ordersQuery.isLoading}
            productsError={productsQuery.error}
            productsLoading={productsQuery.isLoading}
          />
        ) : null}
        <EditorialCommandCenter
          error={pagesQuery.error ?? postsQuery.error ?? reviewsQuery.error}
          loading={
            pagesQuery.isLoading ||
            (siteManifest.features.blog && postsQuery.isLoading) ||
            (canReview && reviewsQuery.isLoading)
          }
          onRetry={() => {
            void pagesQuery.refetch();
            if (siteManifest.features.blog) void postsQuery.refetch();
            if (canReview) void reviewsQuery.refetch();
          }}
          pages={pages}
          posts={posts}
          reviews={(reviewsQuery.data ?? []) as EditorialReview[]}
          reviewsEnabled={canReview}
        />
        {isInitialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <section
              aria-label="Chỉ số chính"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <MetricCard
                context={`${formatCurrency(completedRevenue)} từ đơn hoàn thành`}
                icon={Banknote}
                label="Tổng doanh thu"
                value={hasOrdersData ? formatCurrency(revenue) : "—"}
              />
              <MetricCard
                context={
                  hasOrdersData
                    ? `${newOrders.length} đơn mới cần xử lý`
                    : "Dữ liệu đơn hàng chưa sẵn sàng"
                }
                icon={ClipboardList}
                label="Đơn hàng"
                value={hasOrdersData ? String(orders.length) : "—"}
              />
              <MetricCard
                context={
                  hasProductsData
                    ? `${productStock} sản phẩm đang ghi nhận trong kho`
                    : "Dữ liệu tồn kho chưa sẵn sàng"
                }
                icon={TriangleAlert}
                label="Tồn kho thấp"
                value={hasProductsData ? String(lowStockProducts.length) : "—"}
              />
              <MetricCard
                context={
                  hasOrdersData
                    ? `${formatCurrency(averageOrderValue)} mỗi đơn`
                    : "Dữ liệu khách hàng chưa sẵn sàng"
                }
                icon={Users}
                label="Khách hàng nhận diện"
                value={hasOrdersData ? String(customers.length) : "—"}
              />
            </section>
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
              {hasProductsData ? (
                <ProductAnalysisCard
                  analysisType={analysisType}
                  data={chartData}
                  onAnalysisTypeChange={setAnalysisType}
                />
              ) : (
                <UnavailableDashboardWidget
                  description="Không thể hiển thị biểu đồ khi dữ liệu sản phẩm chưa sẵn sàng."
                  error={productsQuery.error}
                  loading={productsQuery.isLoading}
                  onRetry={() => void productsQuery.refetch()}
                  title="Phân tích sản phẩm"
                />
              )}
              <AttentionPanel
                cancelled={hasOrdersData ? cancelledOrders.length : null}
                lowStock={hasProductsData ? lowStockProducts.length : null}
                newOrders={hasOrdersData ? newOrders.length : null}
              />
            </section>
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              {hasOrdersData ? (
                <RecentOrders orders={orders.slice(0, 5)} />
              ) : (
                <UnavailableDashboardWidget
                  description="Không thể hiển thị đơn gần nhất khi dữ liệu đơn hàng chưa sẵn sàng."
                  error={ordersQuery.error}
                  loading={ordersQuery.isLoading}
                  onRetry={() => void ordersQuery.refetch()}
                  title="Đơn hàng gần nhất"
                />
              )}
              {hasOrdersData ? (
                <TopCustomers customers={customers.slice(0, 5)} />
              ) : (
                <UnavailableDashboardWidget
                  description="Không thể tổng hợp khách hàng khi dữ liệu đơn hàng chưa sẵn sàng."
                  error={ordersQuery.error}
                  loading={ordersQuery.isLoading}
                  onRetry={() => void ordersQuery.refetch()}
                  title="Khách hàng nổi bật"
                />
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function EditorialCommandCenter({
  error,
  loading,
  onRetry,
  pages,
  posts,
  reviews,
  reviewsEnabled,
}: {
  error: { message?: string } | null;
  loading: boolean;
  onRetry: () => void;
  pages: EditorialPage[];
  posts: EditorialPost[];
  reviews: EditorialReview[];
  reviewsEnabled: boolean;
}) {
  const items = [
    ...pages.map((page) => ({
      id: page._id,
      kind: "page" as const,
      scheduledAt: page.scheduledAt,
      status: page.status,
      template: page.template,
      title: page.title,
      updatedAt: page.updatedAt,
    })),
    ...posts.map((post) => ({
      id: post._id,
      kind: "post" as const,
      scheduledAt: post.scheduledAt ?? null,
      status: post.status,
      template: undefined,
      title: post.title,
      updatedAt: post.updatedAt,
    })),
  ].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  const drafts = items.filter((item) => item.status === "draft").length;
  const scheduled = items.filter((item) => Boolean(item.scheduledAt)).length;
  const published = items.filter((item) => item.status === "published").length;
  const pendingReviews = reviews.filter((review) => !review.stale);
  const scheduledReviews = pendingReviews.filter((review) => review.dueAt);
  const overdueReviews = pendingReviews.filter((review) => review.overdue);
  const hasData = pages.length > 0 || posts.length > 0;
  const dateLabel = (value: string | Date) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Không rõ thời điểm"
      : date.toLocaleString("vi-VN", {
          dateStyle: "short",
          timeStyle: "short",
        });
  };

  return (
    <section
      aria-labelledby="editorial-command-heading"
      className="overflow-hidden border bg-foreground text-background"
    >
      <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-background/70">
            <span className="inline-flex items-center gap-1.5">
              <FilePenLine aria-hidden className="size-3.5" />
              Không gian biên tập
            </span>
            <span aria-hidden>·</span>
            <span>{items.length} nội dung có cấu trúc</span>
          </div>
          <h2
            className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl"
            id="editorial-command-heading"
          >
            Nội dung đang chuyển động
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-background/70 sm:text-sm">
            Một điểm bắt đầu cho bản nháp, lịch xuất bản và các thay đổi vừa
            diễn ra trên website.
          </p>

          <div
            aria-label="Tổng quan nội dung"
            className="mt-6 grid grid-cols-2 gap-px bg-background/15 sm:grid-cols-4"
            role="list"
          >
            {[
              { label: "Tổng nội dung", value: items.length },
              { label: "Bản nháp", value: drafts },
              { label: "Đang chờ lịch", value: scheduled },
              reviewsEnabled
                ? { label: "Chờ duyệt", value: pendingReviews.length }
                : { label: "Đã xuất bản", value: published },
            ].map((metric) => (
              <div
                className="bg-foreground p-3 sm:p-4"
                key={metric.label}
                role="listitem"
              >
                <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                  {loading && !hasData ? "—" : metric.value}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-background/70">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-9 items-center gap-2 bg-background px-3 text-xs font-medium text-foreground outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-background/70"
              to="/admin/home"
            >
              <Globe2 aria-hidden className="size-3.5" />
              Mở canvas trang chủ
            </Link>
            {siteManifest.features.blog ? (
              <Link
                className="inline-flex min-h-9 items-center gap-2 border border-background/25 px-3 text-xs font-medium outline-none transition-colors hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-background/70"
                to="/admin/posts/new"
              >
                <FilePenLine aria-hidden className="size-3.5" />
                Viết bài mới
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-9 items-center gap-2 border border-background/25 px-3 text-xs font-medium outline-none transition-colors hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-background/70"
              to="/admin/media"
            >
              <Image aria-hidden className="size-3.5" />
              Chọn media
            </Link>
          </div>
        </div>

        <div className="border-t border-background/15 bg-background/[0.06] p-4 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div>
              <h3 className="text-xs font-medium">
                {reviews.length
                  ? scheduledReviews.length
                    ? "Lịch xét duyệt"
                    : "Hàng đợi xét duyệt"
                  : "Thay đổi gần đây"}
              </h3>
              <p className="mt-0.5 text-[10px] text-background/70">
                {reviews.length
                  ? `${pendingReviews.length} yêu cầu còn hiệu lực${
                      overdueReviews.length
                        ? ` · ${overdueReviews.length} quá hạn`
                        : ""
                    }`
                  : "Từ dữ liệu biên tập hiện tại"}
              </p>
            </div>
            <CalendarClock aria-hidden className="size-4 text-background/55" />
          </div>

          {error && !hasData ? (
            <div className="grid min-h-48 place-items-center border border-background/15 p-5 text-center">
              <div>
                <p className="text-xs font-medium">Chưa thể tải nội dung</p>
                <p className="mt-1 text-[10px] leading-4 text-background/70">
                  {error.message || "Dữ liệu biên tập chưa sẵn sàng."}
                </p>
                <button
                  className="mt-3 border border-background/25 px-3 py-2 text-[11px] font-medium hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
                  onClick={onRetry}
                  type="button"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : reviews.length ? (
            <div className="divide-y divide-background/10 border-y border-background/10">
              {reviews.slice(0, 5).map((review) => {
                const className =
                  "flex min-h-14 items-center gap-3 px-1 py-2 outline-none transition-colors hover:bg-background/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-background/70";
                const content = (
                  <>
                    <span className="grid size-8 shrink-0 place-items-center border border-background/15 text-background/60">
                      {review.documentType === "post" ? (
                        <FilePenLine aria-hidden className="size-3.5" />
                      ) : (
                        <Globe2 aria-hidden className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {review.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-background/70">
                        v{review.reviewVersion} ·{" "}
                        {review.dueAt
                          ? `Hạn ${dateLabel(review.dueAt)}`
                          : review.requestedAt
                            ? `Gửi ${dateLabel(review.requestedAt)}`
                            : "Không rõ thời điểm"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-background/70">
                      {review.stale
                        ? "Đã cũ"
                        : review.overdue
                          ? "Quá hạn"
                          : "Chờ duyệt"}
                    </span>
                  </>
                );

                if (review.documentType === "post") {
                  return (
                    <Link
                      className={className}
                      key={`review:post:${review.documentId}`}
                      params={{ postId: review.documentId }}
                      to="/admin/posts/$postId/edit"
                    >
                      {content}
                    </Link>
                  );
                }
                if (review.slug === "home") {
                  return (
                    <Link
                      className={className}
                      key={`review:page:${review.documentId}`}
                      to="/admin/home"
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <Link
                    className={className}
                    key={`review:page:${review.documentId}`}
                    search={{ pageId: review.documentId }}
                    to="/admin/pages"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ) : items.length ? (
            <div className="divide-y divide-background/10 border-y border-background/10">
              {items.slice(0, 5).map((item) => {
                const content = (
                  <>
                    <span className="grid size-8 shrink-0 place-items-center border border-background/15 text-background/60">
                      {item.kind === "post" ? (
                        <FilePenLine aria-hidden className="size-3.5" />
                      ) : (
                        <Globe2 aria-hidden className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-background/70">
                        {item.kind === "post" ? "Bài viết" : "Trang"} ·{" "}
                        {dateLabel(item.updatedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-background/70">
                      {item.scheduledAt
                        ? "Đã lên lịch"
                        : item.status === "published"
                          ? "Công khai"
                          : "Bản nháp"}
                    </span>
                  </>
                );
                const className =
                  "flex min-h-14 items-center gap-3 px-1 py-2 outline-none transition-colors hover:bg-background/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-background/70";

                return item.kind === "post" ? (
                  <Link
                    className={className}
                    key={`post:${item.id}`}
                    params={{ postId: item.id }}
                    to="/admin/posts/$postId/edit"
                  >
                    {content}
                  </Link>
                ) : (
                  <Link
                    className={className}
                    key={`page:${item.id}`}
                    to={
                      item.template === "landing"
                        ? "/admin/home"
                        : "/admin/pages"
                    }
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center border border-dashed border-background/20 p-5 text-center">
              <div>
                <p className="text-xs font-medium">
                  {loading ? "Đang tải nội dung" : "Chưa có nội dung"}
                </p>
                <p className="mt-1 text-[10px] text-background/70">
                  Nội dung mới sẽ xuất hiện tại đây.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DashboardDataNotice({
  hasOrdersData,
  hasProductsData,
  onRetry,
  ordersError,
  ordersLoading,
  productsError,
  productsLoading,
}: {
  hasOrdersData: boolean;
  hasProductsData: boolean;
  onRetry: () => void;
  ordersError: { message?: string } | null;
  ordersLoading: boolean;
  productsError: { message?: string } | null;
  productsLoading: boolean;
}) {
  const hasError = Boolean(ordersError || productsError);
  const stateLabel = (
    hasData: boolean,
    loading: boolean,
    error: { message?: string } | null,
  ) => {
    if (error && hasData) return "đang dùng dữ liệu gần nhất; làm mới thất bại";
    if (error) return "không thể tải";
    if (loading) return "đang tải";
    return hasData ? "sẵn sàng" : "chưa sẵn sàng";
  };

  return (
    <section
      className={
        hasError
          ? "flex flex-col gap-3 border border-destructive-soft-foreground/20 bg-destructive-soft p-4 text-destructive-soft-foreground sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 border border-info-foreground/20 bg-info p-4 text-info-foreground sm:flex-row sm:items-center sm:justify-between"
      }
      role={hasError ? "alert" : "status"}
    >
      <div>
        <h2 className="text-sm font-medium">
          {hasError
            ? "Một phần báo cáo chưa sẵn sàng"
            : "Đang hoàn tất báo cáo"}
        </h2>
        <ul className="mt-1 grid gap-0.5 text-xs">
          <li>
            Đơn hàng: {stateLabel(hasOrdersData, ordersLoading, ordersError)}
          </li>
          <li>
            Sản phẩm:{" "}
            {stateLabel(hasProductsData, productsLoading, productsError)}
          </li>
        </ul>
      </div>
      <Button className="shrink-0" onClick={onRetry} variant="outline">
        Thử tải lại
      </Button>
    </section>
  );
}

function UnavailableDashboardWidget({
  description,
  error,
  loading,
  onRetry,
  title,
}: {
  description: string;
  error: { message?: string } | null;
  loading: boolean;
  onRetry: () => void;
  title: string;
}) {
  return (
    <DashboardWidget description={description} title={title}>
      <AsyncState
        action={
          error ? (
            <Button onClick={onRetry} variant="outline">
              Thử lại
            </Button>
          ) : undefined
        }
        description={
          error
            ? error.message || description
            : "Dữ liệu sẽ xuất hiện ngay khi tải xong."
        }
        title={loading ? "Đang tải dữ liệu" : "Dữ liệu chưa sẵn sàng"}
        tone={error ? "error" : "empty"}
      />
    </DashboardWidget>
  );
}

function AttentionPanel({
  cancelled,
  lowStock,
  newOrders,
}: {
  cancelled: number | null;
  lowStock: number | null;
  newOrders: number | null;
}) {
  const values = [cancelled, lowStock, newOrders].filter(
    (value): value is number => value !== null,
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  const isPartial = values.length < 3;
  return (
    <DashboardWidget
      action={
        <StatusBadge status={total ? "warning" : "success"}>
          {isPartial ? "Dữ liệu một phần" : `${total} việc`}
        </StatusBadge>
      }
      description={
        isPartial
          ? "Các mục chưa tải được đánh dấu riêng; dữ liệu hợp lệ vẫn được giữ lại."
          : "Ngoại lệ vận hành cần được kiểm tra trước."
      }
      title="Cần chú ý"
    >
      <div className="divide-y">
        <AttentionRow
          count={newOrders}
          href="/admin/orders"
          icon={ShoppingBag}
          label="Đơn mới"
          status="info"
        />
        <AttentionRow
          count={cancelled}
          href="/admin/orders"
          icon={ClipboardList}
          label="Đơn đã hủy"
          status={cancelled ? "destructive" : "neutral"}
        />
        <AttentionRow
          count={lowStock}
          href="/admin/inventory"
          icon={PackageSearch}
          label="Mặt hàng tồn thấp"
          status={lowStock ? "warning" : "neutral"}
        />
      </div>
    </DashboardWidget>
  );
}

function AttentionRow({
  count,
  href,
  icon: Icon,
  label,
  status,
}: {
  count: number | null;
  href: "/admin/orders" | "/admin/inventory";
  icon: typeof ShoppingBag;
  label: string;
  status: "info" | "warning" | "destructive" | "neutral";
}) {
  return (
    <Link
      className="flex min-h-14 items-center gap-3 py-3 text-xs hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      to={href}
    >
      <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <StatusBadge status={count === null ? "neutral" : status}>
        {count === null ? "Chưa tải" : count}
      </StatusBadge>
    </Link>
  );
}

function RecentOrders({
  orders,
}: {
  orders: Array<{
    _id: string;
    createdAt: string | Date;
    firstName?: string | null;
    lastName?: string | null;
    status?: string | null;
    total?: string | number | null;
  }>;
}) {
  return (
    <DashboardWidget
      action={
        <Button render={<Link to="/admin/orders" />} size="sm" variant="ghost">
          Xem tất cả
        </Button>
      }
      description="Năm đơn hàng mới nhất trong dữ liệu hiện tại."
      title="Đơn hàng gần nhất"
    >
      {orders.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Giá trị</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Ngày
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order._id}>
                <TableCell className="font-medium">
                  {[order.lastName, order.firstName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "Khách hàng"}
                </TableCell>
                <TableCell>
                  <OrderStatus status={order.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(Number(order.total ?? 0))}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                  {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <AsyncState
          action={
            <Button render={<Link to="/admin/orders/new" />} variant="outline">
              Tạo đơn hàng
            </Button>
          }
          description="Đơn hàng mới sẽ xuất hiện tại đây để bạn xử lý nhanh."
          title="Chưa có đơn hàng"
        />
      )}
    </DashboardWidget>
  );
}

function OrderStatus({ status }: { status?: string | null }) {
  if (status === "completed")
    return <StatusBadge status="success">Hoàn thành</StatusBadge>;
  if (status === "cancelled")
    return <StatusBadge status="destructive">Đã hủy</StatusBadge>;
  if (status === "new") return <StatusBadge status="info">Đơn mới</StatusBadge>;
  return <StatusBadge status="neutral">{status || "Chưa rõ"}</StatusBadge>;
}

function TopCustomers({
  customers,
}: {
  customers: Array<{
    name: string;
    phone: string;
    orders: number;
    total: number;
  }>;
}) {
  return (
    <DashboardWidget
      description="Xếp theo tổng giá trị đơn hàng hiện có."
      title="Khách hàng nổi bật"
    >
      {customers.length ? (
        <div className="divide-y">
          {customers.map((customer) => (
            <div
              className="flex min-h-14 items-center gap-3 py-3"
              key={customer.phone}
            >
              <div className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-medium">
                {customer.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{customer.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {customer.orders} đơn hàng
                </p>
              </div>
              <span className="text-xs font-medium tabular-nums">
                {formatCurrency(customer.total)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <AsyncState
          description="Khách hàng sẽ được nhận diện từ thông tin liên hệ trên đơn hàng."
          title="Chưa có dữ liệu khách hàng"
        />
      )}
    </DashboardWidget>
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
  const max = Math.max(...data.map((item) => item[analysisType]), 1);
  const labels = { price: "Giá", stock: "Tồn kho", sales: "Doanh số" } as const;
  const format =
    analysisType === "price"
      ? formatCurrency
      : (value: number) => new Intl.NumberFormat("vi-VN").format(value);
  return (
    <DashboardWidget
      action={
        <select
          aria-label="Loại phân tích"
          className="h-8 border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      }
      description={`Sáu sản phẩm cập nhật gần nhất · ${labels[analysisType]}`}
      title="Phân tích sản phẩm"
    >
      {data.length ? (
        <div
          aria-label={`Biểu đồ ${labels[analysisType].toLowerCase()} sản phẩm`}
          className="flex min-h-56 items-end gap-3 overflow-x-auto border-b border-l px-3 pt-4"
          role="img"
        >
          {data.map((item) => {
            const value = item[analysisType];
            return (
              <div
                className="flex h-48 min-w-16 flex-1 flex-col justify-end gap-2"
                key={item.name}
              >
                <div className="flex flex-1 items-end justify-center">
                  <div
                    aria-hidden
                    className="w-full max-w-12 bg-chart-2"
                    style={{ height: `${Math.max((value / max) * 100, 4)}%` }}
                  />
                </div>
                <div className="pb-2 text-center">
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.name}
                  </p>
                  <p className="text-[10px] font-medium tabular-nums">
                    {format(value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <AsyncState
          action={
            <Button
              render={<Link to="/admin/products/new" />}
              variant="outline"
            >
              Thêm sản phẩm
            </Button>
          }
          description="Thêm sản phẩm để bắt đầu theo dõi giá, tồn kho và doanh số."
          title="Chưa có sản phẩm để phân tích"
        />
      )}
    </DashboardWidget>
  );
}
