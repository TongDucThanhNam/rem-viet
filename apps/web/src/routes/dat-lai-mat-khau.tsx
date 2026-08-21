import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import AuthLayout from "@/components/auth-layout";
import { authClient } from "@/lib/auth-client";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/dat-lai-mat-khau")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.token === "string" && search.token
      ? { token: search.token }
      : {}),
    ...(typeof search.error === "string" && search.error
      ? { error: search.error }
      : {}),
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const invalid = search.error === "INVALID_TOKEN" || !search.token;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({
      newPassword: password,
      token: search.token!,
    });
    setPending(false);
    if (result.error) {
      toast.error("Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng.");
      return;
    }
    toast.success("Đã đặt lại mật khẩu. Mọi phiên đăng nhập cũ đã bị thu hồi.");
    await navigate({ to: "/dang-nhap" });
  }

  return (
    <AuthLayout quote={`Bảo vệ tài khoản ${siteConfig.name} CMS`}>
      <div className="mb-6">
        <p className="text-xl font-semibold">Đặt lại mật khẩu</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Mật khẩu mới phải có ít nhất 12 ký tự. Liên kết chỉ dùng được một lần.
        </p>
      </div>
      {invalid ? (
        <div className="grid gap-4">
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            Liên kết không hợp lệ hoặc đã hết hạn.
          </p>
          <Button render={<Link to="/quen-mat-khau" />}>
            Yêu cầu liên kết mới
          </Button>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <Input
              autoComplete="new-password"
              id="new-password"
              minLength={12}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
            <Input
              autoComplete="new-password"
              id="confirm-password"
              minLength={12}
              required
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          <Button disabled={pending} type="submit">
            {pending ? "Đang cập nhật…" : "Đặt mật khẩu mới"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
