import { Button } from "@rem-viet/ui/components/button";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Eye, KeyRound, Mail, ShieldAlert } from "lucide-react";

import AuthLayout from "@/components/auth-layout";

export const Route = createFileRoute("/dang-ky")({
  component: DangKyRoute,
});

function DangKyRoute() {
  return (
    <AuthLayout quote="Cổng quản trị Rèm Việt chỉ dành cho tài khoản đã được cấp quyền">
      <div className="mb-5">
        <p className="text-xl font-semibold">Đăng ký</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Giao diện đăng ký được giữ từ admin cũ, nhưng tạo tài khoản quản trị
          đang bị khóa.
        </p>
      </div>

      <div className="mb-4 flex gap-3 rounded-lg border border-amber-300/40 bg-amber-100/60 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          Tài khoản quản trị phải được tạo trước và đưa vào allowlist{" "}
          <code className="rounded bg-background/70 px-1">ADMIN_EMAILS</code>.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="disabled-email">Địa Chỉ Email</Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              disabled
              className="h-10 rounded-lg pl-8 text-sm"
              id="disabled-email"
              placeholder="Nhập email của bạn"
              type="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="disabled-password">Mật Khẩu</Label>
          <div className="relative">
            <KeyRound
              aria-hidden
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              disabled
              className="h-10 rounded-lg px-8 text-sm"
              id="disabled-password"
              placeholder="Nhập mật khẩu của bạn"
              type="password"
            />
            <Eye
              aria-hidden
              className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="disabled-confirm-password">Xác Nhận Mật Khẩu</Label>
          <div className="relative">
            <KeyRound
              aria-hidden
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              disabled
              className="h-10 rounded-lg px-8 text-sm"
              id="disabled-confirm-password"
              placeholder="Xác nhận mật khẩu của bạn"
              type="password"
            />
            <Eye
              aria-hidden
              className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        <Label className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Checkbox className="mt-1 rounded" disabled />
          <span>
            Tôi đồng ý với{" "}
            <span className="text-foreground">Điều Khoản</span> và{" "}
            <span className="text-foreground">Chính Sách Bảo Mật</span>
          </span>
        </Label>

        <Button className="h-10 w-full rounded-lg text-sm" disabled type="submit">
          Đăng Ký
        </Button>
      </form>

      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs text-muted-foreground">HOẶC</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        <Button className="h-10 rounded-lg text-sm" disabled type="button" variant="outline">
          <span className="font-semibold">G</span>
          Tiếp Tục với Google
        </Button>
        <Button className="h-10 rounded-lg text-sm" disabled type="button" variant="outline">
          <ExternalLink aria-hidden />
          Tiếp Tục với Github
        </Button>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          to="/dang-nhap"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
