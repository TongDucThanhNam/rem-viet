import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import AuthLayout from "@/components/auth-layout";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/quen-mat-khau")({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  return (
    <AuthLayout
      quote={`Khôi phục quyền truy cập vào hệ thống ${siteConfig.name}`}
    >
      <div className="mb-6">
        <p className="text-xl font-semibold">Quên mật khẩu?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Hệ thống không gửi email đặt lại mật khẩu tự động.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
        <div className="flex gap-3">
          <ShieldCheck
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-foreground"
          />
          <div>
            <p className="font-medium text-foreground">
              Liên hệ Owner hoặc đơn vị triển khai
            </p>
            <p>
              Họ sẽ xác minh danh tính và thực hiện quy trình khôi phục quyền
              truy cập phù hợp.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Nhớ mật khẩu?{" "}
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
