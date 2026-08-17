import type { DeploymentProvenance } from "@rem-viet/cms";
import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  Clock3,
  Download,
  FileWarning,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/admin-ui";
import {
  buildPilotObserverDraft,
  canCompletePilot,
  canStartPilot,
  completePilotTask,
  completePilotWorkspace,
  completedPilotTaskCount,
  createPilotWorkspace,
  parsePilotWorkspace,
  pilotStorageKey,
  pilotTaskMinutes,
  pilotTasks,
  startPilotTask,
  startPilotWorkspace,
  type PilotWorkspace,
  type TimedPilotTaskKey,
} from "@/lib/pilot-workspace";

type HandoverPilotWorkspaceProps = {
  deployment?: DeploymentProvenance;
  error?: string;
  isLoading: boolean;
  onRetry: () => void;
  operatorId: string;
};

function formatDuration(minutes: number) {
  if (minutes < 1) return `${Math.max(0, Math.round(minutes * 60))} giây`;
  return `${minutes.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} phút`;
}

function elapsedMinutes(startedAt: string | null, end: Date) {
  if (!startedAt) return 0;
  return Math.max(0, (end.getTime() - Date.parse(startedAt)) / 60_000);
}

function numberFromInput(value: string, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(maximum, Math.max(0, parsed));
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function HandoverPilotWorkspace({
  deployment,
  error,
  isLoading,
  onRetry,
  operatorId,
}: HandoverPilotWorkspaceProps) {
  const [workspace, setWorkspace] = useState(createPilotWorkspace);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [confusionPoint, setConfusionPoint] = useState("");
  const [issueId, setIssueId] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const storageKey = deployment
    ? pilotStorageKey(deployment, operatorId)
    : null;
  const safeToRun = deployment ? canStartPilot(deployment) : false;

  useEffect(() => {
    if (!storageKey) return;
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = parsePilotWorkspace(JSON.parse(stored));
        setWorkspace(parsed.success ? parsed.data : createPilotWorkspace());
      } catch {
        setWorkspace(createPilotWorkspace());
      }
    } else {
      setWorkspace(createPilotWorkspace());
    }
    setHydratedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || hydratedKey !== storageKey) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(workspace));
  }, [hydratedKey, storageKey, workspace]);

  useEffect(() => {
    if (!workspace.startedAt || workspace.completedAt) return;
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, [workspace.completedAt, workspace.startedAt]);

  const completedCount = completedPilotTaskCount(workspace);
  const measuredMinutes = elapsedMinutes(
    workspace.startedAt,
    workspace.completedAt ? new Date(workspace.completedAt) : now,
  );
  const readinessCopy = useMemo(() => {
    if (!deployment) return "Chưa đọc được danh tính deployment.";
    if (deployment.stage !== "staging")
      return `Runtime đang ở stage “${deployment.stage}”; pilot chỉ được chạy trên staging.`;
    if (deployment.sourceState !== "clean")
      return `Source đang ở trạng thái “${deployment.sourceState}”; cần deploy một clean commit trước pilot.`;
    if (deployment.commit === "unknown" || deployment.inputSha256 === "unknown")
      return "Runtime chưa có đủ full Git SHA và deploy-input SHA-256.";
    return "Deployment staging sạch và có đủ danh tính để bắt đầu quan sát.";
  }, [deployment]);

  function updateWorkspace(patch: Partial<PilotWorkspace>) {
    setWorkspace((current) => ({ ...current, ...patch }));
  }

  function addConfusionPoint() {
    const value = confusionPoint.trim();
    if (!value) return;
    updateWorkspace({
      confusionPoints: [...workspace.confusionPoints, value].slice(0, 100),
    });
    setConfusionPoint("");
  }

  function addIssueId() {
    const value = issueId.trim();
    if (!value || workspace.issueIds.includes(value)) return;
    updateWorkspace({ issueIds: [...workspace.issueIds, value].slice(0, 100) });
    setIssueId("");
  }

  function beginTask(key: TimedPilotTaskKey) {
    setWorkspace((current) => startPilotTask(current, key, new Date()));
  }

  function finishTask(key: TimedPilotTaskKey) {
    setWorkspace((current) => completePilotTask(current, key, new Date()));
  }

  function exportDraft() {
    if (!deployment) return;
    const draft = buildPilotObserverDraft({
      deployment,
      now: new Date(),
      origin: window.location.origin,
      workspace,
    });
    downloadJson(
      `pilot-observer-${deployment.siteId}-${deployment.stage}.json`,
      draft,
    );
  }

  function resetWorkspace() {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setWorkspace(createPilotWorkspace());
    setResetArmed(false);
  }

  if (isLoading) {
    return (
      <Card className="rounded-2xl" role="status">
        <CardContent className="p-8 text-sm text-muted-foreground">
          Đang đối chiếu deployment trước khi mở pilot…
        </CardContent>
      </Card>
    );
  }

  if (error || !deployment) {
    return (
      <Card className="rounded-2xl border-destructive/35">
        <CardContent className="flex flex-col items-start gap-4 p-8">
          <StatusBadge status="destructive">Không thể bắt đầu</StatusBadge>
          <p className="text-sm text-muted-foreground">
            {error ?? "Runtime không trả về deployment provenance."}
          </p>
          <Button onClick={onRetry} type="button" variant="outline">
            <RefreshCw className="size-4" /> Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label="Pilot bàn giao có giám sát" className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border-border/70">
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Handover pilot
              </p>
              <StatusBadge status={safeToRun ? "success" : "destructive"}>
                {safeToRun ? "Đủ điều kiện bắt đầu" : "Đang chặn pilot"}
              </StatusBadge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Để khách tự hoàn thành; hệ thống chỉ giữ thời gian và bằng chứng
              quan sát.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              {readinessCopy} Workspace lưu cục bộ trên trình duyệt để tiếp tục
              sau khi mở từng màn hình. Nó không ký thay tester và không biến
              checklist thành release receipt.
            </p>
          </div>
          <div className="grid min-w-56 grid-cols-2 gap-3 rounded-2xl bg-muted/55 p-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {completedCount}/8
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                bước hoàn tất
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatDuration(measuredMinutes)}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                thời gian
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!workspace.startedAt ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-3 ${safeToRun ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}
              >
                {safeToRun ? (
                  <ShieldCheck className="size-5" />
                ) : (
                  <AlertTriangle className="size-5" />
                )}
              </div>
              <div>
                <p className="font-medium">Preflight fail-closed</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {deployment.siteId} / {deployment.stage} · source{" "}
                  {deployment.sourceState} · commit{" "}
                  {deployment.commit.slice(0, 8)}
                </p>
              </div>
            </div>
            <Button
              disabled={!safeToRun}
              onClick={() =>
                setWorkspace((current) =>
                  startPilotWorkspace(current, new Date()),
                )
              }
              type="button"
            >
              <Play className="size-4" /> Bắt đầu quan sát
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {pilotTasks.map((task, index) => {
              const state = workspace.tasks[task.key];
              const isActive = workspace.activeTask === task.key;
              const anotherTaskActive = Boolean(
                workspace.activeTask && !isActive,
              );
              return (
                <Card
                  className={`rounded-2xl transition-colors ${isActive ? "border-primary/55 bg-primary/[0.025]" : "border-border/70"}`}
                  key={task.key}
                >
                  <CardContent className="grid gap-5 p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:p-6">
                    <div
                      className={`flex size-11 items-center justify-center rounded-full text-sm font-semibold ${state.completed ? "bg-emerald-600 text-white" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {state.completed ? (
                        <Check className="size-5" />
                      ) : isActive ? (
                        <CircleDot className="size-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {task.title}
                        </CardTitle>
                        {state.completed ? (
                          <StatusBadge status="success">
                            {formatDuration(state.minutes)}
                          </StatusBadge>
                        ) : isActive ? (
                          <StatusBadge status="warning">Đang đo</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {task.description}
                      </p>
                      <p className="mt-2 text-xs leading-5">
                        <span className="font-semibold">Kết quả cần thấy:</span>{" "}
                        {task.expected}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {isActive ? (
                        <>
                          <Link
                            className={buttonVariants({ variant: "outline" })}
                            to={task.to}
                          >
                            Mở workspace <ArrowRight className="size-4" />
                          </Link>
                          <Button
                            onClick={() => finishTask(task.key)}
                            type="button"
                          >
                            <Check className="size-4" /> Hoàn tất bước
                          </Button>
                        </>
                      ) : (
                        <Button
                          disabled={
                            state.completed ||
                            anotherTaskActive ||
                            Boolean(workspace.completedAt) ||
                            !safeToRun
                          }
                          onClick={() => beginTask(task.key)}
                          type="button"
                          variant="outline"
                        >
                          <Clock3 className="size-4" /> Bắt đầu bước
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Thông tin observer cần giữ lại</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Không ghi email, số điện thoại hoặc payload khách hàng vào ghi
                  chú. Các trường này tạo draft cho verifier, chưa phải
                  approval.
                </p>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pilot-tester-name">Tên tester</Label>
                  <Input
                    id="pilot-tester-name"
                    onChange={(event) =>
                      updateWorkspace({ testerName: event.target.value })
                    }
                    placeholder="Người không tham gia viết code"
                    value={workspace.testerName}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pilot-browser-device">
                    Browser và thiết bị
                  </Label>
                  <Input
                    id="pilot-browser-device"
                    onChange={(event) =>
                      updateWorkspace({ browserAndDevice: event.target.value })
                    }
                    placeholder="Chrome 140 · Windows laptop"
                    value={workspace.browserAndDevice}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pilot-editable-percent">
                    Nội dung định kỳ tự sửa được (%)
                  </Label>
                  <Input
                    id="pilot-editable-percent"
                    max={100}
                    min={0}
                    onChange={(event) =>
                      updateWorkspace({
                        editableRecurringContentPercent: numberFromInput(
                          event.target.value,
                          100,
                        ),
                      })
                    }
                    type="number"
                    value={workspace.editableRecurringContentPercent}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pilot-interventions">
                    Lần developer can thiệp
                  </Label>
                  <Input
                    id="pilot-interventions"
                    min={0}
                    onChange={(event) =>
                      updateWorkspace({
                        developerInterventions: numberFromInput(
                          event.target.value,
                          100,
                        ),
                      })
                    }
                    type="number"
                    value={workspace.developerInterventions}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pilot-open-p0">P0 còn mở</Label>
                  <Input
                    id="pilot-open-p0"
                    min={0}
                    onChange={(event) =>
                      updateWorkspace({
                        openP0: numberFromInput(event.target.value, 100),
                      })
                    }
                    type="number"
                    value={workspace.openP0}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pilot-open-p1">P1 còn mở</Label>
                  <Input
                    id="pilot-open-p1"
                    min={0}
                    onChange={(event) =>
                      updateWorkspace({
                        openP1: numberFromInput(event.target.value, 100),
                      })
                    }
                    type="number"
                    value={workspace.openP1}
                  />
                </div>
                <label className="flex items-start gap-3 sm:col-span-2">
                  <Checkbox
                    checked={workspace.clientManualUsedWithoutExtraGuidance}
                    onCheckedChange={(checked) =>
                      updateWorkspace({
                        clientManualUsedWithoutExtraGuidance: checked === true,
                      })
                    }
                  />
                  <span className="text-sm leading-6">
                    Tester chỉ dùng client manual, không nhận hướng dẫn bổ sung.
                  </span>
                </label>
                <label className="flex items-start gap-3 sm:col-span-2">
                  <Checkbox
                    checked={workspace.noJsonOrCode}
                    onCheckedChange={(checked) =>
                      updateWorkspace({ noJsonOrCode: checked === true })
                    }
                  />
                  <span className="text-sm leading-6">
                    Toàn bộ pilot hoàn thành mà không mở JSON hoặc code.
                  </span>
                </label>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Điểm vướng và issue</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Ghi đúng điều tester không tự hiểu. Một confusion point không
                  tự biến thành lỗi; P0/P1 phải được theo dõi bằng issue riêng.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="pilot-confusion">Confusion point</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pilot-confusion"
                      maxLength={500}
                      onChange={(event) =>
                        setConfusionPoint(event.target.value)
                      }
                      placeholder="Ví dụ: khó tìm revision history"
                      value={confusionPoint}
                    />
                    <Button
                      disabled={!confusionPoint.trim()}
                      onClick={addConfusionPoint}
                      type="button"
                      variant="outline"
                    >
                      Thêm
                    </Button>
                  </div>
                  {workspace.confusionPoints.length > 0 ? (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {workspace.confusionPoints.map((point, index) => (
                        <li className="rounded-lg bg-muted/55 p-3" key={index}>
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pilot-issue">Issue ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pilot-issue"
                      maxLength={120}
                      onChange={(event) => setIssueId(event.target.value)}
                      placeholder="CMS-123"
                      value={issueId}
                    />
                    <Button
                      disabled={!issueId.trim()}
                      onClick={addIssueId}
                      type="button"
                      variant="outline"
                    >
                      Thêm
                    </Button>
                  </div>
                  {workspace.issueIds.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {workspace.issueIds.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-dashed">
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
              <div className="flex items-start gap-3">
                <FileWarning className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-medium">Export vẫn cố ý chưa hợp lệ</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Draft để trống `testerApproval.approvedAt` và `recordedAt`.
                    Tester phải xác nhận sau khi hoàn thành; sau đó chạy{" "}
                    <code>release:pilot:verify</code> trên đúng clean commit.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tổng task timer:{" "}
                    {formatDuration(pilotTaskMinutes(workspace))}. KPI cuối vẫn
                    là ≤30 phút, restore ≤5 phút, ≥90% nội dung và zero
                    intervention/P0/P1.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {!workspace.completedAt ? (
                  <Button
                    disabled={!canCompletePilot(workspace) || !safeToRun}
                    onClick={() =>
                      setWorkspace((current) =>
                        completePilotWorkspace(current, new Date()),
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    <Check className="size-4" /> Kết thúc pilot
                  </Button>
                ) : null}
                <Button
                  disabled={!safeToRun}
                  onClick={exportDraft}
                  type="button"
                >
                  <Download className="size-4" /> Tải observer draft
                </Button>
                <Button
                  onBlur={() => setResetArmed(false)}
                  onClick={resetWorkspace}
                  type="button"
                  variant="ghost"
                >
                  <RotateCcw className="size-4" />
                  {resetArmed ? "Xác nhận reset" : "Reset"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
