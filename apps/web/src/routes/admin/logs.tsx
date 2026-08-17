import { roleHasCapability } from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/logs")({
  component: AdminLogsRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
    if (!roleHasCapability(context.session.staffRole, "audit.read")) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
});

function formatDate(value?: string | null) {
  if (!value) {
    return "Chưa có";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN");
}

function statusTone(statusCode?: number | null) {
  if (!statusCode) {
    return "neutral" as const;
  }

  if (statusCode >= 500) {
    return "destructive" as const;
  }

  if (statusCode >= 400) {
    return "warning" as const;
  }

  return "success" as const;
}

function AdminLogsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const logsQuery = useQuery(
    trpc.logs.list.queryOptions({
      limit: 200,
      isActive: true,
      isDeleted: false,
    }),
  );
  const deleteLog = useMutation(
    trpc.logs.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.logs.list.queryFilter());
        toast.success("Đã xóa bản ghi kỹ thuật.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const logs = logsQuery.data?.data ?? [];
  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return logs;
    }

    return logs.filter((log) =>
      [
        log.method,
        log.url,
        log.statusCode,
        log.ipAddress,
        log.deviceId,
        log.userId,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      ),
    );
  }, [logs, search]);

  return (
    <AdminShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="flex flex-col justify-between gap-3 border p-3 md:flex-row md:items-end">
          <p className="text-xs text-muted-foreground" role="status">
            {filteredLogs.length} trên {logs.length} bản ghi
          </p>
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Tìm nhật ký kỹ thuật"
              className="pl-9"
              placeholder="Tìm phương thức, URL, IP hoặc thiết bị…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </section>

        <Card className="overflow-hidden rounded-md ring-border">
          <CardContent className="p-0">
            {logsQuery.isLoading ? (
              <div
                aria-label="Đang tải nhật ký kỹ thuật"
                className="grid gap-2 p-4"
                role="status"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton className="h-12" key={index} />
                ))}
              </div>
            ) : logsQuery.isError ? (
              <AsyncState
                action={
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => void logsQuery.refetch()}
                  >
                    Thử lại
                  </Button>
                }
                description="Không thể tải các bản ghi kỹ thuật hiện tại."
                title="Không thể tải nhật ký kỹ thuật"
                tone="error"
              />
            ) : filteredLogs.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px] text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="min-w-24">Phương thức</TableHead>
                      <TableHead className="min-w-72">URL</TableHead>
                      <TableHead className="min-w-28">Trạng thái</TableHead>
                      <TableHead className="min-w-40">IP</TableHead>
                      <TableHead className="min-w-44">Thiết bị</TableHead>
                      <TableHead className="min-w-44">Thời gian</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="font-medium">
                          {log.method ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-xl">
                          <p className="truncate font-mono text-[11px]">
                            {log.url ?? "—"}
                          </p>
                          {log.userId ? (
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              userId: {log.userId}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={statusTone(log.statusCode)}>
                            {log.statusCode ?? "Chưa có"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{log.ipAddress ?? "—"}</TableCell>
                        <TableCell>{log.deviceId ?? "—"}</TableCell>
                        <TableCell>
                          {formatDate(log.timeStamp ?? log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <ConfirmDestructiveAction
                              description={`Bản ghi ${log.method ?? "không rõ phương thức"} ${log.url ?? "không rõ URL"} sẽ bị xóa vĩnh viễn và không thể khôi phục.`}
                              pending={deleteLog.isPending}
                              title={`Xóa bản ghi kỹ thuật ${log._id}?`}
                              trigger={
                                <Button
                                  aria-label={`Xóa bản ghi ${log.method ?? ""} ${log.url ?? log._id}`}
                                  disabled={deleteLog.isPending}
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 aria-hidden className="size-4" />
                                </Button>
                              }
                              onConfirm={() => {
                                deleteLog.mutate({ logId: log._id });
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description={
                  search
                    ? "Không có bản ghi nào khớp từ khóa hiện tại."
                    : "Nhật ký mới sẽ hiển thị tại đây."
                }
                title={search ? "Không có kết quả phù hợp" : "Chưa có nhật ký"}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
