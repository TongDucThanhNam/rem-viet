import { roleHasCapability, type StaffRole } from "@rem-viet/cms";
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
import { Plus, ShieldCheck, UserX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { AsyncState, ConfirmDestructiveAction } from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/staff")({
  component: StaffAdminRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
    if (!roleHasCapability(context.session.staffRole, "staff.manage"))
      throw redirect({ to: "/admin/dashboard" });
  },
});

const roles = ["owner", "admin", "editor"] as const;
const roleLabel: Record<StaffRole, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  editor: "Biên tập viên",
};

function StaffAdminRoute() {
  const { session } = Route.useRouteContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.governance.staff.list.queryOptions());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("editor");
  const refresh = () =>
    queryClient.invalidateQueries(trpc.governance.staff.list.queryFilter());
  const create = useMutation(
    trpc.governance.staff.create.mutationOptions({
      onSuccess: () => {
        setName("");
        setEmail("");
        setPassword("");
        setRole("editor");
        void refresh();
        toast.success("Đã tạo tài khoản nhân sự.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const updateRole = useMutation(
    trpc.governance.staff.updateRole.mutationOptions({
      onSuccess: () => {
        void refresh();
        toast.success("Đã cập nhật quyền.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const revoke = useMutation(
    trpc.governance.staff.revoke.mutationOptions({
      onSuccess: () => {
        void refresh();
        toast.success("Đã thu hồi quyền và đăng xuất các phiên đăng nhập.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name, email, password, role });
  }

  return (
    <AdminShell>
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Tạo tài khoản nhân sự</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_10rem_auto] xl:items-end"
              onSubmit={submit}
            >
              <div className="grid gap-2">
                <Label htmlFor="staff-name">Tên</Label>
                <Input
                  id="staff-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-password">Mật khẩu tạm</Label>
                <Input
                  autoComplete="new-password"
                  id="staff-password"
                  minLength={12}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-role">Vai trò</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  id="staff-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as StaffRole)}
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel[item]}
                    </option>
                  ))}
                </select>
              </div>
              <Button disabled={create.isPending} type="submit">
                <Plus aria-hidden />
                {create.isPending ? "Đang tạo…" : "Tạo tài khoản"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Mật khẩu tối thiểu 12 ký tự. Gửi mật khẩu tạm qua kênh bảo mật và
              yêu cầu người dùng đổi ngay sau bàn giao.
            </p>
            {create.isError ? (
              <p className="mt-3 text-xs text-destructive" role="alert">
                Không thể tạo tài khoản. {create.error.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardContent className="p-0">
            {query.isLoading ? (
              <div
                aria-label="Đang tải danh sách nhân sự"
                className="grid gap-2 p-4"
                role="status"
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton className="h-14" key={index} />
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
                description="Không thể tải danh sách tài khoản và quyền hiện tại."
                title="Không thể tải danh sách nhân sự"
                tone="error"
              />
            ) : query.data?.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Người dùng</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Nguồn quyền</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-right">Thu hồi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(query.data ?? []).map((item) => {
                      const isSelf = item.id === session?.user?.id;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <select
                              aria-label={`Vai trò của ${item.email}`}
                              className="h-9 rounded-md border bg-background px-3 text-sm"
                              disabled={isSelf || item.bootstrapOwner}
                              value={item.role ?? ""}
                              onChange={(event) =>
                                updateRole.mutate({
                                  userId: item.id,
                                  role: event.target.value as StaffRole,
                                })
                              }
                            >
                              {!item.role ? (
                                <option value="">Chưa cấp</option>
                              ) : null}
                              {roles.map((entry) => (
                                <option key={entry} value={entry}>
                                  {roleLabel[entry]}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.bootstrapOwner ? (
                              <span className="inline-flex items-center gap-1">
                                <ShieldCheck className="size-4" /> Chủ sở hữu hệ
                                thống
                              </span>
                            ) : item.role ? (
                              "Vai trò được quản lý"
                            ) : (
                              "Không có quyền CMS"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.createdAt).toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell className="text-right">
                            <ConfirmDestructiveAction
                              confirmLabel="Thu hồi quyền"
                              description={`Tài khoản ${item.email} sẽ mất quyền truy cập CMS và mọi phiên đăng nhập hiện tại sẽ bị kết thúc. Có thể cấp lại quyền sau.`}
                              pending={revoke.isPending}
                              title={`Thu hồi quyền của ${item.email}?`}
                              trigger={
                                <Button
                                  aria-label={`Thu hồi ${item.email}`}
                                  disabled={
                                    !item.role ||
                                    isSelf ||
                                    item.bootstrapOwner ||
                                    revoke.isPending
                                  }
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <UserX aria-hidden className="size-4" />
                                </Button>
                              }
                              onConfirm={() =>
                                revoke.mutate({ userId: item.id })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <AsyncState
                description="Tạo tài khoản đầu tiên để bắt đầu phân quyền quản trị."
                title="Chưa có tài khoản nhân sự"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
