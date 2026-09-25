import { cn } from "@rem-viet/ui/lib/utils";

import { editorShadows } from "./design-tokens";
import type { CanvasDevice } from "./canvas-toolbar";

const deviceDimensions = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} satisfies Record<CanvasDevice, { width: number; height: number }>;

const deviceLabels = {
  desktop: "Desktop · 1440 × 900",
  tablet: "Tablet · 768 × 1024",
  mobile: "Mobile · 390 × 844",
} satisfies Record<CanvasDevice, string>;

/**
 * Một iframe surface render đúng viewport width (không scale transform).
 *
 * Instatic-style: 3 iframe song song, mỗi iframe natural-width của breakpoint.
 * Container cho phép horizontal scroll khi 3 iframes vượt quá canvas width.
 */
export function ResponsiveIframeSurface({
  device,
  isActive,
  src,
  reloadKey,
  onLoad,
  className,
}: {
  device: CanvasDevice;
  isActive: boolean;
  src: string;
  reloadKey: number;
  onLoad?: () => void;
  className?: string;
}) {
  const { width, height } = deviceDimensions[device];
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-lg",
        "border bg-white",
        isActive ? "border-emerald-500/60" : "border-white/10",
        editorShadows.previewFrame,
        editorMotionTransitionAll,
        className,
      )}
      data-device={device}
      data-active={isActive || undefined}
      style={{ width, height }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] text-zinc-500">
        <span className="font-mono uppercase tracking-wider">
          {device}
        </span>
        <span className="font-mono">
          {width} × {height}
        </span>
      </div>
      <iframe
        key={reloadKey}
        src={src}
        onLoad={onLoad}
        title={deviceLabels[device]}
        className="block flex-1 border-0 bg-white"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

const editorMotionTransitionAll = "transition-all duration-300 ease-out motion-reduce:transition-none";
