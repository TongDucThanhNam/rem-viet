import { Button } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Copy,
  KeyRound,
  Laptop,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { authClient } from "@/lib/auth-client";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/admin/security")({
  component: SecurityRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
});

type OperatorSession = Readonly<{
  id: string;
  token: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

const sessionPageSize = 10;

function deviceLabel(userAgent?: string | null) {
  if (!userAgent) return "Thiết bị không xác định";
  if (/iphone|ipad|android|mobile/i.test(userAgent)) return "Thiết bị di động";
  if (/windows/i.test(userAgent)) return "Máy tính Windows";
  if (/macintosh|mac os/i.test(userAgent)) return "Máy tính macOS";
  if (/linux/i.test(userAgent)) return "Máy tính Linux";
  return "Trình duyệt web";
}

function SecurityRoute() {
  const { session: operator } = Route.useRouteContext();
  const { data: currentSession } = authClient.useSession();
  const [sessions, setSessions] = useState<OperatorSession[]>([]);
  const [visibleSessionCount, setVisibleSessionCount] =
    useState(sessionPageSize);
  const [loading, setLoading] = useState(true);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const twoFactorEnabled = Boolean(
    (currentSession?.user as { twoFactorEnabled?: boolean } | undefined)
      ?.twoFactorEnabled,
  );
  const mfaRequired =
    operator?.staffRole === "owner" || operator?.staffRole === "admin";
  const mfaSecret = mfaSetup
    ? new URL(mfaSetup.totpURI).searchParams.get("secret")
    : null;
  const orderedSessions = useMemo(
    () =>
      [...sessions].sort((left, right) => {
        const leftCurrent = left.id === currentSession?.session.id;
        const rightCurrent = right.id === currentSession?.session.id;
        if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
        return (
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime()
        );
      }),
    [currentSession?.session.id, sessions],
  );
  const visibleSessions = orderedSessions.slice(0, visibleSessionCount);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await authClient.listSessions();
    setLoading(false);
    if (result.error) {
      toast.error("Không thể tải danh sách phiên đăng nhập.");
      return;
    }
    setSessions((result.data ?? []) as OperatorSession[]);
    setVisibleSessionCount(sessionPageSize);
  }, []);

  useEffect(() => void refresh(), [refresh]);

  async function revoke(token: string) {
    setPendingToken(token);
    const result = await authClient.revokeSession({ token });
    setPendingToken(null);
    if (result.error) {
      toast.error("Không thể thu hồi phiên đăng nhập.");
      return;
    }
    toast.success("Đã thu hồi phiên đăng nhập.");
    await refresh();
  }

  async function revokeOthers() {
    setPendingToken("*");
    const result = await authClient.revokeOtherSessions();
    setPendingToken(null);
    if (result.error) {
      toast.error("Không thể thu hồi các phiên khác.");
      return;
    }
    toast.success("Đã đăng xuất tất cả thiết bị khác.");
    await refresh();
  }

  async function sendVerification() {
    const email = currentSession?.user.email;
    if (!email) return;
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/admin/security",
    });
    if (result.error) {
      toast.error("Không thể gửi email xác minh.");
      return;
    }
    toast.success("Nếu email chưa được xác minh, liên kết mới đã được gửi.");
  }

  async function beginMfaSetup() {
    setMfaPending(true);
    const result = await authClient.twoFactor.enable({
      password,
      issuer: siteConfig.name,
    });
    setMfaPending(false);
    if (result.error || !result.data) {
      toast.error("Không thể bắt đầu thiết lập. Kiểm tra lại mật khẩu.");
      return;
    }
    setMfaSetup(result.data);
    setPassword("");
  }

  async function verifyMfaSetup() {
    setMfaPending(true);
    const result = await authClient.twoFactor.verifyTotp({ code: totpCode });
    setMfaPending(false);
    if (result.error) {
      toast.error("Mã xác thực chưa đúng.");
      return;
    }
    toast.success("Đã bật xác thực hai lớp.");
    window.location.reload();
  }

  async function disableMfa() {
    setMfaPending(true);
    const result = await authClient.twoFactor.disable({ password });
    setMfaPending(false);
    if (result.error) {
      toast.error("Không thể tắt xác thực hai lớp. Kiểm tra lại mật khẩu.");
      return;
    }
    toast.success("Đã tắt xác thực hai lớp.");
    window.location.reload();
  }

  return (
    <AdminShell>
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-5" /> Bảo mật tài khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium">{currentSession?.user.email}</p>
              <p className="mt-1 text-muted-foreground">
                {currentSession?.user.emailVerified
                  ? "Email đã được xác minh."
                  : "Email chưa được xác minh."}
              </p>
            </div>
            {currentSession?.user.emailVerified ? null : (
              <Button
                type="button"
                variant="outline"
                onClick={sendVerification}
              >
                <MailCheck aria-hidden /> Gửi email xác minh
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound aria-hidden className="size-5" /> Xác thực hai lớp
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {mfaRequired
                ? "Owner và Admin bắt buộc bật TOTP trước khi dùng các chức năng quản trị."
                : "TOTP là lớp bảo vệ bổ sung, không bắt buộc với Editor."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-5">
            {twoFactorEnabled ? (
              <div className="grid gap-4">
                <p className="text-sm text-success-foreground">
                  Xác thực hai lớp đang được bật cho tài khoản này.
                </p>
                <div className="grid max-w-md gap-2">
                  <Label htmlFor="mfa-disable-password">
                    Mật khẩu hiện tại
                  </Label>
                  <Input
                    autoComplete="current-password"
                    id="mfa-disable-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button
                  className="w-fit"
                  disabled={mfaPending || !password}
                  type="button"
                  variant="destructive"
                  onClick={() => void disableMfa()}
                >
                  {mfaPending ? "Đang tắt…" : "Tắt xác thực hai lớp"}
                </Button>
              </div>
            ) : mfaSetup ? (
              <div className="grid gap-5">
                <div className="grid gap-2 text-sm">
                  <p className="font-medium">
                    1. Thêm tài khoản vào ứng dụng xác thực
                  </p>
                  <p className="text-muted-foreground">
                    Mở liên kết trên thiết bị có ứng dụng TOTP, hoặc nhập khóa
                    thủ công bên dưới.
                  </p>
                  <a
                    className="w-fit text-primary underline underline-offset-4"
                    href={mfaSetup.totpURI}
                  >
                    Mở trong ứng dụng xác thực
                  </a>
                  <div className="flex max-w-xl items-center gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 text-xs">
                      {mfaSecret}
                    </code>
                    <Button
                      aria-label="Sao chép khóa TOTP"
                      size="icon"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!mfaSecret) return;
                        void navigator.clipboard.writeText(mfaSecret);
                        toast.success("Đã sao chép khóa TOTP.");
                      }}
                    >
                      <Copy aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 text-sm">
                  <p className="font-medium">
                    2. Lưu mã khôi phục ở nơi an toàn
                  </p>
                  <p className="text-muted-foreground">
                    Các mã này chỉ hiển thị trong lần thiết lập này và mỗi mã
                    chỉ dùng được một lần.
                  </p>
                  <div className="grid max-w-xl grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-xs sm:grid-cols-3">
                    {mfaSetup.backupCodes.map((code) => (
                      <span key={code}>{code}</span>
                    ))}
                  </div>
                  <Button
                    className="w-fit"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        mfaSetup.backupCodes.join("\n"),
                      );
                      toast.success("Đã sao chép mã khôi phục.");
                    }}
                  >
                    <Copy aria-hidden /> Sao chép mã khôi phục
                  </Button>
                </div>

                <div className="grid max-w-md gap-2">
                  <Label htmlFor="mfa-verify-code">
                    3. Nhập mã 6 chữ số để hoàn tất
                  </Label>
                  <Input
                    autoComplete="one-time-code"
                    className="font-mono tracking-widest"
                    id="mfa-verify-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(event) =>
                      setTotpCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                <Button
                  className="w-fit"
                  disabled={mfaPending || totpCode.length !== 6}
                  type="button"
                  onClick={() => void verifyMfaSetup()}
                >
                  {mfaPending ? "Đang xác minh…" : "Xác minh và bật TOTP"}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {mfaRequired ? (
                  <p
                    className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
                    role="alert"
                  >
                    Hãy hoàn tất thiết lập để mở khóa quyền quản trị của tài
                    khoản này.
                  </p>
                ) : null}
                <div className="grid max-w-md gap-2">
                  <Label htmlFor="mfa-enable-password">Mật khẩu hiện tại</Label>
                  <Input
                    autoComplete="current-password"
                    id="mfa-enable-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button
                  className="w-fit"
                  disabled={mfaPending || !password}
                  type="button"
                  onClick={() => void beginMfaSetup()}
                >
                  {mfaPending ? "Đang chuẩn bị…" : "Thiết lập ứng dụng TOTP"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Thiết bị và phiên đăng nhập</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Thu hồi ngay các phiên không nhận ra. Mật khẩu đặt lại cũng thu
                hồi toàn bộ phiên cũ.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={loading}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => void refresh()}
              >
                <RefreshCw aria-hidden /> Làm mới
              </Button>
              <Button
                disabled={pendingToken !== null || sessions.length <= 1}
                size="sm"
                type="button"
                variant="destructive"
                onClick={() => void revokeOthers()}
              >
                Đăng xuất thiết bị khác
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {loading ? (
              <p className="text-sm text-muted-foreground" role="status">
                Đang tải phiên đăng nhập…
              </p>
            ) : sessions.length ? (
              <>
                <p className="text-xs text-muted-foreground" role="status">
                  Hiển thị {visibleSessions.length} trong {sessions.length}{" "}
                  phiên đăng nhập.
                </p>
                <ul className="divide-y" aria-label="Danh sách phiên đăng nhập">
                  {visibleSessions.map((item, index) => {
                    const current = item.id === currentSession?.session.id;
                    const mobile = /iphone|ipad|android|mobile/i.test(
                      item.userAgent ?? "",
                    );
                    const Icon = mobile ? Smartphone : Laptop;
                    return (
                      <li
                        className="flex flex-wrap items-center gap-3 py-4"
                        key={item.id}
                      >
                        <Icon
                          aria-hidden
                          className="size-5 text-muted-foreground"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {deviceLabel(item.userAgent)}{" "}
                            {current ? "· Phiên này" : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.ipAddress || "IP không khả dụng"} · Hoạt động{" "}
                            {new Date(item.updatedAt).toLocaleString("vi-VN")} ·
                            Hết hạn{" "}
                            {new Date(item.expiresAt).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        {current ? (
                          <span className="text-xs font-medium text-success-foreground">
                            Đang dùng
                          </span>
                        ) : (
                          <Button
                            aria-label={`Thu hồi phiên ${index + 1}: ${deviceLabel(item.userAgent)}, hoạt động ${new Date(item.updatedAt).toLocaleString("vi-VN")}`}
                            disabled={pendingToken !== null}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => void revoke(item.token)}
                          >
                            {pendingToken === item.token
                              ? "Đang thu hồi…"
                              : "Thu hồi"}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {visibleSessions.length < sessions.length ? (
                  <Button
                    className="w-fit"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setVisibleSessionCount((count) => count + sessionPageSize)
                    }
                  >
                    Hiển thị thêm phiên
                  </Button>
                ) : sessions.length > sessionPageSize ? (
                  <Button
                    className="w-fit"
                    type="button"
                    variant="ghost"
                    onClick={() => setVisibleSessionCount(sessionPageSize)}
                  >
                    Thu gọn danh sách
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có phiên đăng nhập đang hoạt động.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
