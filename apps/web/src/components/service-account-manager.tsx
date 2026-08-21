import {
  roleCapabilities,
  type CmsCapability,
  type StaffRole,
} from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Checkbox } from "@rem-viet/ui/components/checkbox";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, RefreshCw, ShieldX, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import { useTRPC } from "@/utils/trpc";

const capabilityLabel: Record<CmsCapability, string> = {
  "content.readDraft": "Đọc bản nháp",
  "content.write": "Sửa nội dung",
  "content.review.request": "Yêu cầu duyệt",
  "content.review.decide": "Quyết định duyệt",
  "content.publish": "Xuất bản",
  "content.schedule": "Lên lịch",
  "content.restore": "Khôi phục phiên bản",
  "content.delete": "Xóa nội dung",
  "media.manage": "Quản lý media",
  "media.delete": "Xóa media",
  "settings.manage": "Cài đặt website",
  "audit.read": "Đọc nhật ký",
  "staff.manage": "Quản lý nhân sự",
  "redirects.manage": "Quản lý chuyển hướng",
  "leads.manage": "Quản lý khách hàng tiềm năng",
};

const roleLabel: Record<StaffRole, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  editor: "Biên tập viên",
};

type RevealedKey = Readonly<{
  rawKey: string;
  label: string;
}>;

function expiryFromDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function dateLabel(value: Date | string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa từng dùng";
}

export function ServiceAccountManager() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const accounts = useQuery(
    trpc.governance.serviceAccounts.list.queryOptions(),
  );
  const permissions = useQuery(
    trpc.governance.serviceAccounts.permissions.queryOptions(),
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keyLabel, setKeyLabel] = useState("Production integration");
  const [expiryDays, setExpiryDays] = useState(90);
  const [scopes, setScopes] = useState<CmsCapability[]>(["content.readDraft"]);
  const [revealedKey, setRevealedKey] = useState<RevealedKey | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries(
      trpc.governance.serviceAccounts.list.queryFilter(),
    );
  const create = useMutation(
    trpc.governance.serviceAccounts.create.mutationOptions({
      onSuccess: (result) => {
        setRevealedKey({ rawKey: result.rawKey, label: result.key.label });
        setName("");
        setDescription("");
        setKeyLabel("Production integration");
        setScopes(["content.readDraft"]);
        void refresh();
        toast.success("Đã tạo service account và API key.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const rotate = useMutation(
    trpc.governance.serviceAccounts.rotateKey.mutationOptions({
      onSuccess: (result) => {
        setRevealedKey({ rawKey: result.rawKey, label: result.key.label });
        void refresh();
        toast.success("Đã xoay khóa. Khóa cũ bị thu hồi ngay.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const revokeKey = useMutation(
    trpc.governance.serviceAccounts.revokeKey.mutationOptions({
      onSuccess: () => {
        void refresh();
        toast.success("Đã thu hồi API key.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const revokeAccount = useMutation(
    trpc.governance.serviceAccounts.revoke.mutationOptions({
      onSuccess: () => {
        void refresh();
        toast.success("Đã thu hồi service account và toàn bộ khóa.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const availableScopes = permissions.data?.available ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({
      name,
      description,
      keyLabel,
      scopes,
      expiresAt: expiryFromDays(expiryDays),
    });
  }

  function toggleScope(scope: CmsCapability, checked: boolean) {
    setScopes((current) =>
      checked
        ? [...new Set([...current, scope])]
        : current.filter((item) => item !== scope),
    );
  }

  return (
    <div className="grid gap-5">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Ma trận quyền</CardTitle>
          <p className="text-xs text-muted-foreground">
            Quyền giao diện và API dùng cùng một danh mục. API key không bao giờ
            được cấp quyền quản lý nhân sự.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(["owner", "admin", "editor"] as const).map((role) => (
            <div
              className="grid gap-2 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[10rem_1fr]"
              key={role}
            >
              <p className="text-sm font-medium">{roleLabel[role]}</p>
              <div className="flex flex-wrap gap-1.5">
                {roleCapabilities[role].map((capability) => (
                  <span
                    className="rounded border bg-muted px-2 py-1 text-[11px]"
                    key={capability}
                  >
                    {capabilityLabel[capability]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound aria-hidden className="size-5" /> Service account và API
            key
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Dùng cho tích hợp server-to-server. Khóa có scope và hạn dùng, chỉ
            hiển thị một lần, và mọi thao tác vòng đời đều có audit.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="service-account-name">
                  Tên service account
                </Label>
                <Input
                  id="service-account-name"
                  minLength={2}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="service-key-label">Nhãn khóa</Label>
                <Input
                  id="service-key-label"
                  minLength={2}
                  required
                  value={keyLabel}
                  onChange={(event) => setKeyLabel(event.target.value)}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="service-account-description">Mục đích</Label>
                <Input
                  id="service-account-description"
                  placeholder="Ví dụ: đồng bộ nội dung sang ứng dụng mobile"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="service-key-expiry">Hạn dùng</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  id="service-key-expiry"
                  value={expiryDays}
                  onChange={(event) =>
                    setExpiryDays(Number(event.target.value))
                  }
                >
                  <option value={30}>30 ngày</option>
                  <option value={90}>90 ngày</option>
                  <option value={180}>180 ngày</option>
                  <option value={365}>365 ngày</option>
                </select>
              </div>
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Scope API</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableScopes.map((scope) => (
                  <Label
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs"
                    key={scope}
                  >
                    <Checkbox
                      checked={scopes.includes(scope)}
                      onCheckedChange={(value) =>
                        toggleScope(scope, value === true)
                      }
                    />
                    {capabilityLabel[scope]}
                  </Label>
                ))}
              </div>
            </fieldset>
            <Button
              className="w-fit"
              disabled={create.isPending || scopes.length === 0}
              type="submit"
            >
              <Plus aria-hidden />
              {create.isPending ? "Đang tạo…" : "Tạo service account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {revealedKey ? (
        <Card
          className="rounded-md border-warning/50 bg-warning/5"
          role="alert"
        >
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Hãy sao chép khóa ngay</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Khóa “{revealedKey.label}” sẽ không được hiển thị lại sau khi
                đóng thẻ này.
              </p>
            </div>
            <Button
              aria-label="Ẩn API key"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setRevealedKey(null);
                create.reset();
                rotate.reset();
              }}
            >
              <X aria-hidden />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-background p-3 text-xs">
              {revealedKey.rawKey}
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(revealedKey.rawKey);
                toast.success("Đã sao chép API key.");
              }}
            >
              <Copy aria-hidden /> Sao chép
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-md">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Service account hiện có</CardTitle>
          <Button
            disabled={accounts.isFetching}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void accounts.refetch()}
          >
            <RefreshCw aria-hidden /> Làm mới
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">
              Đang tải service account…
            </p>
          ) : accounts.isError ? (
            <AsyncState
              description="Không thể tải service account và trạng thái khóa."
              title="Không thể tải API key"
              tone="error"
            />
          ) : accounts.data?.length ? (
            <div className="grid gap-4">
              {accounts.data.map((account) => (
                <article className="rounded-md border p-4" key={account.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{account.name}</h3>
                        <StatusBadge
                          status={account.revokedAt ? "destructive" : "success"}
                        >
                          {account.revokedAt ? "Đã thu hồi" : "Đang hoạt động"}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {account.description || "Không có mô tả"}
                      </p>
                    </div>
                    {account.revokedAt ? null : (
                      <ConfirmDestructiveAction
                        confirmLabel="Thu hồi account"
                        description="Mọi API key thuộc service account này sẽ bị thu hồi ngay và không thể khôi phục."
                        pending={revokeAccount.isPending}
                        title={`Thu hồi ${account.name}?`}
                        trigger={
                          <Button size="sm" type="button" variant="destructive">
                            <ShieldX aria-hidden /> Thu hồi account
                          </Button>
                        }
                        onConfirm={async () => {
                          await revokeAccount.mutateAsync({
                            serviceAccountId: account.id,
                          });
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-4 grid gap-3">
                    {account.keys.map((key) => {
                      const expired =
                        new Date(key.expiresAt).getTime() <= Date.now();
                      const active =
                        !account.revokedAt && !key.revokedAt && !expired;
                      return (
                        <div
                          className="grid gap-3 rounded-md bg-muted/40 p-3 lg:grid-cols-[1fr_auto]"
                          key={key.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium">{key.label}</span>
                              <code className="text-xs">
                                cmsk_{key.publicId}_…
                              </code>
                              <StatusBadge
                                status={active ? "success" : "destructive"}
                              >
                                {key.revokedAt
                                  ? "Đã thu hồi"
                                  : expired
                                    ? "Hết hạn"
                                    : "Hiệu lực"}
                              </StatusBadge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Hết hạn {dateLabel(key.expiresAt)} · Dùng gần nhất{" "}
                              {dateLabel(key.lastUsedAt)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {key.scopes.map((scope) => (
                                <span
                                  className="rounded border bg-background px-1.5 py-0.5 text-[10px]"
                                  key={scope}
                                >
                                  {capabilityLabel[scope]}
                                </span>
                              ))}
                            </div>
                          </div>
                          {!account.revokedAt && !key.revokedAt ? (
                            <div className="flex flex-wrap items-start gap-2">
                              <Button
                                disabled={rotate.isPending}
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  rotate.mutate({
                                    keyId: key.id,
                                    scopes: key.scopes,
                                    expiresAt: expiryFromDays(90),
                                  })
                                }
                              >
                                <RefreshCw aria-hidden /> Xoay khóa 90 ngày
                              </Button>
                              <ConfirmDestructiveAction
                                confirmLabel="Thu hồi khóa"
                                description="Ứng dụng đang dùng khóa này sẽ mất quyền ngay lập tức."
                                pending={revokeKey.isPending}
                                title={`Thu hồi khóa ${key.label}?`}
                                trigger={
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="destructive"
                                  >
                                    Thu hồi
                                  </Button>
                                }
                                onConfirm={async () => {
                                  await revokeKey.mutateAsync({
                                    keyId: key.id,
                                  });
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <AsyncState
              description="Tạo service account đầu tiên cho một tích hợp server-to-server."
              title="Chưa có service account"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
