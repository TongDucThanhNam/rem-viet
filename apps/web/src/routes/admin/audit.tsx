import { roleHasCapability } from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
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
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import AdminShell from "@/components/admin-shell";
import { AsyncState } from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/audit")({
  component: AuditAdminRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "audit.read"))
      throw redirect({ to: "/admin/dashboard" });
  },
});

function displayJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function AuditAdminRoute() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const query = useQuery(
    trpc.governance.audit.list.queryOptions({
      search: search || undefined,
      entityType: entityType || undefined,
      limit: 150,
    }),
  );

  return (
    <AdminShell>
      <div className="mx-auto grid w-full max-w-7xl gap-5">
        <Card className="rounded-md">
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="audit-search">Tìm kiếm</Label>
              <Input
                id="audit-search"
                placeholder="Email, thao tác, mã đối tượng, mã yêu cầu…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-entity">Loại đối tượng</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                id="audit-entity"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              >
                <option value="">Tất cả</option>
                {[
                  "page",
                  "post",
                  "media",
                  "menu",
                  "site_settings",
                  "staff",
                  "redirect",
                  "form_submission",
                  "form_definition",
                  "system",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardContent className="p-0">
            {query.isLoading ? (
              <div
                aria-label="Đang tải nhật ký kiểm toán"
                className="grid gap-2 p-4"
                role="status"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton className="h-12" key={index} />
                ))}
              </div>
            ) : query.isError ? (
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
                description="Không thể tải phạm vi nhật ký này. Bộ lọc hiện tại vẫn được giữ lại."
                title="Không thể tải nhật ký kiểm toán"
                tone="error"
              />
            ) : query.data?.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Người thực hiện</TableHead>
                      <TableHead>Thao tác</TableHead>
                      <TableHead>Đối tượng</TableHead>
                      <TableHead>Mã yêu cầu</TableHead>
                      <TableHead>Dữ liệu thay đổi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(query.data ?? []).map((event) => (
                      <TableRow className="align-top" key={event.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(event.createdAt).toLocaleString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{event.actorEmail || "Hệ thống"}</div>
                          <div className="text-muted-foreground">
                            {event.actorRole}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {event.action}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{event.entityType}</div>
                          <div className="max-w-48 truncate font-mono text-muted-foreground">
                            {event.entityId}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-40 truncate font-mono text-xs">
                          {event.requestId || "—"}
                        </TableCell>
                        <TableCell>
                          <details>
                            <summary className="cursor-pointer text-xs underline">
                              Xem trước và sau
                            </summary>
                            <pre className="mt-2 max-h-72 max-w-xl overflow-auto rounded-md bg-muted p-3 text-[11px]">
                              {displayJson({
                                before: event.before,
                                after: event.after,
                              })}
                            </pre>
                          </details>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description={
                  search || entityType
                    ? "Không có sự kiện nào khớp bộ lọc hiện tại. Hãy đổi hoặc xóa bộ lọc để xem thêm."
                    : "Các thay đổi có thể kiểm toán sẽ xuất hiện tại đây."
                }
                title={
                  search || entityType
                    ? "Không có kết quả phù hợp"
                    : "Chưa có sự kiện kiểm toán"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
