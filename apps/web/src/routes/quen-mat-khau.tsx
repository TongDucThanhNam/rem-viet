import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { type FormEvent } from "react";
import { toast } from "sonner";

import AuthLayout from "@/components/auth-layout";

export const Route = createFileRoute("/quen-mat-khau")({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.info("Chức năng đặt lại mật khẩu chưa được cấu hình.");
  }

  return (
    <AuthLayout quote="Khôi phục quyền truy cập vào hệ thống Rèm Việt">
      <div className="mb-6">
        <p className="text-xl font-semibold">Quên mật khẩu?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Nhập email quản trị để nhận hướng dẫn khôi phục khi tính năng này được
          cấu hình.
        </p>
      </div>

      <form className="space-y-4" onSubmit={submitReset}>
        <div className="space-y-2">
          <Label htmlFor="resetEmail">Email đăng nhập</Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-10 rounded-lg pl-8 text-sm"
              id="resetEmail"
              name="email"
              placeholder="Nhập email đăng nhập"
              type="email"
            />
          </div>
        </div>

        <Button className="h-10 w-full rounded-lg text-sm" type="submit">
          Gửi hướng dẫn
        </Button>
      </form>

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
