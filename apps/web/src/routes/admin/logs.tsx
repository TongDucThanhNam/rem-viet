import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ListFilter, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import AdminShell from "@/components/admin-shell";
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
    return "bg-muted text-muted-foreground";
  }

  if (statusCode >= 500) {
    return "bg-red-500/10 text-red-700";
  }

  if (statusCode >= 400) {
    return "bg-amber-500/10 text-amber-700";
  }

  return "bg-emerald-500/10 text-emerald-700";
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
      },
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
    <AdminShell hideHeading legacyContentFrame title="Logs">
      <div className="mx-auto my-14 flex w-full max-w-[95rem] flex-col gap-4 lg:px-6">
        <div className="mb-[18px] flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold leading-8 tracking-normal">
                Logs
              </h1>
              <span className="hidden items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:flex">
                {filteredLogs.length}/{logs.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhật ký hoạt động và yêu cầu hệ thống.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-10 rounded-xl pl-9"
              placeholder="Tìm method, URL, IP, device..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden rounded-md border bg-background shadow-sm">
          <CardContent className="p-0">
            {logsQuery.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Đang tải...
              </div>
            ) : filteredLogs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="min-w-24 px-4 py-3 font-semibold">
                        Method
                      </th>
                      <th className="min-w-72 px-4 py-3 font-semibold">URL</th>
                      <th className="min-w-28 px-4 py-3 font-semibold">
                        Status
                      </th>
                      <th className="min-w-40 px-4 py-3 font-semibold">IP</th>
                      <th className="min-w-44 px-4 py-3 font-semibold">
                        Device
                      </th>
                      <th className="min-w-44 px-4 py-3 font-semibold">Time</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr className="border-b last:border-b-0" key={log._id}>
                        <td className="px-4 py-3 font-medium">
                          {log.method ?? "N/A"}
                        </td>
                        <td className="max-w-xl px-4 py-3">
                          <p className="truncate font-mono text-[11px]">
                            {log.url ?? "N/A"}
                          </p>
                          {log.userId ? (
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              userId: {log.userId}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusTone(log.statusCode)}`}
                          >
                            {log.statusCode ?? "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{log.ipAddress ?? "N/A"}</td>
                        <td className="px-4 py-3">{log.deviceId ?? "N/A"}</td>
                        <td className="px-4 py-3">
                          {formatDate(log.timeStamp ?? log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button
                              className="h-auto w-auto bg-transparent p-0 text-pink-600 hover:bg-transparent"
                              disabled={deleteLog.isPending}
                              title="Xóa log"
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm("Xóa log này?")) {
                                  deleteLog.mutate({ logId: log._id });
                                }
                              }}
                            >
                              <Trash2 aria-hidden className="size-5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
                <ListFilter
                  aria-hidden
                  className="size-8 text-muted-foreground"
                />
                <div>
                  <h2 className="text-sm font-medium">Chưa có log</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nhật ký mới sẽ hiển thị tại đây.
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
