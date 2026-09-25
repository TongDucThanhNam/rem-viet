import { useCmsPreviewConnection } from "@agency/cms-admin";
import { createCmsVisualPreviewSession } from "@agency/cms-visual-editor";
import type { CmsVisualNode } from "@agency/cms-visual-editor";
import { parseRichTextDocument } from "@rem-viet/cms";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { CmsPostFormValues } from "@/components/cms-post-form";
import {
  CanvasToolbar,
  type CanvasDevice,
} from "@/components/cms/canvas-toolbar";
import { LayersPanel } from "@/components/cms/layers-panel";
import { PropertiesPanelTabs } from "@/components/cms/properties-panel-tabs";
import {
  CmsPreviewConnectionIndicator,
  CmsPreviewConnectionLabel,
  CmsPreviewConnectionRecovery,
} from "@/components/cms-preview-connection";
import {
  isPostPreviewCompositionCommand,
  isPostPreviewSelectCommand,
  type PostPreviewField,
} from "@/lib/post-preview";
import type { PostRichTextCompositionCommand } from "@/lib/post-rich-text-composition";
import { createPostVisualOutline } from "@/lib/post-visual-outline";
import { siteManifest } from "@/lib/site-config";

type PostPreviewDevice = CanvasDevice;

const postPreviewFieldTargets = {
  publishDate: { label: "Ngày xuất bản", controlId: "post-publish-date" },
  title: { label: "Tiêu đề", controlId: "post-title" },
  description: { label: "Mô tả", controlId: "post-description" },
  coverImage: { label: "Ảnh đại diện", controlId: "post-cover" },
  tags: { label: "Thẻ", controlId: "post-tags" },
  content: { label: "Nội dung bài viết", controlId: "post-content" },
} satisfies Record<PostPreviewField, { label: string; controlId: string }>;

const postPreviewProfiles = {
  desktop: { label: "Desktop", width: 1440, height: 900 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  mobile: { label: "Mobile", width: 390, height: 844 },
} satisfies Record<
  PostPreviewDevice,
  { label: string; width: number; height: number }
>;

export type PostResponsivePreviewProps = {
  canRedo: boolean;
  canUndo: boolean;
  onComposition: (command: PostRichTextCompositionCommand) => void;
  onRedo: () => void;
  onSelectedBlockChange: (index: number | null) => void;
  onUndo: () => void;
  onWorkspaceFocusChange: (focused: boolean) => void;
  postId: string;
  values: CmsPostFormValues;
  version: number;
  previewChannel: Readonly<{
    conflictToken: string;
    sessionBinding: string;
    sessionId: string;
  }>;
  workspaceFocusTriggerRef: RefObject<HTMLButtonElement | null>;
  workspaceFocused: boolean;
};

export default function PostResponsivePreview({
  canRedo,
  canUndo,
  onComposition,
  onRedo,
  onSelectedBlockChange,
  onUndo,
  onWorkspaceFocusChange,
  postId,
  values,
  version,
  previewChannel,
  workspaceFocusTriggerRef: _workspaceFocusTriggerRef,
  workspaceFocused,
}: PostResponsivePreviewProps) {
  const [device, setDevice] = useState<PostPreviewDevice>("desktop");
  const [selectedField, setSelectedField] = useState<PostPreviewField | null>(
    null,
  );
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(
    null,
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const {
    markConnected,
    markFrameLoading,
    markFrameLoaded,
    reloadKey,
    retry,
    status: connectionStatus,
  } = useCmsPreviewConnection();
  const valuesRef = useRef(values);
  const onCompositionRef = useRef(onComposition);
  const onSelectedBlockChangeRef = useRef(onSelectedBlockChange);
  const selectedFieldRef = useRef(selectedField);
  const selectedBlockIndexRef = useRef(selectedBlockIndex);
  const shouldFocusInspectorRef = useRef(false);
  const versionRef = useRef(version);
  const profile = postPreviewProfiles[device];
  const visualRoots = useMemo(() => createPostVisualOutline(values), [values]);
  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null);
  const [hoveredVisualId, setHoveredVisualId] = useState<string | null>(null);
  const selectedVisualNode = useMemo(() => {
    if (!selectedVisualId) return undefined;
    const visit = (nodes: readonly CmsVisualNode[]): CmsVisualNode | null => {
      for (const node of nodes) {
        if (node.id === selectedVisualId) return node;
        if (node.slots) {
          for (const children of Object.values(node.slots)) {
            const found = visit(children);
            if (found) return found;
          }
        }
      }
      return null;
    };
    return visit(visualRoots) ?? undefined;
  }, [visualRoots, selectedVisualId]);
  const standalonePreviewUrl = `/admin/posts/${encodeURIComponent(postId)}/preview`;
  const previewUrl = `${standalonePreviewUrl}?${new URLSearchParams({
    cmsBinding: previewChannel.sessionBinding,
    cmsConflict: previewChannel.conflictToken,
    cmsSession: previewChannel.sessionId,
  })}`;
  const channelReadyRef = useRef(false);
  const previewSessionRef = useRef<{
    key: string;
    session: ReturnType<typeof createCmsVisualPreviewSession>;
  } | null>(null);
  valuesRef.current = values;
  onCompositionRef.current = onComposition;
  onSelectedBlockChangeRef.current = onSelectedBlockChange;
  selectedFieldRef.current = selectedField;
  selectedBlockIndexRef.current = selectedBlockIndex;
  versionRef.current = version;
  const getPreviewSession = useCallback(() => {
    const key = [
      postId,
      previewChannel.sessionId,
      previewChannel.sessionBinding,
      previewChannel.conflictToken,
      reloadKey,
    ].join(":");
    if (previewSessionRef.current?.key !== key) {
      previewSessionRef.current = {
        key,
        session: createCmsVisualPreviewSession({
          source: "host",
          expectedSource: "preview",
          identity: {
            siteId: siteManifest.id,
            documentId: postId,
            documentType: "post",
            sessionId: previewChannel.sessionId,
            sessionBinding: previewChannel.sessionBinding,
            documentVersion: 0,
            conflictToken: previewChannel.conflictToken,
          },
          allowedOrigins: new Set([window.location.origin]),
        }),
      };
    }
    return previewSessionRef.current.session;
  }, [
    postId,
    previewChannel.conflictToken,
    previewChannel.sessionBinding,
    previewChannel.sessionId,
    reloadKey,
  ]);

  const sendWorkingCopy = useCallback(() => {
    if (!channelReadyRef.current) return;
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    const session = getPreviewSession();
    const envelope = session.createVersionedState(
      {
        postId,
        revision: versionRef.current,
        selectedField: selectedFieldRef.current,
        selectedBlockIndex: selectedBlockIndexRef.current,
        values: valuesRef.current,
      },
      versionRef.current,
    );
    if (!envelope) return;
    target.postMessage(envelope, window.location.origin);
  }, [getPreviewSession, postId]);

  useEffect(() => {
    channelReadyRef.current = false;
    markFrameLoading();
  }, [getPreviewSession, markFrameLoading]);

  useEffect(() => {
    sendWorkingCopy();
  }, [selectedBlockIndex, selectedField, sendWorkingCopy, values]);

  /**
   * Two-way binding: when iframe sends a select command (already mapped to
   * `selectedField` / `selectedBlockIndex` in `receiveReady`), mirror it to
   * `selectedVisualId` so the LayersPanel row highlights in lock-step.
   *
   * - Field selection → `post-field-{field}` (matches createPostVisualOutline).
   * - Block selection → `post-block-{blockId}` (resolves from parsed doc).
   */
  useEffect(() => {
    if (selectedField === "content") {
      const doc = parseRichTextDocument(valuesRef.current.content);
      const block =
        selectedBlockIndex !== null && doc
          ? doc.blocks[selectedBlockIndex]
          : null;
      setSelectedVisualId(
        block ? `post-block-${block.id}` : "post-field-content",
      );
      return;
    }
    if (selectedField) {
      setSelectedVisualId(`post-field-${selectedField}`);
    }
  }, [selectedField, selectedBlockIndex]);

  useEffect(() => {
    const receiveReady = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow ||
        !event.data
      )
        return;
      const validation = getPreviewSession().receive({
        value: event.data,
        origin: event.origin,
      });
      if (!validation.accepted) return;
      const payload = validation.envelope.payload;
      if (payload.type === "ready") {
        channelReadyRef.current = true;
        markConnected();
        sendWorkingCopy();
        return;
      }
      if (payload.type === "ack") {
        sendWorkingCopy();
        return;
      }
      if (payload.type !== "command") return;
      if (isPostPreviewSelectCommand(payload.command)) {
        const command = payload.command;
        if (
          command.blockIndex !== undefined &&
          (command.content !== valuesRef.current.content ||
            parseRichTextDocument(valuesRef.current.content)?.blocks[
              command.blockIndex
            ]?.id !== command.blockId)
        )
          return;
        shouldFocusInspectorRef.current = true;
        setSelectedField(command.field);
        const blockIndex = command.blockIndex ?? null;
        setSelectedBlockIndex(blockIndex);
        onSelectedBlockChangeRef.current(blockIndex);
      }
      if (isPostPreviewCompositionCommand(payload.command)) {
        if (payload.command.content !== valuesRef.current.content) return;
        shouldFocusInspectorRef.current = false;
        setSelectedField("content");
        setSelectedBlockIndex(null);
        onSelectedBlockChangeRef.current(null);
        onCompositionRef.current(payload.command.command);
      }
    };
    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [getPreviewSession, markConnected, sendWorkingCopy]);

  useEffect(() => {
    if (!selectedField || !shouldFocusInspectorRef.current) return;
    shouldFocusInspectorRef.current = false;
    const target = postPreviewFieldTargets[selectedField];
    let focusFrame = 0;
    const mountFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const control =
          selectedField === "content"
            ? document.querySelector<HTMLElement>(
                "#post-content .cms-tiptap-prosemirror",
              )
            : document.getElementById(target.controlId);
        control?.scrollIntoView({ behavior: "smooth", block: "center" });
        control?.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(mountFrame);
      cancelAnimationFrame(focusFrame);
    };
  }, [selectedBlockIndex, selectedField]);

  useEffect(() => {
    /* scale removed — Instatic convention renders iframe at natural
     * device dimensions inside horizontally scrollable canvas area. */
  }, []);

  return (
    <Card
      className={
        workspaceFocused
          ? "h-full w-full overflow-hidden rounded-none border-0"
          : "mx-auto w-full max-w-6xl overflow-hidden rounded-md"
      }
      data-cms-preview-connection={connectionStatus}
      data-cms-selected-post-field={selectedField ?? "none"}
      id="post-live-preview"
    >
      <CardContent
        className={
          workspaceFocused
            ? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] p-0"
            : "p-0"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-zinc-950 px-3 py-2.5 text-white">
          <CmsPreviewConnectionIndicator
            connectedText={
              selectedField
                ? `Từ canvas: ${postPreviewFieldTargets[selectedField].label}`
                : "Nhấp nội dung để chỉnh · chưa cần lưu"
            }
            status={connectionStatus}
            title={
              <h2 className="truncate text-xs font-semibold">
                Bản xem trước bài viết đang soạn
              </h2>
            }
          />
          <CanvasToolbar
            canRedo={canRedo}
            canUndo={canUndo}
            device={device}
            focused={workspaceFocused}
            mode="design"
            onDeviceChange={setDevice}
            onFocusToggle={() => onWorkspaceFocusChange(!workspaceFocused)}
            onModeChange={() => undefined}
            onOpen={() => window.open(standalonePreviewUrl, "_blank", "noopener,noreferrer")}
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
            onSelect={setSelectedVisualId}
          />
          <div
            aria-label={`Khung xem trước bài viết ${profile.label}`}
            className={`relative grid min-h-0 flex-1 place-items-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.08),transparent_64%)] p-6 ${workspaceFocused ? "" : "min-h-[36rem]"}`}
            ref={canvasRef}
          >
            <CmsPreviewConnectionRecovery
              onRetry={retry}
              status={connectionStatus}
            />
            <div
              className="overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] ring-1 ring-black/10"
              style={{
                height: profile.height,
                width: profile.width,
              }}
            >
              <iframe
                className="border-0 bg-white"
                key={reloadKey}
                onLoad={() => {
                  markFrameLoaded();
                  sendWorkingCopy();
                }}
                ref={frameRef}
                src={previewUrl}
                style={{
                  height: profile.height,
                  width: profile.width,
                }}
                title={`Xem trước bài viết ${profile.label}`}
              />
            </div>
          </div>
          <PropertiesPanelTabs
            onAttributeChange={(path, value) => {
              // Phase 4.5: wire postMessage → iframe to apply attribute changes.
              // For now: log only so the tab is interactive end-to-end without
              // mutating state silently.
              // eslint-disable-next-line no-console
              console.info("[post-preview] attribute change", { path, value });
            }}
            onStyleChange={(css) => {
              // eslint-disable-next-line no-console
              console.info("[post-preview] style change", { css });
            }}
            selectedNode={selectedVisualNode}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-zinc-900/90 px-3 py-2 text-[10px] text-zinc-400">
          <span>
            {profile.width} × {profile.height} · <span className="font-mono uppercase">{device}</span>
          </span>
          <CmsPreviewConnectionLabel
            connectedLabel={
              <>Bản làm việc trên bản nháp v{version} · riêng tư · trực tiếp</>
            }
            status={connectionStatus}
          />
        </div>
      </CardContent>
    </Card>
  );
}
