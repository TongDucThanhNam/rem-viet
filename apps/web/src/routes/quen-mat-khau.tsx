import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import AuthLayout from "@/components/auth-layout";
import { authClient } from "@/lib/auth-client";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/quen-mat-khau")({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/dat-lai-mat-khau",
    });
    setPending(false);
    setSubmitted(true);
  }

  return (
    <AuthLayout quote={`Khôi phục quyền truy cập ${siteConfig.name} CMS`}>
      <div className="mb-6">
        <p className="text-xl font-semibold">Quên mật khẩu</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Nhập email quản trị. Nếu tài khoản tồn tại, hệ thống sẽ gửi liên kết
          dùng một lần và hết hạn sau 30 phút.
        </p>
      </div>
      {submitted ? (
        <div className="grid gap-4">
          <p
            className="rounded-lg border bg-muted/40 p-4 text-sm"
            role="status"
          >
            Yêu cầu đã được xử lý. Kiểm tra hộp thư và thư rác; thông báo này
            không xác nhận email có tồn tại trong hệ thống hay không.
          </p>
          <Button render={<Link to="/dang-nhap" />} variant="outline">
            <ArrowLeft aria-hidden /> Quay lại đăng nhập
          </Button>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="reset-email">Email quản trị</Label>
            <div className="relative">
              <Mail
                aria-hidden
                className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="email"
                className="pl-8"
                id="reset-email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <Button disabled={pending} type="submit">
            {pending ? "Đang xử lý…" : "Gửi liên kết đặt lại"}
          </Button>
          <Link
            className="text-center text-sm text-muted-foreground hover:text-foreground"
            to="/dang-nhap"
          >
            Quay lại đăng nhập
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
