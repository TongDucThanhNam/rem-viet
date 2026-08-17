import { roleHasCapability, type FormSubmissionStatus } from "@rem-viet/cms";
import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/leads")({
  component: LeadsAdmin,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "leads.manage"))
      throw redirect({ to: "/admin/dashboard" });
  },
});

const statuses: FormSubmissionStatus[] = ["new", "contacted", "closed", "spam"];
const statusLabels: Record<FormSubmissionStatus | "all", string> = {
  all: "Tất cả",
  new: "Mới",
  contacted: "Đã liên hệ",
  closed: "Đã đóng",
  spam: "Thư rác",
};

function notificationPresentation(status: string) {
  switch (status) {
    case "sent":
      return { label: "Đã gửi thông báo", tone: "success" as const };
    case "failed":
      return { label: "Gửi thông báo thất bại", tone: "destructive" as const };
    case "pending":
      return { label: "Đang chờ thông báo", tone: "warning" as const };
    case "skipped":
      return { label: "Không gửi thông báo", tone: "neutral" as const };
    default:
      return { label: status, tone: "info" as const };
  }
}

function LeadsAdmin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FormSubmissionStatus | "all">("all");
  const query = useQuery(
    trpc.operations.submissions.list.queryOptions(
      status === "all" ? { limit: 200 } : { status, limit: 200 },
    ),
  );
  const update = useMutation(
    trpc.operations.submissions.update.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.operations.submissions.list.queryFilter(),
        ),
      onError: (error) => toast.error(error.message),
    }),
  );
  const remove = useMutation(
    trpc.operations.submissions.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.operations.submissions.list.queryFilter(),
        ),
      onError: (error) => toast.error(error.message),
    }),
  );
  const retryNotification = useMutation(
    trpc.operations.submissions.retryNotification.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.attempted && result.emailStatus === "sent"
            ? "Đã gửi lại email thông báo."
            : "Đã thử lại; hãy kiểm tra cấu hình hoặc lỗi nhà cung cấp.",
        );
        return queryClient.invalidateQueries(
          trpc.operations.submissions.list.queryFilter(),
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <AdminShell
      actions={
        <a
          className={buttonVariants({ variant: "secondary" })}
          href="/api/leads/export.csv"
        >
          <Download aria-hidden /> Xuất CSV
        </a>
      }
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Lọc trạng thái"
        >
          {(["all", ...statuses] as const).map((value) => (
            <Button
              aria-pressed={status === value}
              key={value}
              size="sm"
              variant={status === value ? "default" : "outline"}
              onClick={() => setStatus(value)}
            >
              {statusLabels[value]}
            </Button>
          ))}
        </div>
        {query.isLoading ? (
          <div
            aria-label="Đang tải khách hàng tiềm năng"
            className="grid gap-3"
            role="status"
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton className="h-64" key={index} />
            ))}
          </div>
        ) : query.isError ? (
          <Card className="rounded-md ring-border">
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
                description="Không thể tải các yêu cầu tư vấn trong bộ lọc hiện tại."
                title="Không thể tải khách hàng tiềm năng"
                tone="error"
              />
            </CardContent>
          </Card>
        ) : query.data?.length ? (
          query.data.map((lead) => {
            const notification = notificationPresentation(
              lead.notificationStatus,
            );
            return (
              <Card
                className="rounded-md ring-border"
                data-testid={`lead-${lead.id}`}
                key={lead.id}
              >
                <CardContent className="grid gap-4 md:grid-cols-[1fr_13rem]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{lead.formKey}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleString("vi-VN")}
                      </span>
                      <StatusBadge status={notification.tone}>
                        {notification.label}
                      </StatusBadge>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm">
                      {Object.entries(lead.payload).map(([key, value]) => (
                        <div
                          className="grid grid-cols-[8rem_1fr] gap-3"
                          key={key}
                        >
                          <dt className="text-muted-foreground">{key}</dt>
                          <dd className="whitespace-pre-wrap break-words">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 grid gap-2">
                      <Label htmlFor={`note-${lead.id}`}>Ghi chú nội bộ</Label>
                      <Input
                        id={`note-${lead.id}`}
                        defaultValue={lead.internalNote}
                        onBlur={(event) =>
                          event.target.value !== lead.internalNote &&
                          update.mutate({
                            submissionId: lead.id,
                            internalNote: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid content-start gap-3">
                    <select
                      aria-label="Trạng thái lead"
                      className="h-9 border bg-background px-3 text-sm"
                      value={lead.status}
                      onChange={(event) =>
                        update.mutate({
                          submissionId: lead.id,
                          status: event.target.value as FormSubmissionStatus,
                        })
                      }
                    >
                      {statuses.map((value) => (
                        <option key={value} value={value}>
                          {statusLabels[value]}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Nguồn: {lead.sourcePage}
                    </p>
                    {lead.notificationError ? (
                      <p className="break-words text-xs text-destructive">
                        Thông báo: {lead.notificationError}
                      </p>
                    ) : null}
                    {lead.notificationStatus === "failed" ||
                    lead.notificationStatus === "skipped" ||
                    (lead.notificationStatus === "pending" &&
                      Date.now() - new Date(lead.createdAt).getTime() >=
                        10 * 60_000) ? (
                      <Button
                        variant="outline"
                        disabled={retryNotification.isPending}
                        onClick={() =>
                          retryNotification.mutate({ submissionId: lead.id })
                        }
                      >
                        <RotateCcw aria-hidden /> Gửi lại email
                      </Button>
                    ) : null}
                    <ConfirmDestructiveAction
                      description="Toàn bộ dữ liệu cá nhân, nội dung gửi và ghi chú nội bộ của yêu cầu này sẽ bị xóa vĩnh viễn và không thể khôi phục."
                      pending={remove.isPending}
                      title={`Xóa dữ liệu khách hàng ${lead.id}?`}
                      trigger={
                        <Button
                          disabled={remove.isPending}
                          type="button"
                          variant="destructive"
                        >
                          <Trash2 aria-hidden /> Xóa dữ liệu
                        </Button>
                      }
                      onConfirm={() => remove.mutate({ submissionId: lead.id })}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="rounded-md ring-border">
            <CardContent className="p-0">
              <AsyncState
                description={
                  status === "all"
                    ? "Yêu cầu tư vấn mới sẽ xuất hiện tại đây."
                    : "Không có yêu cầu nào ở trạng thái này. Hãy chọn bộ lọc khác để xem thêm."
                }
                title={
                  status === "all"
                    ? "Chưa có khách hàng tiềm năng"
                    : "Không có kết quả phù hợp"
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
