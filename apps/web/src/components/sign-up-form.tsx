import { Button } from "@rem-viet/ui/components/button";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import AuthLayout from "@/components/auth-layout";
import { authClient } from "@/lib/auth-client";

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate({
    from: "/",
  });

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/admin/dashboard",
            });
            toast.success("Đăng ký thành công");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z
        .object({
          name: z.string().min(2, "Tên cần ít nhất 2 ký tự"),
          email: z.email("Email không hợp lệ"),
          password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự"),
          confirmPassword: z.string().min(8, "Vui lòng xác nhận mật khẩu"),
        })
        .refine((value) => value.password === value.confirmPassword, {
          message: "Mật khẩu xác nhận không khớp",
          path: ["confirmPassword"],
        }),
    },
  });

  return (
    <AuthLayout quote="Cổng đăng ký tài khoản quản trị Rèm Việt">
      <div className="mb-6">
        <p className="text-xl font-semibold">Đăng ký</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tạo tài khoản quản trị Rèm Việt.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!acceptedTerms) {
            toast.error(
              "Vui lòng đồng ý với điều khoản và chính sách bảo mật.",
            );
            return;
          }
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Tên hiển thị</Label>
              <div className="relative">
                <UserRound
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  autoComplete="name"
                  className="h-10 rounded-lg pl-8 text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="Nhập tên của bạn"
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

        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Địa chỉ email</Label>
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
                  placeholder="Nhập email của bạn"
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
                  autoComplete="new-password"
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

        <form.Field name="confirmPassword">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Xác nhận mật khẩu</Label>
              <div className="relative">
                <KeyRound
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  autoComplete="new-password"
                  className="h-10 rounded-lg px-8 text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="Xác nhận mật khẩu"
                  type={isConfirmVisible ? "text" : "password"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <button
                  aria-label={
                    isConfirmVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  type="button"
                  onClick={() => setIsConfirmVisible((value) => !value)}
                >
                  {isConfirmVisible ? (
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

        <Label className="flex cursor-pointer items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Checkbox
            checked={acceptedTerms}
            className="mt-1 rounded"
            onCheckedChange={(value) => setAcceptedTerms(value === true)}
          />
          <span>
            Tôi đồng ý với{" "}
            <button
              className="text-foreground underline-offset-4 hover:underline"
              type="button"
            >
              Điều khoản
            </button>{" "}
            và{" "}
            <button
              className="text-foreground underline-offset-4 hover:underline"
              type="button"
            >
              Chính sách bảo mật
            </button>
          </span>
        </Label>

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
              {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
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
          Tiếp tục với Google
        </Button>
        <Button
          className="h-10 rounded-lg text-sm"
          type="button"
          variant="outline"
          onClick={() => toast.info("Github OAuth chưa được cấu hình.")}
        >
          <ExternalLink aria-hidden />
          Tiếp tục với Github
        </Button>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <button
          className="font-medium text-foreground underline-offset-4 hover:underline"
          type="button"
          onClick={onSwitchToSignIn}
        >
          Đăng nhập
        </button>
      </p>
    </AuthLayout>
  );
}
