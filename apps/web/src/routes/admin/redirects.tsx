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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/redirects")({
  component: RedirectsAdmin,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "redirects.manage")) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
});

function RedirectsAdmin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.operations.redirects.list.queryOptions());
  const [oldPath, setOldPath] = useState("");
  const [newPath, setNewPath] = useState("");
  const [statusCode, setStatusCode] = useState<301 | 302 | 307 | 308>(301);
  const [isHydrated, setIsHydrated] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState<
    Record<string, boolean>
  >({});
  useEffect(() => setIsHydrated(true), []);

  function clearOptimisticActive(redirectId: string) {
    setOptimisticActive((current) => {
      const next = { ...current };
      delete next[redirectId];
      return next;
    });
  }
  const create = useMutation(
    trpc.operations.redirects.create.mutationOptions({
      onSuccess: () => {
        setOldPath("");
        setNewPath("");
        queryClient.invalidateQueries(
          trpc.operations.redirects.list.queryFilter(),
        );
        toast.success("Đã tạo chuyển hướng.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const update = useMutation(
    trpc.operations.redirects.update.mutationOptions({
      onSuccess: async (_data, variables) => {
        await queryClient.invalidateQueries(
          trpc.operations.redirects.list.queryFilter(),
        );
        clearOptimisticActive(variables.redirectId);
      },
      onError: (error, variables) => {
        clearOptimisticActive(variables.redirectId);
        toast.error(error.message);
      },
    }),
  );
  const remove = useMutation(
    trpc.operations.redirects.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.operations.redirects.list.queryFilter(),
        ),
      onError: (error) => toast.error(error.message),
    }),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ oldPath, newPath, statusCode, active: true });
  }

  return (
    <AdminShell>
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Card className="rounded-md">
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-[1fr_1fr_8rem_auto] md:items-end"
              onSubmit={submit}
            >
              <div className="grid gap-2">
                <Label htmlFor="redirect-old">Đường dẫn cũ</Label>
                <Input
                  id="redirect-old"
                  disabled={!isHydrated || create.isPending}
                  placeholder="/gioi-thieu-cu"
                  required
                  value={oldPath}
                  onChange={(event) => setOldPath(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redirect-new">Đường dẫn mới</Label>
                <Input
                  id="redirect-new"
                  disabled={!isHydrated || create.isPending}
                  placeholder="/gioi-thieu"
                  required
                  value={newPath}
                  onChange={(event) => setNewPath(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redirect-status">Mã</Label>
                <select
                  id="redirect-status"
                  className="h-8 border bg-background px-2 text-xs"
                  disabled={!isHydrated || create.isPending}
                  value={statusCode}
                  onChange={(event) =>
                    setStatusCode(
                      Number(event.target.value) as 301 | 302 | 307 | 308,
                    )
                  }
                >
                  {[301, 302, 307, 308].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <Button disabled={!isHydrated || create.isPending} type="submit">
                <Plus aria-hidden /> Tạo
              </Button>
            </form>
            {create.isError ? (
              <p className="mt-3 text-xs text-destructive" role="alert">
                Không thể tạo chuyển hướng. {create.error.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-md ring-border">
          <CardContent className="p-0">
            {query.isLoading ? (
              <div
                aria-label="Đang tải danh sách chuyển hướng"
                className="grid gap-2 p-4"
                role="status"
              >
                {Array.from({ length: 5 }).map((_, index) => (
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
                description="Không thể tải các quy tắc chuyển hướng hiện tại."
                title="Không thể tải danh sách chuyển hướng"
                tone="error"
              />
            ) : query.data?.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Đường dẫn cũ</TableHead>
                      <TableHead>Đường dẫn mới</TableHead>
                      <TableHead>Mã</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(query.data ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.oldPath}
                        </TableCell>
                        <TableCell>
                          <a
                            className="inline-flex items-center gap-1 font-mono text-xs underline"
                            href={item.newPath}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.newPath}
                            <ExternalLink className="size-3" />
                          </a>
                        </TableCell>
                        <TableCell>{item.statusCode}</TableCell>
                        <TableCell>
                          <label className="flex items-center gap-2">
                            <input
                              aria-label={`Bật chuyển hướng ${item.oldPath}`}
                              type="checkbox"
                              checked={optimisticActive[item.id] ?? item.active}
                              disabled={
                                !isHydrated ||
                                update.isPending ||
                                remove.isPending
                              }
                              onChange={(event) => {
                                const active = event.target.checked;
                                setOptimisticActive((current) => ({
                                  ...current,
                                  [item.id]: active,
                                }));
                                update.mutate({
                                  redirectId: item.id,
                                  active,
                                });
                              }}
                            />
                            <StatusBadge
                              status={
                                (optimisticActive[item.id] ?? item.active)
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              {(optimisticActive[item.id] ?? item.active)
                                ? "Đang bật"
                                : "Đang tắt"}
                            </StatusBadge>
                          </label>
                        </TableCell>
                        <TableCell className="text-right">
                          <ConfirmDestructiveAction
                            description={`Quy tắc từ ${item.oldPath} đến ${item.newPath} sẽ bị xóa. Các lượt truy cập sau đó sẽ không còn được chuyển hướng.`}
                            pending={remove.isPending}
                            title={`Xóa chuyển hướng ${item.oldPath}?`}
                            trigger={
                              <Button
                                aria-label={`Xóa ${item.oldPath}`}
                                disabled={
                                  !isHydrated ||
                                  update.isPending ||
                                  remove.isPending
                                }
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 aria-hidden className="size-4" />
                              </Button>
                            }
                            onConfirm={() =>
                              remove.mutate({ redirectId: item.id })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description="Tạo quy tắc đầu tiên để bảo toàn truy cập khi một đường dẫn thay đổi."
                title="Chưa có chuyển hướng"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
