import { roleHasCapability } from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Gauge,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import AdminShell from "@/components/admin-shell";
import { AsyncState, StatusBadge } from "@/components/admin-ui";
import ReleaseConfidencePanel from "@/components/release-confidence-panel";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/performance")({
  component: PerformanceAdminRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "audit.read")) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
});

function formatMetric(name: string, value: number | null) {
  if (value === null) return "—";
  return name === "CLS"
    ? value.toFixed(3)
    : `${value.toLocaleString("vi-VN")} ms`;
}

const statusPresentation = {
  pass: { label: "Đạt", status: "success" },
  fail: { label: "Chưa đạt", status: "destructive" },
  insufficient: { label: "Chưa đủ mẫu", status: "warning" },
} as const;

const metricPresentation: Record<
  string,
  {
    eyebrow: string;
    description: string;
    action: string;
    accentClass: string;
  }
> = {
  LCP: {
    eyebrow: "Tốc độ tải",
    description: "Thời gian nội dung chính xuất hiện đầy đủ trên màn hình.",
    action: "Kiểm tra ảnh hero, font và thời gian phản hồi tài liệu chính.",
    accentClass: "bg-sky-500",
  },
  INP: {
    eyebrow: "Độ phản hồi",
    description: "Độ trễ khi khách nhấn, chạm hoặc tương tác với trang.",
    action: "Kiểm tra long task và handler trên hành trình có tương tác.",
    accentClass: "bg-violet-500",
  },
  CLS: {
    eyebrow: "Độ ổn định",
    description: "Mức dịch chuyển bất ngờ của bố cục trong lúc tải trang.",
    action: "Kiểm tra kích thước media, font tải muộn và nội dung chèn thêm.",
    accentClass: "bg-amber-500",
  },
};

const deviceLabels = {
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  desktop: "Máy tính",
} as const;

function PerformanceAdminRoute() {
  const trpc = useTRPC();
  const [days, setDays] = useState(28);
  const [path, setPath] = useState("");
  const [deviceClass, setDeviceClass] = useState("");
  const normalizedPath = path.trim();
  const validPath =
    !normalizedPath ||
    (normalizedPath.startsWith("/") &&
      !normalizedPath.startsWith("//") &&
      !/[\s\\?#]/u.test(normalizedPath));
  const query = useQuery({
    ...trpc.operations.vitals.summary.queryOptions({
      days,
      path: normalizedPath || undefined,
      deviceClass:
        deviceClass === "mobile" ||
        deviceClass === "tablet" ||
        deviceClass === "desktop"
          ? deviceClass
          : undefined,
    }),
    enabled: validPath,
  });
  const runtimeQuery = useQuery(
    trpc.operations.readiness.runtime.queryOptions(),
  );
  const metrics = query.data?.metrics ?? [];
  const passingMetrics = metrics.filter(
    (metric) => metric.status === "pass",
  ).length;
  const failingMetrics = metrics.filter(
    (metric) => metric.status === "fail",
  ).length;
  const totalSamples = metrics.reduce(
    (total, metric) => total + metric.sampleCount,
    0,
  );
  const minimumSamples = query.data?.minimumSamples ?? 75;
  const routeFacets = query.data?.facets.routes ?? [];
  const deviceFacets = query.data?.facets.devices ?? [];
  const deviceCount = (value: keyof typeof deviceLabels) =>
    deviceFacets.find((facet) => facet.value === value)?.sampleCount ?? 0;
  const overallStatus = failingMetrics
    ? "attention"
    : metrics.length > 0 && passingMetrics === metrics.length
      ? "healthy"
      : "collecting";
  const overall = {
    healthy: {
      label: "Trải nghiệm đang đạt chuẩn",
      description:
        "Tất cả Core Web Vitals đều nằm trong ngân sách hiệu năng đã chốt.",
      icon: CheckCircle2,
      badgeClass: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20",
    },
    attention: {
      label: "Có chỉ số cần ưu tiên",
      description:
        "Ít nhất một chỉ số p75 đã vượt ngân sách và cần được điều tra.",
      icon: ArrowUpRight,
      badgeClass: "bg-rose-400/15 text-rose-200 ring-rose-300/20",
    },
    collecting: {
      label: "Đang tích lũy bằng chứng",
      description:
        "Hệ thống cần thêm dữ liệu thực tế trước khi đưa ra kết luận.",
      icon: ArrowDownRight,
      badgeClass: "bg-amber-400/15 text-amber-100 ring-amber-300/20",
    },
  }[overallStatus];
  const OverallIcon = overall.icon;

  const downloadEvidence = () => {
    if (!query.data) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(query.data, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `web-vitals-${query.data.window.days}d-${query.data.generatedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      actions={
        <div className="flex gap-2">
          <Button
            disabled={!validPath || query.isFetching}
            onClick={() => void query.refetch()}
            variant="outline"
          >
            <RefreshCw className="size-4" />
            {query.isFetching ? "Đang làm mới…" : "Làm mới"}
          </Button>
          <Button
            disabled={!validPath || !query.data}
            onClick={downloadEvidence}
          >
            <Download className="size-4" />
            Tải bằng chứng JSON
          </Button>
        </div>
      }
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <section
          aria-labelledby="performance-overview-heading"
          className="relative overflow-hidden rounded-2xl bg-zinc-950 px-6 py-7 text-white shadow-xl shadow-black/10 sm:px-8 sm:py-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.24),transparent_34%),radial-gradient(circle_at_92%_18%,rgba(168,85,247,0.2),transparent_30%)]"
          />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/10">
                  <Activity className="size-3.5" />
                  Dữ liệu người dùng thực
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${overall.badgeClass}`}
                >
                  <OverallIcon className="size-3.5" />
                  {overall.label}
                </span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Performance intelligence
              </p>
              <h2
                className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
                id="performance-overview-heading"
              >
                Biết chính xác trải nghiệm khách hàng đang tốt đến đâu.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
                {overall.description} Báo cáo dùng p75 từ lưu lượng công khai,
                loại trừ cảm giác chủ quan và dữ liệu lab đơn lẻ.
              </p>
            </div>

            <div className="grid min-w-[280px] grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
              <div className="bg-white/[0.04] p-4">
                <p className="text-2xl font-semibold tabular-nums">
                  {query.isLoading
                    ? "—"
                    : `${passingMetrics}/${metrics.length}`}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-400">
                  Chỉ số đạt
                </p>
              </div>
              <div className="bg-white/[0.04] p-4">
                <p className="text-2xl font-semibold tabular-nums">
                  {query.isLoading ? "—" : totalSamples.toLocaleString("vi-VN")}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-400">
                  Tổng mẫu
                </p>
              </div>
              <div className="bg-white/[0.04] p-4">
                <p className="text-2xl font-semibold tabular-nums">{days}d</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-400">
                  Cửa sổ
                </p>
              </div>
            </div>
          </div>
        </section>

        <ReleaseConfidencePanel
          metrics={metrics}
          minimumSamples={minimumSamples}
          onRetry={() => {
            void query.refetch();
            void runtimeQuery.refetch();
          }}
          performanceError={query.isError}
          performanceLoading={query.isLoading}
          runtime={runtimeQuery.data ?? null}
          runtimeError={runtimeQuery.isError}
          runtimeLoading={runtimeQuery.isLoading}
        />

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="border-b pb-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-muted p-2.5">
                <Gauge className="size-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Phạm vi phân tích</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Khoanh vùng một hành trình cụ thể mà không làm thay đổi dữ
                  liệu gốc.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="vitals-window">Cửa sổ đo</Label>
              <select
                className="h-10 rounded-lg border bg-background px-3 text-sm shadow-xs"
                id="vitals-window"
                onChange={(event) => setDays(Number(event.target.value))}
                value={days}
              >
                <option value={7}>7 ngày</option>
                <option value={28}>28 ngày</option>
                <option value={90}>90 ngày</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vitals-path">
                Đường dẫn chính xác (tùy chọn)
              </Label>
              <Input
                aria-invalid={!validPath}
                id="vitals-path"
                onChange={(event) => setPath(event.target.value)}
                placeholder="/ hoặc /bai-viet"
                value={path}
              />
              {!validPath ? (
                <p className="text-xs text-destructive">
                  Chỉ nhập đường dẫn nội bộ, không có tham số truy vấn hoặc mảnh
                  neo.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vitals-device">Thiết bị</Label>
              <select
                className="h-10 rounded-lg border bg-background px-3 text-sm shadow-xs"
                id="vitals-device"
                onChange={(event) => setDeviceClass(event.target.value)}
                value={deviceClass}
              >
                <option value="">
                  Tất cả ·{" "}
                  {deviceFacets.reduce(
                    (total, facet) => total + facet.sampleCount,
                    0,
                  )}{" "}
                  mẫu
                </option>
                {(
                  Object.keys(deviceLabels) as Array<keyof typeof deviceLabels>
                ).map((value) => (
                  <option key={value} value={value}>
                    {deviceLabels[value]} · {deviceCount(value)} mẫu
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t pt-4 md:col-span-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Hành trình có dữ liệu</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Chọn nhanh một đường dẫn thật thay vì phải nhớ URL.
                  </p>
                </div>
                {normalizedPath ? (
                  <Button
                    onClick={() => setPath("")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Xem tất cả hành trình
                  </Button>
                ) : null}
              </div>
              {routeFacets.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {routeFacets.map((facet) => (
                    <Button
                      aria-pressed={normalizedPath === facet.path}
                      key={facet.path}
                      onClick={() => setPath(facet.path)}
                      size="sm"
                      type="button"
                      variant={
                        normalizedPath === facet.path ? "default" : "outline"
                      }
                    >
                      <span className="max-w-52 truncate">{facet.path}</span>
                      <span className="text-xs opacity-65">
                        {facet.sampleCount.toLocaleString("vi-VN")}
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Chưa có hành trình công khai nào trong phạm vi này.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {query.error ? (
          <Card className="rounded-2xl ring-border">
            <CardContent className="p-0">
              <AsyncState
                action={
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => void query.refetch()}
                  >
                    Thử lại
                  </Button>
                }
                description={query.error.message}
                title="Không thể tải dữ liệu hiệu năng"
                tone="error"
              />
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {query.isLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Skeleton className="h-44" key={index} />
              ))
            : null}
          {metrics.map((metric) => {
            const status = statusPresentation[metric.status];
            const presentation = metricPresentation[metric.name] ?? {
              eyebrow: "Core Web Vital",
              description: "Chỉ số trải nghiệm thực tế trên trang công khai.",
              action: "Khoanh vùng theo hành trình và thiết bị để điều tra.",
              accentClass: "bg-primary",
            };
            const comparison = metric.comparison;
            const absoluteDelta =
              comparison.delta === null ? null : Math.abs(comparison.delta);
            const comparisonLabel =
              comparison.direction === "improved"
                ? `Cải thiện ${formatMetric(metric.name, absoluteDelta)}`
                : comparison.direction === "regressed"
                  ? `Tăng ${formatMetric(metric.name, absoluteDelta)}`
                  : comparison.direction === "stable"
                    ? "Không đổi"
                    : "Chưa có kỳ trước";
            const comparisonTone =
              comparison.direction === "improved"
                ? "text-emerald-700 dark:text-emerald-300"
                : comparison.direction === "regressed"
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-muted-foreground";
            const samplesNeeded = Math.max(
              0,
              minimumSamples - metric.sampleCount,
            );
            const budgetDistance =
              metric.p75 === null ? null : Math.abs(metric.p75 - metric.target);
            const decision =
              metric.status === "insufficient"
                ? `Cần thêm ${samplesNeeded.toLocaleString("vi-VN")} mẫu để chốt kết luận.`
                : metric.status === "fail"
                  ? `Vượt ngân sách ${formatMetric(metric.name, budgetDistance)}.`
                  : `Còn dư địa ${formatMetric(metric.name, budgetDistance)} trước ngưỡng.`;
            const markerPosition =
              metric.p75 === null
                ? 0
                : Math.min(
                    100,
                    Math.max(3, (metric.p75 / (metric.target * 1.5)) * 100),
                  );
            const sampleCoverage = Math.min(
              100,
              (metric.sampleCount / minimumSamples) * 100,
            );
            return (
              <Card
                aria-label={`${metric.name}: ${presentation.eyebrow}`}
                className="group relative overflow-hidden rounded-2xl border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                key={metric.name}
                role="article"
              >
                <div
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-1 ${presentation.accentClass}`}
                />
                <CardHeader className="flex-row items-start justify-between gap-3 pb-3 pt-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {presentation.eyebrow}
                    </p>
                    <CardTitle className="mt-1 text-lg">
                      {metric.name}
                    </CardTitle>
                  </div>
                  <StatusBadge status={status.status}>
                    {status.label}
                  </StatusBadge>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-4xl font-semibold tracking-tight tabular-nums">
                      {formatMetric(metric.name, metric.p75)}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      {presentation.description}
                    </p>
                  </div>

                  <div className="grid gap-2 rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">So với kỳ trước</span>
                      <span className={`font-semibold ${comparisonTone}`}>
                        {comparisonLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Kỳ trước: {formatMetric(metric.name, comparison.p75)} ·{" "}
                      {comparison.sampleCount.toLocaleString("vi-VN")} mẫu
                      {comparison.deltaPercent === null
                        ? ""
                        : ` · ${Math.abs(comparison.deltaPercent).toLocaleString("vi-VN")}%`}
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        p75 hiện tại
                      </span>
                      <span className="font-medium">
                        Mục tiêu ≤ {formatMetric(metric.name, metric.target)}
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted">
                      <div
                        aria-hidden
                        className="absolute bottom-[-3px] top-[-3px] w-px bg-foreground/35"
                        style={{ left: "66.666%" }}
                      />
                      {metric.p75 !== null ? (
                        <div
                          aria-label={`${metric.name} p75: ${formatMetric(metric.name, metric.p75)}`}
                          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow ${metric.status === "pass" ? "bg-emerald-500" : metric.status === "fail" ? "bg-rose-500" : "bg-amber-500"}`}
                          role="img"
                          style={{ left: `${markerPosition}%` }}
                        />
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>Nhanh</span>
                      <span>Ngân sách</span>
                      <span>Chậm</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/55 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">Độ tin cậy dữ liệu</span>
                      <span className="tabular-nums text-muted-foreground">
                        {metric.sampleCount.toLocaleString("vi-VN")} /{" "}
                        {minimumSamples} mẫu
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                      <div
                        aria-hidden
                        className="h-full rounded-full bg-foreground/75 transition-[width]"
                        style={{ width: `${sampleCoverage}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs font-medium leading-5 text-foreground">
                      {decision}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {presentation.action}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!query.isLoading && query.data && metrics.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="rounded-2xl bg-muted p-4">
                <MonitorSmartphone className="size-7 text-muted-foreground" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">
                Chưa có dữ liệu cho phạm vi này
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Hãy mở rộng cửa sổ đo hoặc bỏ bớt bộ lọc. Báo cáo chỉ dùng dữ
                liệu người dùng thật nên sẽ không tự tạo mẫu giả.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!query.isLoading && query.data ? (
          <Card className="overflow-hidden rounded-2xl border-border/70">
            <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Bằng chứng có thể kiểm toán
                  </p>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Cửa sổ từ{" "}
                    {new Date(query.data.window.from).toLocaleString("vi-VN")}{" "}
                    đến {new Date(query.data.window.to).toLocaleString("vi-VN")}
                    . Chỉ kết luận khi mỗi chỉ số có ít nhất{" "}
                    {query.data.minimumSamples} mẫu; dữ liệu tự xoá sau 90 ngày.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                Cập nhật{" "}
                {new Date(query.data.generatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
