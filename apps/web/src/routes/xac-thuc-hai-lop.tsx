import { Button } from "@rem-viet/ui/components/button";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import AuthLayout from "@/components/auth-layout";
import { authClient } from "@/lib/auth-client";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/xac-thuc-hai-lop")({
  component: TwoFactorChallengeRoute,
});

function TwoFactorChallengeRoute() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [backupMode, setBackupMode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = backupMode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setPending(false);
    if (result.error) {
      toast.error(
        result.error.code === "ACCOUNT_TEMPORARILY_LOCKED"
          ? "Tài khoản tạm khóa 15 phút do quá nhiều lần xác minh sai."
          : "Mã xác minh không hợp lệ hoặc đã hết hạn.",
      );
      return;
    }
    await navigate({ to: "/admin/dashboard" });
  }

  return (
    <AuthLayout quote={`Xác minh đăng nhập ${siteConfig.name} CMS`}>
      <div className="mb-6">
        <ShieldCheck aria-hidden className="mb-3 size-8" />
        <p className="text-xl font-semibold">Xác thực hai lớp</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {backupMode
            ? "Nhập một mã khôi phục chưa sử dụng."
            : "Nhập mã 6 chữ số từ ứng dụng xác thực."}
        </p>
      </div>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor="two-factor-code">
            {backupMode ? "Mã khôi phục" : "Mã xác thực"}
          </Label>
          <div className="relative">
            <KeyRound
              aria-hidden
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoComplete="one-time-code"
              className="pl-8 font-mono tracking-widest"
              id="two-factor-code"
              inputMode={backupMode ? "text" : "numeric"}
              maxLength={backupMode ? 64 : 6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
            />
          </div>
        </div>
        <Label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={trustDevice}
            onCheckedChange={(value) => setTrustDevice(value === true)}
          />
          Tin cậy thiết bị này trong 30 ngày
        </Label>
        <Button disabled={pending} type="submit">
          {pending ? "Đang xác minh…" : "Xác minh"}
        </Button>
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          type="button"
          onClick={() => {
            setBackupMode((value) => !value);
            setCode("");
          }}
        >
          {backupMode ? "Dùng mã từ ứng dụng" : "Dùng mã khôi phục"}
        </button>
        <Link
          className="text-center text-xs text-muted-foreground hover:text-foreground"
          to="/dang-nhap"
        >
          Hủy và đăng nhập lại
        </Link>
      </form>
    </AuthLayout>
  );
}
