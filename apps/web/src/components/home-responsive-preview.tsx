import type { CmsPreviewConnectionStatus } from "@agency/cms-admin";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import {
  CmsPreviewConnectionIndicator,
  CmsPreviewConnectionLabel,
  CmsPreviewConnectionRecovery,
} from "@/components/cms-preview-connection";

export type HomePreviewDevice = "desktop" | "tablet" | "mobile";

const previewProfiles = {
  desktop: { label: "Desktop", width: 1440, height: 900, icon: Monitor },
  tablet: { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  mobile: { label: "Mobile", width: 390, height: 844, icon: Smartphone },
} satisfies Record<
  HomePreviewDevice,
  { label: string; width: number; height: number; icon: typeof Monitor }
>;

export type HomeResponsivePreviewProps = {
  canRedo: boolean;
  canUndo: boolean;
  device: HomePreviewDevice;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onFrameLoad: () => void;
  onOpen: () => void;
  onRedo: () => void;
  onRetry: () => void;
  onUndo: () => void;
  reloadKey: number;
  previewUrl: string;
  status: CmsPreviewConnectionStatus;
  version: number;
  workspaceFocusTriggerRef: RefObject<HTMLButtonElement | null>;
  workspaceFocused: boolean;
  onDeviceChange: (device: HomePreviewDevice) => void;
  onWorkspaceFocusChange: (focused: boolean) => void;
};

export default function HomeResponsivePreview({
  canRedo,
  canUndo,
  device,
  frameRef,
  onFrameLoad,
  onOpen,
  onRedo,
  onRetry,
  onUndo,
  reloadKey,
  previewUrl,
  status,
  version,
  workspaceFocusTriggerRef,
  workspaceFocused,
  onDeviceChange,
  onWorkspaceFocusChange,
}: HomeResponsivePreviewProps) {
  const profile = previewProfiles[device];
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fitPreview = () => {
      const availableWidth = Math.max(240, canvas.clientWidth - 48);
      const availableHeight = Math.max(320, canvas.clientHeight - 48);
      setScale(
        Math.min(
          1,
          availableWidth / profile.width,
          availableHeight / profile.height,
        ),
      );
    };
    fitPreview();
    const observer = new ResizeObserver(fitPreview);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [profile.height, profile.width]);

  return (
    <div
      className="flex min-h-[42rem] flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl xl:min-h-0"
      data-cms-preview-connection={status}
      data-cms-preview-shell="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/90 px-3 py-2.5">
        <CmsPreviewConnectionIndicator
          connectedText="Click một vùng để mở đúng inspector"
          status={status}
          title={<h2 className="text-xs font-semibold">Canvas trực tiếp</h2>}
        />
        <div className="flex items-center gap-1 rounded-md bg-black/35 p-1">
          <button
            aria-keyshortcuts="Control+Z Meta+Z"
            aria-label="Hoàn tác thay đổi canvas"
            className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            data-cms-history-undo="true"
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            type="button"
            onClick={onUndo}
          >
            <Undo2 aria-hidden className="size-3.5" />
          </button>
          <button
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            aria-label="Làm lại thay đổi canvas"
            className="mr-1 grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            data-cms-history-redo="true"
            disabled={!canRedo}
            title="Làm lại (Ctrl+Shift+Z)"
            type="button"
            onClick={onRedo}
          >
            <Redo2 aria-hidden className="size-3.5" />
          </button>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
          <button
            aria-label={
              workspaceFocused
                ? "Thoát chế độ tập trung"
                : "Mở chế độ tập trung"
            }
            aria-pressed={workspaceFocused}
            className="hidden size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white xl:grid"
            ref={workspaceFocusTriggerRef}
            title={
              workspaceFocused
                ? "Thoát chế độ tập trung (Esc)"
                : "Mở canvas và inspector trong chế độ tập trung"
            }
            type="button"
            onClick={() => onWorkspaceFocusChange(!workspaceFocused)}
          >
            {workspaceFocused ? (
              <Minimize2 aria-hidden className="size-3.5" />
            ) : (
              <Maximize2 aria-hidden className="size-3.5" />
            )}
          </button>
          <span
            aria-hidden
            className="mx-0.5 hidden h-4 w-px bg-white/10 xl:block"
          />
          {(Object.keys(previewProfiles) as HomePreviewDevice[]).map((key) => {
            const Icon = previewProfiles[key].icon;
            return (
              <button
                aria-label={`Xem trước ${previewProfiles[key].label}`}
                className={`grid size-7 place-items-center rounded transition-colors ${device === key ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}
                key={key}
                title={previewProfiles[key].label}
                type="button"
                onClick={() => onDeviceChange(key)}
              >
                <Icon aria-hidden className="size-3.5" />
              </button>
            );
          })}
          <a
            aria-label="Mở canvas trong tab riêng"
            className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            href={previewUrl}
            rel="noreferrer"
            target="_blank"
            onClick={(event) => {
              event.preventDefault();
              onOpen();
            }}
          >
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      </div>
      <div
        aria-label="Khung cuộn xem trước Trang chủ"
        className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_62%)] p-6"
        data-cms-preview-canvas="true"
        ref={canvasRef}
        tabIndex={0}
      >
        <CmsPreviewConnectionRecovery onRetry={onRetry} status={status} />
        <div
          className="overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/15 transition-[width,height] duration-300 motion-reduce:transition-none"
          style={{
            height: profile.height * scale,
            width: profile.width * scale,
          }}
        >
          <iframe
            className="border-0 bg-white"
            key={reloadKey}
            onLoad={onFrameLoad}
            ref={frameRef}
            src={previewUrl}
            style={{
              height: profile.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: profile.width,
            }}
            title={`Xem trước Trang chủ ${profile.label}`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900/90 px-3 py-2 text-[10px] text-zinc-400">
        <span>
          {profile.width} × {profile.height} · {Math.round(scale * 100)}%
        </span>
        <CmsPreviewConnectionLabel
          connectedLabel={<>Nháp v{version} · đang đồng bộ trực tiếp</>}
          status={status}
        />
      </div>
    </div>
  );
}
