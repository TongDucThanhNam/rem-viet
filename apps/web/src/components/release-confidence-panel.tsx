import { Button } from "@rem-viet/ui/components/button";
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Database,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

type ReleaseMetric = {
  name: string;
  sampleCount: number;
  status: "pass" | "fail" | "insufficient";
};

type RuntimeReadiness = {
  deployment: {
    commit: string;
    inputSha256: string;
    siteId: string;
    sourceState: "clean" | "dirty" | "unknown";
    stage: string;
  };
  health: {
    checks: {
      database: "ok";
      notifications: {
        configuration: "ok" | "degraded";
        failed: number;
        missingProviders: Array<"email" | "telegram">;
        required: boolean;
        stalePending: number;
        status: "ok" | "degraded";
      };
    };
    status: "ok" | "degraded";
  };
};

type ReleaseConfidencePanelProps = {
  minimumSamples: number;
  metrics: ReleaseMetric[];
  onRetry: () => void;
  performanceError: boolean;
  performanceLoading: boolean;
  runtime: RuntimeReadiness | null;
  runtimeError: boolean;
  runtimeLoading: boolean;
};

const gateTone = {
  success: {
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Đã chứng minh",
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "Cần bằng chứng",
  },
  danger: {
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Đang chặn phát hành",
  },
  neutral: {
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    label: "Chưa kiểm tra",
  },
} as const;

type GateTone = keyof typeof gateTone;

function GateCard({
  detail,
  icon: Icon,
  label,
  title,
  tone,
}: {
  detail: string;
  icon: typeof Activity;
  label?: string;
  title: string;
  tone: GateTone;
}) {
  const presentation = gateTone[tone];
  return (
    <article className="grid min-h-44 content-between gap-5 border bg-background p-5 shadow-xs">
      <div>
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-10 place-items-center rounded-full bg-muted">
            <Icon aria-hidden className="size-4" />
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${presentation.badge}`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${presentation.dot}`}
            />
            {label ?? presentation.label}
          </span>
        </div>
        <h3 className="mt-5 text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

function shortIdentity(value: string) {
  return value === "unknown" ? "không rõ" : value.slice(0, 8);
}

export default function ReleaseConfidencePanel({
  minimumSamples,
  metrics,
  onRetry,
  performanceError,
  performanceLoading,
  runtime,
  runtimeError,
  runtimeLoading,
}: ReleaseConfidencePanelProps) {
  const performanceReady =
    metrics.length === 3 && metrics.every((metric) => metric.status === "pass");
  const performanceFailed = metrics.some((metric) => metric.status === "fail");
  const performanceTone: GateTone = performanceError
    ? "danger"
    : performanceLoading
      ? "neutral"
      : performanceReady
        ? "success"
        : performanceFailed
          ? "danger"
          : "warning";
  const performanceDetail = performanceLoading
    ? "Đang đối chiếu p75 và độ phủ mẫu từ lưu lượng công khai."
    : performanceError
      ? "Không thể đọc dữ liệu hiệu năng; trạng thái phát hành phải giữ ở mức chưa xác minh."
      : metrics.length
        ? metrics
            .map(
              (metric) =>
                `${metric.name} ${metric.sampleCount.toLocaleString("vi-VN")}/${minimumSamples}`,
            )
            .join(" · ")
        : "Chưa có đủ dữ liệu công khai để đánh giá CLS, LCP và INP.";

  const deploymentReady = Boolean(
    runtime?.deployment.sourceState === "clean" &&
    runtime.deployment.commit !== "unknown" &&
    runtime.deployment.inputSha256 !== "unknown",
  );
  const deploymentTone: GateTone = runtimeError
    ? "danger"
    : runtimeLoading
      ? "neutral"
      : deploymentReady
        ? "success"
        : "danger";
  const deploymentDetail = runtimeLoading
    ? "Đang đọc danh tính deployment hiện tại."
    : runtimeError || !runtime
      ? "Không thể xác minh site, stage, commit và deployment input hash."
      : `${runtime.deployment.siteId} / ${runtime.deployment.stage} · source ${runtime.deployment.sourceState} · commit ${shortIdentity(runtime.deployment.commit)}.`;

  const notifications = runtime?.health.checks.notifications;
  const notificationReady = Boolean(
    notifications &&
    notifications.configuration === "ok" &&
    notifications.missingProviders.length === 0 &&
    notifications.failed === 0 &&
    notifications.stalePending === 0,
  );
  const notificationTone: GateTone = runtimeError
    ? "danger"
    : runtimeLoading
      ? "neutral"
      : notificationReady
        ? "success"
        : "warning";
  const notificationDetail = runtimeLoading
    ? "Đang kiểm tra cấu hình và hàng đợi thông báo."
    : runtimeError || !notifications
      ? "Không thể đọc trạng thái notification runtime."
      : notifications.missingProviders.length
        ? `Thiếu cấu hình: ${notifications.missingProviders.join(", ")}. Failed ${notifications.failed}; pending quá hạn ${notifications.stalePending}.`
        : `Cấu hình sẵn sàng; failed ${notifications.failed}; pending quá hạn ${notifications.stalePending}.`;

  const databaseReady = runtime?.health.checks.database === "ok";
  const provenCount = [
    performanceReady,
    deploymentReady,
    notificationReady,
    databaseReady,
  ].filter(Boolean).length;
  const observableReady = provenCount === 4;
  const loading = performanceLoading || runtimeLoading;

  return (
    <section
      aria-labelledby="release-confidence-heading"
      className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20 shadow-sm"
    >
      <div className="grid gap-6 border-b bg-background px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck aria-hidden className="size-4" />
              Release confidence
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                observableReady
                  ? gateTone.success.badge
                  : gateTone.warning.badge
              }`}
            >
              {loading ? "Đang đối chiếu" : `${provenCount}/4 cổng runtime`}
            </span>
          </div>
          <h2
            className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
            id="release-confidence-heading"
          >
            Chỉ bàn giao khi bằng chứng nói rằng website đã sẵn sàng.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Đây là ảnh chụp runtime hiện tại, không phải chứng nhận phát hành.
            Alert dispatch, backup định kỳ và pilot ngoài đội phát triển vẫn cần
            receipt độc lập trước khi gắn nhãn client-ready.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums">
              {loading ? "—" : `${provenCount}/4`}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Bằng chứng quan sát được
            </p>
          </div>
          {(performanceError || runtimeError) && (
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              Thử lại
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-px bg-border/70 md:grid-cols-2 xl:grid-cols-4">
        <GateCard
          detail={performanceDetail}
          icon={Activity}
          title="Hiệu năng người dùng thực"
          tone={performanceTone}
        />
        <GateCard
          detail={deploymentDetail}
          icon={CloudCog}
          title="Danh tính deployment"
          tone={deploymentTone}
        />
        <GateCard
          detail={notificationDetail}
          icon={BellRing}
          title="Notification runtime"
          tone={notificationTone}
        />
        <GateCard
          detail={
            runtimeLoading
              ? "Đang kiểm tra kết nối dữ liệu vận hành."
              : runtimeError
                ? "Không thể chứng minh kết nối dữ liệu ở runtime hiện tại."
                : databaseReady
                  ? "Database phản hồi bình thường; trạng thái được đọc trực tiếp từ runtime hiện tại."
                  : "Database chưa trả về trạng thái sẵn sàng."
          }
          icon={Database}
          title="Dữ liệu vận hành"
          tone={
            runtimeError
              ? "danger"
              : runtimeLoading
                ? "neutral"
                : databaseReady
                  ? "success"
                  : "danger"
          }
        />
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FileCheck2 aria-hidden className="size-4" />
          Receipt ngoài runtime
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Operational alert", "Dispatch + inbox confirmation", BellRing],
            [
              "Scheduled backup",
              "Manual → weekly immutable receipts",
              CheckCircle2,
            ],
            ["Client pilot", "Non-developer approval", CircleAlert],
          ].map(([title, detail, Icon]) => (
            <div
              className="flex gap-3 border bg-background p-3"
              key={String(title)}
            >
              <Icon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div>
                <p className="text-xs font-medium">{String(title)}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  {String(detail)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
