import { Button } from "@rem-viet/ui/components/button";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import AuthLayout from "@/components/auth-layout";
import { authClient } from "@/lib/auth-client";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate({
    from: "/",
  });

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/admin/dashboard",
            });
            toast.success("Đăng nhập thành công");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Email không hợp lệ"),
        password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự"),
      }),
    },
  });

  return (
    <AuthLayout quote="Cổng đăng nhập vào hệ thống Rèm Việt">
      <div className="mb-6">
        <p className="text-xl font-semibold">Đăng nhập</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Truy cập trang quản trị Rèm Việt.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Tên đăng nhập</Label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  autoComplete="email"
                  className="h-10 rounded-lg pl-8 text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="Nhập email đăng nhập"
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-xs text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Mật khẩu</Label>
              <div className="relative">
                <KeyRound
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  autoComplete="current-password"
                  className="h-10 rounded-lg px-8 text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="Nhập mật khẩu"
                  type={isPasswordVisible ? "text" : "password"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <button
                  aria-label={
                    isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  type="button"
                  onClick={() => setIsPasswordVisible((value) => !value)}
                >
                  {isPasswordVisible ? (
                    <EyeOff aria-hidden className="size-4" />
                  ) : (
                    <Eye aria-hidden className="size-4" />
                  )}
                </button>
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-xs text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <div className="flex items-center justify-between gap-3 py-1 text-sm">
          <Label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <Checkbox
              checked={remember}
              className="rounded"
              onCheckedChange={(value) => setRemember(value === true)}
            />
            Ghi nhớ đăng nhập
          </Label>
          <a
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            href="/quen-mat-khau"
          >
            Quên mật khẩu?
          </a>
        </div>

        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              className="h-10 w-full rounded-lg text-sm"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs text-muted-foreground">HOẶC</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        <Button
          className="h-10 rounded-lg text-sm"
          type="button"
          variant="outline"
          onClick={() => toast.info("Google OAuth chưa được cấu hình.")}
        >
          <span className="font-semibold">G</span>
          Đăng nhập bằng Google
        </Button>
        <Button
          className="h-10 rounded-lg text-sm"
          type="button"
          variant="outline"
          onClick={() => toast.info("Github OAuth chưa được cấu hình.")}
        >
          <ExternalLink aria-hidden />
          Đăng nhập bằng Github
        </Button>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <button
          className="font-medium text-foreground underline-offset-4 hover:underline"
          type="button"
          onClick={onSwitchToSignUp}
        >
          Đăng ký ngay
        </button>
      </p>
    </AuthLayout>
  );
}
