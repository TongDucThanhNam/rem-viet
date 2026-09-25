import { cn } from "@rem-viet/ui/lib/utils";
import {
  Code2,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { editorMotion, editorShadows } from "./design-tokens";
import { IconButton } from "./icon-button";

export type CanvasDevice = "desktop" | "tablet" | "mobile";
export type CanvasMode = "design" | "preview" | "code";

const deviceMap = {
  desktop: { icon: Monitor, label: "Desktop 1440px", aria: "Xem trước Desktop 1440px" },
  tablet: { icon: Tablet, label: "Tablet 768px", aria: "Xem trước Tablet 768px" },
  mobile: { icon: Smartphone, label: "Mobile 390px", aria: "Xem trước Mobile 390px" },
} satisfies Record<CanvasDevice, { icon: LucideIcon; label: string; aria: string }>;

const modeMap = {
  design: { icon: Eye, label: "Design mode" },
  preview: { icon: Eye, label: "Preview mode" },
  code: { icon: Code2, label: "Code mode" },
} satisfies Record<CanvasMode, { icon: LucideIcon; label: string }>;

type CanvasToolbarProps = {
  mode: CanvasMode;
  device: CanvasDevice;
  canUndo: boolean;
  canRedo: boolean;
  focused: boolean;
  onModeChange: (m: CanvasMode) => void;
  onDeviceChange: (d: CanvasDevice) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFocusToggle: () => void;
  onOpen: () => void;
};

/**
 * Floating canvas toolbar — AWWWARDS-grade glass pill.
 *
 * Sticky trên đầu canvas area, luôn visible khi scroll.
 * Background blur tạo depth khi content scroll bên dưới.
 */
export function CanvasToolbar(props: CanvasToolbarProps) {
  return (
    <div
      data-canvas-toolbar
      className={cn(
        "sticky top-0 z-10 flex items-center gap-1 rounded-full",
        "border border-white/10 bg-zinc-900/80 backdrop-blur-md",
        "px-2 py-1.5",
        editorShadows.floatingToolbar,
        editorMotion.transition,
        editorMotion.reducedMotion,
      )}
    >
      <ModeToggle value={props.mode} onChange={props.onModeChange} />
      <Divider />
      <IconButton
        icon={Undo2}
        onClick={props.onUndo}
        disabled={!props.canUndo}
        title="Hoàn tác (Ctrl+Z)"
        aria-keyshortcuts="Control+Z Meta+Z"
        aria-label="Hoàn tác thay đổi canvas"
      />
      <IconButton
        icon={Redo2}
        onClick={props.onRedo}
        disabled={!props.canRedo}
        title="Làm lại (Ctrl+Shift+Z)"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
        aria-label="Làm lại thay đổi canvas"
      />
      <Divider />
      <DeviceSwitcher value={props.device} onChange={props.onDeviceChange} />
      <Divider />
      <IconButton
        icon={props.focused ? Minimize2 : Maximize2}
        onClick={props.onFocusToggle}
        pressed={props.focused}
        title={props.focused ? "Thoát chế độ tập trung (Esc)" : "Mở chế độ tập trung"}
        aria-label={
          props.focused ? "Thoát chế độ tập trung" : "Mở chế độ tập trung"
        }
        aria-pressed={props.focused}
        className="hidden xl:grid"
      />
      <IconButton
        icon={ExternalLink}
        onClick={props.onOpen}
        title="Mở canvas trong tab riêng"
        aria-label="Mở canvas trong tab riêng"
      />
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: CanvasMode;
  onChange: (m: CanvasMode) => void;
}) {
  const modes: CanvasMode[] = ["design", "preview", "code"];
  return (
    <div
      role="radiogroup"
      aria-label="Canvas mode"
      className="flex items-center gap-0.5 rounded-md bg-black/35 p-0.5"
    >
      {modes.map((id) => {
        const { icon: Icon, label } = modeMap[id];
        const pressed = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={pressed}
            aria-label={label}
            onClick={() => onChange(id)}
            className={cn(
              "grid size-6 place-items-center rounded",
              editorMotion.transition,
              editorMotion.reducedMotion,
              pressed
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon aria-hidden className="size-3" />
          </button>
        );
      })}
    </div>
  );
}

function DeviceSwitcher({
  value,
  onChange,
}: {
  value: CanvasDevice;
  onChange: (d: CanvasDevice) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Viewport device"
      className="flex items-center gap-0.5 rounded-md bg-black/35 p-0.5"
    >
      {(Object.entries(deviceMap) as [CanvasDevice, typeof deviceMap[CanvasDevice]][]).map(
        ([id, { icon: Icon, label, aria }]) => {
          const pressed = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={pressed}
              aria-label={aria}
              title={label}
              onClick={() => onChange(id)}
              className={cn(
                "grid size-6 place-items-center rounded",
                editorMotion.transition,
                editorMotion.reducedMotion,
                pressed
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon aria-hidden className="size-3" />
            </button>
          );
        },
      )}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-white/10" />;
}
