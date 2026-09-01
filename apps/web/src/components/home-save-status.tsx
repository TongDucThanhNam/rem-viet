import { CmsDraftStatusSlots, type CmsDraftSaveState } from "@agency/cms-admin";
import { AlertTriangle, Check, Clock3 } from "lucide-react";

export type HomeSaveStatusProps = {
  state: CmsDraftSaveState;
  lastSavedAt: Date | null;
};

export default function HomeSaveStatus({
  state,
  lastSavedAt,
}: HomeSaveStatusProps) {
  const saved = lastSavedAt ? (
    <span
      aria-atomic="true"
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-success-foreground"
      role="status"
    >
      <Check aria-hidden className="size-4" /> Đã lưu lúc{" "}
      {lastSavedAt.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  ) : (
    <span
      aria-atomic="true"
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-muted-foreground"
      role="status"
    >
      <Check aria-hidden className="size-4" /> Đã đồng bộ với máy chủ
    </span>
  );
  return (
    <CmsDraftStatusSlots
      state={state}
      slots={{
        saving: (
          <span
            aria-atomic="true"
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <Clock3 aria-hidden className="size-4" /> Đang tự động lưu…
          </span>
        ),
        conflict: (
          <span
            aria-atomic="true"
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-warning-foreground"
            role="status"
          >
            <AlertTriangle aria-hidden className="size-4" /> Có xung đột phiên
            bản
          </span>
        ),
        dirty: (
          <span
            aria-atomic="true"
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <Clock3 aria-hidden className="size-4" /> Có thay đổi chưa lưu
          </span>
        ),
        saved,
        clean: saved,
      }}
    />
  );
}
