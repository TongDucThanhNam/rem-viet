import { useCmsPreviewConnection } from "@agency/cms-admin";
import { createCmsVisualPreviewSession } from "@agency/cms-visual-editor";
import { parseRichTextDocument } from "@rem-viet/cms";
import { Card, CardContent } from "@rem-viet/ui/components/card";
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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { CmsPostFormValues } from "@/components/cms-post-form";
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
import { siteManifest } from "@/lib/site-config";

type PostPreviewDevice = "desktop" | "tablet" | "mobile";

const postPreviewFieldTargets = {
  publishDate: { label: "Ngày xuất bản", controlId: "post-publish-date" },
  title: { label: "Tiêu đề", controlId: "post-title" },
  description: { label: "Mô tả", controlId: "post-description" },
  coverImage: { label: "Ảnh đại diện", controlId: "post-cover" },
  tags: { label: "Thẻ", controlId: "post-tags" },
  content: { label: "Nội dung bài viết", controlId: "post-content" },
} satisfies Record<PostPreviewField, { label: string; controlId: string }>;

const postPreviewProfiles = {
  desktop: { label: "Desktop", width: 1440, height: 900, icon: Monitor },
  tablet: { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  mobile: { label: "Mobile", width: 390, height: 844, icon: Smartphone },
} satisfies Record<
  PostPreviewDevice,
  { label: string; width: number; height: number; icon: typeof Monitor }
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
  workspaceFocusTriggerRef,
  workspaceFocused,
}: PostResponsivePreviewProps) {
  const [device, setDevice] = useState<PostPreviewDevice>("desktop");
  const [scale, setScale] = useState(0.4);
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fitPreview = () => {
      const availableWidth = Math.max(240, canvas.clientWidth - 48);
      const availableHeight = Math.max(360, canvas.clientHeight - 48);
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
          <div className="flex items-center gap-1 rounded-md bg-white/8 p-1">
            <button
              aria-keyshortcuts="Control+Z Meta+Z"
              aria-label="Hoàn tác thay đổi bài viết"
              className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              data-cms-post-history-undo="true"
              disabled={!canUndo}
              title="Hoàn tác (Ctrl+Z)"
              type="button"
              onClick={onUndo}
            >
              <Undo2 aria-hidden className="size-3.5" />
            </button>
            <button
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
              aria-label="Làm lại thay đổi bài viết"
              className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              data-cms-post-history-redo="true"
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
                  ? "Thoát chế độ tập trung bài viết"
                  : "Mở chế độ tập trung bài viết"
              }
              aria-pressed={workspaceFocused}
              className="hidden size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white xl:grid"
              ref={workspaceFocusTriggerRef}
              title={
                workspaceFocused
                  ? "Thoát chế độ tập trung (Esc)"
                  : "Mở canvas và biểu mẫu trong chế độ tập trung"
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
            {(Object.keys(postPreviewProfiles) as PostPreviewDevice[]).map(
              (key) => {
                const previewProfile = postPreviewProfiles[key];
                const Icon = previewProfile.icon;
                return (
                  <button
                    aria-label={`Xem trước bài viết ${previewProfile.label}`}
                    aria-pressed={device === key}
                    className={
                      device === key
                        ? "grid size-7 place-items-center rounded bg-white text-zinc-950 shadow"
                        : "grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                    }
                    key={key}
                    title={previewProfile.label}
                    type="button"
                    onClick={() => setDevice(key)}
                  >
                    <Icon aria-hidden className="size-3.5" />
                  </button>
                );
              },
            )}
            <a
              aria-label="Mở bản nháp bài viết đã lưu trong tab riêng"
              className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              href={standalonePreviewUrl}
              rel="noreferrer"
              target="_blank"
              title="Mở bản nháp đã lưu"
            >
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
        </div>
        <div
          aria-label={`Khung xem trước bài viết ${profile.label}`}
          className={`relative grid place-items-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.08),transparent_64%)] p-6 ${workspaceFocused ? "min-h-0" : "min-h-[36rem]"}`}
          ref={canvasRef}
        >
          <CmsPreviewConnectionRecovery
            onRetry={retry}
            status={connectionStatus}
          />
          <div
            className="overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] ring-1 ring-black/10 transition-[width,height] duration-300 motion-reduce:transition-none"
            style={{
              height: profile.height * scale,
              width: profile.width * scale,
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
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: profile.width,
              }}
              title={`Xem trước bài viết ${profile.label}`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
          <span>
            {profile.width} × {profile.height} · {Math.round(scale * 100)}%
          </span>
          <CmsPreviewConnectionLabel
            connectedLabel={
              <>Bản làm việc trên bản nháp v{version} · riêng tư · trực tiếp</>
            }
            status={connectionStatus}
            tone="light"
          />
        </div>
      </CardContent>
    </Card>
  );
}
