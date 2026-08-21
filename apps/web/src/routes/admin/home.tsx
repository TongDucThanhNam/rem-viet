import {
  CmsDraftStatusSlots,
  CmsRevisionList,
  CmsWorkflowActionSlots,
  compareCmsBlockRevisions,
  compareCmsRevisionFieldDetails,
  filterCmsBlockAuthoringCatalog,
  resolveCmsAdminWorkflow,
  runCmsWorkflowCommand,
  useCmsAutosave,
  useCmsFocusWorkspace,
  useCmsPreviewConnection,
  type CmsDraftSaveState,
  type CmsPreviewConnectionStatus,
  type CmsRevisionFieldDefinition,
} from "@agency/cms-admin";
import {
  commitCmsDraftHistory,
  createCmsDraftHistory,
  createCmsVisualEditorStateMessage,
  createCmsVisualPreviewEnvelope,
  initialCmsVisualPreviewReplayState,
  isCmsVisualEditorMessage,
  redoCmsDraftHistory,
  undoCmsDraftHistory,
  validateCmsVisualPreviewEnvelope,
  type CmsVisualPreviewIdentity,
} from "@agency/cms-visual-editor";
import { RemVietEditorShell } from "@agency/cms-template-rem-viet/admin";
import {
  remVietTemplateAuthoringCatalog,
  remVietTemplateBlockLabels as homeBlockLabels,
} from "@agency/cms-template-rem-viet";
import {
  defaultHomeBlocks,
  homeBlockSchema,
  pageRevisionSnapshotSchema,
  type HomeBlock,
  type PageBlock,
} from "@rem-viet/cms";
import { Button, buttonVariants } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  GitCompareArrows,
  GripVertical,
  History,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Send,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";

import AdminHomeBlockEditor from "@/components/admin-home-block-editor";
import AdminShell from "@/components/admin-shell";
import { ConfirmDestructiveAction } from "@/components/admin-ui";
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
import { getHomeVisualFieldTarget } from "@/lib/home-visual-editing";
import {
  canDuplicateHomeBlock,
  canRemoveHomeBlock,
  duplicateHomeVisualBlock,
  getInsertableHomeBlockTypes,
  insertHomeVisualBlock,
  isHomeBlockType,
  moveHomeVisualBlock,
  removeHomeVisualBlock,
  type HomeCompositionResult,
} from "@/lib/home-visual-order";
import { siteConfig, siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/home")({
  component: AdminHomeRoute,
  beforeLoad: async () => ({ session: await getAdminUser() }),
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
});

type HomePageRow = {
  _id: string;
  blocks: PageBlock[];
  publishedRevisionId: string | null;
  status: "draft" | "published";
  slug: string;
  title: string;
  updatedAt: string;
  version: number;
  scheduledAt: string | Date | null;
  scheduleNote: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

type PageRevisionRow = {
  id: string;
  version: number;
  note: string;
  createdAt: string | Date;
  createdBy: string;
  snapshot: HomeRevisionSnapshot;
};

type HomeRevisionSnapshot = {
  title: string;
  slug: string;
  template: string;
  blocks: PageBlock[];
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

type HomeRevisionMetadata = Omit<HomeRevisionSnapshot, "blocks" | "template">;

const homeRevisionMetadataFields = [
  {
    key: "title",
    label: "Tên trang",
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
] as const satisfies readonly CmsRevisionFieldDefinition<HomeRevisionMetadata>[];

type SaveState = CmsDraftSaveState;
type PreviewDevice = "desktop" | "tablet" | "mobile";

const cloneDefaults = () => homeBlockSchema.array().parse(defaultHomeBlocks);

function blocksFromPage(page?: HomePageRow) {
  if (!page) return cloneDefaults();

  const blocks: HomeBlock[] = [];
  for (const candidate of page.blocks) {
    const result = homeBlockSchema.safeParse(candidate);
    if (!result.success) continue;
    blocks.push(result.data);
  }
  return blocks;
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function validationMessage(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  return error.issues
    .slice(0, 6)
    .map((issue) => {
      const field = issue.path.length ? issue.path.join(".") : "nội dung";
      return `${field}: ${issue.message}`;
    })
    .join(" · ");
}

function AdminHomeRoute() {
  const { session } = Route.useRouteContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pagesQuery = useQuery(trpc.content.pages.adminList.queryOptions({}));
  const workflowCapabilitiesQuery = useQuery(
    trpc.content.pages.capabilities.queryOptions(),
  );
  const pages = (pagesQuery.data ?? []) as HomePageRow[];
  const page = pages.find((candidate) => candidate.slug === "home");
  const workflow = resolveCmsAdminWorkflow({
    providerCapabilities: workflowCapabilitiesQuery.data?.provider ?? {
      supported: [],
    },
    grantedCapabilities: workflowCapabilitiesQuery.data?.granted ?? [],
    documentExists: Boolean(page),
    published: page?.status === "published",
    scheduled: Boolean(page?.scheduledAt),
  });
  const showDebug = import.meta.env.DEV || session?.staffRole === "owner";

  const [blockHistory, setBlockHistory] = useState(() =>
    createCmsDraftHistory(cloneDefaults()),
  );
  const blocks = blockHistory.present;
  const [selectedId, setSelectedId] = useState(cloneDefaults()[0]!.id);
  const [workingVersion, setWorkingVersion] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [editorReady, setEditorReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [workspaceFocused, setWorkspaceFocused] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [sidebarComposerOpen, setSidebarComposerOpen] = useState(false);
  const [sidebarCatalogQuery, setSidebarCatalogQuery] = useState("");
  const [comparedRevisionId, setComparedRevisionId] = useState<string | null>(
    null,
  );
  const [selectedFieldPath, setSelectedFieldPath] = useState<string | null>(
    null,
  );
  const [visualSelectionRevision, setVisualSelectionRevision] = useState(0);
  const [scheduleAt, setScheduleAt] = useState("");
  const [seoTitle, setSeoTitle] = useState(siteConfig.name);
  const [seoDescription, setSeoDescription] = useState(
    "Lưới chống muỗi cao cấp may đo theo từng khung cửa, giữ nhà thoáng sáng và bảo vệ gia đình.",
  );
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const editGeneration = useRef(0);
  const loadedVersion = useRef<number | null>(null);
  const reloadAtVersion = useRef<number | null>(null);
  const saving = useRef(false);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const previewHostSequence = useRef(0);
  const previewChannelReady = useRef(false);
  const previewReplay = useRef(initialCmsVisualPreviewReplayState());
  const pendingPreviewVersion = useRef<{
    messageId: string;
    version: number;
  } | null>(null);
  const previewIdentity = useRef<CmsVisualPreviewIdentity>({
    siteId: siteManifest.id,
    documentId: "home",
    documentType: "homepage",
    sessionId: session!.previewChannel.sessionId,
    sessionBinding: session!.previewChannel.sessionBinding,
    documentVersion: 0,
    conflictToken: session!.previewChannel.conflictToken,
  });
  const previewUrl = `/admin/home-preview?${new URLSearchParams({
    cmsBinding: previewIdentity.current.sessionBinding,
    cmsConflict: previewIdentity.current.conflictToken,
    cmsSession: previewIdentity.current.sessionId,
  })}`;
  const {
    onKeyDown: handleFocusedWorkspaceKeyDown,
    triggerRef: workspaceFocusTriggerRef,
    workspaceRef,
  } = useCmsFocusWorkspace({
    focused: workspaceFocused,
    onFocusedChange: setWorkspaceFocused,
  });
  const {
    markConnected: markPreviewConnected,
    markFrameLoading: markPreviewFrameLoading,
    markFrameLoaded: markPreviewFrameLoaded,
    reloadKey: previewReloadKey,
    retry: retryPreview,
    status: previewConnectionStatus,
  } = useCmsPreviewConnection();

  useEffect(() => {
    markPreviewFrameLoading();
    previewChannelReady.current = false;
    previewHostSequence.current = 0;
    previewReplay.current = initialCmsVisualPreviewReplayState();
    pendingPreviewVersion.current = null;
    previewIdentity.current = {
      ...previewIdentity.current,
      documentVersion: 0,
    };
  }, [markPreviewFrameLoading, previewReloadKey]);

  const markDraftDirty = useCallback(() => {
    editGeneration.current += 1;
    setDirty(true);
    setSaveState("dirty");
    setValidationError(null);
    setConflictMessage(null);
  }, []);

  const markEdited = useCallback(
    (nextBlocks: HomeBlock[], historyGroup?: string) => {
      setBlockHistory((current) =>
        commitCmsDraftHistory(current, nextBlocks, {
          group: historyGroup,
          limit: 50,
        }),
      );
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const canUndoDraft = blockHistory.past.length > 0;
  const canRedoDraft = blockHistory.future.length > 0;

  const navigateDraftHistory = useCallback(
    (direction: "undo" | "redo") => {
      const next =
        direction === "undo"
          ? undoCmsDraftHistory(blockHistory)
          : redoCmsDraftHistory(blockHistory);
      if (next === blockHistory) return;
      setBlockHistory(next);
      markDraftDirty();
      setSelectedId((current) =>
        next.present.some((block) => block.id === current)
          ? current
          : next.present[0]!.id,
      );
      setSelectedFieldPath(null);
    },
    [blockHistory, markDraftDirty],
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

  const selectedBlock =
    blocks.find((block) => block.id === selectedId) ?? blocks[0];
  const selectedVisualFieldTarget =
    selectedBlock && selectedFieldPath
      ? getHomeVisualFieldTarget(selectedBlock, selectedFieldPath)
      : undefined;
  const insertableBlockTypes = getInsertableHomeBlockTypes(blocks);
  const insertableCatalog = remVietTemplateAuthoringCatalog.filter(({ type }) =>
    insertableBlockTypes.includes(type),
  );
  const filteredSidebarCatalog = filterCmsBlockAuthoringCatalog(
    insertableCatalog,
    sidebarCatalogQuery,
  );

  const applyCompositionResult = useCallback(
    (result: HomeCompositionResult | null) => {
      if (!result) return false;
      markEdited(result.blocks);
      setSelectedId(result.selectedBlockId);
      setSelectedFieldPath(null);
      return true;
    },
    [markEdited],
  );

  const syncVisualPreview = useCallback(() => {
    if (!previewChannelReady.current) return;
    if (pendingPreviewVersion.current) return;
    const state = createCmsVisualEditorStateMessage({
      blocks,
      selectedBlockId: selectedBlock?.id ?? null,
      selectedFieldPath,
      selectionRevision: visualSelectionRevision,
      revision: workingVersion,
    });
    const sequence = ++previewHostSequence.current;
    const envelope = createCmsVisualPreviewEnvelope({
      source: "host",
      messageId: `${previewIdentity.current.sessionId}:host:${sequence}`,
      sequence,
      identity: previewIdentity.current,
      payload: { type: "state", state },
    });
    if (previewIdentity.current.documentVersion !== workingVersion) {
      pendingPreviewVersion.current = {
        messageId: envelope.messageId,
        version: workingVersion,
      };
    }
    previewFrameRef.current?.contentWindow?.postMessage(
      envelope,
      window.location.origin,
    );
  }, [
    blocks,
    selectedBlock?.id,
    selectedFieldPath,
    visualSelectionRevision,
    workingVersion,
  ]);

  useEffect(() => syncVisualPreview(), [syncVisualPreview]);

  const previewHostActionsRef = useRef({
    applyCompositionResult,
    blocks,
    markEdited,
    markPreviewConnected,
    selectedBlock,
    syncVisualPreview,
  });
  previewHostActionsRef.current = {
    applyCompositionResult,
    blocks,
    markEdited,
    markPreviewConnected,
    selectedBlock,
    syncVisualPreview,
  };

  useEffect(() => {
    const receivePreviewMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== previewFrameRef.current?.contentWindow
      )
        return;
      let validation = validateCmsVisualPreviewEnvelope({
        value: event.data,
        origin: event.origin,
        allowedOrigins: new Set([window.location.origin]),
        expectedSource: "preview",
        expectedIdentity: previewIdentity.current,
        replay: previewReplay.current,
      });
      const pendingVersion = pendingPreviewVersion.current;
      if (
        !validation.accepted &&
        validation.reason === "identity" &&
        pendingVersion
      ) {
        const transitionValidation = validateCmsVisualPreviewEnvelope({
          value: event.data,
          origin: event.origin,
          allowedOrigins: new Set([window.location.origin]),
          expectedSource: "preview",
          expectedIdentity: {
            ...previewIdentity.current,
            documentVersion: pendingVersion.version,
          },
          replay: previewReplay.current,
        });
        if (
          transitionValidation.accepted &&
          transitionValidation.envelope.payload.type === "ack" &&
          transitionValidation.envelope.payload.acknowledgedMessageId ===
            pendingVersion.messageId
        ) {
          validation = transitionValidation;
        }
      }
      if (!validation.accepted) return;
      previewReplay.current = validation.replay;
      const payload = validation.envelope.payload;
      if (payload.type === "ack") {
        if (
          pendingVersion &&
          payload.acknowledgedMessageId === pendingVersion.messageId
        ) {
          previewIdentity.current = {
            ...previewIdentity.current,
            documentVersion: pendingVersion.version,
          };
          pendingPreviewVersion.current = null;
          previewHostActionsRef.current.syncVisualPreview();
        }
        return;
      }
      if (payload.type === "ready") {
        previewChannelReady.current = true;
        previewHostActionsRef.current.markPreviewConnected();
        previewHostActionsRef.current.syncVisualPreview();
        return;
      }
      if (
        payload.type !== "command" ||
        !isCmsVisualEditorMessage(payload.command)
      )
        return;
      const message = payload.command;
      const { applyCompositionResult, blocks, markEdited, selectedBlock } =
        previewHostActionsRef.current;
      if (message.type === "move") {
        const nextBlocks = moveHomeVisualBlock(blocks, message);
        if (!nextBlocks) return;
        markEdited(nextBlocks);
        setSelectedId(message.blockId);
        setSelectedFieldPath(null);
      }
      if (message.type === "insert") {
        if (!isHomeBlockType(message.blockType)) return;
        applyCompositionResult(
          insertHomeVisualBlock(blocks, {
            blockType: message.blockType,
            targetBlockId: message.targetBlockId,
            placement: message.placement,
          }),
        );
      }
      if (message.type === "duplicate") {
        applyCompositionResult(
          duplicateHomeVisualBlock(blocks, message.blockId),
        );
      }
      if (message.type === "remove") {
        const source = blocks.find((block) => block.id === message.blockId);
        const result = removeHomeVisualBlock(blocks, message.blockId);
        if (!source || !applyCompositionResult(result)) return;
        const previousBlocks = blocks;
        const previousSelectedId = selectedBlock?.id ?? blocks[0]!.id;
        toast(`Đã xóa ${homeBlockLabels[source.type]}.`, {
          action: {
            label: "Hoàn tác",
            onClick: () => {
              markEdited(previousBlocks);
              setSelectedId(previousSelectedId);
            },
          },
        });
      }
      if (
        message.type === "select" &&
        blocks.some((block) => block.id === message.blockId)
      ) {
        setSelectedId(message.blockId);
        const nextBlock = blocks.find((block) => block.id === message.blockId);
        setSelectedFieldPath(
          nextBlock &&
            message.fieldPath &&
            getHomeVisualFieldTarget(nextBlock, message.fieldPath)
            ? message.fieldPath
            : null,
        );
      }
    };
    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, []);

  useEffect(() => {
    if (!selectedBlock || !selectedFieldPath) return;
    const visualTarget = getHomeVisualFieldTarget(
      selectedBlock,
      selectedFieldPath,
    );
    if (!visualTarget) return;
    let focusFrame = 0;
    let recoveryFrame = 0;
    let stabilizationTimer: ReturnType<typeof setTimeout> | undefined;
    const focusVisualControl = () => {
      const control = document.getElementById(visualTarget.controlId);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    };
    const recoverVisualFocus = () => {
      document.removeEventListener("focusout", recoverVisualFocus, true);
      recoveryFrame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (
          active === document.body ||
          active === previewFrameRef.current ||
          active?.id === visualTarget.controlId
        ) {
          focusVisualControl();
        }
      });
    };
    const mountFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        focusVisualControl();
        document.addEventListener("focusout", recoverVisualFocus, true);
        stabilizationTimer = setTimeout(() => {
          const active = document.activeElement;
          if (
            active === document.body ||
            active === previewFrameRef.current ||
            active?.id === visualTarget.controlId
          ) {
            focusVisualControl();
          }
        }, 100);
      });
    });
    return () => {
      cancelAnimationFrame(mountFrame);
      cancelAnimationFrame(focusFrame);
      cancelAnimationFrame(recoveryFrame);
      clearTimeout(stabilizationTimer);
      document.removeEventListener("focusout", recoverVisualFocus, true);
    };
  }, [selectedBlock, selectedFieldPath]);

  useEffect(() => {
    if (!page) {
      if (pagesQuery.isFetched) setEditorReady(true);
      return;
    }
    setSeoTitle(page.seoTitle);
    setSeoDescription(page.seoDescription);
    setCanonicalUrl(page.canonicalUrl);
    setOgImage(page.ogImage);
    setRobotsIndex(page.robotsIndex);
    setRobotsFollow(page.robotsFollow);
  }, [page?._id, page?.version]);

  const revisionsQuery = useQuery({
    ...trpc.content.pages.revisions.queryOptions({ pageId: page?._id ?? "" }),
    enabled: Boolean(page?._id),
  });
  const revisions = (revisionsQuery.data ?? []) as PageRevisionRow[];
  const currentRevisionMetadata: HomeRevisionMetadata = {
    title: page?.title ?? "Trang chủ",
    slug: page?.slug ?? "home",
    seoTitle,
    seoDescription,
    canonicalUrl,
    ogImage,
    robotsIndex,
    robotsFollow,
  };

  const createPage = useMutation(trpc.content.pages.create.mutationOptions());
  const updatePage = useMutation(trpc.content.pages.update.mutationOptions());
  const publishPage = useMutation(trpc.content.pages.publish.mutationOptions());
  const restoreRevision = useMutation(
    trpc.content.pages.restore.mutationOptions(),
  );
  const schedulePage = useMutation(
    trpc.content.pages.schedule.mutationOptions(),
  );
  const unschedulePage = useMutation(
    trpc.content.pages.unschedule.mutationOptions(),
  );
  const unpublishPage = useMutation(
    trpc.content.pages.unpublish.mutationOptions(),
  );

  const invalidateHome = useCallback(
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

  useEffect(() => {
    if (!page) return;
    if (loadedVersion.current !== null && page.version < loadedVersion.current)
      return;
    if (reloadAtVersion.current === page.version) {
      const next = blocksFromPage(page);
      setBlockHistory(createCmsDraftHistory(next));
      setSelectedId((current) =>
        next.some((block) => block.id === current) ? current : next[0]!.id,
      );
      setWorkingVersion(page.version);
      loadedVersion.current = page.version;
      reloadAtVersion.current = null;
      setDirty(false);
      setSaveState("clean");
      setValidationError(null);
      setConflictMessage(null);
      setEditorReady(true);
      return;
    }
    if (loadedVersion.current === page.version) return;

    if (dirty && loadedVersion.current !== null) {
      setSaveState("conflict");
      setConflictMessage(
        `Máy chủ đang ở v${page.version}, trong khi thẻ này còn thay đổi chưa lưu từ v${workingVersion}.`,
      );
      return;
    }

    const next = blocksFromPage(page);
    setBlockHistory(createCmsDraftHistory(next));
    setSelectedId((current) =>
      next.some((block) => block.id === current) ? current : next[0]!.id,
    );
    setWorkingVersion(page.version);
    loadedVersion.current = page.version;
    reloadAtVersion.current = null;
    setDirty(false);
    setSaveState("clean");
    setValidationError(null);
    setConflictMessage(null);
    setEditorReady(true);
  }, [dirty, page, pagesQuery.isFetched, workingVersion]);

  const markMetadataEdited = () => {
    editGeneration.current += 1;
    setDirty(true);
    setSaveState("dirty");
    setValidationError(null);
  };

  const saveNow = useCallback(
    async (announce = false) => {
      if (!workflow.save.available) return null;
      if (saving.current) return null;
      const parsed = homeBlockSchema.array().safeParse(blocks);
      if (!parsed.success) {
        const message = validationMessage(parsed.error);
        setValidationError(message);
        setSaveState("dirty");
        if (announce) toast.error("Nội dung chưa hợp lệ.");
        return null;
      }

      const generation = editGeneration.current;
      saving.current = true;
      setSaveState("saving");
      setValidationError(null);

      try {
        if (!page) {
          const result = await createPage.mutateAsync({
            title: "Trang chủ",
            slug: "home",
            template: "landing",
            status: "draft",
            blocks: parsed.data,
            seoTitle,
            seoDescription,
            canonicalUrl,
            ogImage,
            robotsIndex,
            robotsFollow,
          });
          const created = result.data;
          if (!created) throw new Error("Không tạo được nội dung Trang chủ.");
          loadedVersion.current = created.version;
          setWorkingVersion(created.version);
          if (editGeneration.current === generation) {
            setDirty(false);
            setSaveState("saved");
          } else {
            setSaveState("dirty");
          }
          setLastSavedAt(new Date());
          await invalidateHome(created._id);
          if (announce) toast.success("Đã tạo và lưu bản nháp Trang chủ.");
          return { pageId: created._id, version: created.version };
        }

        const result = await updatePage.mutateAsync({
          pageId: page._id,
          blocks: parsed.data,
          template: "landing",
          seoTitle,
          seoDescription,
          canonicalUrl,
          ogImage,
          robotsIndex,
          robotsFollow,
          expectedVersion: workingVersion,
        });
        const updated = result.data;
        if (!updated)
          throw new Error("Không tải lại được Trang chủ sau khi lưu.");
        loadedVersion.current = updated.version;
        setWorkingVersion(updated.version);
        if (editGeneration.current === generation) {
          setDirty(false);
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }
        setLastSavedAt(new Date());
        await invalidateHome(page._id);
        if (announce) toast.success("Đã lưu bản nháp.");
        return { pageId: page._id, version: updated.version };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Lưu bản nháp thất bại.";
        if (/changed since|expected version|conflict/i.test(message)) {
          setSaveState("conflict");
          setConflictMessage(
            "Nội dung đã được sửa ở tab khác. Tải bản mới trên máy chủ hoặc sao chép nội dung hiện tại trước khi tiếp tục.",
          );
          if (page) await invalidateHome(page._id);
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
      invalidateHome,
      page,
      ogImage,
      robotsFollow,
      robotsIndex,
      saveState,
      updatePage,
      workingVersion,
      workflow.save.available,
      seoDescription,
      seoTitle,
    ],
  );

  const { openAfterSave } = useSaveBeforeNavigation({
    dirty,
    saving: saveState === "saving",
    save: () => saveNow(false),
  });

  const openHomePreview = useCallback(
    (url: string) => {
      void openAfterSave(url).then((result) => {
        if (result === "popup-blocked") {
          toast.error(
            "Trình duyệt đã chặn tab xem trước. Hãy cho phép cửa sổ bật lên.",
          );
        } else if (result === "save-blocked") {
          toast.error("Chưa thể mở xem trước vì bản nháp chưa lưu thành công.");
        }
      });
    },
    [openAfterSave],
  );

  useCmsAutosave({
    changeToken: blocks,
    conflicted: saveState === "conflict",
    dirty,
    save: () => saveNow(false),
    saving: saveState === "saving",
  });

  const publishedRevision = useMemo(
    () =>
      revisions.find((revision) => revision.id === page?.publishedRevisionId),
    [page?.publishedRevisionId, revisions],
  );

  const updateSelectedBlock = (next: HomeBlock) => {
    markEdited(
      blocks.map((block) => (block.id === selectedBlock?.id ? next : block)),
      selectedBlock
        ? `block:${selectedBlock.id}:${selectedFieldPath ?? "inspector"}`
        : undefined,
    );
  };

  const handlePublish = async () => {
    if (!workflow.publish.available) return;
    try {
      const outcome = await runCmsWorkflowCommand({
        current: page ? { id: page._id, version: workingVersion } : null,
        dirty,
        save: async () => {
          const saved = await saveNow(false);
          return saved ? { id: saved.pageId, version: saved.version } : null;
        },
        command: async (target) => ({
          pageId: target.id,
          result: await publishPage.mutateAsync({
            pageId: target.id,
            expectedVersion: target.version,
            note: "Xuất bản từ trình chỉnh sửa Trang chủ",
          }),
        }),
      });
      if (!outcome) return;
      loadedVersion.current = outcome.result.version;
      setWorkingVersion(outcome.result.version);
      setSaveState("saved");
      await invalidateHome(outcome.pageId);
      toast.success("Đã xuất bản Trang chủ.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Xuất bản thất bại.",
      );
    }
  };

  const handleSchedule = async () => {
    if (!workflow.schedule.available || !scheduleAt) return;
    try {
      const outcome = await runCmsWorkflowCommand({
        current: page ? { id: page._id, version: workingVersion } : null,
        dirty,
        save: async () => {
          const saved = await saveNow(false);
          return saved ? { id: saved.pageId, version: saved.version } : null;
        },
        command: async (target) => ({
          pageId: target.id,
          result: await schedulePage.mutateAsync({
            pageId: target.id,
            scheduledAt: new Date(scheduleAt),
            expectedVersion: target.version,
            note: "Lịch từ trình chỉnh sửa Trang chủ",
          }),
        }),
      });
      if (!outcome) return;
      loadedVersion.current = outcome.result.version;
      setWorkingVersion(outcome.result.version);
      setScheduleAt("");
      await invalidateHome(outcome.pageId);
      toast.success("Đã lên lịch xuất bản.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể lên lịch.",
      );
    }
  };

  const handleUnschedule = async () => {
    if (!page || !workflow.unschedule.available) return;
    try {
      const result = await unschedulePage.mutateAsync({
        pageId: page._id,
        expectedVersion: workingVersion,
      });
      loadedVersion.current = result.version;
      setWorkingVersion(result.version);
      await invalidateHome(page._id);
      toast.success("Đã hủy lịch xuất bản.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể hủy lịch.",
      );
    }
  };

  const handleUnpublish = async () => {
    if (!page || !workflow.unpublish.available) return;
    try {
      const result = await unpublishPage.mutateAsync({
        pageId: page._id,
        expectedVersion: workingVersion,
      });
      loadedVersion.current = result.version;
      setWorkingVersion(result.version);
      await invalidateHome(page._id);
      toast.success("Đã hủy xuất bản Trang chủ.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể hủy xuất bản.",
      );
    }
  };

  const reloadServerVersion = async () => {
    const result = await pagesQuery.refetch();
    const latest = ((result.data ?? []) as HomePageRow[]).find(
      (candidate) => candidate.slug === "home",
    );
    if (!latest) {
      toast.error("Không tải được bản Trang chủ mới nhất từ máy chủ.");
      return;
    }
    const next = blocksFromPage(latest);
    setBlockHistory(createCmsDraftHistory(next));
    setSelectedId(next[0]!.id);
    setSelectedFieldPath(null);
    setWorkingVersion(latest.version);
    loadedVersion.current = latest.version;
    reloadAtVersion.current = null;
    editGeneration.current += 1;
    setDirty(false);
    setSaveState("clean");
    setConflictMessage(null);
    setValidationError(null);
  };

  const reorderBlock = (targetId: string) => {
    if (!draggedBlockId || draggedBlockId === targetId) return;
    const from = blocks.findIndex((block) => block.id === draggedBlockId);
    const to = blocks.findIndex((block) => block.id === targetId);
    const source = blocks[from];
    const target = blocks[to];
    if (
      from < 0 ||
      to < 0 ||
      !source ||
      !target ||
      source.type === "hero" ||
      source.type === "footerCta" ||
      target.type === "hero" ||
      target.type === "footerCta"
    )
      return;
    markEdited(moveItem(blocks, from, to));
    setSelectedId(source.id);
    setSelectedFieldPath(null);
    setDraggedBlockId(null);
  };

  const addBlockFromSidebar = (blockType: HomeBlock["type"]) => {
    const footerBlock = blocks.find((block) => block.type === "footerCta");
    if (!footerBlock) return;
    if (
      applyCompositionResult(
        insertHomeVisualBlock(blocks, {
          blockType,
          targetBlockId: footerBlock.id,
          placement: "before",
        }),
      )
    ) {
      setSidebarComposerOpen(false);
      setSidebarCatalogQuery("");
      toast.success(`Đã thêm ${homeBlockLabels[blockType]}.`);
    }
  };

  const duplicateBlockFromSidebar = (block: HomeBlock) => {
    if (applyCompositionResult(duplicateHomeVisualBlock(blocks, block.id))) {
      toast.success(`Đã nhân bản ${homeBlockLabels[block.type]}.`);
    }
  };

  const removeBlockFromSidebar = (block: HomeBlock) => {
    const previousBlocks = blocks;
    const previousSelectedId = selectedBlock?.id ?? blocks[0]!.id;
    if (!applyCompositionResult(removeHomeVisualBlock(blocks, block.id)))
      return;
    toast(`Đã xóa ${homeBlockLabels[block.type]}.`, {
      action: {
        label: "Hoàn tác",
        onClick: () => {
          markEdited(previousBlocks);
          setSelectedId(previousSelectedId);
        },
      },
    });
  };

  return (
    <AdminShell
      defaultSidebarExpanded={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              document
                .getElementById("home-revision-history")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <History aria-hidden />
            Lịch sử
          </Button>
          <CmsWorkflowActionSlots
            model={workflow}
            order={["preview", "schedule", "publish"]}
            slots={{
              preview: (
                <a
                  className={buttonVariants({ variant: "secondary" })}
                  href={previewUrl}
                  rel="noreferrer"
                  target="_blank"
                  onClick={(event) => {
                    event.preventDefault();
                    openHomePreview(event.currentTarget.href);
                  }}
                >
                  <Eye aria-hidden /> Xem bản nháp
                </a>
              ),
              schedule: (
                <>
                  <input
                    aria-label="Thời gian xuất bản"
                    className="h-9 rounded-md border bg-background px-3 text-xs"
                    min={new Date(Date.now() + 60_000)
                      .toISOString()
                      .slice(0, 16)}
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                  />
                  <Button
                    disabled={
                      !editorReady ||
                      !scheduleAt ||
                      schedulePage.isPending ||
                      saveState === "saving"
                    }
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSchedule()}
                  >
                    <Clock3 aria-hidden /> Lên lịch
                  </Button>
                </>
              ),
              publish: (
                <ConfirmDestructiveAction
                  confirmLabel="Xuất bản"
                  confirmVariant="default"
                  description="Bản nháp hiện tại sẽ trở thành nội dung Trang chủ công khai. Lịch sử phiên bản vẫn được giữ nguyên."
                  onConfirm={handlePublish}
                  pending={publishPage.isPending || saveState === "saving"}
                  title="Xuất bản Trang chủ?"
                  trigger={
                    <Button
                      disabled={
                        !editorReady ||
                        publishPage.isPending ||
                        saveState === "saving"
                      }
                      type="button"
                    >
                      <Send aria-hidden /> Xuất bản
                    </Button>
                  }
                />
              ),
            }}
          />
        </div>
      }
    >
      {conflictMessage ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border border-warning-foreground/20 bg-warning p-4 text-sm text-warning-foreground">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-4" />
            <div>
              <strong>Xung đột phiên bản</strong>
              <p className="mt-1 text-muted-foreground">{conflictMessage}</p>
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

      {editorReady && page ? (
        <div className="mb-4">
          <EditorialReviewPanel
            commentGranted={
              session?.capabilities.includes("content.write") ?? false
            }
            currentVersion={workingVersion}
            decisionGranted={
              session?.capabilities.includes("content.review.decide") ?? false
            }
            dirty={dirty}
            documentId={page._id}
            documentType="page"
            onSaveDraft={() => saveNow(false)}
            publishGranted={
              session?.capabilities.includes("content.publish") ?? false
            }
            requestGranted={
              session?.capabilities.includes("content.review.request") ?? false
            }
          />
        </div>
      ) : null}

      {editorReady ? (
        <RemVietEditorShell
          className={`grid gap-4 xl:h-[calc(100dvh-10rem)] xl:min-h-[42rem] xl:gap-0 xl:overflow-hidden xl:border ${
            workspaceFocused
              ? "fixed inset-3 z-[100] rounded-xl bg-background shadow-[0_30px_120px_rgba(0,0,0,0.45)] ring-1 ring-black/10 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_26rem]"
              : "xl:grid-cols-[17rem_minmax(0,1fr)_26rem]"
          }`}
          data-cms-home-workspace-mode={
            workspaceFocused ? "focused" : "standard"
          }
          documentId="home"
          documentType="homepage"
          label="Không gian biên tập Trang chủ trực quan"
          mode={workspaceFocused ? "focused" : "standard"}
          ref={workspaceRef}
          style={
            workspaceFocused ? { height: "calc(100dvh - 1.5rem)" } : undefined
          }
          onKeyDown={handleFocusedWorkspaceKeyDown}
        >
          <aside
            className={
              workspaceFocused
                ? "hidden"
                : "order-1 grid content-start gap-3 xl:overflow-y-auto xl:border-r xl:bg-muted/20 xl:p-3"
            }
            data-cms-home-structure="true"
          >
            <Card>
              <CardContent className="grid gap-2">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">Cấu trúc trang</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Chọn, thêm, nhân bản hoặc đổi thứ tự trong giới hạn
                    template.
                  </p>
                </div>
                <div className="relative mb-2">
                  <Button
                    aria-controls="sidebar-section-catalog"
                    aria-expanded={sidebarComposerOpen}
                    aria-label="Thêm section vào cuối trang"
                    className="h-9 w-full justify-between px-3"
                    disabled={insertableCatalog.length === 0}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => setSidebarComposerOpen((open) => !open)}
                  >
                    <span className="flex items-center gap-2">
                      <Plus aria-hidden className="size-3.5" /> Thêm section
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={`size-3.5 transition-transform ${sidebarComposerOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                  {sidebarComposerOpen ? (
                    <div
                      aria-label="Danh mục section cho trang chủ"
                      className="mt-2 grid gap-2 rounded-lg border bg-popover p-2 shadow-lg"
                      id="sidebar-section-catalog"
                      role="dialog"
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        setSidebarComposerOpen(false);
                        setSidebarCatalogQuery("");
                      }}
                    >
                      <Label
                        className="sr-only"
                        htmlFor="sidebar-section-search"
                      >
                        Tìm section
                      </Label>
                      <div className="relative">
                        <Search
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                          autoFocus
                          className="h-8 pl-8 text-xs"
                          id="sidebar-section-search"
                          placeholder="Tìm theo tên hoặc mục đích…"
                          type="search"
                          value={sidebarCatalogQuery}
                          onChange={(event) =>
                            setSidebarCatalogQuery(event.target.value)
                          }
                        />
                      </div>
                      <div className="grid max-h-72 gap-1 overflow-y-auto">
                        {filteredSidebarCatalog.map((definition) => (
                          <button
                            className="grid gap-1 rounded-md border border-transparent px-2.5 py-2 text-left transition hover:border-primary/25 hover:bg-primary/8 focus-visible:border-primary/40 focus-visible:outline-none"
                            key={definition.type}
                            type="button"
                            onClick={() => addBlockFromSidebar(definition.type)}
                          >
                            <span className="text-[9px] font-semibold tracking-[0.1em] text-primary uppercase">
                              {definition.category}
                            </span>
                            <strong className="text-xs font-semibold">
                              {definition.label}
                            </strong>
                            <span className="text-[11px] leading-relaxed text-muted-foreground">
                              {definition.description}
                            </span>
                          </button>
                        ))}
                        {filteredSidebarCatalog.length === 0 ? (
                          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                            Không tìm thấy section phù hợp.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                {blocks.map((block, index) => (
                  <div
                    className={`group/block grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 rounded-md border p-2 transition-colors ${selectedBlock?.id === block.id ? "border-primary bg-primary/10 shadow-sm" : "bg-background hover:border-primary/40"} ${draggedBlockId === block.id ? "opacity-50" : ""}`}
                    draggable={
                      block.type !== "hero" && block.type !== "footerCta"
                    }
                    key={block.id}
                    onDragEnd={() => setDraggedBlockId(null)}
                    onDragOver={(event) => {
                      if (draggedBlockId) event.preventDefault();
                    }}
                    onDragStart={() => setDraggedBlockId(block.id)}
                    onDrop={(event) => {
                      event.preventDefault();
                      reorderBlock(block.id);
                    }}
                  >
                    <GripVertical
                      aria-label={`Kéo để đổi thứ tự ${homeBlockLabels[block.type]}`}
                      className={`mt-1 size-3.5 text-muted-foreground ${block.type === "hero" || block.type === "footerCta" ? "opacity-25" : "cursor-grab group-active/block:cursor-grabbing"}`}
                    />
                    <input
                      aria-label={`Bật ${homeBlockLabels[block.type]}`}
                      checked={block.enabled}
                      type="checkbox"
                      onChange={(event) =>
                        markEdited(
                          blocks.map((entry) =>
                            entry.id === block.id
                              ? { ...entry, enabled: event.target.checked }
                              : entry,
                          ),
                        )
                      }
                    />
                    <button
                      className="min-h-7 min-w-0 py-1 text-left text-xs font-medium leading-snug"
                      type="button"
                      onClick={() => {
                        setSelectedId(block.id);
                        setSelectedFieldPath(null);
                        setVisualSelectionRevision((current) =>
                          current >= Number.MAX_SAFE_INTEGER ? 0 : current + 1,
                        );
                      }}
                    >
                      <span className="block">
                        {index + 1}. {homeBlockLabels[block.type]}
                      </span>
                    </button>
                    <div className="col-start-3 flex min-w-0 items-center justify-between gap-1">
                      <span
                        className={`truncate text-[10px] font-normal ${selectedBlock?.id === block.id ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {block.enabled ? "Đang hiển thị" : "Đã ẩn"}
                      </span>
                      <div className="flex shrink-0">
                        <Button
                          aria-label={`Nhân bản ${homeBlockLabels[block.type]}`}
                          className="size-6"
                          disabled={!canDuplicateHomeBlock(blocks, block)}
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => duplicateBlockFromSidebar(block)}
                        >
                          <Copy aria-hidden />
                        </Button>
                        <Button
                          aria-label={`Xóa ${homeBlockLabels[block.type]}`}
                          className="size-6 text-destructive hover:text-destructive"
                          disabled={!canRemoveHomeBlock(blocks, block)}
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => removeBlockFromSidebar(block)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                        <Button
                          aria-label="Đưa block lên"
                          className="size-6"
                          disabled={
                            block.type === "hero" ||
                            block.type === "footerCta" ||
                            index <= 1
                          }
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            markEdited(moveItem(blocks, index, index - 1))
                          }
                        >
                          <ChevronUp aria-hidden />
                        </Button>
                        <Button
                          aria-label="Đưa block xuống"
                          className="size-6"
                          disabled={
                            block.type === "hero" ||
                            block.type === "footerCta" ||
                            index >= blocks.length - 2
                          }
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            markEdited(moveItem(blocks, index, index + 1))
                          }
                        >
                          <ChevronDown aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-3">
                <h2 className="text-sm font-semibold">SEO Trang chủ</h2>
                <div className="grid gap-2">
                  <Label htmlFor="home-seo-title">SEO title</Label>
                  <Input
                    id="home-seo-title"
                    value={seoTitle}
                    onChange={(event) => {
                      setSeoTitle(event.target.value);
                      markMetadataEdited();
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="home-seo-description">Description</Label>
                  <textarea
                    className="min-h-20 rounded-md border bg-background p-2 text-xs"
                    id="home-seo-description"
                    value={seoDescription}
                    onChange={(event) => {
                      setSeoDescription(event.target.value);
                      markMetadataEdited();
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="home-canonical">Canonical URL</Label>
                  <Input
                    id="home-canonical"
                    value={canonicalUrl}
                    onChange={(event) => {
                      setCanonicalUrl(event.target.value);
                      markMetadataEdited();
                    }}
                  />
                </div>
                <MediaPickerField
                  id="home-og-image"
                  label="OG image"
                  value={ogImage}
                  onChange={(value) => {
                    setOgImage(value);
                    markMetadataEdited();
                  }}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={robotsIndex}
                    onChange={(event) => {
                      setRobotsIndex(event.target.checked);
                      markMetadataEdited();
                    }}
                  />
                  Cho phép index
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={robotsFollow}
                    onChange={(event) => {
                      setRobotsFollow(event.target.checked);
                      markMetadataEdited();
                    }}
                  />
                  Cho phép follow
                </label>
              </CardContent>
            </Card>
          </aside>

          <div
            className="order-3 min-w-0 xl:overflow-y-auto xl:border-l xl:p-4"
            data-cms-inspector="true"
            data-cms-selected-field-path={selectedFieldPath ?? ""}
          >
            <Card>
              <CardContent className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      {selectedBlock
                        ? homeBlockLabels[selectedBlock.type]
                        : "Không có block"}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bản đang sửa v{workingVersion} · Tự động lưu sau 1,6 giây
                    </p>
                    {selectedVisualFieldTarget ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        <span className="size-1.5 rounded-full bg-primary" />
                        Từ canvas: {selectedVisualFieldTarget.label}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {selectedBlock?.enabled
                      ? "Hiển thị khi xuất bản"
                      : "Đang ẩn"}
                  </span>
                </div>

                {selectedBlock ? (
                  <AdminHomeBlockEditor
                    block={selectedBlock}
                    onChange={updateSelectedBlock}
                  />
                ) : null}

                {validationError ? (
                  <div className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <strong>Chưa thể lưu:</strong> {validationError}
                  </div>
                ) : null}

                {showDebug ? (
                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-xs font-medium">
                      JSON debug (chỉ đọc)
                    </summary>
                    <pre className="mt-3 max-h-96 overflow-auto bg-muted p-3 text-[11px]">
                      {JSON.stringify(selectedBlock, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </CardContent>
            </Card>

            <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-4 backdrop-blur">
              <SaveStatus lastSavedAt={lastSavedAt} state={saveState} />
              <Button
                aria-label="Lưu bản nháp"
                disabled={!workflow.save.available || saveState === "saving"}
                type="button"
                onClick={() => void saveNow(true)}
              >
                <Save aria-hidden />
                {saveState === "saving" ? "Đang lưu…" : "Lưu bản nháp"}
              </Button>
            </div>
          </div>

          <aside
            className={`order-2 grid min-h-0 content-start gap-4 xl:overflow-hidden xl:bg-zinc-950 xl:p-3 ${
              workspaceFocused
                ? "xl:grid-rows-[minmax(0,1fr)]"
                : "xl:grid-rows-[minmax(0,1fr)_auto]"
            }`}
          >
            <ResponsivePreview
              canRedo={canRedoDraft}
              canUndo={canUndoDraft}
              device={previewDevice}
              frameRef={previewFrameRef}
              previewUrl={previewUrl}
              reloadKey={previewReloadKey}
              status={previewConnectionStatus}
              onFrameLoad={() => {
                markPreviewFrameLoaded();
              }}
              onOpen={() => openHomePreview(previewUrl)}
              onRedo={() => navigateDraftHistory("redo")}
              onRetry={retryPreview}
              onUndo={() => navigateDraftHistory("undo")}
              workspaceFocusTriggerRef={workspaceFocusTriggerRef}
              workspaceFocused={workspaceFocused}
              version={workingVersion}
              onDeviceChange={setPreviewDevice}
              onWorkspaceFocusChange={setWorkspaceFocused}
            />

            <Card
              className={workspaceFocused ? "hidden" : undefined}
              data-cms-home-supporting-panel="status"
            >
              <CardContent className="grid gap-3 text-sm">
                <h2 className="font-semibold">Trạng thái</h2>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Bản đang sửa</span>
                  <span>v{workingVersion}</span>
                </div>
                {workflow.unpublish.available ? (
                  <ConfirmDestructiveAction
                    confirmLabel="Hủy xuất bản"
                    confirmVariant="destructive"
                    description="Trang chủ sẽ tạm ngừng hiển thị công khai. Bản nháp và lịch sử phiên bản vẫn được giữ lại."
                    onConfirm={handleUnpublish}
                    pending={unpublishPage.isPending}
                    title="Hủy xuất bản Trang chủ?"
                    trigger={
                      <Button size="sm" type="button" variant="outline">
                        Hủy xuất bản
                      </Button>
                    }
                  />
                ) : null}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Công khai</span>
                  <span data-testid="published-version">
                    {publishedRevision
                      ? `v${publishedRevision.version}`
                      : "Chưa xuất bản"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cập nhật</span>
                  <span className="text-right">
                    {page ? formatDate(page.updatedAt) : "—"}
                  </span>
                </div>
                {page?.scheduledAt ? (
                  <div className="flex items-center justify-between gap-3 border border-info-foreground/20 bg-info p-3 text-xs text-info-foreground">
                    <span>
                      <strong>Đã lên lịch</strong>
                      <br />
                      {formatDate(page.scheduledAt)}
                    </span>
                    {workflow.unschedule.available ? (
                      <Button
                        disabled={unschedulePage.isPending}
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => void handleUnschedule()}
                      >
                        Hủy lịch
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {!workflow.publish.available ? (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Biên tập viên được lưu và xem trước bản nháp; chỉ Quản trị
                    viên hoặc Chủ sở hữu được xuất bản và khôi phục.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card
              className={workspaceFocused ? "hidden" : "scroll-mt-20"}
              data-cms-home-supporting-panel="revisions"
              id="home-revision-history"
            >
              <CardContent className="grid gap-3">
                <div className="flex items-center gap-2">
                  <History aria-hidden className="size-4" />
                  <h2 className="text-sm font-semibold">
                    Phiên bản đã xuất bản
                  </h2>
                </div>
                <CmsRevisionList
                  empty={
                    <p className="text-xs text-muted-foreground">
                      Chưa có phiên bản đã xuất bản.
                    </p>
                  }
                  loading={revisionsQuery.isLoading}
                  renderRevision={(revision) => (
                    <div
                      className="grid gap-2 border-t pt-3 text-xs"
                      data-testid={`revision-v${revision.version}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong>v{revision.version}</strong>
                        <span className="text-muted-foreground">
                          {formatDate(revision.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {revision.note || "Không có ghi chú"}
                      </p>
                      <Button
                        aria-controls={`revision-diff-v${revision.version}`}
                        aria-expanded={comparedRevisionId === revision.id}
                        className="justify-start"
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
                        {comparedRevisionId === revision.id
                          ? "Ẩn thay đổi"
                          : "So sánh với bản nháp"}
                      </Button>
                      {comparedRevisionId === revision.id ? (
                        <HomeRevisionComparison
                          currentBlocks={blocks}
                          currentMetadata={currentRevisionMetadata}
                          revision={revision}
                        />
                      ) : null}
                      {workflow.restore.available ? (
                        <ConfirmDestructiveAction
                          confirmLabel="Khôi phục bản nháp"
                          confirmVariant="default"
                          description={`Nội dung phiên bản v${revision.version} sẽ thay thế bản nháp đang làm việc. Trang chủ công khai chưa thay đổi cho đến khi bạn xuất bản lại.`}
                          pending={restoreRevision.isPending}
                          title={`Khôi phục phiên bản v${revision.version}?`}
                          trigger={
                            <Button
                              className="justify-start"
                              disabled={
                                !page || restoreRevision.isPending || dirty
                              }
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              <RotateCcw aria-hidden /> Khôi phục vào bản nháp
                            </Button>
                          }
                          onConfirm={async () => {
                            if (!page) return;
                            try {
                              const result = await restoreRevision.mutateAsync({
                                pageId: page._id,
                                revisionId: revision.id,
                                expectedVersion: workingVersion,
                              });
                              loadedVersion.current = result.version;
                              reloadAtVersion.current = result.version;
                              setWorkingVersion(result.version);
                              setDirty(false);
                              setSaveState("clean");
                              await invalidateHome(page._id);
                              toast.success(
                                "Đã khôi phục phiên bản vào bản nháp. Nội dung công khai chưa thay đổi.",
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Khôi phục thất bại.",
                              );
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  )}
                  revisions={revisions}
                />
              </CardContent>
            </Card>
          </aside>
        </RemVietEditorShell>
      ) : (
        <Card aria-busy="true">
          <CardContent>
            <p className="text-sm text-muted-foreground" role="status">
              Đang tải bản Trang chủ mới nhất…
            </p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

function revisionBlockChangeLabel(
  status: "added" | "removed" | "modified" | "moved" | "modified-and-moved",
) {
  switch (status) {
    case "added":
      return "Đã thêm sau phiên bản này";
    case "removed":
      return "Đã xóa sau phiên bản này";
    case "modified":
      return "Đã sửa nội dung";
    case "moved":
      return "Đã đổi vị trí";
    case "modified-and-moved":
      return "Đã sửa nội dung và đổi vị trí";
  }
}

function HomeRevisionComparison({
  currentBlocks,
  currentMetadata,
  revision,
}: {
  currentBlocks: readonly HomeBlock[];
  currentMetadata: HomeRevisionMetadata;
  revision: PageRevisionRow;
}) {
  const normalizedRevision = pageRevisionSnapshotSchema.safeParse(
    revision.snapshot,
  );
  if (!normalizedRevision.success) {
    return (
      <div
        className="rounded-md border border-destructive/30 bg-destructive/8 p-3 text-destructive"
        id={`revision-diff-v${revision.version}`}
        role="alert"
      >
        Không thể đọc snapshot của phiên bản này. Hệ thống đã chặn so sánh và
        không thay đổi bản nháp.
      </div>
    );
  }
  const revisionBlocks = homeBlockSchema
    .array()
    .safeParse(normalizedRevision.data.blocks);
  if (!revisionBlocks.success) {
    return (
      <div
        className="rounded-md border border-destructive/30 bg-destructive/8 p-3 text-destructive"
        id={`revision-diff-v${revision.version}`}
        role="alert"
      >
        Không thể đọc snapshot của phiên bản này. Hệ thống đã chặn so sánh và
        không thay đổi bản nháp.
      </div>
    );
  }

  const blockDiff = compareCmsBlockRevisions(
    revisionBlocks.data,
    currentBlocks,
  );
  const metadataDiff = compareCmsRevisionFieldDetails(
    normalizedRevision.data,
    currentMetadata,
    homeRevisionMetadataFields,
  );
  const hasChanges =
    blockDiff.summary.totalChanges > 0 || metadataDiff.length > 0;

  return (
    <section
      aria-label={`Thay đổi từ phiên bản v${revision.version} đến bản nháp hiện tại`}
      className="grid gap-3 rounded-lg border bg-muted/35 p-3"
      id={`revision-diff-v${revision.version}`}
    >
      <div>
        <strong className="text-xs">So với bản nháp hiện tại</strong>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Bao gồm cả thay đổi trên canvas chưa được lưu.
        </p>
      </div>

      {hasChanges ? (
        <>
          <div
            aria-label="Tóm tắt thay đổi section"
            className="flex flex-wrap gap-1.5"
          >
            {blockDiff.summary.added ? (
              <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                +{blockDiff.summary.added} thêm
              </span>
            ) : null}
            {blockDiff.summary.removed ? (
              <span className="rounded-full bg-red-500/12 px-2 py-1 text-[10px] font-medium text-red-700 dark:text-red-300">
                −{blockDiff.summary.removed} xóa
              </span>
            ) : null}
            {blockDiff.summary.modified ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                {blockDiff.summary.modified} sửa
              </span>
            ) : null}
            {blockDiff.summary.moved ? (
              <span className="rounded-full bg-blue-500/12 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                {blockDiff.summary.moved} đổi vị trí
              </span>
            ) : null}
            {metadataDiff.length ? (
              <span className="rounded-full bg-violet-500/12 px-2 py-1 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                {metadataDiff.length} metadata
              </span>
            ) : null}
          </div>

          {blockDiff.changes.length ? (
            <div className="grid gap-1.5">
              {blockDiff.changes.map((change) => (
                <div
                  className="flex items-start justify-between gap-3 rounded-md border bg-background px-2.5 py-2"
                  key={`${change.status}-${change.id}`}
                >
                  <span className="grid gap-0.5">
                    <strong className="text-[11px]">
                      {homeBlockLabels[change.type]}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">
                      {revisionBlockChangeLabel(change.status)}
                    </span>
                  </span>
                  {change.beforeIndex !== null &&
                  change.afterIndex !== null &&
                  change.beforeIndex !== change.afterIndex ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {change.beforeIndex + 1} → {change.afterIndex + 1}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {metadataDiff.length ? (
            <div className="border-t pt-2">
              <strong className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                Metadata đã thay đổi
              </strong>
              <div className="mt-2">
                <RevisionFieldComparison changes={metadataDiff} />
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-md border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2 text-[11px] text-emerald-800 dark:text-emerald-200">
          Bản nháp hiện tại trùng với phiên bản này.
        </p>
      )}
    </section>
  );
}

const previewProfiles = {
  desktop: { label: "Desktop", width: 1440, height: 900, icon: Monitor },
  tablet: { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  mobile: { label: "Mobile", width: 390, height: 844, icon: Smartphone },
} satisfies Record<
  PreviewDevice,
  { label: string; width: number; height: number; icon: typeof Monitor }
>;

function ResponsivePreview({
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
}: {
  canRedo: boolean;
  canUndo: boolean;
  device: PreviewDevice;
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
  onDeviceChange: (device: PreviewDevice) => void;
  onWorkspaceFocusChange: (focused: boolean) => void;
}) {
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
          {(Object.keys(previewProfiles) as PreviewDevice[]).map((key) => {
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

function SaveStatus({
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
