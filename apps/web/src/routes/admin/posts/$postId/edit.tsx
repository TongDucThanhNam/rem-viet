import {
  CmsDraftStatusSlots,
  areCmsRevisionValuesEqual,
  commitCmsDraftHistory,
  compareCmsRevisionFieldDetails,
  createCmsDraftHistory,
  redoCmsDraftHistory,
  undoCmsDraftHistory,
  useCmsAutosave,
  useCmsFocusWorkspace,
  useCmsPreviewConnection,
  type CmsDraftSaveState,
  type CmsRevisionFieldDefinition,
} from "@agency/cms-admin";
import { remVietRichTextBlockLabels } from "@agency/cms-template-rem-viet";
import {
  parseRichTextDocument,
  postRevisionSnapshotSchema,
  type PostRevisionSnapshot,
} from "@rem-viet/cms";
import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  GitCompareArrows,
  History,
  Maximize2,
  Minimize2,
  Monitor,
  Redo2,
  RotateCcw,
  Send,
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
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import CmsPostForm, {
  type CmsPostFormValues,
  validateCmsPostFormValues,
} from "@/components/cms-post-form";
import {
  CmsPreviewConnectionIndicator,
  CmsPreviewConnectionLabel,
  CmsPreviewConnectionRecovery,
} from "@/components/cms-preview-connection";
import { ConfirmDestructiveAction } from "@/components/admin-ui";
import EditorialReviewPanel from "@/components/editorial-review-panel";
import RevisionFieldComparison from "@/components/revision-field-comparison";
import { getAdminUser } from "@/functions/get-admin-user";
import { useSaveBeforeNavigation } from "@/hooks/use-save-before-navigation";
import {
  isPostPreviewCompositionMessage,
  isPostPreviewSelectMessage,
  type PostPreviewField,
} from "@/lib/post-preview";
import type {
  PostRichTextCompositionCommand,
  PostRichTextCompositionRequest,
} from "@/lib/post-rich-text-composition";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts/$postId/edit")({
  component: EditPostRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
});

type SaveState = CmsDraftSaveState;

type PostFormSource = Omit<CmsPostFormValues, "content" | "slug"> & {
  _id: string;
  content: unknown;
  publishedRevisionId: string | null;
  scheduledAt: string | null;
  slug: string;
  version: number;
};

type PostRevisionRow = {
  id: string;
  version: number;
  note: string;
  createdAt: string | Date;
  snapshot: PostRevisionSnapshot;
};

function summarizePostContent(content: string) {
  const document = parseRichTextDocument(content);
  if (!document) {
    return content.trim()
      ? `Nội dung định dạng cũ · ${[...content].length.toLocaleString("vi-VN")} ký tự`
      : "Để trống";
  }
  const counts = new Map<string, number>();
  for (const block of document.blocks) {
    const label =
      remVietRichTextBlockLabels[block.type].toLocaleLowerCase("vi");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return `${document.blocks.length} block · ${[...counts]
    .map(([label, count]) => `${count} ${label}`)
    .join(", ")}`;
}

const postRevisionFields = [
  {
    key: "title",
    label: "Tiêu đề",
    read: (value) => value.title,
    summarize: (value) => value.title,
  },
  {
    key: "slug",
    label: "Đường dẫn",
    read: (value) => value.slug,
    summarize: (value) => `/${value.slug ?? ""}`,
  },
  {
    key: "description",
    label: "Mô tả",
    read: (value) => value.description,
    summarize: (value) => value.description,
  },
  {
    key: "coverImage",
    label: "Ảnh bìa",
    read: (value) => value.coverImage,
    summarize: (value) => (value.coverImage ? "Có ảnh" : "Để trống"),
  },
  {
    key: "tags",
    label: "Thẻ",
    read: (value) => value.tags,
    summarize: (value) => value.tags.join(", "),
  },
  {
    key: "content",
    label: "Nội dung bài viết",
    read: (value) => value.content,
    summarize: (value) => summarizePostContent(value.content),
  },
  {
    key: "publishDate",
    label: "Ngày xuất bản",
    read: (value) => value.publishDate,
    summarize: (value) => value.publishDate,
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
    summarize: (value) => value.canonicalUrl || "Để trống",
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
] as const satisfies readonly CmsRevisionFieldDefinition<CmsPostFormValues>[];

function formValuesFromRevision(
  snapshot: PostRevisionSnapshot,
): CmsPostFormValues {
  const normalized = postRevisionSnapshotSchema.parse(snapshot);
  return {
    title: normalized.title,
    slug: normalized.slug,
    description: normalized.description,
    coverImage: normalized.coverImage,
    tags: normalized.tags,
    content: normalized.content,
    publishDate: normalized.publishDate,
    seoTitle: normalized.seoTitle,
    seoDescription: normalized.seoDescription,
    canonicalUrl: normalized.canonicalUrl,
    ogImage: normalized.ogImage,
    robotsIndex: normalized.robotsIndex,
    robotsFollow: normalized.robotsFollow,
  };
}

function formValuesFromPost(post: PostFormSource): CmsPostFormValues {
  return {
    title: post.title,
    slug: post.slug,
    description: post.description,
    coverImage: post.coverImage,
    tags: post.tags,
    content:
      typeof post.content === "string"
        ? post.content
        : JSON.stringify(post.content, null, 2),
    publishDate: post.publishDate,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    canonicalUrl: post.canonicalUrl,
    ogImage: post.ogImage,
    robotsIndex: post.robotsIndex,
    robotsFollow: post.robotsFollow,
  };
}

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

function PostResponsivePreview({
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
  workspaceFocusTriggerRef,
  workspaceFocused,
}: {
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
  workspaceFocusTriggerRef: RefObject<HTMLButtonElement | null>;
  workspaceFocused: boolean;
}) {
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
    markFrameLoaded,
    reloadKey,
    retry,
    status: connectionStatus,
  } = useCmsPreviewConnection();
  const valuesRef = useRef(values);
  const selectedFieldRef = useRef(selectedField);
  const selectedBlockIndexRef = useRef(selectedBlockIndex);
  const profile = postPreviewProfiles[device];
  const previewUrl = `/admin/posts/${encodeURIComponent(postId)}/preview`;
  valuesRef.current = values;
  selectedFieldRef.current = selectedField;
  selectedBlockIndexRef.current = selectedBlockIndex;

  const sendWorkingCopy = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "cms:post-preview",
        postId,
        selectedField: selectedFieldRef.current,
        selectedBlockIndex: selectedBlockIndexRef.current,
        values: valuesRef.current,
      },
      window.location.origin,
    );
  }, [postId]);

  useEffect(() => {
    sendWorkingCopy();
  }, [selectedBlockIndex, selectedField, sendWorkingCopy, values]);

  useEffect(() => {
    const receiveReady = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== "object"
      )
        return;
      const message = event.data as Record<string, unknown>;
      if (
        message.type === "cms:post-preview-ready" &&
        message.postId === postId
      ) {
        markConnected();
        sendWorkingCopy();
      }
      if (isPostPreviewSelectMessage(event.data, postId)) {
        if (
          event.data.blockIndex !== undefined &&
          (event.data.content !== valuesRef.current.content ||
            parseRichTextDocument(valuesRef.current.content)?.blocks[
              event.data.blockIndex
            ]?.id !== event.data.blockId)
        )
          return;
        setSelectedField(event.data.field);
        const blockIndex = event.data.blockIndex ?? null;
        setSelectedBlockIndex(blockIndex);
        onSelectedBlockChange(blockIndex);
      }
      if (isPostPreviewCompositionMessage(event.data, postId)) {
        if (event.data.content !== valuesRef.current.content) return;
        setSelectedField("content");
        setSelectedBlockIndex(null);
        onSelectedBlockChange(null);
        onComposition(event.data.command);
      }
    };
    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [
    markConnected,
    onComposition,
    onSelectedBlockChange,
    postId,
    sendWorkingCopy,
  ]);

  useEffect(() => {
    if (!selectedField) return;
    const target = postPreviewFieldTargets[selectedField];
    let focusFrame = 0;
    const mountFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const control =
          selectedField === "content" && selectedBlockIndex === null
            ? (document.querySelector<HTMLElement>(
                "#post-content [id^='post-content-block-'] textarea, #post-content [id^='post-content-block-'] input",
              ) ??
              document.querySelector<HTMLElement>(
                "#post-content [id^='post-content-block-'] button",
              ))
            : selectedField === "content"
              ? document.getElementById(target.controlId)
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
              href={previewUrl}
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
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EditPostRoute() {
  const { postId } = Route.useParams();
  const { session } = Route.useRouteContext();
  const canPublish = session?.capabilities.includes("content.publish") ?? false;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const postQuery = useQuery(trpc.content.posts.byId.queryOptions({ postId }));
  const updatePost = useMutation(trpc.content.posts.update.mutationOptions());
  const revisionsQuery = useQuery(
    trpc.content.posts.revisions.queryOptions({ postId }),
  );
  const publishPost = useMutation(trpc.content.posts.publish.mutationOptions());
  const restorePost = useMutation(trpc.content.posts.restore.mutationOptions());
  const schedulePost = useMutation(
    trpc.content.posts.schedule.mutationOptions(),
  );
  const unschedulePost = useMutation(
    trpc.content.posts.unschedule.mutationOptions(),
  );
  const [scheduleAt, setScheduleAt] = useState("");
  const [formSeed, setFormSeed] = useState<CmsPostFormValues | null>(null);
  const [draftValues, setDraftValues] = useState<CmsPostFormValues | null>(
    null,
  );
  const [draftHistory, setDraftHistory] = useState(() =>
    createCmsDraftHistory<CmsPostFormValues | null>(null),
  );
  const [compositionRequest, setCompositionRequest] =
    useState<PostRichTextCompositionRequest | null>(null);
  const [selectedPostBlockIndex, setSelectedPostBlockIndex] = useState<
    number | null
  >(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [workingVersion, setWorkingVersion] = useState<number | null>(null);
  const [serverSlug, setServerSlug] = useState("");
  const [publishedRevisionId, setPublishedRevisionId] = useState<string | null>(
    null,
  );
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [slugDecisionRequired, setSlugDecisionRequired] = useState(false);
  const [createRedirectOnSlugChange, setCreateRedirectOnSlugChange] =
    useState(true);
  const [comparedRevisionId, setComparedRevisionId] = useState<string | null>(
    null,
  );
  const [workspaceFocused, setWorkspaceFocused] = useState(false);
  const {
    onKeyDown: handleFocusedWorkspaceKeyDown,
    triggerRef: workspaceFocusTriggerRef,
    workspaceRef,
  } = useCmsFocusWorkspace({
    focused: workspaceFocused,
    onFocusedChange: setWorkspaceFocused,
  });
  const editGeneration = useRef(0);
  const baselineDraftRef = useRef<CmsPostFormValues | null>(null);
  const compositionRequestId = useRef(0);
  const saving = useRef(false);
  const loadedPostId = useRef<string | null>(null);
  const post = postQuery.data?.data;

  const installServerPost = useCallback(
    (nextPost: PostFormSource, state: SaveState = "clean") => {
      const nextValues = formValuesFromPost(nextPost);
      editGeneration.current += 1;
      loadedPostId.current = nextPost._id;
      baselineDraftRef.current = nextValues;
      setFormSeed(nextValues);
      setDraftValues(nextValues);
      setDraftHistory(createCmsDraftHistory(nextValues));
      setCompositionRequest(null);
      setSelectedPostBlockIndex(null);
      setWorkingVersion(nextPost.version);
      setServerSlug(nextPost.slug);
      setPublishedRevisionId(nextPost.publishedRevisionId);
      setScheduledAt(nextPost.scheduledAt);
      setDirty(false);
      setSaveState(state);
      setValidationError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);
      setCreateRedirectOnSlugChange(true);
      setComparedRevisionId(null);
      setFormEpoch((current) => current + 1);
    },
    [],
  );

  useEffect(() => {
    if (!post || loadedPostId.current === postId) return;
    installServerPost(post as PostFormSource);
  }, [installServerPost, post, postId]);

  const invalidatePostLists = useCallback(
    () =>
      queryClient.invalidateQueries(trpc.content.posts.adminList.queryFilter()),
    [queryClient, trpc],
  );

  const reloadServerVersion = useCallback(async () => {
    const result = await postQuery.refetch();
    const latest = result.data?.data;
    if (!latest) {
      toast.error("Không tải được phiên bản bài viết mới nhất từ máy chủ.");
      return false;
    }
    installServerPost(latest as PostFormSource, "saved");
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.content.posts.revisions.queryFilter({ postId }),
      ),
      invalidatePostLists(),
    ]);
    return true;
  }, [
    installServerPost,
    invalidatePostLists,
    postId,
    postQuery,
    queryClient,
    trpc,
  ]);

  const markDraftChanged = useCallback(
    (nextValues: CmsPostFormValues) => {
      editGeneration.current += 1;
      const changed = !areCmsRevisionValuesEqual(
        baselineDraftRef.current,
        nextValues,
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
      setValidationError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);
    },
    [lastSavedAt],
  );

  const handleFormChange = useCallback(
    (values: CmsPostFormValues, historyGroup?: string) => {
      setDraftHistory((current) =>
        areCmsRevisionValuesEqual(values, current.present)
          ? current
          : commitCmsDraftHistory(current, values, {
              group: historyGroup,
              limit: 50,
            }),
      );
      setDraftValues(values);
      markDraftChanged(values);
    },
    [markDraftChanged],
  );

  const canUndoDraft = draftHistory.past.length > 0;
  const canRedoDraft = draftHistory.future.length > 0;

  const navigateDraftHistory = useCallback(
    (direction: "undo" | "redo") => {
      const next =
        direction === "undo"
          ? undoCmsDraftHistory(draftHistory)
          : redoCmsDraftHistory(draftHistory);
      if (next === draftHistory || !next.present) return;
      const nextValues = next.present;
      setDraftHistory(next);
      setDraftValues(nextValues);
      setFormSeed(nextValues);
      setFormEpoch((current) => current + 1);
      const parsed = parseRichTextDocument(nextValues.content);
      setSelectedPostBlockIndex((current) =>
        current === null
          ? null
          : Math.min(current, Math.max(0, (parsed?.blocks.length ?? 1) - 1)),
      );
      setCompositionRequest(null);
      markDraftChanged(nextValues);
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

  const handlePostComposition = useCallback(
    (command: PostRichTextCompositionCommand) => {
      compositionRequestId.current += 1;
      setCompositionRequest({ id: compositionRequestId.current, command });
    },
    [],
  );

  const saveNow = useCallback(
    async (
      values: CmsPostFormValues | null,
      options: { announce?: boolean; allowSlugDecision?: boolean } = {},
    ) => {
      if (!values || workingVersion === null || saving.current) return null;
      const error = validateCmsPostFormValues(values);
      if (error) {
        setValidationError(error);
        setSaveState("dirty");
        if (options.announce) toast.error("Nội dung chưa hợp lệ.");
        return null;
      }

      const slugChanged = Boolean(values.slug && values.slug !== serverSlug);
      if (slugChanged && publishedRevisionId && !options.allowSlugDecision) {
        setSlugDecisionRequired(true);
        setSaveState("dirty");
        return null;
      }

      const createRedirect = Boolean(
        slugChanged && publishedRevisionId && createRedirectOnSlugChange,
      );
      const generation = editGeneration.current;
      const valuesAtSave = values;
      saving.current = true;
      setSaveState("saving");
      setValidationError(null);
      setConflictMessage(null);
      setSlugDecisionRequired(false);

      try {
        const result = await updatePost.mutateAsync({
          postId,
          expectedVersion: workingVersion,
          createRedirect,
          ...values,
        });
        const updated = result.data;
        if (!updated)
          throw new Error("Không tải lại được bài viết sau khi lưu.");

        setWorkingVersion(updated.version);
        setServerSlug(updated.slug);
        setPublishedRevisionId(updated.publishedRevisionId);
        setScheduledAt(updated.scheduledAt);
        setLastSavedAt(new Date());
        baselineDraftRef.current = valuesAtSave;
        if (editGeneration.current === generation) {
          setDirty(false);
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }
        await invalidatePostLists();
        if (options.announce) toast.success("Đã lưu bản nháp.");
        return { version: updated.version };
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Lưu bản nháp thất bại.";
        if (/changed since|expected version|conflict/i.test(message)) {
          setSaveState("conflict");
          setConflictMessage(
            "Bài viết đã được sửa ở tab khác. Tải phiên bản mới từ máy chủ hoặc sao chép nội dung hiện tại trước khi tiếp tục.",
          );
          await postQuery.refetch();
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
      invalidatePostLists,
      postId,
      postQuery,
      createRedirectOnSlugChange,
      publishedRevisionId,
      serverSlug,
      updatePost,
      workingVersion,
    ],
  );

  const { openAfterSave } = useSaveBeforeNavigation({
    dirty,
    saving: saveState === "saving",
    save: () =>
      saveNow(draftValues, {
        announce: false,
        allowSlugDecision: true,
      }),
  });

  const openPostPreview = useCallback(
    (url: string) => {
      void openAfterSave(url).then((result) => {
        if (result === "popup-blocked") {
          toast.error(
            "Trình duyệt đã chặn thẻ xem trước. Hãy cho phép cửa sổ bật lên.",
          );
        } else if (result === "save-blocked") {
          toast.error("Chưa thể mở bản xem trước vì bản nháp chưa được lưu.");
        }
      });
    },
    [openAfterSave],
  );

  useCmsAutosave({
    changeToken: draftValues,
    conflicted: saveState === "conflict",
    dirty,
    save: () => saveNow(draftValues, { allowSlugDecision: false }),
    saving: saveState === "saving",
  });

  return (
    <AdminShell
      actions={
        formSeed && workingVersion !== null ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                document
                  .getElementById("post-revision-history")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <History aria-hidden />
              Lịch sử
            </Button>
            <Link
              className={buttonVariants({ variant: "secondary" })}
              params={{ postId }}
              target="_blank"
              to="/admin/posts/$postId/preview"
              onClick={(event) => {
                event.preventDefault();
                openPostPreview(event.currentTarget.href);
              }}
            >
              <Eye aria-hidden />
              Xem trước
            </Link>
            {canPublish ? (
              <>
                <input
                  aria-label="Thời gian xuất bản"
                  className="h-9 rounded-md border bg-background px-3 text-xs"
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
                {scheduledAt ? (
                  <Button
                    variant="secondary"
                    disabled={
                      unschedulePost.isPending || saveState === "conflict"
                    }
                    onClick={async () => {
                      const saved = dirty
                        ? await saveNow(draftValues, {
                            allowSlugDecision: true,
                          })
                        : { version: workingVersion };
                      if (!saved) return;
                      await unschedulePost.mutateAsync({
                        postId,
                        expectedVersion: saved.version,
                      });
                      await reloadServerVersion();
                      toast.success("Đã hủy lịch.");
                    }}
                  >
                    Hủy lịch {new Date(scheduledAt).toLocaleString("vi-VN")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={
                      !scheduleAt ||
                      schedulePost.isPending ||
                      saveState === "conflict"
                    }
                    onClick={async () => {
                      const saved = dirty
                        ? await saveNow(draftValues, {
                            allowSlugDecision: true,
                          })
                        : { version: workingVersion };
                      if (!saved) return;
                      await schedulePost.mutateAsync({
                        postId,
                        expectedVersion: saved.version,
                        scheduledAt: new Date(scheduleAt),
                        note: "Lên lịch từ trình biên tập bài viết",
                      });
                      setScheduleAt("");
                      await reloadServerVersion();
                      toast.success("Đã lên lịch.");
                    }}
                  >
                    <Clock3 />
                    Lên lịch
                  </Button>
                )}
                <ConfirmDestructiveAction
                  confirmLabel="Xuất bản"
                  confirmVariant="default"
                  description="Bản nháp hiện tại sẽ trở thành nội dung công khai. Lịch sử phiên bản vẫn được giữ nguyên."
                  pending={publishPost.isPending}
                  title={`Xuất bản “${formSeed.title || "bài viết này"}”?`}
                  trigger={
                    <Button
                      disabled={
                        publishPost.isPending || saveState === "conflict"
                      }
                      type="button"
                    >
                      <Send />
                      Xuất bản
                    </Button>
                  }
                  onConfirm={async () => {
                    const saved = dirty
                      ? await saveNow(draftValues, {
                          allowSlugDecision: true,
                        })
                      : { version: workingVersion };
                    if (!saved) return;
                    await publishPost.mutateAsync({
                      postId,
                      expectedVersion: saved.version,
                      note: "Xuất bản từ trình biên tập bài viết",
                    });
                    await reloadServerVersion();
                    toast.success("Đã xuất bản.");
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null
      }
    >
      {postQuery.isLoading ? (
        <div className="mx-auto min-h-80 w-full max-w-4xl animate-pulse rounded-md border bg-muted/30" />
      ) : post && formSeed && workingVersion !== null ? (
        <div className="grid gap-5">
          {conflictMessage ? (
            <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 border border-warning-foreground/20 bg-warning p-4 text-sm text-warning-foreground">
              <div>
                <strong>Xung đột phiên bản</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conflictMessage}
                </p>
              </div>
              <Button variant="secondary" onClick={reloadServerVersion}>
                Tải phiên bản từ máy chủ
              </Button>
            </div>
          ) : null}
          {slugDecisionRequired ? (
            <div className="mx-auto grid w-full max-w-4xl gap-2 border border-warning-foreground/20 bg-warning p-3 text-xs text-warning-foreground">
              <strong>Đường dẫn của bài đã xuất bản đang thay đổi.</strong>
              <label className="flex items-start gap-2">
                <input
                  checked={createRedirectOnSlugChange}
                  className="mt-0.5"
                  type="checkbox"
                  onChange={(event) =>
                    setCreateRedirectOnSlugChange(event.target.checked)
                  }
                />
                <span>
                  Tạo chuyển hướng 301 từ /bai-viet/{serverSlug} để giữ liên kết
                  cũ hoạt động. Sau đó bấm “Lưu thay đổi”.
                </span>
              </label>
            </div>
          ) : null}
          {validationError ? (
            <div className="mx-auto w-full max-w-4xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <strong>Chưa thể tự động lưu:</strong> {validationError}
            </div>
          ) : null}
          <EditorialReviewPanel
            currentVersion={workingVersion}
            decisionGranted={
              session?.capabilities.includes("content.review.decide") ?? false
            }
            dirty={dirty}
            documentId={postId}
            documentType="post"
            onSaveDraft={() =>
              saveNow(draftValues, {
                announce: false,
                allowSlugDecision: true,
              })
            }
            publishGranted={canPublish}
            requestGranted={
              session?.capabilities.includes("content.review.request") ?? false
            }
          />
          <div
            aria-label={
              workspaceFocused
                ? "Không gian biên tập bài viết trực quan tập trung"
                : undefined
            }
            aria-modal={workspaceFocused || undefined}
            className={
              workspaceFocused
                ? "fixed inset-3 z-[100] grid h-[calc(100dvh-1.5rem)] min-h-0 grid-cols-[minmax(0,1fr)_26rem] gap-0 overflow-hidden rounded-xl bg-background shadow-[0_30px_120px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
                : "contents"
            }
            data-cms-post-workspace-mode={
              workspaceFocused ? "focused" : "standard"
            }
            ref={workspaceRef}
            role={workspaceFocused ? "dialog" : undefined}
            onKeyDown={handleFocusedWorkspaceKeyDown}
          >
            <div
              className={
                workspaceFocused
                  ? "order-1 min-h-0 overflow-hidden border-r"
                  : "contents"
              }
            >
              <PostResponsivePreview
                canRedo={canRedoDraft}
                canUndo={canUndoDraft}
                onComposition={handlePostComposition}
                onRedo={() => navigateDraftHistory("redo")}
                onSelectedBlockChange={setSelectedPostBlockIndex}
                onUndo={() => navigateDraftHistory("undo")}
                onWorkspaceFocusChange={setWorkspaceFocused}
                postId={postId}
                values={draftValues ?? formSeed}
                version={workingVersion}
                workspaceFocusTriggerRef={workspaceFocusTriggerRef}
                workspaceFocused={workspaceFocused}
              />
            </div>
            <div
              className={
                workspaceFocused
                  ? "order-2 min-h-0 overflow-y-auto border-l bg-background p-4"
                  : "contents"
              }
            >
              <CmsPostForm
                compositionRequest={compositionRequest}
                contentValue={draftValues?.content}
                key={`${postId}-${formEpoch}`}
                initialValues={formSeed}
                isSubmitDisabled={saveState === "conflict"}
                isSubmitting={saveState === "saving"}
                onChange={handleFormChange}
                selectedBlockIndex={selectedPostBlockIndex}
                submitLabel="Lưu thay đổi"
                status={
                  <PostSaveStatus
                    lastSavedAt={lastSavedAt}
                    state={saveState}
                    version={workingVersion}
                  />
                }
                onSubmit={(values: CmsPostFormValues) =>
                  void saveNow(values, {
                    announce: true,
                    allowSlugDecision: true,
                  })
                }
              />
            </div>
          </div>
          <Card
            className="mx-auto w-full max-w-4xl scroll-mt-20 rounded-md"
            id="post-revision-history"
          >
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2">
                <History className="size-4" />
                <h2 className="font-semibold">Phiên bản đã xuất bản</h2>
              </div>
              {((revisionsQuery.data ?? []) as PostRevisionRow[]).map(
                (revision) => {
                  const fieldChanges = compareCmsRevisionFieldDetails(
                    formValuesFromRevision(revision.snapshot),
                    draftValues ?? formSeed,
                    postRevisionFields,
                  );
                  const comparisonOpen = comparedRevisionId === revision.id;
                  return (
                    <div
                      className="grid gap-3 border-t pt-3 text-xs"
                      data-testid={`post-revision-v${revision.version}`}
                      key={revision.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <strong>v{revision.version}</strong>
                          <p className="text-muted-foreground">
                            {revision.note || "Không có ghi chú"} ·{" "}
                            {new Date(revision.createdAt).toLocaleString(
                              "vi-VN",
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            aria-controls={`post-revision-diff-${revision.version}`}
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
                          {canPublish ? (
                            <ConfirmDestructiveAction
                              confirmLabel="Khôi phục bản nháp"
                              confirmVariant="default"
                              description={`Nội dung phiên bản v${revision.version} sẽ thay thế bản nháp hiện tại. Nội dung công khai chưa thay đổi.`}
                              pending={restorePost.isPending}
                              title={`Khôi phục phiên bản v${revision.version}?`}
                              trigger={
                                <Button
                                  disabled={restorePost.isPending || dirty}
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  <RotateCcw />
                                  Khôi phục bản nháp
                                </Button>
                              }
                              onConfirm={async () => {
                                await restorePost.mutateAsync({
                                  postId,
                                  revisionId: revision.id,
                                  expectedVersion: workingVersion,
                                });
                                await reloadServerVersion();
                                setComparedRevisionId(null);
                                toast.success("Đã khôi phục vào bản nháp.");
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                      {comparisonOpen ? (
                        <section
                          aria-label={`Thay đổi của phiên bản v${revision.version}`}
                          className="rounded-md bg-muted/50 p-3"
                          id={`post-revision-diff-${revision.version}`}
                        >
                          <strong>So với bản nháp đang chỉnh sửa</strong>
                          {fieldChanges.length ? (
                            <div className="mt-3">
                              <RevisionFieldComparison changes={fieldChanges} />
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
                },
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mx-auto flex min-h-80 w-full max-w-4xl flex-col items-center justify-center gap-3 border text-center">
          <FileText aria-hidden className="size-8 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-medium">Không tìm thấy bài viết</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bản ghi này không còn tồn tại.
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: "secondary" })}
            to="/admin/posts"
          >
            Quay lại danh sách
          </Link>
        </div>
      )}
    </AdminShell>
  );
}

function PostSaveStatus({
  state,
  lastSavedAt,
  version,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
  version: number;
}) {
  const saved = lastSavedAt ? (
    <span className="flex items-center gap-2 text-xs text-success-foreground">
      <Check aria-hidden className="size-4" /> Đã lưu v{version} lúc{" "}
      {lastSavedAt.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  ) : (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <Check aria-hidden className="size-4" /> Bản làm việc v{version} · Đã đồng
      bộ với máy chủ
    </span>
  );
  return (
    <CmsDraftStatusSlots
      state={state}
      slots={{
        saving: (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 aria-hidden className="size-4" /> Đang tự động lưu…
          </span>
        ),
        conflict: (
          <span className="flex items-center gap-2 text-xs text-warning-foreground">
            <AlertTriangle aria-hidden className="size-4" /> Có xung đột phiên
            bản
          </span>
        ),
        dirty: (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 aria-hidden className="size-4" /> Có thay đổi chưa lưu · Tự
            động lưu sau 1,6 giây
          </span>
        ),
        saved,
        clean: saved,
      }}
    />
  );
}
