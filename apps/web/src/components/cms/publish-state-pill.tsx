import { cn } from "@rem-viet/ui/lib/utils";
import { Loader2 } from "lucide-react";

import { editorMotion } from "./design-tokens";

/**
 * Trạng thái lưu nháp của document đang edit.
 * - `saved`: đã đồng bộ xong, an toàn
 * - `unsaved`: có thay đổi chưa được lưu
 * - `saving`: đang ghi xuống backend
 * - `error`: lưu thất bại, cần retry
 */
export type PublishState = "saved" | "unsaved" | "saving" | "error";

const stateConfig = {
  saved: {
    dot: "bg-emerald-500",
    label: "Đã lưu nháp",
    pulse: false,
  },
  unsaved: {
    dot: "bg-amber-500",
    label: "Chưa lưu nháp",
    pulse: false,
  },
  saving: {
    dot: "bg-sky-500",
    label: "Đang lưu…",
    pulse: true,
  },
  error: {
    dot: "bg-rose-500",
    label: "Lỗi lưu nháp",
    pulse: false,
  },
} satisfies Record<PublishState, { dot: string; label: string; pulse: boolean }>;

const dotPulseKeyframes = `
@keyframes publish-pill-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.15); }
}
`;

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export function PublishStatePill({
  state,
  lastSavedAt,
}: {
  state: PublishState;
  lastSavedAt?: Date;
}) {
  const config = stateConfig[state];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dotPulseKeyframes }} />
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border border-white/10",
          "bg-zinc-900/80 px-3 py-1 text-xs",
          editorMotion.transition,
          editorMotion.reducedMotion,
        )}
        data-publish-state={state}
      >
        {config.pulse ? (
          <Loader2
            aria-hidden
            className="size-3 animate-spin text-sky-400 motion-reduce:animate-none"
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              config.dot,
              state === "saving" && "motion-reduce:animate-none",
            )}
            style={{
              animation: "publish-pill-pulse 1.4s ease-in-out infinite",
            }}
          />
        )}
        <span className="font-medium text-zinc-300">{config.label}</span>
        {lastSavedAt && state !== "saving" ? (
          <span className="text-zinc-500">
            · <time dateTime={lastSavedAt.toISOString()}>{formatRelativeTime(lastSavedAt)}</time>
          </span>
        ) : null}
      </div>
    </>
  );
}
