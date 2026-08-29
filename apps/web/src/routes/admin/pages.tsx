import {
  CmsBlockEditor,
  CmsDraftStatusSlots,
  CmsRevisionList,
  CmsWorkflowActionSlots,
  areCmsRevisionValuesEqual,
  compareCmsRevisionFieldDetails,
  filterCmsBlockAuthoringCatalog,
  resolveCmsReusableContentReferenceState,
  resolveCmsAdminWorkflow,
  runCmsWorkflowCommand,
  useCmsAutosave,
  useCmsFocusWorkspace,
  useCmsPreviewConnection,
  type CmsBlockEditorProps,
  type CmsDraftSaveState,
  type CmsRevisionFieldDefinition,
} from "@agency/cms-admin";
import {
  commitCmsDraftHistory,
  createCmsDraftHistory,
  createCmsVisualEditorStateMessage,
  createCmsVisualPreviewSession,
  filterCmsVisualPatterns,
  getCmsVisualInlineTextTargets,
  isCmsVisualEditorMessage,
  redoCmsDraftHistory,
  undoCmsDraftHistory,
} from "@agency/cms-visual-editor";
import {
  RemVietEditorShell,
  createRemVietStandardBlockEditorRegistry,
} from "@agency/cms-template-rem-viet/admin";
import {
  isRemVietStandardBlockType,
  remVietStandardBlockAuthoringCatalog,
  remVietStandardBlockLabels as standardBlockLabels,
  toLegacyRemVietStandardBlock,
  toRemVietStandardBlock,
  type ProductGridBlock,
  type RichTextBlock,
  type ReusableContentBlock,
  type StandardCtaBlock,
} from "@agency/cms-template-rem-viet";
import {
  remVietStandardVisualComponentRegistry,
  remVietStandardVisualPatternRegistry,
} from "@agency/cms-template-rem-viet/visual-authoring";
import {
  createStandardPageBlockId,
  emptyRichTextDocument,
  ensureStandardPageBlockIds,
  pageBlockListSchema,
  pageRevisionSnapshotSchema,
  parseRichTextDocument,
  type IdentifiedStandardPageBlock,
  type PageBlock,
  type PageRevisionSnapshot,
} from "@rem-viet/cms";
import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { Textarea } from "@rem-viet/ui/components/textarea";
import { cn } from "@rem-viet/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  Clock3,
  Copy,
  ExternalLink,
  GitCompareArrows,
  History,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  Redo2,
  Save,
  Search,
  Send,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import {
  AsyncState,
  ConfirmDestructiveAction,
  StatusBadge,
} from "@/components/admin-ui";
import CmsRichTextEditor from "@/components/cms-rich-text-editor";
import {
  CmsPreviewConnectionIndicator,
  CmsPreviewConnectionLabel,
  CmsPreviewConnectionRecovery,
} from "@/components/cms-preview-connection";
import EditorialReviewPanel from "@/components/editorial-review-panel";
import MediaPickerField from "@/components/media-picker-field";
import RevisionFieldComparison from "@/components/revision-field-comparison";
import { getAdminUser } from "@/functions/get-admin-user";
import { useSaveBeforeNavigation } from "@/hooks/use-save-before-navigation";
import {
  isUnsavedStandardPagePreviewId,
  unsavedStandardPagePreviewId,
} from "@/lib/standard-page-preview";
import { applyStandardPageInlineText } from "@/lib/standard-page-inline-edit";
import {
  copyStandardPageBlock,
  pasteStandardPageBlocks,
} from "@/lib/standard-page-clipboard";
import { applyStandardPagePattern } from "@/lib/standard-page-patterns";
import { siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/pages")({
  component: AdminPagesRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.pageId === "string" && search.pageId.trim()
      ? { pageId: search.pageId }
      : {}),
  }),
});

type PageRow = {
  _id: string;
  title: string;
  slug: string;
  folder: string;
  template: "landing" | "standard";
  blocks: PageBlock[];
  status: "draft" | "published";
  publishedRevisionId: string | null;
  version: number;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  scheduledAt: string | Date | null;
  scheduleNote: string;
  updatedAt: string;
};

type PageRevisionRow = {
  id: string;
  version: number;
  note: string;
  createdBy: string;
  createdAt: string | Date;
  snapshot: PageRevisionSnapshot;
};

type SaveState = CmsDraftSaveState;

type StandardBlock = IdentifiedStandardPageBlock;
type ReusableFragmentRow = {
  id: string;
  version: number;
  status: "draft" | "published";
  data: {
    title: string;
    key: string;
    description: string;
    contentType: string;
    value: unknown;
  };
  publishedRevisionId: string | null;
  updatedAt: string;
};
type StandardPageDraft = {
  title: string;
  slug: string;
  folder: string;
  blocks: StandardBlock[];
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

const newRichTextBlock = (): StandardBlock => ({
  id: createStandardPageBlockId("richText", []),
  type: "richText",
  content: JSON.stringify(emptyRichTextDocument),
});

function createStandardBlock(
  type: StandardBlock["type"],
  existing: readonly StandardBlock[] = [],
): StandardBlock {
  const id = createStandardPageBlockId(
    type,
    existing.map((block) => block.id),
  );
  return type === "reusableContent"
    ? {
        id,
        type,
        reference: {
          kind: "cms.reusable-reference",
          fragmentId: "select-fragment",
          contentType: "standard-page-block",
          revisionId: null,
          overrides: [],
        },
      }
    : type === "cta"
      ? { id, type, title: "Liên hệ với chúng tôi", href: "/lien-he" }
      : type === "productGrid"
        ? { id, type, limit: 8 }
        : {
            id,
            type,
            content: JSON.stringify(emptyRichTextDocument),
          };
}

function summarizeRichTextContent(content: string) {
  const document = parseRichTextDocument(content);
  if (!document) {
    return content.trim()
      ? `Nội dung định dạng cũ · ${[...content].length.toLocaleString("vi-VN")} ký tự`
      : "Để trống";
  }

  const text = document.blocks
    .flatMap((block) => {
      if (block.type === "list") {
        return block.items.flatMap((item) => item.map((span) => span.text));
      }
      if (block.type === "code") return [block.code];
      if (block.type === "image") return [block.alt, block.caption];
      if (block.type === "video") return [block.title];
      return block.children.map((span) => span.text);
    })
    .join(" ")
    .trim();

  return text || `${document.blocks.length} block trống`;
}

function summarizeStandardPageBlocks(blocks: PageBlock[]) {
  const summaries = standardBlocks(blocks).map((block) => {
    if (block.type === "richText") {
      return `Văn bản: ${summarizeRichTextContent(block.content)}`;
    }
    if (block.type === "productGrid") {
      return `Lưới sản phẩm: ${block.limit ?? 8} mục`;
    }
    if (block.type === "cta") return `CTA: ${block.title} → ${block.href}`;
    return `Dùng lại: ${block.reference.fragmentId}${
      block.reference.overrides.length
        ? ` · ${block.reference.overrides.length} ghi đè`
        : ""
    }`;
  });

  return summaries.length ? summaries.join(" · ") : "Không có block";
}

const standardPageRevisionFields = [
  {
    key: "title",
    label: "Tiêu đề trang",
    read: (value) => value.title,
    summarize: (value) => value.title,
  },
  {
    key: "slug",
    label: "Đường dẫn",
    read: (value) => value.slug,
    summarize: (value) => `/${value.slug}`,
  },
  {
    key: "folder",
    label: "Thư mục workflow",
    read: (value) => value.folder,
    summarize: (value) => value.folder || "Thư mục gốc",
  },
  {
    key: "blocks",
    label: "Nội dung và cấu trúc block",
    read: (value) => value.blocks,
    summarize: (value) => summarizeStandardPageBlocks(value.blocks),
  },
  {
    key: "seoTitle",
    label: "Tiêu đề SEO",
    read: (value) => value.seoTitle,
    summarize: (value) => value.seoTitle,
  },
  {
    key: "seoDescription",
    label: "Mô tả SEO",
    read: (value) => value.seoDescription,
    summarize: (value) => value.seoDescription,
  },
  {
    key: "canonicalUrl",
    label: "Canonical URL",
    read: (value) => value.canonicalUrl,
    summarize: (value) => value.canonicalUrl,
  },
  {
    key: "ogImage",
    label: "Ảnh chia sẻ",
    read: (value) => value.ogImage,
    summarize: (value) => (value.ogImage ? "Có ảnh" : "Để trống"),
  },
  {
    key: "robotsIndex",
    label: "Cho phép lập chỉ mục",
    read: (value) => value.robotsIndex,
    summarize: (value) => (value.robotsIndex ? "Bật" : "Tắt"),
  },
  {
    key: "robotsFollow",
    label: "Cho phép theo liên kết",
    read: (value) => value.robotsFollow,
    summarize: (value) => (value.robotsFollow ? "Bật" : "Tắt"),
  },
] as const satisfies readonly CmsRevisionFieldDefinition<PageRevisionSnapshot>[];

function standardBlocks(blocks: PageBlock[]): StandardBlock[] {
  return ensureStandardPageBlockIds(
    blocks.filter((block) => isRemVietStandardBlockType(block.type)) as Extract<
      PageBlock,
      { type: "richText" | "productGrid" | "cta" | "reusableContent" }
    >[],
  );
}

function emptyStandardPageDraft(): StandardPageDraft {
  return {
    title: "",
    slug: "",
    folder: "",
    blocks: [newRichTextBlock()],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    ogImage: "",
    robotsIndex: true,
    robotsFollow: true,
  };
}

function standardPageDraftFromRow(page: PageRow): StandardPageDraft {
  const blocks = standardBlocks(page.blocks);
  return {
    title: page.title,
    slug: page.slug,
    folder: page.folder,
    blocks: blocks.length ? blocks : [newRichTextBlock()],
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    canonicalUrl: page.canonicalUrl,
    ogImage: page.ogImage,
    robotsIndex: page.robotsIndex,
    robotsFollow: page.robotsFollow,
  };
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("vi-VN");
}

function toDatetimeLocal(value: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type StandardPagePreviewDevice = "desktop" | "tablet" | "mobile";

const standardPagePreviewProfiles = {
  desktop: { label: "Desktop", width: 1440, height: 900, icon: Monitor },
  tablet: { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  mobile: { label: "Mobile", width: 390, height: 844, icon: Smartphone },
} satisfies Record<
  StandardPagePreviewDevice,
  { label: string; width: number; height: number; icon: typeof Monitor }
>;

function StandardPageResponsivePreview({
  blocks,
  canInlineEdit,
  canRedo,
  canUndo,
  onCopy,
  onDuplicate,
  onInsert,
  onInlineText,
  onMove,
  onPaste,
  onRedo,
  onRemove,
  onSelect,
  onUndo,
  onWorkspaceFocusChange,
  pageId,
  selectedFieldPath,
  selectedIndex,
  title,
  version,
  previewChannel,
  workspaceFocusTriggerRef,
  workspaceFocused,
}: {
  blocks: StandardBlock[];
  canInlineEdit: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onCopy: (index: number) => void;
  onDuplicate: (index: number) => void;
  onInsert: (type: StandardBlock["type"], targetIndex: number) => void;
  onInlineText: (index: number, fieldPath: string, value: string) => void;
  onMove: (
    sourceIndex: number,
    targetIndex: number,
    placement: "before" | "after",
  ) => void;
  onPaste: (targetIndex: number, placement: "before" | "after") => void;
  onRedo: () => void;
  onRemove: (index: number) => void;
  onSelect: (index: number, fieldPath?: string) => void;
  onUndo: () => void;
  onWorkspaceFocusChange: (focused: boolean) => void;
  pageId: string;
  selectedFieldPath: string | null;
  selectedIndex: number;
  title: string;
  version: number;
  previewChannel: Readonly<{
    conflictToken: string;
    sessionBinding: string;
    sessionId: string;
  }>;
  workspaceFocusTriggerRef: RefObject<HTMLButtonElement | null>;
  workspaceFocused: boolean;
}) {
  const [device, setDevice] = useState<StandardPagePreviewDevice>("desktop");
  const [scale, setScale] = useState(0.4);
  const [lastCanvasIntent, setLastCanvasIntent] = useState("none");
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
  const profile = standardPagePreviewProfiles[device];
  const standalonePreviewUrl = `/admin/pages/${encodeURIComponent(pageId)}/preview`;
  const previewUrl = `${standalonePreviewUrl}?${new URLSearchParams({
    cmsBinding: previewChannel.sessionBinding,
    cmsConflict: previewChannel.conflictToken,
    cmsSession: previewChannel.sessionId,
  })}`;
  const isUnsavedPreview = isUnsavedStandardPagePreviewId(pageId);
  const channelReadyRef = useRef(false);
  const previewSessionRef = useRef<{
    key: string;
    session: ReturnType<typeof createCmsVisualPreviewSession>;
  } | null>(null);
  const getPreviewSession = useCallback(() => {
    const key = [
      pageId,
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
            documentId: pageId,
            documentType: "standardPage",
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
    pageId,
    previewChannel.conflictToken,
    previewChannel.sessionBinding,
    previewChannel.sessionId,
    reloadKey,
  ]);
  const visualBlocks = useMemo(
    () =>
      blocks.flatMap((block, index) => {
        const parsed = toRemVietStandardBlock(block, index);
        return parsed.success ? [parsed.data] : [];
      }),
    [blocks],
  );
  const inlineTextTargets = useMemo(
    () =>
      getCmsVisualInlineTextTargets({
        nodes: visualBlocks,
        registry: remVietStandardVisualComponentRegistry,
        grants: new Set(
          canInlineEdit ? ["content.component.edit", "content.field.edit"] : [],
        ),
      }),
    [canInlineEdit, visualBlocks],
  );

  const sendWorkingCopy = useCallback(() => {
    if (!channelReadyRef.current) return;
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    const session = getPreviewSession();
    const visualState = createCmsVisualEditorStateMessage({
      blocks: visualBlocks,
      selectedBlockId: visualBlocks[selectedIndex]?.id ?? null,
      selectedFieldPath,
      selectionRevision: 0,
      revision: version,
      inlineTextTargets,
    });
    const envelope = session.createVersionedState(
      {
        pageId,
        title,
        blocks,
        visualState,
      },
      version,
    );
    if (!envelope) return;
    target.postMessage(envelope, window.location.origin);
  }, [
    blocks,
    getPreviewSession,
    inlineTextTargets,
    pageId,
    selectedFieldPath,
    selectedIndex,
    title,
    version,
    visualBlocks,
  ]);
  const visualRuntimeRef = useRef({
    onCopy,
    onDuplicate,
    onInsert,
    onInlineText,
    onMove,
    onPaste,
    onRemove,
    onSelect,
    sendWorkingCopy,
    visualBlocks,
  });
  visualRuntimeRef.current = {
    onCopy,
    onDuplicate,
    onInsert,
    onInlineText,
    onMove,
    onPaste,
    onRemove,
    onSelect,
    sendWorkingCopy,
    visualBlocks,
  };

  useEffect(() => {
    channelReadyRef.current = false;
    markFrameLoading();
  }, [getPreviewSession, markFrameLoading]);

  useEffect(() => sendWorkingCopy(), [sendWorkingCopy]);

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
      const runtime = visualRuntimeRef.current;
      if (payload.type === "ready") {
        channelReadyRef.current = true;
        markConnected();
        runtime.sendWorkingCopy();
        return;
      }
      if (payload.type === "ack") {
        runtime.sendWorkingCopy();
        return;
      }
      if (
        payload.type !== "command" ||
        !isCmsVisualEditorMessage(payload.command)
      )
        return;
      const visualMessage = payload.command;
      setLastCanvasIntent(visualMessage.type);
      if (visualMessage.type === "select") {
        const index = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.blockId,
        );
        if (index >= 0)
          runtime.onSelect(index, visualMessage.fieldPath ?? undefined);
      }
      if (visualMessage.type === "move") {
        const sourceIndex = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.blockId,
        );
        const targetIndex = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.targetBlockId,
        );
        if (sourceIndex >= 0 && targetIndex >= 0)
          runtime.onMove(sourceIndex, targetIndex, visualMessage.placement);
      }
      if (visualMessage.type === "insert") {
        const targetIndex = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.targetBlockId,
        );
        if (
          targetIndex >= 0 &&
          isRemVietStandardBlockType(visualMessage.blockType)
        )
          runtime.onInsert(
            visualMessage.blockType as StandardBlock["type"],
            targetIndex,
          );
      }
      if (visualMessage.type === "inline-text") {
        const index = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.blockId,
        );
        if (index >= 0) {
          runtime.onInlineText(
            index,
            visualMessage.fieldPath,
            visualMessage.value,
          );
        }
      }
      if (visualMessage.type === "copy") {
        const index = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.blockId,
        );
        if (index >= 0) runtime.onCopy(index);
      }
      if (visualMessage.type === "paste") {
        const index = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.targetBlockId,
        );
        if (index >= 0) {
          runtime.onPaste(index, visualMessage.placement);
        }
      }
      if (visualMessage.type === "duplicate") {
        const index = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.blockId,
        );
        if (index >= 0) runtime.onDuplicate(index);
      }
      if (visualMessage.type === "remove") {
        const index = runtime.visualBlocks.findIndex(
          (block) => block.id === visualMessage.blockId,
        );
        if (index >= 0) runtime.onRemove(index);
      }
    };
    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [getPreviewSession, markConnected]);

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
      className={cn(
        "overflow-hidden rounded-md",
        workspaceFocused && "h-full rounded-none border-0",
      )}
      data-cms-canvas-field-path={selectedFieldPath ?? "none"}
      data-cms-canvas-last-intent={lastCanvasIntent}
      data-cms-preview-connection={connectionStatus}
      id="standard-page-preview"
    >
      <CardContent
        className={cn(
          "p-0",
          workspaceFocused &&
            "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-zinc-950 px-3 py-2.5 text-white">
          <CmsPreviewConnectionIndicator
            connectedText="Dùng renderer thật · chưa cần lưu"
            status={connectionStatus}
            title={
              <h3 className="truncate text-xs font-semibold">
                Bản xem trước đang soạn
              </h3>
            }
          />
          <div className="flex items-center gap-1 rounded-md bg-white/8 p-1">
            <button
              aria-keyshortcuts="Control+Z Meta+Z"
              aria-label="Hoàn tác thay đổi trang"
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
              aria-label="Làm lại thay đổi trang"
              className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
                  ? "Thoát chế độ tập trung trang"
                  : "Mở chế độ tập trung trang"
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
            {(
              Object.keys(
                standardPagePreviewProfiles,
              ) as StandardPagePreviewDevice[]
            ).map((key) => {
              const previewProfile = standardPagePreviewProfiles[key];
              const Icon = previewProfile.icon;
              return (
                <button
                  aria-label={`Xem trước ${previewProfile.label}`}
                  aria-pressed={device === key}
                  className={cn(
                    "grid size-7 place-items-center rounded transition-colors",
                    device === key
                      ? "bg-white text-zinc-950 shadow"
                      : "text-zinc-400 hover:bg-white/10 hover:text-white",
                  )}
                  key={key}
                  title={previewProfile.label}
                  type="button"
                  onClick={() => setDevice(key)}
                >
                  <Icon aria-hidden className="size-3.5" />
                </button>
              );
            })}
            {!isUnsavedPreview ? (
              <a
                aria-label="Mở bản nháp đã lưu trong tab riêng"
                className="grid size-7 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                href={standalonePreviewUrl}
                rel="noreferrer"
                target="_blank"
                title="Mở bản nháp đã lưu"
              >
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
        <div
          aria-label={`Khung xem trước trang ${profile.label}`}
          className={cn(
            "relative grid min-h-[36rem] place-items-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(24,24,27,0.08),transparent_64%)] p-6",
            workspaceFocused && "min-h-0",
          )}
          ref={canvasRef}
          tabIndex={0}
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
              title={`Xem trước trang ${profile.label}`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
          <span>
            {profile.width} × {profile.height} · {Math.round(scale * 100)}%
          </span>
          <CmsPreviewConnectionLabel
            connectedLabel={<>Bản nháp v{version} · riêng tư · trực tiếp</>}
            status={connectionStatus}
            tone="light"
          />
        </div>
      </CardContent>
    </Card>
  );
}

type StandardEditorContext = {
  key: string;
  onDetach: (block: StandardBlock) => void;
};

function RichTextEditor({
  block,
  context,
  onChange,
}: CmsBlockEditorProps<RichTextBlock> & { context: StandardEditorContext }) {
  return (
    <div data-cms-field-path="data.content">
      <CmsRichTextEditor
        key={context.key}
        value={block.data.content}
        onChange={(content) => onChange({ ...block, data: { content } })}
      />
    </div>
  );
}

function ProductGridEditor({
  block,
  onChange,
}: CmsBlockEditorProps<ProductGridBlock> & { context: StandardEditorContext }) {
  return (
    <>
      <div className="grid gap-2" data-cms-field-path="data.categoryId">
        <Label htmlFor="grid-category">Mã danh mục (không bắt buộc)</Label>
        <Input
          id="grid-category"
          value={block.data.categoryId ?? ""}
          onChange={(event) =>
            onChange({
              ...block,
              data: {
                ...block.data,
                categoryId: event.target.value || undefined,
              },
            })
          }
        />
      </div>
      <div className="grid gap-2" data-cms-field-path="data.limit">
        <Label htmlFor="grid-limit">Số sản phẩm</Label>
        <Input
          id="grid-limit"
          max={24}
          min={1}
          type="number"
          value={block.data.limit ?? 8}
          onChange={(event) =>
            onChange({
              ...block,
              data: { ...block.data, limit: Number(event.target.value) },
            })
          }
        />
      </div>
    </>
  );
}

function CtaEditor({
  block,
  onChange,
}: CmsBlockEditorProps<StandardCtaBlock> & { context: StandardEditorContext }) {
  return (
    <>
      <div className="grid gap-2" data-cms-field-path="data.title">
        <Label htmlFor="cta-title">Tiêu đề</Label>
        <Input
          id="cta-title"
          value={block.data.title}
          onChange={(event) =>
            onChange({
              ...block,
              data: { ...block.data, title: event.target.value },
            })
          }
        />
      </div>
      <div className="grid gap-2" data-cms-field-path="data.href">
        <Label htmlFor="cta-href">Liên kết</Label>
        <Input
          id="cta-href"
          value={block.data.href}
          onChange={(event) =>
            onChange({
              ...block,
              data: { ...block.data, href: event.target.value },
            })
          }
        />
      </div>
    </>
  );
}

function ReusableContentEditor({
  block,
  context,
  onChange,
}: CmsBlockEditorProps<ReusableContentBlock> & {
  context: StandardEditorContext;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fragmentsQuery = useQuery(
    trpc.content.reusableContent.list.queryOptions(),
  );
  const usageQuery = useQuery(
    trpc.content.reusableContent.usage.queryOptions(),
  );
  const resolutionQuery = useQuery({
    ...trpc.content.reusableContent.resolve.queryOptions({
      reference: block.data.reference,
      mode: "draft",
      blockId: block.id,
    }),
    enabled: block.data.reference.fragmentId !== "select-fragment",
  });
  const updateFragment = useMutation(
    trpc.content.reusableContent.update.mutationOptions(),
  );
  const publishFragment = useMutation(
    trpc.content.reusableContent.publish.mutationOptions(),
  );
  const detachFragment = useMutation(
    trpc.content.reusableContent.detach.mutationOptions(),
  );
  const fragments = (fragmentsQuery.data ?? []) as ReusableFragmentRow[];
  const current = fragments.find(
    (fragment) => fragment.id === block.data.reference.fragmentId,
  );
  const usageCount = new Set(
    (usageQuery.data?.byFragment[block.data.reference.fragmentId] ?? []).map(
      (usage) => usage.sourceId,
    ),
  ).size;
  const state = resolveCmsReusableContentReferenceState({
    reference: block.data.reference,
    fragment: current
      ? {
          id: current.id,
          title: current.data.title,
          key: current.data.key,
          description: current.data.description,
          contentType: current.data.contentType,
          version: current.version,
          publishedRevisionId: current.publishedRevisionId,
          usageCount,
        }
      : null,
    resolved: Boolean(resolutionQuery.data?.block),
  });

  const changeReference = (
    next: Partial<ReusableContentBlock["data"]["reference"]>,
  ) =>
    onChange({
      ...block,
      data: {
        reference: { ...block.data.reference, ...next },
      },
    });
  const setOverride = (path: string, value: string | number) =>
    changeReference({
      overrides: [
        ...block.data.reference.overrides.filter(
          (override) => override.path !== path,
        ),
        { op: "set", path, value },
      ],
    });
  const invalidateReusable = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.content.reusableContent.list.queryFilter(),
      ),
      queryClient.invalidateQueries(
        trpc.content.reusableContent.usage.queryFilter(),
      ),
      queryClient.invalidateQueries(
        trpc.content.reusableContent.resolve.queryFilter(),
      ),
    ]);
  };
  const resolved = resolutionQuery.data?.block;

  const applyOverridesToShared = async () => {
    if (!current || !resolved) return;
    try {
      const saved = await updateFragment.mutateAsync({
        fragmentId: current.id,
        expectedVersion: current.version,
        value: resolved,
      });
      await publishFragment.mutateAsync({
        fragmentId: current.id,
        expectedVersion: saved.version,
        note: `Applied from page editor (${usageCount} current usages)`,
      });
      changeReference({ overrides: [], revisionId: null });
      await invalidateReusable();
      toast.success("Đã cập nhật và xuất bản nội dung dùng chung.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật nội dung dùng chung.",
      );
    }
  };

  const detachLocalCopy = async () => {
    try {
      const detached = await detachFragment.mutateAsync({
        reference: block.data.reference,
        mode: "draft",
        blockId: block.id,
      });
      context.onDetach({ ...detached.block, id: block.id });
      toast.success(
        `Đã tách bản cục bộ từ revision ${detached.detachedFrom.revisionId}.`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Không thể tách nội dung dùng chung.",
      );
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${context.key}-reusable-fragment`}>
          Nội dung dùng chung
        </Label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          id={`${context.key}-reusable-fragment`}
          value={block.data.reference.fragmentId}
          onChange={(event) =>
            changeReference({
              fragmentId: event.target.value,
              revisionId: null,
              overrides: [],
            })
          }
        >
          <option value="select-fragment">Chọn một nội dung…</option>
          {fragments.map((fragment) => (
            <option key={fragment.id} value={fragment.id}>
              {fragment.data.title} ·{" "}
              {fragment.publishedRevisionId ? "đã xuất bản" : "bản nháp"}
            </option>
          ))}
        </select>
      </div>

      {current ? (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>{current.data.title}</strong> · {usageCount} nơi đang dùng
            </span>
            <StatusBadge
              status={current.publishedRevisionId ? "success" : "warning"}
            >
              {current.publishedRevisionId ? "Đã xuất bản" : "Chỉ bản nháp"}
            </StatusBadge>
          </div>
          <p className="text-muted-foreground">
            {state.synced
              ? "Đồng bộ với bản xuất bản mới nhất."
              : `Đang ghim revision ${state.revisionId}.`}
          </p>
        </div>
      ) : null}

      {resolved?.type === "richText" ? (
        <div data-cms-field-path="data.reference.overrides.content">
          <Label>Nội dung ghi đè trên trang này</Label>
          <CmsRichTextEditor
            key={`${context.key}-reusable-rich-text`}
            value={resolved.content}
            onChange={(content) => setOverride("/content", content)}
          />
        </div>
      ) : resolved?.type === "productGrid" ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${context.key}-reusable-category`}>
              Mã danh mục ghi đè
            </Label>
            <Input
              id={`${context.key}-reusable-category`}
              value={resolved.categoryId ?? ""}
              onChange={(event) =>
                setOverride("/categoryId", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${context.key}-reusable-limit`}>
              Số sản phẩm ghi đè
            </Label>
            <Input
              id={`${context.key}-reusable-limit`}
              max={24}
              min={1}
              type="number"
              value={resolved.limit ?? 8}
              onChange={(event) =>
                setOverride("/limit", Number(event.target.value))
              }
            />
          </div>
        </div>
      ) : resolved?.type === "cta" ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${context.key}-reusable-title`}>
              Tiêu đề ghi đè
            </Label>
            <Input
              id={`${context.key}-reusable-title`}
              value={resolved.title}
              onChange={(event) => setOverride("/title", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${context.key}-reusable-href`}>
              Liên kết ghi đè
            </Label>
            <Input
              id={`${context.key}-reusable-href`}
              value={resolved.href}
              onChange={(event) => setOverride("/href", event.target.value)}
            />
          </div>
        </div>
      ) : resolutionQuery.isError ? (
        <p className="text-xs text-destructive" role="alert">
          {resolutionQuery.error.message}
        </p>
      ) : current ? (
        <p className="text-xs text-muted-foreground" role="status">
          Đang tải nội dung dùng chung…
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          disabled={!current?.publishedRevisionId}
          size="sm"
          type="button"
          variant="outline"
          onClick={() =>
            changeReference({
              revisionId: state.pinned
                ? null
                : (current?.publishedRevisionId ?? null),
            })
          }
        >
          {state.pinned ? "Bỏ ghim revision" : "Ghim revision hiện tại"}
        </Button>
        <Button
          disabled={state.overrideCount === 0}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => changeReference({ overrides: [] })}
        >
          Xóa {state.overrideCount} ghi đè
        </Button>
        <Button
          disabled={!resolved || detachFragment.isPending}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => void detachLocalCopy()}
        >
          Tách thành bản cục bộ
        </Button>
        <Button
          disabled={
            !current ||
            !resolved ||
            state.overrideCount === 0 ||
            updateFragment.isPending ||
            publishFragment.isPending
          }
          size="sm"
          type="button"
          onClick={() => void applyOverridesToShared()}
        >
          Áp dụng cho {usageCount} nơi và xuất bản
        </Button>
        {current && !current.publishedRevisionId ? (
          <Button
            disabled={publishFragment.isPending}
            size="sm"
            type="button"
            onClick={() =>
              void publishFragment
                .mutateAsync({
                  fragmentId: current.id,
                  expectedVersion: current.version,
                  note: "Published from standard-page editor",
                })
                .then(invalidateReusable)
                .then(() => toast.success("Đã xuất bản nội dung dùng chung."))
                .catch((caught: unknown) =>
                  toast.error(
                    caught instanceof Error
                      ? caught.message
                      : "Không thể xuất bản nội dung dùng chung.",
                  ),
                )
            }
          >
            Xuất bản nội dung dùng chung
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SaveBlockAsReusable({
  block,
  onCreated,
}: {
  block: Exclude<StandardBlock, { type: "reusableContent" }>;
  onCreated: (fragment: ReusableFragmentRow) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fragmentTitle, setFragmentTitle] = useState("");
  const [fragmentKey, setFragmentKey] = useState("");
  const createFragment = useMutation(
    trpc.content.reusableContent.create.mutationOptions(),
  );
  const suggestedKey = fragmentTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);

  const create = async () => {
    const key = (fragmentKey || suggestedKey).trim();
    if (!fragmentTitle.trim() || !key) {
      toast.error("Tên và key nội dung dùng chung là bắt buộc.");
      return;
    }
    try {
      const created = (await createFragment.mutateAsync({
        title: fragmentTitle,
        key,
        description: `Tạo từ khối ${standardBlockLabels[block.type]} trong trình biên tập trang.`,
        value: block,
        status: "draft",
      })) as ReusableFragmentRow;
      await queryClient.invalidateQueries(
        trpc.content.reusableContent.list.queryFilter(),
      );
      onCreated(created);
      setOpen(false);
      setFragmentTitle("");
      setFragmentKey("");
      toast.success(
        "Đã tạo bản nháp dùng chung. Hãy xuất bản trước khi public trang.",
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Không thể tạo nội dung dùng chung.",
      );
    }
  };

  if (!open) {
    return (
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Tạo nội dung dùng chung từ khối này
      </Button>
    );
  }
  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-2">
        <Label htmlFor="new-reusable-title">Tên nội dung dùng chung</Label>
        <Input
          id="new-reusable-title"
          value={fragmentTitle}
          onChange={(event) => setFragmentTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-reusable-key">Key ổn định</Label>
        <Input
          id="new-reusable-key"
          placeholder={suggestedKey || "shared-content-key"}
          value={fragmentKey}
          onChange={(event) => setFragmentKey(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={createFragment.isPending}
          size="sm"
          type="button"
          onClick={() => void create()}
        >
          Tạo và thay bằng tham chiếu
        </Button>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Hủy
        </Button>
      </div>
    </div>
  );
}

const standardBlockEditorRegistry =
  createRemVietStandardBlockEditorRegistry<StandardEditorContext>({
    richText: RichTextEditor,
    productGrid: ProductGridEditor,
    cta: CtaEditor,
    reusableContent: ReusableContentEditor,
  });

function AdminPagesRoute() {
  const { session } = Route.useRouteContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { pageId: selectedPageId } = Route.useSearch();
  const pagesQuery = useQuery(trpc.content.pages.adminList.queryOptions({}));
  const workflowCapabilitiesQuery = useQuery(
    trpc.content.pages.capabilities.queryOptions(),
  );
  const pages = ((pagesQuery.data ?? []) as PageRow[]).filter(
    (page) => page.slug !== "home",
  );
  const sortedPages = useMemo(
    () =>
      [...pages].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [pages],
  );
  const [editingPage, setEditingPage] = useState<PageRow | null>(null);
  const [draftHistory, setDraftHistory] = useState(() =>
    createCmsDraftHistory(emptyStandardPageDraft()),
  );
  const draft = draftHistory.present;
  const {
    blocks,
    canonicalUrl,
    ogImage,
    robotsFollow,
    robotsIndex,
    seoDescription,
    seoTitle,
    slug,
    folder,
    title,
  } = draft;
  const baselineDraftRef = useRef(draft);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visualClipboardText, setVisualClipboardText] = useState<string | null>(
    null,
  );
  const [selectedCanvasFieldPath, setSelectedCanvasFieldPath] = useState<
    string | null
  >(null);
  const [workspaceFocused, setWorkspaceFocused] = useState(false);
  const [blockCatalogQuery, setBlockCatalogQuery] = useState("");
  const {
    onKeyDown: handleFocusedWorkspaceKeyDown,
    triggerRef: workspaceFocusTriggerRef,
    workspaceRef,
  } = useCmsFocusWorkspace({
    focused: workspaceFocused,
    onFocusedChange: setWorkspaceFocused,
  });
  const [canvasFocusRequest, setCanvasFocusRequest] = useState<{
    fieldPath: string | null;
    index: number;
    serial: number;
  } | null>(null);
  const [createRedirectOnSlugChange, setCreateRedirectOnSlugChange] =
    useState(true);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [workingVersion, setWorkingVersion] = useState<number | null>(null);
  const [serverSlug, setServerSlug] = useState("");
  const [publishedRevisionId, setPublishedRevisionId] = useState<string | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [slugDecisionRequired, setSlugDecisionRequired] = useState(false);
  const [changeToken, setChangeToken] = useState(0);
  const [comparedRevisionId, setComparedRevisionId] = useState<string | null>(
    null,
  );
  const handledDeepLinkRef = useRef<string | null>(null);
  const editGeneration = useRef(0);
  const saving = useRef(false);
  const workflow = resolveCmsAdminWorkflow({
    providerCapabilities: workflowCapabilitiesQuery.data?.provider ?? {
      supported: [],
    },
    grantedCapabilities: workflowCapabilitiesQuery.data?.granted ?? [],
    documentExists: Boolean(editingPage),
    published: editingPage?.status === "published",
    scheduled: Boolean(editingPage?.scheduledAt),
  });
  const revisionsQuery = useQuery({
    ...trpc.content.pages.revisions.queryOptions({
      pageId: editingPage?._id ?? "",
    }),
    enabled: Boolean(editingPage),
  });

  const invalidate = useCallback(
    async (pageId?: string) => {
      await Promise.all([
        queryClient.invalidateQueries(
          trpc.content.pages.adminList.queryFilter(),
        ),
        pageId
          ? queryClient.invalidateQueries(
              trpc.content.pages.revisions.queryFilter({ pageId }),
            )
          : Promise.resolve(),
      ]);
    },
    [queryClient, trpc],
  );
  const createPage = useMutation(trpc.content.pages.create.mutationOptions());
  const updatePage = useMutation(trpc.content.pages.update.mutationOptions());
  const publishPage = useMutation(trpc.content.pages.publish.mutationOptions());
  const deletePage = useMutation(
    trpc.content.pages.delete.mutationOptions({
      onSuccess: () => {
        resetForm();
        void invalidate();
        toast.success("Đã xóa trang.");
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const restorePage = useMutation(trpc.content.pages.restore.mutationOptions());
  const schedulePage = useMutation(
    trpc.content.pages.schedule.mutationOptions(),
  );
  const unschedulePage = useMutation(
    trpc.content.pages.unschedule.mutationOptions(),
  );
  const unpublishPage = useMutation(
    trpc.content.pages.unpublish.mutationOptions(),
  );

  const markDraftChanged = useCallback(
    (nextDraft: StandardPageDraft) => {
      editGeneration.current += 1;
      setChangeToken((current) => current + 1);
      const changed = !areCmsRevisionValuesEqual(
        baselineDraftRef.current,
        nextDraft,
      );
      setDirty(changed);
      setSaveState(
        changed
          ? saving.current
            ? "saving"
            : "dirty"
          : lastSavedAt
            ? "saved"
            : "clean",
      );
      setError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);
    },
    [lastSavedAt],
  );

  const commitDraft = useCallback(
    (nextDraft: StandardPageDraft, historyGroup?: string) => {
      if (areCmsRevisionValuesEqual(draft, nextDraft)) return;
      setDraftHistory((current) =>
        commitCmsDraftHistory(current, nextDraft, {
          group: historyGroup,
          limit: 50,
        }),
      );
      markDraftChanged(nextDraft);
    },
    [draft, markDraftChanged],
  );

  const commitBlocks = useCallback(
    (nextBlocks: StandardBlock[], historyGroup?: string) => {
      commitDraft({ ...draft, blocks: nextBlocks }, historyGroup);
    },
    [commitDraft, draft],
  );

  const canUndoDraft = draftHistory.past.length > 0;
  const canRedoDraft = draftHistory.future.length > 0;

  const navigateDraftHistory = useCallback(
    (direction: "undo" | "redo") => {
      const next =
        direction === "undo"
          ? undoCmsDraftHistory(draftHistory)
          : redoCmsDraftHistory(draftHistory);
      if (next === draftHistory) return;
      setDraftHistory(next);
      setSelectedIndex((current) =>
        Math.min(current, Math.max(0, next.present.blocks.length - 1)),
      );
      setSelectedCanvasFieldPath(null);
      markDraftChanged(next.present);
    },
    [draftHistory, markDraftChanged],
  );

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const undo = key === "z" && !event.shiftKey;
      const redo = key === "y" || (key === "z" && event.shiftKey);
      if (!undo && !redo) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return;
      if ((undo && !canUndoDraft) || (redo && !canRedoDraft)) return;
      event.preventDefault();
      navigateDraftHistory(undo ? "undo" : "redo");
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [canRedoDraft, canUndoDraft, navigateDraftHistory]);

  const installServerPage = useCallback(
    (page: PageRow, state: SaveState = "clean") => {
      const nextDraft = standardPageDraftFromRow(page);
      baselineDraftRef.current = nextDraft;
      setEditingPage(page);
      setDraftHistory(createCmsDraftHistory(nextDraft));
      setSelectedIndex(0);
      setSelectedCanvasFieldPath(null);
      setCreateRedirectOnSlugChange(true);
      setScheduleAt(toDatetimeLocal(page.scheduledAt));
      setScheduleNote(page.scheduleNote);
      setWorkingVersion(page.version);
      setServerSlug(page.slug);
      setPublishedRevisionId(page.publishedRevisionId);
      setDirty(false);
      setSaveState(state);
      setLastSavedAt(state === "saved" ? new Date() : null);
      setError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);
      setComparedRevisionId(null);
      editGeneration.current += 1;
    },
    [],
  );

  useEffect(() => setComparedRevisionId(null), [editingPage?._id]);

  useEffect(() => {
    if (!selectedPageId) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (
      handledDeepLinkRef.current === selectedPageId ||
      editingPage?._id === selectedPageId
    )
      return;
    const selectedPage = sortedPages.find(
      (page) => page._id === selectedPageId,
    );
    if (selectedPage) {
      handledDeepLinkRef.current = selectedPageId;
      installServerPage(selectedPage);
    }
  }, [editingPage?._id, installServerPage, selectedPageId, sortedPages]);

  function resetForm() {
    const nextDraft = emptyStandardPageDraft();
    baselineDraftRef.current = nextDraft;
    handledDeepLinkRef.current = selectedPageId ?? null;
    void navigate({ replace: true, search: {} });
    setEditingPage(null);
    setDraftHistory(createCmsDraftHistory(nextDraft));
    setSelectedIndex(0);
    setSelectedCanvasFieldPath(null);
    setWorkspaceFocused(false);
    setBlockCatalogQuery("");
    setCreateRedirectOnSlugChange(true);
    setScheduleAt("");
    setScheduleNote("");
    setWorkingVersion(null);
    setServerSlug("");
    setPublishedRevisionId(null);
    setDirty(false);
    setSaveState("clean");
    setLastSavedAt(null);
    setConflictMessage(null);
    setSlugDecisionRequired(false);
    setComparedRevisionId(null);
    setError(null);
    editGeneration.current += 1;
  }

  function updateSelected(block: StandardBlock) {
    if (areCmsRevisionValuesEqual(blocks[selectedIndex], block)) return;
    commitBlocks(
      blocks.map((item, index) => (index === selectedIndex ? block : item)),
      `block-field:${selectedIndex}:${block.type}`,
    );
  }

  function addBlock(type: StandardBlock["type"]) {
    const block = createStandardBlock(type, blocks);
    commitBlocks([...blocks, block]);
    setSelectedIndex(blocks.length);
    setSelectedCanvasFieldPath(null);
  }

  function addPattern(patternId: string) {
    try {
      const patterned = applyStandardPagePattern({
        blocks,
        patternId,
        version: workingVersion ?? editingPage?.version ?? 0,
        canInsert: session?.capabilities.includes("content.write") ?? false,
      });
      commitBlocks([...patterned.blocks], `pattern:${patternId}`);
      setSelectedIndex(patterned.firstInsertedIndex);
      setSelectedCanvasFieldPath(null);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Không thể thêm mẫu bố cục.",
      );
    }
  }

  function selectStandardBlock(index: number) {
    setSelectedIndex(index);
    setSelectedCanvasFieldPath(null);
  }

  const selectBlockFromCanvas = useCallback(
    (index: number, fieldPath?: string) => {
      setSelectedIndex(index);
      setSelectedCanvasFieldPath(fieldPath ?? null);
      setCanvasFocusRequest((current) => ({
        fieldPath: fieldPath ?? null,
        index,
        serial: (current?.serial ?? 0) + 1,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!canvasFocusRequest || canvasFocusRequest.index !== selectedIndex)
      return;
    const inspector = document.getElementById("standard-page-block-inspector");
    inspector?.scrollIntoView({ behavior: "smooth", block: "center" });
    const fieldTarget = canvasFocusRequest.fieldPath
      ? Array.from(
          inspector?.querySelectorAll<HTMLElement>("[data-cms-field-path]") ??
            [],
        ).find(
          (target) =>
            target.dataset.cmsFieldPath === canvasFocusRequest.fieldPath,
        )
      : inspector;
    const control = fieldTarget?.querySelector<HTMLElement>(
      "textarea, input, [contenteditable='true'], button",
    );
    control?.focus({ preventScroll: true });
  }, [canvasFocusRequest, selectedIndex]);

  const moveBlockFromCanvas = useCallback(
    (
      sourceIndex: number,
      targetIndex: number,
      placement: "before" | "after",
    ) => {
      if (sourceIndex === targetIndex) return;
      const source = blocks[sourceIndex];
      if (!source || !blocks[targetIndex]) return;
      const next = blocks.filter((_, index) => index !== sourceIndex);
      const adjustedTarget =
        sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      const insertionIndex =
        placement === "before" ? adjustedTarget : adjustedTarget + 1;
      next.splice(insertionIndex, 0, source);
      commitBlocks(next);
      setSelectedIndex(insertionIndex);
      setSelectedCanvasFieldPath(null);
    },
    [blocks, commitBlocks],
  );

  const insertBlockFromCanvas = useCallback(
    (type: StandardBlock["type"], targetIndex: number) => {
      if (!blocks[targetIndex]) return;
      const next = [...blocks];
      next.splice(targetIndex + 1, 0, createStandardBlock(type, blocks));
      commitBlocks(next);
      setSelectedIndex(targetIndex + 1);
      setSelectedCanvasFieldPath(null);
    },
    [blocks, commitBlocks],
  );

  const updateInlineTextFromCanvas = useCallback(
    (index: number, fieldPath: string, value: string) => {
      const block = blocks[index];
      if (!block) return;
      try {
        const result = applyStandardPageInlineText({
          blocks,
          blockId: block.id,
          fieldPath,
          value,
          version: workingVersion ?? editingPage?.version ?? 0,
          canEdit: session?.capabilities.includes("content.write") ?? false,
        });
        commitBlocks(
          [...result.blocks],
          `inline-text:${block.id}:${fieldPath}`,
        );
        setSelectedIndex(index);
        setSelectedCanvasFieldPath(`data.${fieldPath}`);
      } catch (caught) {
        toast.error(
          caught instanceof Error
            ? caught.message
            : "Không thể cập nhật nội dung trực tiếp.",
        );
      }
    },
    [
      blocks,
      commitBlocks,
      editingPage?.version,
      session?.capabilities,
      workingVersion,
    ],
  );

  const duplicateBlockFromCanvas = useCallback(
    (index: number) => {
      const source = blocks[index];
      if (!source) return;
      const next = [...blocks];
      next.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createStandardPageBlockId(
          source.type,
          blocks.map((block) => block.id),
        ),
      });
      commitBlocks(next);
      setSelectedIndex(index + 1);
      setSelectedCanvasFieldPath(null);
    },
    [blocks, commitBlocks],
  );

  const copyBlockToEditorClipboard = useCallback(
    (index: number) => {
      const source = blocks[index];
      if (!source) return;
      try {
        setVisualClipboardText(
          copyStandardPageBlock({
            blocks,
            blockId: source.id,
            version: workingVersion ?? editingPage?.version ?? 0,
          }),
        );
        setSelectedIndex(index);
        setSelectedCanvasFieldPath(null);
        toast.success("Đã sao chép khối vào bộ nhớ biên tập.");
      } catch (caught) {
        toast.error(
          caught instanceof Error ? caught.message : "Không thể sao chép khối.",
        );
      }
    },
    [blocks, editingPage?.version, workingVersion],
  );

  const pasteBlocksFromEditorClipboard = useCallback(
    (targetIndex: number, placement: "before" | "after") => {
      if (!visualClipboardText) {
        toast.error("Bộ nhớ biên tập chưa có khối để dán.");
        return;
      }
      try {
        const result = pasteStandardPageBlocks({
          blocks,
          clipboardText: visualClipboardText,
          targetIndex,
          placement,
          version: workingVersion ?? editingPage?.version ?? 0,
          canInsert: session?.capabilities.includes("content.write") ?? false,
        });
        commitBlocks([...result.blocks]);
        setSelectedIndex(result.firstInsertedIndex);
        setSelectedCanvasFieldPath(null);
        toast.success("Đã dán khối trong một bước hoàn tác.");
      } catch (caught) {
        toast.error(
          caught instanceof Error ? caught.message : "Không thể dán khối.",
        );
      }
    },
    [
      blocks,
      commitBlocks,
      editingPage?.version,
      session?.capabilities,
      visualClipboardText,
      workingVersion,
    ],
  );

  useEffect(() => {
    const handleClipboardShortcut = (event: KeyboardEvent) => {
      if (
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "c" && blocks[selectedIndex]) {
        event.preventDefault();
        copyBlockToEditorClipboard(selectedIndex);
      }
      if (key === "v" && visualClipboardText && blocks[selectedIndex]) {
        event.preventDefault();
        pasteBlocksFromEditorClipboard(selectedIndex, "after");
      }
    };
    window.addEventListener("keydown", handleClipboardShortcut);
    return () => window.removeEventListener("keydown", handleClipboardShortcut);
  }, [
    blocks,
    copyBlockToEditorClipboard,
    pasteBlocksFromEditorClipboard,
    selectedIndex,
    visualClipboardText,
  ]);

  const removeBlockFromCanvas = useCallback(
    (index: number) => {
      if (blocks.length === 1 || !blocks[index]) return;
      commitBlocks(blocks.filter((_, position) => position !== index));
      setSelectedIndex(Math.max(0, index - 1));
      setSelectedCanvasFieldPath(null);
    },
    [blocks, commitBlocks],
  );

  const saveNow = useCallback(
    async (
      options: { announce?: boolean; allowSlugDecision?: boolean } = {},
    ) => {
      if (!workflow.save.available || saving.current) return null;
      setError(null);
      const parsed = pageBlockListSchema.safeParse(blocks);
      if (!title.trim()) {
        setError("Tiêu đề là bắt buộc.");
        setSaveState("dirty");
        if (options.announce) toast.error("Nội dung chưa hợp lệ.");
        return null;
      }
      if (!parsed.success) {
        setError(parsed.error.issues.map((issue) => issue.message).join(" · "));
        setSaveState("dirty");
        if (options.announce) toast.error("Nội dung chưa hợp lệ.");
        return null;
      }

      const normalizedSlug = slug.trim() || undefined;
      const slugChanged = Boolean(
        editingPage && normalizedSlug && normalizedSlug !== serverSlug,
      );
      if (slugChanged && publishedRevisionId && !options.allowSlugDecision) {
        setSlugDecisionRequired(true);
        setSaveState("dirty");
        return null;
      }

      const generation = editGeneration.current;
      const draftAtSave = draft;
      saving.current = true;
      setSaveState("saving");
      setConflictMessage(null);
      setSlugDecisionRequired(false);

      try {
        const payload = {
          title: title.trim(),
          slug: normalizedSlug,
          folder,
          template: "standard" as const,
          blocks: parsed.data,
          seoTitle,
          seoDescription,
          canonicalUrl,
          ogImage,
          robotsIndex,
          robotsFollow,
        };
        const result = editingPage
          ? await updatePage.mutateAsync({
              pageId: editingPage._id,
              expectedVersion: workingVersion ?? editingPage.version,
              createRedirect: Boolean(
                slugChanged &&
                publishedRevisionId &&
                createRedirectOnSlugChange,
              ),
              ...payload,
            })
          : await createPage.mutateAsync({
              ...payload,
              status: "draft",
            });
        const updated = result.data as PageRow | undefined;
        if (!updated) throw new Error("Không tải lại được trang sau khi lưu.");

        setEditingPage(updated);
        setWorkingVersion(updated.version);
        setServerSlug(updated.slug);
        setPublishedRevisionId(updated.publishedRevisionId);
        setScheduleAt(toDatetimeLocal(updated.scheduledAt));
        setScheduleNote(updated.scheduleNote);
        setLastSavedAt(new Date());
        baselineDraftRef.current = draftAtSave;
        if (editGeneration.current === generation) {
          setDirty(false);
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }
        handledDeepLinkRef.current = updated._id;
        if (!editingPage) {
          await navigate({ replace: true, search: { pageId: updated._id } });
        }
        await invalidate(updated._id);
        if (options.announce) {
          toast.success(editingPage ? "Đã cập nhật trang." : "Đã tạo trang.");
        }
        return { pageId: updated._id, version: updated.version };
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Lưu bản nháp thất bại.";
        if (/changed since|expected version|conflict/i.test(message)) {
          setSaveState("conflict");
          setConflictMessage(
            "Trang đã được sửa ở tab khác. Tải phiên bản mới từ máy chủ hoặc sao chép nội dung hiện tại trước khi tiếp tục.",
          );
          await pagesQuery.refetch();
        } else {
          setSaveState("dirty");
        }
        setDirty(true);
        toast.error(message);
        return null;
      } finally {
        saving.current = false;
      }
    },
    [
      blocks,
      canonicalUrl,
      createPage,
      createRedirectOnSlugChange,
      draft,
      editingPage,
      invalidate,
      navigate,
      ogImage,
      pagesQuery,
      publishedRevisionId,
      robotsFollow,
      robotsIndex,
      seoDescription,
      seoTitle,
      serverSlug,
      slug,
      title,
      updatePage,
      workflow.save.available,
      workingVersion,
    ],
  );

  const { flushCurrentDraft, openAfterSave } = useSaveBeforeNavigation({
    dirty,
    saving: saveState === "saving",
    save: () => saveNow({ allowSlugDecision: true }),
  });

  useCmsAutosave({
    changeToken,
    conflicted: saveState === "conflict",
    dirty: Boolean(editingPage) && dirty,
    save: () => saveNow({ allowSlugDecision: false }),
    saving: saveState === "saving",
  });

  const requestEditorReset = useCallback(async () => {
    if (dirty && !(await flushCurrentDraft())) {
      toast.error("Chưa thể chuyển trang vì bản nháp chưa lưu thành công.");
      return;
    }
    resetForm();
  }, [dirty, flushCurrentDraft]);

  const openPage = useCallback(
    async (page: PageRow) => {
      if (editingPage?._id === page._id) return;
      if (dirty && !(await flushCurrentDraft())) {
        toast.error("Chưa thể chuyển trang vì bản nháp chưa lưu thành công.");
        return;
      }
      handledDeepLinkRef.current = page._id;
      installServerPage(page);
      await navigate({ replace: true, search: { pageId: page._id } });
    },
    [dirty, editingPage?._id, flushCurrentDraft, installServerPage, navigate],
  );

  const reloadServerVersion = useCallback(async () => {
    if (!editingPage) return;
    const result = await pagesQuery.refetch();
    const latest = ((result.data ?? []) as PageRow[]).find(
      (page) => page._id === editingPage._id,
    );
    if (!latest) {
      toast.error("Không tải được phiên bản trang mới nhất từ máy chủ.");
      return;
    }
    installServerPage(latest, "saved");
  }, [editingPage, installServerPage, pagesQuery]);

  const openSavedPreview = useCallback(
    (url: string) => {
      void openAfterSave(url).then((result) => {
        if (result === "popup-blocked") {
          toast.error("Trình duyệt đã chặn tab xem trước.");
        } else if (result === "save-blocked") {
          toast.error("Chưa thể mở xem trước vì bản nháp chưa lưu thành công.");
        }
      });
    },
    [openAfterSave],
  );

  const refreshPageAfterCommand = useCallback(
    async (pageId: string) => {
      const result = await pagesQuery.refetch();
      const latest = ((result.data ?? []) as PageRow[]).find(
        (page) => page._id === pageId,
      );
      if (!latest)
        throw new Error("Không tải lại được trang sau khi thực hiện thao tác.");
      installServerPage(latest, "saved");
      await invalidate(pageId);
    },
    [installServerPage, invalidate, pagesQuery],
  );

  const handleWorkflowError = useCallback(
    (caught: unknown, fallback: string) => {
      const message = caught instanceof Error ? caught.message : fallback;
      if (/changed since|expected version|conflict/i.test(message)) {
        setDirty(true);
        setSaveState("conflict");
        setConflictMessage(
          "Trang đã thay đổi trên máy chủ. Tải phiên bản mới trước khi tiếp tục thao tác.",
        );
      }
      toast.error(message);
    },
    [],
  );

  const handlePublish = useCallback(async () => {
    if (!workflow.publish.available) return;
    try {
      const outcome = await runCmsWorkflowCommand({
        current:
          editingPage && workingVersion !== null
            ? { id: editingPage._id, version: workingVersion }
            : null,
        dirty,
        save: async () => {
          const saved = await saveNow({ allowSlugDecision: true });
          return saved ? { id: saved.pageId, version: saved.version } : null;
        },
        command: async (target) => ({
          pageId: target.id,
          result: await publishPage.mutateAsync({
            pageId: target.id,
            expectedVersion: target.version,
            note: "Xuất bản từ trình chỉnh sửa trang",
          }),
        }),
      });
      if (!outcome) return;
      await refreshPageAfterCommand(outcome.pageId);
      toast.success("Đã xuất bản trang.");
    } catch (caught) {
      handleWorkflowError(caught, "Xuất bản thất bại.");
    }
  }, [
    dirty,
    editingPage,
    handleWorkflowError,
    publishPage,
    refreshPageAfterCommand,
    saveNow,
    workflow.publish.available,
    workingVersion,
  ]);

  const handleSchedule = useCallback(async () => {
    if (!workflow.schedule.available || !scheduleAt) return;
    try {
      const outcome = await runCmsWorkflowCommand({
        current:
          editingPage && workingVersion !== null
            ? { id: editingPage._id, version: workingVersion }
            : null,
        dirty,
        save: async () => {
          const saved = await saveNow({ allowSlugDecision: true });
          return saved ? { id: saved.pageId, version: saved.version } : null;
        },
        command: async (target) => ({
          pageId: target.id,
          result: await schedulePage.mutateAsync({
            pageId: target.id,
            expectedVersion: target.version,
            scheduledAt: new Date(scheduleAt),
            note: scheduleNote,
          }),
        }),
      });
      if (!outcome) return;
      await refreshPageAfterCommand(outcome.pageId);
      toast.success("Đã lên lịch xuất bản.");
    } catch (caught) {
      handleWorkflowError(caught, "Không thể lên lịch xuất bản.");
    }
  }, [
    dirty,
    editingPage,
    handleWorkflowError,
    refreshPageAfterCommand,
    saveNow,
    scheduleAt,
    scheduleNote,
    schedulePage,
    workflow.schedule.available,
    workingVersion,
  ]);

  const handleUnschedule = useCallback(async () => {
    if (!editingPage || workingVersion === null) return;
    try {
      const outcome = await runCmsWorkflowCommand({
        current: { id: editingPage._id, version: workingVersion },
        dirty,
        save: async () => {
          const saved = await saveNow({ allowSlugDecision: true });
          return saved ? { id: saved.pageId, version: saved.version } : null;
        },
        command: async (target) => ({
          pageId: target.id,
          result: await unschedulePage.mutateAsync({
            pageId: target.id,
            expectedVersion: target.version,
          }),
        }),
      });
      if (!outcome) return;
      await refreshPageAfterCommand(outcome.pageId);
      toast.success("Đã hủy lịch xuất bản.");
    } catch (caught) {
      handleWorkflowError(caught, "Không thể hủy lịch xuất bản.");
    }
  }, [
    dirty,
    editingPage,
    handleWorkflowError,
    refreshPageAfterCommand,
    saveNow,
    unschedulePage,
    workingVersion,
  ]);

  const handleUnpublish = useCallback(async () => {
    if (!editingPage || workingVersion === null) return;
    try {
      const outcome = await runCmsWorkflowCommand({
        current: { id: editingPage._id, version: workingVersion },
        dirty,
        save: async () => {
          const saved = await saveNow({ allowSlugDecision: true });
          return saved ? { id: saved.pageId, version: saved.version } : null;
        },
        command: async (target) => ({
          pageId: target.id,
          result: await unpublishPage.mutateAsync({
            pageId: target.id,
            expectedVersion: target.version,
          }),
        }),
      });
      if (!outcome) return;
      await refreshPageAfterCommand(outcome.pageId);
      toast.success("Đã hủy xuất bản trang.");
    } catch (caught) {
      handleWorkflowError(caught, "Không thể hủy xuất bản trang.");
    }
  }, [
    dirty,
    editingPage,
    handleWorkflowError,
    refreshPageAfterCommand,
    saveNow,
    unpublishPage,
    workingVersion,
  ]);

  const handleRestore = useCallback(
    async (revisionId: string) => {
      if (!editingPage || workingVersion === null) return;
      try {
        const outcome = await runCmsWorkflowCommand({
          current: { id: editingPage._id, version: workingVersion },
          dirty,
          save: async () => {
            const saved = await saveNow({ allowSlugDecision: true });
            return saved ? { id: saved.pageId, version: saved.version } : null;
          },
          command: async (target) => ({
            pageId: target.id,
            result: await restorePage.mutateAsync({
              pageId: target.id,
              revisionId,
              expectedVersion: target.version,
            }),
          }),
        });
        if (!outcome) return;
        await refreshPageAfterCommand(outcome.pageId);
        toast.success("Đã khôi phục phiên bản thành bản nháp làm việc.");
      } catch (caught) {
        handleWorkflowError(caught, "Không thể khôi phục phiên bản.");
      }
    },
    [
      dirty,
      editingPage,
      handleWorkflowError,
      refreshPageAfterCommand,
      restorePage,
      saveNow,
      workingVersion,
    ],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    void saveNow({ announce: true, allowSlugDecision: true });
  }
  const selected = blocks[selectedIndex];
  const canonicalSelected = selected
    ? toRemVietStandardBlock(selected, selectedIndex)
    : null;
  const filteredStandardCatalog = filterCmsBlockAuthoringCatalog(
    remVietStandardBlockAuthoringCatalog,
    blockCatalogQuery,
  );
  const filteredStandardPatterns = filterCmsVisualPatterns(
    remVietStandardVisualPatternRegistry.patterns,
    blockCatalogQuery,
  );
  const shouldOfferRedirect = Boolean(
    publishedRevisionId && slug.trim() && slug.trim() !== serverSlug,
  );

  return (
    <AdminShell
      actions={
        editingPage && workflow.revisions.available ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              document
                .getElementById("standard-page-revision-history")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <History aria-hidden />
            Lịch sử
          </Button>
        ) : null
      }
    >
      <div className="mx-auto grid w-full max-w-[95rem] gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="grid content-start gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Danh sách trang</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quản lý nội dung theo từng khối mà không cần chỉnh sửa JSON.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void requestEditorReset()}
            >
              <Plus />
              Tạo trang
            </Button>
          </div>
          <Card className="rounded-md">
            <CardContent className="p-0">
              {pagesQuery.isLoading ? (
                <div
                  className="grid gap-3 p-4"
                  aria-label="Đang tải danh sách trang"
                >
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton className="h-12 w-full" key={index} />
                  ))}
                </div>
              ) : pagesQuery.isError ? (
                <AsyncState
                  action={
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => pagesQuery.refetch()}
                    >
                      Thử lại
                    </Button>
                  }
                  description={pagesQuery.error.message}
                  title="Không thể tải danh sách trang"
                  tone="error"
                />
              ) : sortedPages.length ? (
                <div className="overflow-x-auto">
                  <Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tiêu đề</TableHead>
                        <TableHead>Đường dẫn</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Cập nhật</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPages.map((page) => (
                        <TableRow key={page._id}>
                          <TableCell className="font-medium">
                            {page.title}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            /{page.slug}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={
                                page.status === "published"
                                  ? "success"
                                  : "warning"
                              }
                            >
                              {page.status === "published"
                                ? "Đã xuất bản"
                                : "Bản nháp"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(page.updatedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void openPage(page)}
                              >
                                Sửa
                              </Button>
                              <ConfirmDestructiveAction
                                description="Trang sẽ bị xóa khỏi hệ thống. Hành động này không thể hoàn tác."
                                onConfirm={async () => {
                                  await deletePage.mutateAsync({
                                    pageId: page._id,
                                    expectedVersion: page.version,
                                  });
                                }}
                                pending={deletePage.isPending}
                                title={`Xóa “${page.title}”?`}
                                trigger={
                                  <Button
                                    aria-label={`Xóa ${page.title}`}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Trash2 />
                                  </Button>
                                }
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <AsyncState
                  description="Tạo trang đầu tiên để bổ sung nội dung ngoài trang chủ."
                  title="Chưa có trang nội dung"
                />
              )}
            </CardContent>
          </Card>
        </section>

        <form className="grid content-start gap-4" onSubmit={submit}>
          {conflictMessage ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border border-warning-foreground/20 bg-warning p-4 text-sm text-warning-foreground">
              <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden className="mt-0.5 size-4" />
                <div>
                  <strong>Xung đột phiên bản</strong>
                  <p className="mt-1 text-muted-foreground">
                    {conflictMessage}
                  </p>
                </div>
              </div>
              <Button
                disabled={pagesQuery.isFetching}
                type="button"
                variant="secondary"
                onClick={() => void reloadServerVersion()}
              >
                Tải bản trên máy chủ
              </Button>
            </div>
          ) : null}
          {editingPage && workingVersion !== null ? (
            <EditorialReviewPanel
              commentGranted={
                session?.capabilities.includes("content.write") ?? false
              }
              currentVersion={workingVersion}
              decisionGranted={
                session?.capabilities.includes("content.review.decide") ?? false
              }
              dirty={dirty}
              documentId={editingPage._id}
              documentType="page"
              onSaveDraft={() =>
                saveNow({ announce: false, allowSlugDecision: true })
              }
              publishGranted={
                session?.capabilities.includes("content.publish") ?? false
              }
              requestGranted={
                session?.capabilities.includes("content.review.request") ??
                false
              }
            />
          ) : null}
          <Card className="rounded-md">
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {editingPage ? "Sửa trang" : "Tạo trang"}
                </h2>
                {editingPage ? (
                  <Button
                    aria-label="Đóng trình chỉnh sửa"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => void requestEditorReset()}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="page-title">Tiêu đề</Label>
                  <Input
                    id="page-title"
                    value={title}
                    onChange={(e) =>
                      commitDraft(
                        { ...draft, title: e.target.value },
                        "page-field:title",
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="page-slug">Đường dẫn</Label>
                  <Input
                    id="page-slug"
                    value={slug}
                    onChange={(e) =>
                      commitDraft(
                        { ...draft, slug: e.target.value },
                        "page-field:slug",
                      )
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="page-folder">Thư mục workflow</Label>
                  <Input
                    id="page-folder"
                    placeholder="campaigns/summer"
                    value={folder}
                    onChange={(e) =>
                      commitDraft(
                        { ...draft, folder: e.target.value },
                        "page-field:folder",
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Dùng đường dẫn ID phân cấp để chọn workflow theo thư mục; để
                    trống cho chính sách cấp collection.
                  </p>
                </div>
              </div>
              {shouldOfferRedirect ? (
                <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                  <input
                    checked={createRedirectOnSlugChange}
                    className="mt-0.5"
                    type="checkbox"
                    onChange={(event) =>
                      setCreateRedirectOnSlugChange(event.target.checked)
                    }
                  />
                  <span>
                    <span className="block font-medium">
                      Tạo chuyển hướng 301 từ /{editingPage?.slug}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Giữ liên kết cũ hoạt động sau khi đổi đường dẫn.
                    </span>
                  </span>
                </label>
              ) : null}
              {slugDecisionRequired ? (
                <p className="text-xs text-warning-foreground" role="status">
                  Tự động lưu đang tạm dừng để bạn xác nhận lựa chọn chuyển
                  hướng, rồi nhấn “Lưu bản nháp”.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <RemVietEditorShell
            className={
              workspaceFocused
                ? "fixed inset-3 z-[100] grid h-[calc(100dvh-1.5rem)] min-h-0 grid-cols-[minmax(0,1fr)_26rem] gap-0 overflow-hidden rounded-xl bg-background shadow-[0_30px_120px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
                : "contents"
            }
            data-cms-standard-workspace-mode={
              workspaceFocused ? "focused" : "standard"
            }
            documentId={editingPage?._id ?? unsavedStandardPagePreviewId}
            documentType="standardPage"
            label="Không gian biên tập trang trực quan"
            mode={workspaceFocused ? "focused" : "standard"}
            ref={workspaceRef}
            onKeyDown={handleFocusedWorkspaceKeyDown}
          >
            <Card
              className={cn(
                "rounded-md",
                workspaceFocused &&
                  "order-2 min-h-0 overflow-y-auto rounded-none border-y-0 border-r-0",
              )}
            >
              <CardContent
                className={cn("grid gap-4", workspaceFocused && "p-4")}
              >
                <div className={cn("grid gap-2", workspaceFocused && "hidden")}>
                  <Label className="sr-only" htmlFor="standard-block-search">
                    Tìm loại khối
                  </Label>
                  <div className="relative max-w-md">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      className="pl-8"
                      id="standard-block-search"
                      placeholder="Tìm khối theo tên hoặc mục đích…"
                      type="search"
                      value={blockCatalogQuery}
                      onChange={(event) =>
                        setBlockCatalogQuery(event.target.value)
                      }
                    />
                  </div>
                  <section
                    aria-labelledby="standard-patterns-heading"
                    className="grid gap-2"
                  >
                    <div>
                      <h3
                        className="text-sm font-semibold"
                        id="standard-patterns-heading"
                      >
                        Mẫu bố cục
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Thêm nhiều khối đã cấu hình trong một bước hoàn tác.
                      </p>
                    </div>
                    {filteredStandardPatterns.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {filteredStandardPatterns.map((pattern) => (
                          <button
                            aria-label={`Thêm mẫu ${pattern.label.toLocaleLowerCase("vi-VN")}`}
                            className="grid min-h-24 content-start gap-1 rounded-md border border-primary/20 bg-primary/5 p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/10"
                            key={pattern.id}
                            type="button"
                            onClick={() => addPattern(pattern.id)}
                          >
                            <span className="flex items-center gap-1.5 text-sm font-semibold">
                              <Plus aria-hidden className="size-3.5" />
                              {pattern.label}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                              {pattern.category}
                            </span>
                            <span className="text-xs leading-5 text-muted-foreground">
                              {pattern.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
                        role="status"
                      >
                        Không có mẫu bố cục phù hợp với “{blockCatalogQuery}”.
                      </p>
                    )}
                  </section>
                  {filteredStandardCatalog.length ? (
                    <div
                      aria-label="Danh mục khối cho trang nội dung"
                      className="grid gap-2 sm:grid-cols-3"
                    >
                      {filteredStandardCatalog.map((definition) => (
                        <button
                          aria-label={`Thêm ${definition.label.toLocaleLowerCase("vi-VN")}`}
                          className="grid min-h-24 content-start gap-1 rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                          key={definition.type}
                          type="button"
                          onClick={() => addBlock(definition.type)}
                        >
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            <Plus aria-hidden className="size-3.5" />
                            {definition.label}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                            {definition.category}
                          </span>
                          <span className="text-xs leading-5 text-muted-foreground">
                            {definition.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Không có loại khối phù hợp với “{blockCatalogQuery}”.
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "grid gap-3 md:grid-cols-[13rem_1fr]",
                    workspaceFocused && "block",
                  )}
                >
                  <div
                    className={cn(
                      "grid content-start gap-2",
                      workspaceFocused && "hidden",
                    )}
                  >
                    {blocks.map((block, index) => (
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2 text-left text-xs",
                          index === selectedIndex &&
                            "border-primary bg-primary/5",
                        )}
                        key={`${block.type}-${index}`}
                      >
                        <button
                          className="min-w-0 flex-1 truncate text-left"
                          type="button"
                          onClick={() => selectStandardBlock(index)}
                        >
                          {index + 1}. {standardBlockLabels[block.type]}
                        </button>
                        <Button
                          aria-label="Lên"
                          disabled={index === 0}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlockFromCanvas(index, index - 1, "before");
                          }}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          aria-label="Xuống"
                          disabled={index === blocks.length - 1}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlockFromCanvas(index, index + 1, "after");
                          }}
                        >
                          <ChevronDown />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "grid gap-4 rounded-md border p-4",
                      workspaceFocused && "rounded-none border-0 p-0",
                    )}
                    id="standard-page-block-inspector"
                  >
                    {canonicalSelected?.success ? (
                      <CmsBlockEditor
                        block={canonicalSelected.data}
                        context={{
                          key: `${editingPage?._id ?? "new"}-${selectedIndex}`,
                          onDetach: (detached) =>
                            updateSelected({
                              ...detached,
                              id: blocks[selectedIndex]?.id ?? detached.id,
                            }),
                        }}
                        registry={standardBlockEditorRegistry}
                        onChange={(next) =>
                          updateSelected({
                            ...toLegacyRemVietStandardBlock(next),
                            id: next.id,
                          })
                        }
                      />
                    ) : null}
                    {selected && selected.type !== "reusableContent" ? (
                      <SaveBlockAsReusable
                        block={selected}
                        onCreated={(fragment) =>
                          updateSelected({
                            id: selected.id,
                            type: "reusableContent",
                            reference: {
                              kind: "cms.reusable-reference",
                              fragmentId: fragment.id,
                              contentType: "standard-page-block",
                              revisionId: null,
                              overrides: [],
                            },
                          })
                        }
                      />
                    ) : null}
                    <div className="flex gap-2 border-t pt-3">
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          copyBlockToEditorClipboard(selectedIndex)
                        }
                      >
                        <ClipboardCopy />
                        Sao chép
                      </Button>
                      <Button
                        disabled={!visualClipboardText}
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          pasteBlocksFromEditorClipboard(selectedIndex, "after")
                        }
                      >
                        <ClipboardPaste />
                        Dán sau
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => duplicateBlockFromCanvas(selectedIndex)}
                      >
                        <Copy />
                        Nhân bản
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={blocks.length === 1}
                        onClick={() => removeBlockFromCanvas(selectedIndex)}
                      >
                        <Trash2 />
                        Xóa khối
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div
              className={
                workspaceFocused
                  ? "order-1 min-h-0 overflow-hidden border-r"
                  : "contents"
              }
            >
              {workflow.preview.available ? (
                <StandardPageResponsivePreview
                  blocks={blocks}
                  canInlineEdit={
                    session?.capabilities.includes("content.write") ?? false
                  }
                  canRedo={canRedoDraft}
                  canUndo={canUndoDraft}
                  onCopy={copyBlockToEditorClipboard}
                  onDuplicate={duplicateBlockFromCanvas}
                  onInsert={insertBlockFromCanvas}
                  onInlineText={updateInlineTextFromCanvas}
                  onMove={moveBlockFromCanvas}
                  onPaste={pasteBlocksFromEditorClipboard}
                  onRedo={() => navigateDraftHistory("redo")}
                  onRemove={removeBlockFromCanvas}
                  onSelect={selectBlockFromCanvas}
                  onUndo={() => navigateDraftHistory("undo")}
                  onWorkspaceFocusChange={setWorkspaceFocused}
                  pageId={editingPage?._id ?? unsavedStandardPagePreviewId}
                  previewChannel={session!.previewChannel}
                  selectedFieldPath={selectedCanvasFieldPath}
                  selectedIndex={selectedIndex}
                  title={title}
                  version={workingVersion ?? editingPage?.version ?? 0}
                  workspaceFocusTriggerRef={workspaceFocusTriggerRef}
                  workspaceFocused={workspaceFocused}
                />
              ) : null}
            </div>
          </RemVietEditorShell>

          <Card className="rounded-md">
            <CardContent className="grid gap-4">
              <h3 className="font-semibold">SEO</h3>
              <div className="grid gap-2">
                <Label htmlFor="page-seo-title">Tiêu đề SEO</Label>
                <Input
                  id="page-seo-title"
                  value={seoTitle}
                  onChange={(e) =>
                    commitDraft(
                      { ...draft, seoTitle: e.target.value },
                      "page-field:seo-title",
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-seo-description">Mô tả SEO</Label>
                <Textarea
                  className="min-h-20"
                  id="page-seo-description"
                  value={seoDescription}
                  onChange={(e) =>
                    commitDraft(
                      { ...draft, seoDescription: e.target.value },
                      "page-field:seo-description",
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-canonical">URL chính tắc</Label>
                <Input
                  id="page-canonical"
                  value={canonicalUrl}
                  onChange={(e) =>
                    commitDraft(
                      { ...draft, canonicalUrl: e.target.value },
                      "page-field:canonical-url",
                    )
                  }
                />
              </div>
              <MediaPickerField
                id="page-og-image"
                label="Ảnh chia sẻ mạng xã hội"
                value={ogImage}
                onChange={(value) =>
                  commitDraft(
                    { ...draft, ogImage: value },
                    "page-field:og-image",
                  )
                }
              />
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={robotsIndex}
                    onChange={(e) =>
                      commitDraft(
                        { ...draft, robotsIndex: e.target.checked },
                        "page-field:robots-index",
                      )
                    }
                  />
                  Cho phép công cụ tìm kiếm lập chỉ mục
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={robotsFollow}
                    onChange={(e) =>
                      commitDraft(
                        { ...draft, robotsFollow: e.target.checked },
                        "page-field:robots-follow",
                      )
                    }
                  />
                  Cho phép theo dõi liên kết
                </label>
              </div>
            </CardContent>
          </Card>
          {editingPage && workflow.schedule.available ? (
            <Card className="rounded-md">
              <CardContent className="grid gap-4">
                <div>
                  <h3 className="font-semibold">Lịch xuất bản</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lưu bản nháp trước, sau đó đặt lịch cho phiên bản hiện có
                    trên máy chủ.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="page-schedule-at">Thời điểm</Label>
                  <Input
                    id="page-schedule-at"
                    min={toDatetimeLocal(new Date())}
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="page-schedule-note">Ghi chú</Label>
                  <Input
                    id="page-schedule-note"
                    value={scheduleNote}
                    onChange={(e) => setScheduleNote(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !scheduleAt ||
                      schedulePage.isPending ||
                      saveState === "saving" ||
                      saveState === "conflict"
                    }
                    onClick={() => void handleSchedule()}
                  >
                    {schedulePage.isPending ? "Đang đặt lịch…" : "Đặt lịch"}
                  </Button>
                  {editingPage.scheduledAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        unschedulePage.isPending ||
                        saveState === "saving" ||
                        saveState === "conflict"
                      }
                      onClick={() => void handleUnschedule()}
                    >
                      {unschedulePage.isPending ? "Đang hủy…" : "Hủy lịch"}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
          {editingPage && workflow.revisions.available ? (
            <Card
              className="scroll-mt-20 rounded-md"
              id="standard-page-revision-history"
            >
              <CardContent className="grid gap-3">
                <div className="flex items-center gap-2">
                  <History className="size-4" />
                  <h3 className="font-semibold">Phiên bản đã xuất bản</h3>
                </div>
                <CmsRevisionList
                  empty={
                    <p className="text-xs text-muted-foreground">
                      Chưa có phiên bản đã xuất bản.
                    </p>
                  }
                  loading={revisionsQuery.isLoading}
                  renderRevision={(revision) => {
                    const revisionSnapshot = pageRevisionSnapshotSchema.parse(
                      revision.snapshot,
                    );
                    const currentSnapshot: PageRevisionSnapshot = {
                      title,
                      slug,
                      folder,
                      template: "standard",
                      blocks,
                      seoTitle,
                      seoDescription,
                      canonicalUrl,
                      ogImage,
                      robotsIndex,
                      robotsFollow,
                    };
                    const fieldChanges = compareCmsRevisionFieldDetails(
                      revisionSnapshot,
                      currentSnapshot,
                      standardPageRevisionFields,
                    );
                    const comparisonOpen = comparedRevisionId === revision.id;
                    return (
                      <div
                        className="grid gap-3 rounded-md border p-3"
                        data-testid={`standard-page-revision-v${revision.version}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs">
                            <p className="font-medium">
                              Phiên bản {revision.version}
                            </p>
                            <p className="text-muted-foreground">
                              {formatDate(String(revision.createdAt))}
                              {revision.note ? ` · ${revision.note}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              aria-controls={`standard-page-revision-diff-${revision.version}`}
                              aria-expanded={comparisonOpen}
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setComparedRevisionId((current) =>
                                  current === revision.id ? null : revision.id,
                                )
                              }
                            >
                              <GitCompareArrows aria-hidden />
                              {comparisonOpen ? "Ẩn thay đổi" : "So sánh"}
                            </Button>
                            {workflow.restore.available ? (
                              <ConfirmDestructiveAction
                                confirmLabel="Khôi phục bản nháp"
                                confirmVariant="default"
                                description="Nội dung của phiên bản này sẽ thay thế bản nháp đang làm việc. Nội dung đã xuất bản không thay đổi cho đến khi bạn xuất bản lại."
                                onConfirm={async () => {
                                  await handleRestore(revision.id);
                                }}
                                pending={restorePage.isPending}
                                title={`Khôi phục phiên bản ${revision.version}?`}
                                trigger={
                                  <Button
                                    disabled={
                                      saveState === "saving" ||
                                      saveState === "conflict"
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    Khôi phục
                                  </Button>
                                }
                              />
                            ) : null}
                          </div>
                        </div>
                        {comparisonOpen ? (
                          <section
                            aria-label={`Thay đổi của phiên bản ${revision.version}`}
                            className="rounded-md bg-muted/50 p-3 text-xs"
                            id={`standard-page-revision-diff-${revision.version}`}
                          >
                            <strong>So với bản nháp đang chỉnh sửa</strong>
                            {fieldChanges.length ? (
                              <div className="mt-3">
                                <RevisionFieldComparison
                                  changes={fieldChanges}
                                />
                              </div>
                            ) : (
                              <p className="mt-1 text-muted-foreground">
                                Bản nháp hiện tại trùng với phiên bản này.
                              </p>
                            )}
                          </section>
                        ) : null}
                      </div>
                    );
                  }}
                  revisions={
                    (revisionsQuery.data as PageRevisionRow[] | undefined) ?? []
                  }
                />
              </CardContent>
            </Card>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-4 backdrop-blur">
            <StandardPageSaveStatus
              lastSavedAt={lastSavedAt}
              state={saveState}
            />
            <CmsWorkflowActionSlots
              model={workflow}
              order={["unpublish", "preview", "save", "publish"]}
              slots={{
                unpublish: editingPage ? (
                  <ConfirmDestructiveAction
                    confirmLabel="Hủy xuất bản"
                    confirmVariant="destructive"
                    description="Trang sẽ không còn hiển thị công khai. Bản nháp và lịch sử phiên bản vẫn được giữ lại."
                    onConfirm={handleUnpublish}
                    pending={unpublishPage.isPending || saveState === "saving"}
                    title={`Hủy xuất bản “${title.trim()}”?`}
                    trigger={
                      <Button
                        disabled={saveState === "conflict"}
                        type="button"
                        variant="outline"
                      >
                        Hủy xuất bản
                      </Button>
                    }
                  />
                ) : null,
                preview: editingPage ? (
                  <a
                    className={buttonVariants({ variant: "outline" })}
                    href={`/admin/pages/${encodeURIComponent(editingPage._id)}/preview`}
                    rel="noreferrer"
                    target="_blank"
                    onClick={(event) => {
                      event.preventDefault();
                      openSavedPreview(event.currentTarget.href);
                    }}
                  >
                    <ExternalLink aria-hidden />
                    Xem bản nháp đã lưu
                  </a>
                ) : null,
                save: (
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={
                      createPage.isPending ||
                      updatePage.isPending ||
                      saveState === "saving" ||
                      saveState === "conflict"
                    }
                  >
                    <Save aria-hidden />
                    {saveState === "saving" ? "Đang lưu…" : "Lưu bản nháp"}
                  </Button>
                ),
                publish: (
                  <ConfirmDestructiveAction
                    confirmLabel="Xuất bản"
                    confirmVariant="default"
                    description="Trang sẽ hiển thị công khai trên website ngay lập tức với nội dung hiện tại."
                    onConfirm={handlePublish}
                    pending={publishPage.isPending || saveState === "saving"}
                    title={`Xuất bản “${title.trim() || "trang chưa đặt tên"}”?`}
                    trigger={
                      <Button
                        disabled={
                          publishPage.isPending ||
                          saveState === "saving" ||
                          saveState === "conflict"
                        }
                        type="button"
                      >
                        <Send />
                        Xuất bản
                      </Button>
                    }
                  />
                ),
              }}
            />
          </div>
        </form>
      </div>
    </AdminShell>
  );
}

function StandardPageSaveStatus({
  state,
  lastSavedAt,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
}) {
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
