import { roleHasCapability } from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/operations")({
  component: CmsOperationsAdmin,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "audit.read")) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
});

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function initialCalendarMonth() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function calendarMonthWindow(month: string) {
  const cursor = new Date(month);
  const from = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1),
  );
  const to = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
  );
  return { from: from.toISOString(), to: to.toISOString() };
}

function shiftCalendarMonth(month: string, offset: number) {
  const cursor = new Date(month);
  return new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + offset, 1),
  ).toISOString();
}

function calendarKindLabel(kind: string) {
  if (kind === "review_due") return "Hạn duyệt";
  if (kind === "release_schedule") return "Release";
  return "Xuất bản";
}

function calendarEntityHref(entityType: string, entityId: string) {
  if (entityType === "page")
    return `/admin/pages?pageId=${encodeURIComponent(entityId)}`;
  if (entityType === "post")
    return `/admin/posts/${encodeURIComponent(entityId)}/edit`;
  return null;
}

function statusTone(status: string) {
  if (["succeeded", "published", "delivered", "dispatched"].includes(status)) {
    return "success" as const;
  }
  if (["failed", "dead_letter"].includes(status)) {
    return "destructive" as const;
  }
  if (["running", "publishing", "delivering"].includes(status)) {
    return "info" as const;
  }
  if (["waiting", "scheduled", "rolling_back"].includes(status)) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div aria-label={label} className="grid gap-2 p-4" role="status">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton className="h-12" key={index} />
      ))}
    </div>
  );
}

function CmsOperationsAdmin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const jobs = useQuery(trpc.operations.jobs.list.queryOptions({ limit: 100 }));
  const releases = useQuery(
    trpc.operations.releases.list.queryOptions({ limit: 50 }),
  );
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  const calendarWindow = useMemo(
    () => calendarMonthWindow(calendarMonth),
    [calendarMonth],
  );
  const calendar = useQuery(
    trpc.operations.calendar.list.queryOptions(calendarWindow),
  );
  const endpoints = useQuery(
    trpc.operations.webhooks.listEndpoints.queryOptions(),
  );
  const deliveries = useQuery(
    trpc.operations.webhooks.listDeliveries.queryOptions({ limit: 100 }),
  );
  const workflows = useQuery(trpc.operations.workflows.list.queryOptions());
  const [endpointName, setEndpointName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointTopics, setEndpointTopics] = useState(
    "content.page.published, content.post.published",
  );
  const [revealedSecret, setRevealedSecret] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [releaseName, setReleaseName] = useState("");
  const [releaseItems, setReleaseItems] = useState("");
  const [releaseSchedule, setReleaseSchedule] = useState("");
  const [workflowCollection, setWorkflowCollection] = useState<"page" | "post">(
    "page",
  );
  const [workflowLabel, setWorkflowLabel] = useState("Phê duyệt xuất bản");
  const [workflowApprovals, setWorkflowApprovals] = useState(1);
  const [workflowSelfApproval, setWorkflowSelfApproval] = useState(false);
  const calendarGroups = useMemo(() => {
    const entries = calendar.data ?? [];
    const groups = new Map<string, (typeof entries)[number][]>();
    for (const entry of entries) {
      const date = entry.startsAt.slice(0, 10);
      groups.set(date, [...(groups.get(date) ?? []), entry]);
    }
    return [...groups].map(([date, groupedEntries]) => ({
      date,
      entries: groupedEntries,
    }));
  }, [calendar.data]);

  const refreshJobs = () =>
    queryClient.invalidateQueries(trpc.operations.jobs.list.queryFilter());
  const refreshReleases = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.operations.releases.list.queryFilter(),
      ),
      queryClient.invalidateQueries(
        trpc.operations.calendar.list.queryFilter(),
      ),
    ]);
  };
  const refreshWebhooks = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.operations.webhooks.listEndpoints.queryFilter(),
      ),
      queryClient.invalidateQueries(
        trpc.operations.webhooks.listDeliveries.queryFilter(),
      ),
    ]);
  };
  const refreshWorkflows = () =>
    queryClient.invalidateQueries(trpc.operations.workflows.list.queryFilter());

  const retryJob = useMutation(
    trpc.operations.jobs.retry.mutationOptions({
      onSuccess: () => {
        void refreshJobs();
        toast.success("Đã đưa công việc trở lại hàng đợi.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const cancelJob = useMutation(
    trpc.operations.jobs.cancel.mutationOptions({
      onSuccess: () => {
        void refreshJobs();
        toast.success("Đã gửi yêu cầu hủy công việc.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const createEndpoint = useMutation(
    trpc.operations.webhooks.createEndpoint.mutationOptions({
      onSuccess: (result) => {
        setEndpointName("");
        setEndpointUrl("");
        setRevealedSecret({
          label: `Khóa ký mới cho ${result.endpoint.name}`,
          value: result.secret,
        });
        void refreshWebhooks();
        toast.success("Đã tạo webhook.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const rotateSecret = useMutation(
    trpc.operations.webhooks.rotateSecret.mutationOptions({
      onSuccess: (result) => {
        setRevealedSecret({
          label: `Khóa ký mới cho ${result.endpointId}`,
          value: result.secret,
        });
        void refreshWebhooks();
        toast.success("Đã xoay khóa. Khóa cũ còn hiệu lực trong 24 giờ.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const revokeEndpoint = useMutation(
    trpc.operations.webhooks.revokeEndpoint.mutationOptions({
      onSuccess: () => {
        void refreshWebhooks();
        toast.success("Đã thu hồi webhook.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const replayDelivery = useMutation(
    trpc.operations.webhooks.replayDelivery.mutationOptions({
      onSuccess: () => {
        void refreshWebhooks();
        toast.success("Đã tạo một lượt giao lại riêng biệt.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const createRelease = useMutation(
    trpc.operations.releases.create.mutationOptions(),
  );
  const scheduleRelease = useMutation(
    trpc.operations.releases.schedule.mutationOptions(),
  );
  const previewRelease = useMutation(
    trpc.operations.releases.preview.mutationOptions({
      onSuccess: (preview) =>
        preview.valid
          ? toast.success("Release đã vượt qua kiểm tra trước khi xuất bản.")
          : toast.error(
              `${preview.items.filter((item) => !item.valid).length} mục cần xử lý trước khi xuất bản.`,
            ),
      onError: (error) => toast.error(error.message),
    }),
  );
  const publishRelease = useMutation(
    trpc.operations.releases.publishNow.mutationOptions({
      onSuccess: () => {
        void refreshReleases();
        void refreshJobs();
        toast.success("Đã xếp release để xuất bản.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const cancelRelease = useMutation(
    trpc.operations.releases.cancel.mutationOptions({
      onSuccess: () => {
        void refreshReleases();
        void refreshJobs();
        toast.success("Đã hủy release.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const upsertWorkflow = useMutation(
    trpc.operations.workflows.upsert.mutationOptions({
      onSuccess: () => {
        void refreshWorkflows();
        toast.success("Đã lưu workflow xuất bản.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const deactivateWorkflow = useMutation(
    trpc.operations.workflows.deactivate.mutationOptions({
      onSuccess: () => {
        void refreshWorkflows();
        toast.success("Đã tắt workflow.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  function submitEndpoint(event: FormEvent) {
    event.preventDefault();
    createEndpoint.mutate({
      name: endpointName,
      url: endpointUrl,
      topics: endpointTopics
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    });
  }

  async function submitRelease(event: FormEvent) {
    event.preventDefault();
    try {
      const items = releaseItems
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const values = line.split(",").map((value) => value.trim());
          const documentType = values[0];
          if (documentType === "collection") {
            const [, collection, documentId, locale, rawVersion] = values;
            if (
              values.length !== 5 ||
              !collection ||
              !documentId ||
              rawVersion === undefined ||
              !Number.isInteger(Number(rawVersion))
            ) {
              throw new Error(
                `Dòng không hợp lệ: ${line}. Dùng định dạng collection,collection-slug,document-id,vi-VN,3.`,
              );
            }
            return {
              documentType,
              collection,
              documentId,
              locale: locale ?? "",
              expectedVersion: Number(rawVersion),
            } as const;
          }
          const [, documentId, rawVersion] = values;
          if (
            values.length !== 3 ||
            (documentType !== "page" && documentType !== "post") ||
            !documentId ||
            !rawVersion ||
            !Number.isInteger(Number(rawVersion))
          ) {
            throw new Error(
              `Dòng không hợp lệ: ${line}. Dùng định dạng page,page-id,3 hoặc collection,collection-slug,document-id,vi-VN,3.`,
            );
          }
          return {
            documentType: documentType as "page" | "post",
            documentId,
            expectedVersion: Number(rawVersion),
            locale: null,
          };
        });
      const created = await createRelease.mutateAsync({
        name: releaseName,
        idempotencyKey: `admin:${crypto.randomUUID()}`,
        items,
      });
      if (releaseSchedule) {
        await scheduleRelease.mutateAsync({
          releaseId: created.id,
          scheduledAt: new Date(releaseSchedule),
        });
      }
      setReleaseName("");
      setReleaseItems("");
      setReleaseSchedule("");
      await refreshReleases();
      await refreshJobs();
      toast.success(
        releaseSchedule ? "Đã lên lịch release." : "Đã tạo release nháp.",
      );
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  }

  function submitWorkflow(event: FormEvent) {
    event.preventDefault();
    upsertWorkflow.mutate({
      collection: workflowCollection,
      locale: "",
      active: true,
      stages: [
        {
          id: "approval",
          label: workflowLabel,
          approvalsRequired: workflowApprovals,
          reviewerRoles: ["owner", "admin"],
          allowSelfApproval: workflowSelfApproval,
        },
      ],
    });
  }

  return (
    <AdminShell>
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <Card
          aria-labelledby="cms-operations-calendar-title"
          className="rounded-md ring-border"
          role="region"
        >
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle id="cms-operations-calendar-title">
                Lịch nội dung và release
              </CardTitle>
              <CardDescription>
                Một lịch chung cho hạn duyệt, nội dung đã lên lịch và release
                nhiều tài liệu.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                aria-label="Tháng trước"
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={() =>
                  setCalendarMonth((current) => shiftCalendarMonth(current, -1))
                }
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <p
                aria-live="polite"
                className="min-w-32 text-center text-sm font-medium capitalize"
              >
                {new Date(calendarMonth).toLocaleDateString("vi-VN", {
                  month: "long",
                  timeZone: "UTC",
                  year: "numeric",
                })}
              </p>
              <Button
                aria-label="Tháng sau"
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={() =>
                  setCalendarMonth((current) => shiftCalendarMonth(current, 1))
                }
              >
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {calendar.isLoading ? (
              <LoadingRows label="Đang tải lịch nội dung và release" />
            ) : calendar.isError ? (
              <AsyncState
                description="Không thể tải lịch vận hành cho tháng đã chọn."
                title="Không thể tải lịch"
                tone="error"
              />
            ) : calendarGroups.length ? (
              <div className="grid gap-5">
                {calendarGroups.map((group) => (
                  <section
                    aria-labelledby={`calendar-date-${group.date}`}
                    className="grid gap-2 sm:grid-cols-[10rem_1fr]"
                    key={group.date}
                  >
                    <h3
                      className="text-sm font-semibold capitalize"
                      id={`calendar-date-${group.date}`}
                    >
                      <time dateTime={group.date}>
                        {new Date(
                          `${group.date}T00:00:00.000Z`,
                        ).toLocaleDateString("vi-VN", {
                          day: "numeric",
                          month: "long",
                          timeZone: "UTC",
                          weekday: "short",
                        })}
                      </time>
                    </h3>
                    <ul className="grid gap-2">
                      {group.entries.map((entry) => {
                        const href = calendarEntityHref(
                          entry.entityType,
                          entry.entityId,
                        );
                        return (
                          <li
                            className="flex flex-col gap-2 border bg-muted/20 p-3 sm:flex-row sm:items-center"
                            key={entry.id}
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                              <CalendarDays aria-hidden className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              {href ? (
                                <a
                                  className="font-medium hover:underline"
                                  href={href}
                                >
                                  {entry.title}
                                </a>
                              ) : (
                                <p className="font-medium">{entry.title}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                <time dateTime={entry.startsAt}>
                                  {new Date(entry.startsAt).toLocaleTimeString(
                                    "vi-VN",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </time>
                                {entry.collection
                                  ? ` · ${entry.collection}`
                                  : ` · ${entry.entityType}`}
                                {entry.locale ? ` · ${entry.locale}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <StatusBadge status="info">
                                {calendarKindLabel(entry.kind)}
                              </StatusBadge>
                              <StatusBadge
                                status={
                                  entry.overdue
                                    ? "destructive"
                                    : statusTone(entry.status)
                                }
                              >
                                {entry.overdue ? "quá hạn" : entry.status}
                              </StatusBadge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <AsyncState
                description="Tháng này chưa có hạn duyệt, nội dung hoặc release đã lên lịch."
                title="Lịch đang trống"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardHeader>
            <CardTitle>Công việc nền</CardTitle>
            <CardDescription>
              Hàng đợi bền vững, số lần thử và lỗi đã được che dữ liệu nhạy cảm.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {jobs.isLoading ? (
              <LoadingRows label="Đang tải công việc nền" />
            ) : jobs.isError ? (
              <AsyncState
                description="Không thể tải trạng thái hàng đợi."
                title="Không thể tải công việc"
                tone="error"
              />
            ) : jobs.data?.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px] text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Công việc</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Lần thử</TableHead>
                      <TableHead>Thời điểm</TableHead>
                      <TableHead>Lỗi gần nhất</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.data.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="font-medium">{job.taskName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {job.id} · {job.queue}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={statusTone(job.status)}>
                            {job.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {job.attempt}/{job.maxAttempts}
                        </TableCell>
                        <TableCell>{formatDate(job.availableAt)}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="line-clamp-2 text-destructive">
                            {job.lastError || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {[
                              "waiting",
                              "failed",
                              "dead_letter",
                              "cancelled",
                            ].includes(job.status) ? (
                              <Button
                                aria-label={`Thử lại ${job.taskName}`}
                                disabled={retryJob.isPending}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  retryJob.mutate({ jobId: job.id })
                                }
                              >
                                <RotateCcw aria-hidden className="size-4" />
                              </Button>
                            ) : null}
                            {["queued", "running", "waiting"].includes(
                              job.status,
                            ) ? (
                              <Button
                                aria-label={`Hủy ${job.taskName}`}
                                disabled={cancelJob.isPending}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  cancelJob.mutate({ jobId: job.id })
                                }
                              >
                                <Ban aria-hidden className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description="Các công việc đã lên lịch hoặc chạy nền sẽ xuất hiện tại đây."
                title="Chưa có công việc"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardHeader>
            <CardTitle>Release nhiều nội dung</CardTitle>
            <CardDescription>
              Mỗi dòng dùng page,page-id,3; post,post-id,7; hoặc
              collection,collection-slug,document-id,vi-VN,3. Version là khóa
              chống ghi đè nội dung mới hơn.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form
              className="grid gap-4 lg:grid-cols-2"
              onSubmit={submitRelease}
            >
              <div className="grid gap-2">
                <Label htmlFor="release-name">Tên release</Label>
                <Input
                  id="release-name"
                  required
                  value={releaseName}
                  onChange={(event) => setReleaseName(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="release-schedule">
                  Lên lịch (không bắt buộc)
                </Label>
                <Input
                  id="release-schedule"
                  type="datetime-local"
                  value={releaseSchedule}
                  onChange={(event) => setReleaseSchedule(event.target.value)}
                />
              </div>
              <div className="grid gap-2 lg:col-span-2">
                <Label htmlFor="release-items">Nội dung và version</Label>
                <Textarea
                  id="release-items"
                  className="min-h-24 font-mono text-xs"
                  placeholder={
                    "page,home-page-id,12\npost,launch-post-id,4\ncollection,rem-viet-localized-campaigns,campaign-id,vi-VN,3"
                  }
                  required
                  value={releaseItems}
                  onChange={(event) => setReleaseItems(event.target.value)}
                />
              </div>
              <div className="lg:col-span-2">
                <Button
                  disabled={
                    createRelease.isPending || scheduleRelease.isPending
                  }
                  type="submit"
                >
                  <Plus aria-hidden />
                  {releaseSchedule ? "Tạo và lên lịch" : "Tạo release nháp"}
                </Button>
              </div>
            </form>
            {releases.isLoading ? (
              <LoadingRows label="Đang tải release" />
            ) : releases.isError ? (
              <AsyncState
                description="Không thể tải các release hiện tại."
                title="Không thể tải release"
                tone="error"
              />
            ) : releases.data?.length ? (
              <div className="overflow-x-auto border">
                <Table className="min-w-[900px] text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Release</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Nội dung</TableHead>
                      <TableHead>Lịch chạy</TableHead>
                      <TableHead>Lỗi / bồi hoàn</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {releases.data.map((release) => (
                      <TableRow key={release.id}>
                        <TableCell>
                          <div className="font-medium">{release.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {release.id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={statusTone(release.status)}>
                            {release.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {release.items.length} mục ·{" "}
                          {
                            release.items.filter(
                              (item) => item.status === "published",
                            ).length
                          }{" "}
                          đã xuất bản
                          <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                            {release.items.map((item) => (
                              <li key={item.id}>
                                {item.documentType === "collection"
                                  ? [
                                      item.collection + "/" + item.documentId,
                                      item.locale || "default",
                                    ].join(" · ")
                                  : item.documentType +
                                    "/" +
                                    item.documentId}{" "}
                                · v{item.expectedVersion} · {item.status}
                              </li>
                            ))}
                          </ul>
                          {previewRelease.variables?.releaseId === release.id &&
                          previewRelease.data ? (
                            <div
                              className={
                                previewRelease.data.valid
                                  ? "text-success"
                                  : "text-destructive"
                              }
                            >
                              {previewRelease.data.valid
                                ? "Kiểm tra: sẵn sàng"
                                : `Kiểm tra: ${previewRelease.data.items.filter((item) => !item.valid).length} lỗi`}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatDate(release.scheduledAt)}</TableCell>
                        <TableCell className="max-w-sm">
                          <p className="line-clamp-2 text-destructive">
                            {release.lastError || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              aria-label={`Kiểm tra ${release.name}`}
                              disabled={previewRelease.isPending}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                previewRelease.mutate({ releaseId: release.id })
                              }
                            >
                              <ShieldCheck aria-hidden className="size-4" />
                            </Button>
                            {["draft", "failed"].includes(release.status) ? (
                              <Button
                                aria-label={`Xuất bản ${release.name}`}
                                disabled={publishRelease.isPending}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  publishRelease.mutate({
                                    releaseId: release.id,
                                  })
                                }
                              >
                                <Play aria-hidden className="size-4" />
                              </Button>
                            ) : null}
                            {["draft", "scheduled", "failed"].includes(
                              release.status,
                            ) ? (
                              <ConfirmDestructiveAction
                                confirmLabel="Hủy release"
                                description="Công việc chưa chạy sẽ bị hủy. Nội dung đã xuất bản bởi một lượt chạy trước không bị xóa âm thầm."
                                pending={cancelRelease.isPending}
                                title={`Hủy ${release.name}?`}
                                trigger={
                                  <Button
                                    aria-label={`Hủy ${release.name}`}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Ban aria-hidden className="size-4" />
                                  </Button>
                                }
                                onConfirm={() =>
                                  cancelRelease.mutate({
                                    releaseId: release.id,
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description="Tạo release đầu tiên để xuất bản nhiều tài liệu theo một receipt."
                title="Chưa có release"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardHeader>
            <CardTitle>Workflow phê duyệt</CardTitle>
            <CardDescription>
              Chính sách là opt-in theo loại nội dung. Khi bật, publish và
              release bị chặn cho đến khi đủ số người phê duyệt độc lập.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form
              className="grid gap-4 md:grid-cols-[10rem_1fr_9rem_auto] md:items-end"
              onSubmit={submitWorkflow}
            >
              <div className="grid gap-2">
                <Label htmlFor="workflow-collection">Loại nội dung</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  id="workflow-collection"
                  value={workflowCollection}
                  onChange={(event) =>
                    setWorkflowCollection(event.target.value as "page" | "post")
                  }
                >
                  <option value="page">Page</option>
                  <option value="post">Post</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workflow-label">Tên bước</Label>
                <Input
                  id="workflow-label"
                  required
                  value={workflowLabel}
                  onChange={(event) => setWorkflowLabel(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workflow-approvals">Số phê duyệt</Label>
                <Input
                  id="workflow-approvals"
                  max={5}
                  min={1}
                  type="number"
                  value={workflowApprovals}
                  onChange={(event) =>
                    setWorkflowApprovals(Number(event.target.value))
                  }
                />
              </div>
              <Button disabled={upsertWorkflow.isPending} type="submit">
                Lưu workflow
              </Button>
              <label className="flex items-center gap-2 text-xs md:col-span-4">
                <input
                  checked={workflowSelfApproval}
                  type="checkbox"
                  onChange={(event) =>
                    setWorkflowSelfApproval(event.target.checked)
                  }
                />
                Cho phép người gửi review tự phê duyệt
              </label>
            </form>
            {workflows.isLoading ? (
              <LoadingRows label="Đang tải workflow" />
            ) : workflows.isError ? (
              <AsyncState
                description="Không thể tải chính sách workflow."
                title="Không thể tải workflow"
                tone="error"
              />
            ) : workflows.data?.length ? (
              <div className="grid gap-2">
                {workflows.data.map((policy) => (
                  <div
                    className="flex flex-col justify-between gap-3 border p-3 sm:flex-row sm:items-center"
                    key={policy.id}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {policy.collection}
                        <StatusBadge
                          status={policy.active ? "success" : "neutral"}
                        >
                          {policy.active ? "active" : "inactive"}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {policy.stages
                          .map(
                            (stage) =>
                              `${stage.label}: ${stage.approvalsRequired} phê duyệt`,
                          )
                          .join(" · ")}
                      </p>
                    </div>
                    {policy.active ? (
                      <Button
                        disabled={deactivateWorkflow.isPending}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          deactivateWorkflow.mutate({
                            collection: policy.collection as "page" | "post",
                            locale: policy.locale,
                          })
                        }
                      >
                        Tắt
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <AsyncState
                description="Không có workflow bắt buộc; publish hiện dùng quyền vai trò mặc định."
                title="Workflow chưa được bật"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardHeader>
            <CardTitle>Webhook đã ký</CardTitle>
            <CardDescription>
              Chỉ hostname HTTPS có trong CMS_WEBHOOK_ALLOWED_HOSTS mới được
              chấp nhận. Khóa ký chỉ hiển thị một lần.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {revealedSecret ? (
              <div className="grid gap-2 border border-warning/40 bg-warning/5 p-3">
                <div className="text-xs font-medium">
                  {revealedSecret.label}
                </div>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto bg-background p-2 text-xs">
                    {revealedSecret.value}
                  </code>
                  <Button
                    aria-label="Sao chép khóa ký"
                    size="icon-sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(revealedSecret.value);
                      toast.success("Đã sao chép khóa ký.");
                    }}
                  >
                    <Copy aria-hidden className="size-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Lưu ngay trong trình quản lý bí mật. Sau khi đóng, CMS không
                  thể hiển thị lại giá trị này.
                </p>
              </div>
            ) : null}
            <form
              className="grid gap-4 lg:grid-cols-[1fr_1.5fr_1.5fr_auto] lg:items-end"
              onSubmit={submitEndpoint}
            >
              <div className="grid gap-2">
                <Label htmlFor="webhook-name">Tên</Label>
                <Input
                  id="webhook-name"
                  required
                  value={endpointName}
                  onChange={(event) => setEndpointName(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="webhook-url">HTTPS URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://hooks.example.com/cms"
                  required
                  type="url"
                  value={endpointUrl}
                  onChange={(event) => setEndpointUrl(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="webhook-topics">
                  Topics, cách nhau bằng dấu phẩy
                </Label>
                <Input
                  id="webhook-topics"
                  required
                  value={endpointTopics}
                  onChange={(event) => setEndpointTopics(event.target.value)}
                />
              </div>
              <Button disabled={createEndpoint.isPending} type="submit">
                <Plus aria-hidden /> Tạo
              </Button>
            </form>
            {endpoints.isLoading ? (
              <LoadingRows label="Đang tải webhook" />
            ) : endpoints.isError ? (
              <AsyncState
                description="Không thể tải endpoint webhook."
                title="Không thể tải webhook"
                tone="error"
              />
            ) : endpoints.data?.length ? (
              <div className="overflow-x-auto border">
                <Table className="min-w-[900px] text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Topics</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Khóa cũ hết hạn</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.data.map((endpoint) => (
                      <TableRow key={endpoint.id}>
                        <TableCell>
                          <div className="font-medium">{endpoint.name}</div>
                          <div className="max-w-md truncate font-mono text-[10px] text-muted-foreground">
                            {endpoint.url}
                          </div>
                        </TableCell>
                        <TableCell>{endpoint.topics.join(", ")}</TableCell>
                        <TableCell>
                          <StatusBadge
                            status={endpoint.active ? "success" : "neutral"}
                          >
                            {endpoint.active ? "active" : "revoked"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {formatDate(endpoint.previousSecretValidUntil)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {endpoint.active ? (
                              <>
                                <Button
                                  aria-label={`Xoay khóa ${endpoint.name}`}
                                  disabled={rotateSecret.isPending}
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    rotateSecret.mutate({
                                      endpointId: endpoint.id,
                                    })
                                  }
                                >
                                  <KeyRound aria-hidden className="size-4" />
                                </Button>
                                <ConfirmDestructiveAction
                                  confirmLabel="Thu hồi"
                                  description="Endpoint sẽ ngừng nhận sự kiện mới và các lượt giao đang chờ sẽ bị hủy."
                                  pending={revokeEndpoint.isPending}
                                  title={`Thu hồi ${endpoint.name}?`}
                                  trigger={
                                    <Button
                                      aria-label={`Thu hồi ${endpoint.name}`}
                                      size="icon-sm"
                                      type="button"
                                      variant="ghost"
                                    >
                                      <Ban aria-hidden className="size-4" />
                                    </Button>
                                  }
                                  onConfirm={() =>
                                    revokeEndpoint.mutate({
                                      endpointId: endpoint.id,
                                    })
                                  }
                                />
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description="Tạo endpoint để nhận sự kiện xuất bản có chữ ký HMAC."
                title="Chưa có webhook"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardHeader>
            <CardTitle>Lượt giao webhook</CardTitle>
            <CardDescription>
              Theo dõi HTTP status, lỗi đã che dữ liệu nhạy cảm và tạo lượt giao
              lại có audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {deliveries.isLoading ? (
              <LoadingRows label="Đang tải lượt giao webhook" />
            ) : deliveries.isError ? (
              <AsyncState
                description="Không thể tải lịch sử giao webhook."
                title="Không thể tải lượt giao"
                tone="error"
              />
            ) : deliveries.data?.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px] text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Endpoint / topic</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Lần thử</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>Lỗi / phản hồi</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.data.map(({ delivery, endpoint, event }) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <div className="font-medium">{endpoint.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {event.topic}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={statusTone(delivery.status)}>
                            {delivery.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {delivery.attempt}/{delivery.maxAttempts}
                        </TableCell>
                        <TableCell>{delivery.httpStatus ?? "—"}</TableCell>
                        <TableCell className="max-w-sm">
                          <p className="line-clamp-2 text-destructive">
                            {delivery.lastError ||
                              delivery.responseSnippet ||
                              "—"}
                          </p>
                        </TableCell>
                        <TableCell>{formatDate(delivery.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            aria-label={`Giao lại ${delivery.id}`}
                            disabled={replayDelivery.isPending}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              replayDelivery.mutate({ deliveryId: delivery.id })
                            }
                          >
                            <RefreshCw aria-hidden className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description="Lượt giao sẽ xuất hiện sau sự kiện xuất bản đầu tiên."
                title="Chưa có lượt giao"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
