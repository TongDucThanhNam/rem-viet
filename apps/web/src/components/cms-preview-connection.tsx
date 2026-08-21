import type { CmsPreviewConnectionStatus } from "@agency/cms-admin";
import { Clock3, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

const statusCopy = {
  connecting: "Đang khởi động bản xem trước…",
  connected: "Đã kết nối với renderer trực tiếp",
  delayed: "Canvas chưa xác nhận kết nối",
} satisfies Record<CmsPreviewConnectionStatus, string>;

export function CmsPreviewConnectionIndicator({
  connectedText,
  status,
  title,
}: {
  connectedText: string;
  status: CmsPreviewConnectionStatus;
  title: ReactNode;
}) {
  const connected = status === "connected";
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      data-cms-preview-connection={status}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        {connected ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
        ) : null}
        <span
          className={`relative inline-flex size-2 rounded-full ${
            connected
              ? "bg-emerald-400"
              : status === "delayed"
                ? "bg-rose-400"
                : "bg-amber-300"
          }`}
        />
      </span>
      <div className="min-w-0">
        {title}
        <p aria-live="polite" className="text-[10px] text-zinc-400">
          {connected ? connectedText : statusCopy[status]}
        </p>
      </div>
    </div>
  );
}

export function CmsPreviewConnectionRecovery({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: CmsPreviewConnectionStatus;
}) {
  if (status !== "delayed") return null;
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-zinc-950/82 p-6 backdrop-blur-sm">
      <div
        className="grid max-w-sm justify-items-center gap-3 rounded-xl border border-rose-300/20 bg-zinc-900/95 p-5 text-center text-white shadow-2xl"
        role="alert"
      >
        <WifiOff aria-hidden className="size-5 text-rose-300" />
        <div>
          <p className="text-sm font-semibold">Canvas chưa phản hồi</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Phiên đăng nhập có thể đã hết hạn hoặc renderer chưa khởi động xong.
            Nội dung đang sửa vẫn an toàn trong inspector.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          type="button"
          onClick={onRetry}
        >
          <RefreshCw aria-hidden className="size-3.5" />
          Tải lại canvas
        </button>
      </div>
    </div>
  );
}

export function CmsPreviewConnectionLabel({
  connectedLabel,
  status,
  tone = "dark",
}: {
  connectedLabel: ReactNode;
  status: CmsPreviewConnectionStatus;
  tone?: "dark" | "light";
}) {
  if (status === "connected")
    return (
      <span className="inline-flex items-center gap-1.5">
        <Wifi aria-hidden className="size-3" />
        {connectedLabel}
      </span>
    );
  if (status === "delayed")
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${
          tone === "dark" ? "text-rose-300" : "text-rose-700"
        }`}
      >
        <WifiOff aria-hidden className="size-3" />
        Canvas chưa phản hồi
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        tone === "dark" ? "text-amber-200" : "text-amber-800"
      }`}
    >
      <Clock3 aria-hidden className="size-3" />
      Đang kết nối canvas
    </span>
  );
}
