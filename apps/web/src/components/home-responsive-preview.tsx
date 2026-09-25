import type { CmsPreviewConnectionStatus } from "@agency/cms-admin";
import type { CmsVisualNode } from "@agency/cms-visual-editor";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { CanvasToolbar, type CanvasDevice } from "@/components/cms/canvas-toolbar";
import { LayersPanel } from "@/components/cms/layers-panel";
import { PropertiesPanelTabs } from "@/components/cms/properties-panel-tabs";
import { ResponsiveIframeSurface } from "@/components/cms/responsive-iframe-surface";
import {
  CmsPreviewConnectionIndicator,
  CmsPreviewConnectionLabel,
  CmsPreviewConnectionRecovery,
} from "@/components/cms-preview-connection";

export type HomePreviewDevice = CanvasDevice;

const allDevices: CanvasDevice[] = ["desktop", "tablet", "mobile"];

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
  workspaceFocused: boolean;
  /** Canonical root nodes (CmsVisualNode[]) để hiển thị LayersPanel. */
  visualRoots: readonly CmsVisualNode[];
  /** Selected node id, dùng cho LayersPanel highlight + PropertiesPanelTabs. */
  selectedVisualId?: string | null;
  onSelectVisualId?: (id: string) => void;
  onDeviceChange: (device: HomePreviewDevice) => void;
  onWorkspaceFocusChange: (focused: boolean) => void;
};

function findNodeById(
  roots: readonly CmsVisualNode[],
  id: string | null | undefined,
): CmsVisualNode | null {
  if (!id) return null;
  const visit = (node: CmsVisualNode): CmsVisualNode | null => {
    if (node.id === id) return node;
    if (!node.slots) return null;
    for (const children of Object.values(node.slots)) {
      for (const child of children) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };
  for (const root of roots) {
    const found = visit(root);
    if (found) return found;
  }
  return null;
}

/**
 * Home page canvas — 3 iframe surfaces song song (desktop / tablet / mobile),
 * không scale transform. Instatic convention: mỗi iframe render đúng natural
 * width của viewport để @media CSS áp dụng chính xác. Canvas layout 3-cột:
 * LayersPanel trái · iframe center · PropertiesPanelTabs phải.
 */
export default function HomeResponsivePreview({
  canRedo,
  canUndo,
  device,
  frameRef: _frameRef,
  onFrameLoad,
  onOpen,
  onRedo,
  onRetry,
  onUndo,
  reloadKey,
  previewUrl,
  status,
  version,
  workspaceFocused,
  visualRoots,
  selectedVisualId,
  onSelectVisualId,
  onDeviceChange,
  onWorkspaceFocusChange,
}: HomeResponsivePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeDeviceRef = useRef<HTMLDivElement>(null);
  const [hoveredVisualId, setHoveredVisualId] = useState<string | null>(null);

  // Cuộn active device vào view khi user chọn thiết bị khác.
  useEffect(() => {
    activeDeviceRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [device]);

  const selectedVisualNode = useMemo(
    () => findNodeById(visualRoots, selectedVisualId),
    [visualRoots, selectedVisualId],
  );

  const handleSelectVisual = (id: string) => {
    onSelectVisualId?.(id);
  };

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
        <CanvasToolbar
          canRedo={canRedo}
          canUndo={canUndo}
          device={device}
          focused={workspaceFocused}
          mode="design"
          onDeviceChange={onDeviceChange}
          onFocusToggle={() => onWorkspaceFocusChange(!workspaceFocused)}
          onModeChange={() => undefined}
          onOpen={onOpen}
          onRedo={onRedo}
          onUndo={onUndo}
        />
      </div>
      <div className="flex min-h-0 flex-1">
        <LayersPanel
          hoveredId={hoveredVisualId ?? undefined}
          roots={visualRoots}
          selectedId={selectedVisualId ?? undefined}
          onHover={setHoveredVisualId}
          onSelect={handleSelectVisual}
        />
        <div
          aria-label="Khung cuộn xem trước Trang chủ"
          className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_62%)] p-6"
          data-cms-preview-canvas="true"
          ref={canvasRef}
          tabIndex={0}
        >
          <CmsPreviewConnectionRecovery onRetry={onRetry} status={status} />
          <div
            className="flex w-full max-w-fit items-start justify-center gap-6"
            data-cms-iframe-grid="true"
          >
            {allDevices.map((d) => {
              const isActive = d === device;
              return (
                <div
                  key={d}
                  ref={isActive ? activeDeviceRef : undefined}
                  data-active-wrapper={isActive || undefined}
                  className="flex flex-col items-center gap-2"
                >
                  <ResponsiveIframeSurface
                    device={d}
                    isActive={isActive}
                    onLoad={isActive ? onFrameLoad : undefined}
                    reloadKey={reloadKey}
                    src={previewUrl}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <PropertiesPanelTabs
          onAttributeChange={(path, value) => {
            // Phase 4.5: wire postMessage → iframe to apply attribute changes.
            // For now: log only so the tab is interactive end-to-end without
            // mutating state silently.
            // eslint-disable-next-line no-console
            console.info("[home-preview] attribute change", { path, value });
          }}
          onStyleChange={(css) => {
            // eslint-disable-next-line no-console
            console.info("[home-preview] style change", { css });
          }}
          selectedNode={selectedVisualNode ?? undefined}
        />
      </div>
      <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900/90 px-3 py-2 text-[10px] text-zinc-400">
        <span>3 viewports · thiết bị đang chọn: <span className="font-mono uppercase">{device}</span></span>
        <CmsPreviewConnectionLabel
          connectedLabel={<>Nháp v{version} · đang đồng bộ trực tiếp</>}
          status={status}
        />
      </div>
    </div>
  );
}
