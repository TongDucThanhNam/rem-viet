import { homeBlockSchema, type HomeBlock, type PageBlock } from "@rem-viet/cms";
import { filterCmsBlockAuthoringCatalog } from "@agency/cms-admin";
import {
  createCmsVisualEditorDuplicateMessage,
  createCmsVisualEditorInsertMessage,
  createCmsVisualEditorMoveMessage,
  createCmsVisualEditorRemoveMessage,
  createCmsVisualEditorSelectionMessage,
  createCmsVisualPreviewEnvelope,
  createCmsVisualPreviewResponseHeaders,
  initialCmsVisualPreviewReplayState,
  isCmsVisualEditorMessage,
  validateCmsVisualPreviewEnvelope,
  type CmsVisualEditorMessage,
  type CmsVisualPreviewIdentity,
  type CmsVisualPreviewPayload,
} from "@agency/cms-visual-editor";
import {
  remVietTemplateAuthoringCatalog,
  remVietTemplateBlockLabels as homeBlockLabels,
} from "@agency/cms-template-rem-viet";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";

import { HomepageRenderer } from "@/components/landing/homepage-renderer";
import { getPreviewAdminUser } from "@/functions/get-preview-admin-user";
import {
  canDuplicateHomeBlock,
  canRemoveHomeBlock,
  getInsertableHomeBlockTypes,
  isPinnedHomeBlock,
} from "@/lib/home-visual-order";
import { siteConfig, siteManifest } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/home-preview")({
  validateSearch: (search: Record<string, unknown>) => ({
    cmsBinding: typeof search.cmsBinding === "string" ? search.cmsBinding : "",
    cmsConflict:
      typeof search.cmsConflict === "string" ? search.cmsConflict : "",
    cmsSession: typeof search.cmsSession === "string" ? search.cmsSession : "",
  }),
  headers: () =>
    createCmsVisualPreviewResponseHeaders({ frameAncestors: ["'self'"] }),
  beforeLoad: async ({ search }) => {
    const session = await getPreviewAdminUser();
    if (!session) throw redirect({ to: "/dang-nhap" });
    const hasChannel = Boolean(
      search.cmsBinding || search.cmsConflict || search.cmsSession,
    );
    if (
      hasChannel &&
      (!search.cmsBinding ||
        !search.cmsConflict ||
        !search.cmsSession ||
        search.cmsBinding !== session.previewSessionBinding)
    ) {
      throw redirect({ to: "/admin/home" });
    }
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
  head: () => ({
    meta: [
      { title: `Xem trước bản nháp Trang chủ — ${siteConfig.name} CMS` },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: HomePreviewRoute,
});

type PreviewPage = {
  _id: string;
  title: string;
  blocks: PageBlock[];
  slug: string;
};

function previewBlocks(page?: PreviewPage) {
  const blocks: HomeBlock[] = [];

  for (const candidate of page?.blocks ?? []) {
    const result = homeBlockSchema.safeParse(candidate);
    if (!result.success) continue;
    blocks.push(result.data);
  }

  return blocks;
}

function HomePreviewRoute() {
  const search = Route.useSearch();
  const trpc = useTRPC();
  const pagesQuery = useQuery(trpc.content.pages.adminList.queryOptions({}));
  const pages = (pagesQuery.data ?? []) as PreviewPage[];
  const page = pages.find((candidate) => candidate.slug === "home");
  const [liveBlocks, setLiveBlocks] = useState<HomeBlock[] | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedFieldPath, setSelectedFieldPath] = useState<string | null>(
    null,
  );
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [studioConnected, setStudioConnected] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [toolbarPosition, setToolbarPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const fieldHintRef = useRef<HTMLDivElement>(null);
  const draggedBlockIdRef = useRef<string | null>(null);
  const previewSequence = useRef(0);
  const previewReplay = useRef(initialCmsVisualPreviewReplayState());
  const previewIdentity = useRef<CmsVisualPreviewIdentity>({
    siteId: siteManifest.id,
    documentId: "home",
    documentType: "homepage",
    sessionId: search.cmsSession,
    sessionBinding: search.cmsBinding,
    documentVersion: 0,
    conflictToken: search.cmsConflict,
  });
  const channelActive = Boolean(
    search.cmsBinding && search.cmsConflict && search.cmsSession,
  );
  const postPreviewPayload = useCallback(
    (payload: CmsVisualPreviewPayload) => {
      if (!channelActive || window.parent === window) return;
      const sequence = ++previewSequence.current;
      window.parent.postMessage(
        createCmsVisualPreviewEnvelope({
          source: "preview",
          messageId: `${previewIdentity.current.sessionId}:preview:${sequence}`,
          sequence,
          identity: previewIdentity.current,
          payload,
        }),
        window.location.origin,
      );
    },
    [channelActive],
  );
  const postPreviewCommand = useCallback(
    (command: CmsVisualEditorMessage) =>
      postPreviewPayload({ type: "command", command }),
    [postPreviewPayload],
  );
  const displayedBlocks = useMemo(
    () => liveBlocks ?? previewBlocks(page),
    [liveBlocks, page],
  );
  const selectedBlock = displayedBlocks.find(
    (block) => block.id === selectedBlockId,
  );
  const selectedIndex = selectedBlock
    ? displayedBlocks.findIndex((block) => block.id === selectedBlock.id)
    : -1;
  const selectedBlockMovable = selectedBlock
    ? !isPinnedHomeBlock(selectedBlock)
    : false;
  const insertableBlockTypes = getInsertableHomeBlockTypes(displayedBlocks);
  const insertableCatalog = remVietTemplateAuthoringCatalog.filter(({ type }) =>
    insertableBlockTypes.includes(type),
  );
  const filteredCatalog = filterCmsBlockAuthoringCatalog(
    insertableCatalog,
    catalogQuery,
  );
  const selectedBlockDuplicable = selectedBlock
    ? canDuplicateHomeBlock(displayedBlocks, selectedBlock)
    : false;
  const selectedBlockRemovable = selectedBlock
    ? canRemoveHomeBlock(displayedBlocks, selectedBlock)
    : false;

  useEffect(() => {
    const receiveState = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      )
        return;
      const validation = validateCmsVisualPreviewEnvelope({
        value: event.data,
        origin: event.origin,
        allowedOrigins: new Set([window.location.origin]),
        expectedSource: "host",
        expectedIdentity: previewIdentity.current,
        replay: previewReplay.current,
      });
      if (!validation.accepted) return;
      previewReplay.current = validation.replay;
      const payload = validation.envelope.payload;
      if (
        payload.type !== "state" ||
        !isCmsVisualEditorMessage(payload.state) ||
        payload.state.type !== "state"
      )
        return;
      const message = payload.state;
      const parsed = homeBlockSchema.array().safeParse(message.blocks);
      if (!parsed.success) return;
      previewIdentity.current = {
        ...previewIdentity.current,
        documentVersion: message.revision,
      };
      setLiveBlocks(parsed.data);
      setSelectedBlockId(
        parsed.data.some((block) => block.id === message.selectedBlockId)
          ? message.selectedBlockId
          : null,
      );
      setSelectedFieldPath(message.selectedFieldPath);
      setSelectionRevision(message.selectionRevision);
      setComposerOpen(false);
      setCatalogQuery("");
      setStudioConnected(true);
    };
    const selectPreviewTarget = (event: MouseEvent | PointerEvent) => {
      if (window.parent === window) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const block = target.closest<HTMLElement>("[data-cms-preview-block]");
      const blockId = block?.dataset.cmsBlockId;
      if (!blockId) return;
      const field = target.closest<HTMLElement>("[data-cms-preview-field]");
      const fieldPath = field?.dataset.cmsFieldPath;
      event.preventDefault();
      event.stopPropagation();
      setSelectedBlockId(blockId);
      setSelectedFieldPath(fieldPath ?? null);
      postPreviewCommand(
        createCmsVisualEditorSelectionMessage(blockId, fieldPath),
      );
    };
    const selectBlockWithPointer = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-cms-preview-field]")
      )
        return;
      selectPreviewTarget(event);
    };
    const selectBlockWithClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (
        event.detail !== 0 &&
        !(
          target instanceof Element &&
          target.closest("[data-cms-preview-field]")
        )
      )
        return;
      selectPreviewTarget(event);
    };
    const updateFieldHint = (event: PointerEvent) => {
      const hint = fieldHintRef.current;
      if (!hint) return;
      const target = event.target;
      const field =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-cms-preview-field]")
          : null;
      const label = field?.dataset.cmsFieldLabel;
      if (!label) {
        hint.style.opacity = "0";
        hint.dataset.cmsFieldLabel = "";
        return;
      }
      const labelNode = hint.querySelector<HTMLElement>(
        "[data-cms-field-hint-label]",
      );
      if (labelNode) labelNode.textContent = label;
      hint.dataset.cmsFieldLabel = label;
      hint.style.left = `${Math.min(event.clientX + 16, window.innerWidth - 220)}px`;
      hint.style.top = `${Math.min(event.clientY + 16, window.innerHeight - 52)}px`;
      hint.style.opacity = "1";
    };
    const hideFieldHint = () => {
      if (!fieldHintRef.current) return;
      fieldHintRef.current.style.opacity = "0";
      fieldHintRef.current.dataset.cmsFieldLabel = "";
    };
    const clearDropMarkers = () => {
      for (const block of document.querySelectorAll<HTMLElement>(
        "[data-cms-drop-placement]",
      )) {
        delete block.dataset.cmsDropPlacement;
      }
    };
    const finishDragging = () => {
      clearDropMarkers();
      for (const block of document.querySelectorAll<HTMLElement>(
        "[data-cms-preview-dragging]",
      )) {
        delete block.dataset.cmsPreviewDragging;
      }
      draggedBlockIdRef.current = null;
      setDraggedBlockId(null);
    };
    const dragOverBlock = (event: DragEvent) => {
      const sourceId = draggedBlockIdRef.current;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-cms-preview-block]")
          : null;
      const targetId = target?.dataset.cmsBlockId;
      if (
        !sourceId ||
        !target ||
        !targetId ||
        sourceId === targetId ||
        target.dataset.cmsPreviewMovable !== "true"
      ) {
        clearDropMarkers();
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      clearDropMarkers();
      const bounds = target.getBoundingClientRect();
      target.dataset.cmsDropPlacement =
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    };
    const dropBlock = (event: DragEvent) => {
      const sourceId = draggedBlockIdRef.current;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-cms-preview-block]")
          : null;
      const targetId = target?.dataset.cmsBlockId;
      const placement = target?.dataset.cmsDropPlacement;
      if (
        sourceId &&
        targetId &&
        sourceId !== targetId &&
        target?.dataset.cmsPreviewMovable === "true" &&
        (placement === "before" || placement === "after")
      ) {
        event.preventDefault();
        event.stopPropagation();
        postPreviewCommand(
          createCmsVisualEditorMoveMessage(sourceId, targetId, placement),
        );
        setSelectedBlockId(sourceId);
        setSelectedFieldPath(null);
      }
      finishDragging();
    };

    window.addEventListener("message", receiveState);
    window.addEventListener("pointerdown", selectBlockWithPointer, true);
    window.addEventListener("click", selectBlockWithClick, true);
    window.addEventListener("dragover", dragOverBlock, true);
    window.addEventListener("drop", dropBlock, true);
    window.addEventListener("dragend", finishDragging, true);
    window.addEventListener("pointermove", updateFieldHint, true);
    window.addEventListener("pointerleave", hideFieldHint);
    if (window.parent !== window) {
      postPreviewPayload({ type: "ready" });
    }
    return () => {
      window.removeEventListener("message", receiveState);
      window.removeEventListener("pointerdown", selectBlockWithPointer, true);
      window.removeEventListener("click", selectBlockWithClick, true);
      window.removeEventListener("dragover", dragOverBlock, true);
      window.removeEventListener("drop", dropBlock, true);
      window.removeEventListener("dragend", finishDragging, true);
      window.removeEventListener("pointermove", updateFieldHint, true);
      window.removeEventListener("pointerleave", hideFieldHint);
    };
  }, [postPreviewCommand, postPreviewPayload]);

  useEffect(() => {
    if (!selectedBlockId) {
      setToolbarPosition(null);
      return;
    }
    let frame = 0;
    const selected = document.querySelector<HTMLElement>(
      `[data-cms-block-id="${CSS.escape(selectedBlockId)}"]`,
    );
    if (!selected) {
      setToolbarPosition(null);
      return;
    }
    const updatePosition = () => {
      const bounds = selected.getBoundingClientRect();
      setToolbarPosition({
        left: Math.max(12, Math.min(window.innerWidth - 372, bounds.left + 12)),
        top: Math.max(12, Math.min(window.innerHeight - 56, bounds.top + 12)),
      });
    };
    const schedulePosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    updatePosition();
    const observer = new ResizeObserver(schedulePosition);
    observer.observe(selected);
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
    };
  }, [displayedBlocks, selectedBlockId]);

  const postMove = (targetBlockId: string, placement: "before" | "after") => {
    if (!selectedBlock || window.parent === window) return;
    postPreviewCommand(
      createCmsVisualEditorMoveMessage(
        selectedBlock.id,
        targetBlockId,
        placement,
      ),
    );
    setSelectedFieldPath(null);
  };

  const postInsert = (blockType: HomeBlock["type"]) => {
    if (!selectedBlock || window.parent === window) return;
    postPreviewCommand(
      createCmsVisualEditorInsertMessage(
        blockType,
        selectedBlock.id,
        selectedBlock.type === "footerCta" ? "before" : "after",
      ),
    );
    setComposerOpen(false);
    setCatalogQuery("");
    setSelectedFieldPath(null);
  };

  const postDuplicate = () => {
    if (!selectedBlock || !selectedBlockDuplicable || window.parent === window)
      return;
    postPreviewCommand(createCmsVisualEditorDuplicateMessage(selectedBlock.id));
    setSelectedFieldPath(null);
  };

  const postRemove = () => {
    if (!selectedBlock || !selectedBlockRemovable || window.parent === window)
      return;
    postPreviewCommand(createCmsVisualEditorRemoveMessage(selectedBlock.id));
    setComposerOpen(false);
    setCatalogQuery("");
    setSelectedFieldPath(null);
  };

  const beginCanvasDrag = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!selectedBlock || !selectedBlockMovable) {
      event.preventDefault();
      return;
    }
    draggedBlockIdRef.current = selectedBlock.id;
    setDraggedBlockId(selectedBlock.id);
    const selectedElement = document.querySelector<HTMLElement>(
      `[data-cms-block-id="${CSS.escape(selectedBlock.id)}"]`,
    );
    if (selectedElement) selectedElement.dataset.cmsPreviewDragging = "true";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selectedBlock.id);
  };
  const visibleBlocks = displayedBlocks.filter((block) => block.enabled);
  const visibleSelectedIndex = selectedBlock
    ? visibleBlocks.findIndex((block) => block.id === selectedBlock.id)
    : -1;
  const previousMoveTarget =
    visibleSelectedIndex > 1
      ? visibleBlocks[visibleSelectedIndex - 1]
      : undefined;
  const nextMoveTarget =
    visibleSelectedIndex >= 0 && visibleSelectedIndex < visibleBlocks.length - 2
      ? visibleBlocks[visibleSelectedIndex + 1]
      : undefined;

  if (pagesQuery.isLoading) {
    return (
      <main
        aria-label="Đang tải bản xem trước Trang chủ"
        className="grid h-dvh place-items-center bg-black text-sm text-white"
      >
        Đang tải bản nháp…
      </main>
    );
  }

  if (pagesQuery.isError) {
    return (
      <main
        aria-label="Lỗi bản xem trước Trang chủ"
        className="grid h-dvh place-items-center bg-black px-6 text-center text-sm text-white"
      >
        Không tải được bản nháp. Hãy quay lại trình biên tập và thử lại.
      </main>
    );
  }

  return (
    <>
      <aside
        aria-label="Trạng thái preview"
        className="fixed right-4 top-4 z-[10001] rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur"
      >
        {studioConnected
          ? "Studio trực quan · cập nhật trực tiếp"
          : "Xem trước bản nháp · riêng tư"}
      </aside>
      {selectedBlock && toolbarPosition ? (
        <div
          aria-label={`Sắp xếp ${homeBlockLabels[selectedBlock.type]}`}
          className="fixed z-[10003] flex max-w-[360px] items-center gap-1 rounded-lg border border-white/15 bg-black/90 p-1.5 font-vietnam text-white shadow-2xl backdrop-blur-md"
          data-cms-section-toolbar="true"
          data-cms-toolbar-block-id={selectedBlock.id}
          data-cms-toolbar-dragging={
            draggedBlockId === selectedBlock.id ? "true" : "false"
          }
          role="toolbar"
          style={toolbarPosition}
        >
          <span className="max-w-32 truncate px-2 text-[10px] font-semibold tracking-[0.08em] uppercase">
            {selectedIndex + 1}. {homeBlockLabels[selectedBlock.type]}
          </span>
          {selectedBlockMovable ? (
            <>
              <button
                aria-label="Đưa section lên trên canvas"
                className="grid size-8 place-items-center rounded-md text-white/75 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                disabled={!previousMoveTarget}
                type="button"
                onClick={() => {
                  if (previousMoveTarget)
                    postMove(previousMoveTarget.id, "before");
                }}
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                aria-label="Đưa section xuống dưới canvas"
                className="grid size-8 place-items-center rounded-md text-white/75 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                disabled={!nextMoveTarget}
                type="button"
                onClick={() => {
                  if (nextMoveTarget) postMove(nextMoveTarget.id, "after");
                }}
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
              <button
                aria-label="Kéo section để sắp xếp trên canvas"
                className="grid size-8 cursor-grab place-items-center rounded-md bg-brand text-black transition hover:brightness-110 active:cursor-grabbing"
                draggable
                title="Kéo tới section đích"
                type="button"
                onDragEnd={() => {
                  draggedBlockIdRef.current = null;
                  setDraggedBlockId(null);
                }}
                onDragStart={beginCanvasDrag}
              >
                <GripVertical aria-hidden className="size-4" />
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 rounded-md bg-white/8 px-2 py-1.5 text-[10px] text-white/65">
              <LockKeyhole aria-hidden className="size-3.5" /> Vùng cố định
            </span>
          )}
          <button
            aria-controls="canvas-section-catalog"
            aria-expanded={composerOpen}
            aria-label="Thêm section trên canvas"
            className="grid size-8 place-items-center rounded-md text-white/75 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            disabled={insertableBlockTypes.length === 0}
            type="button"
            onClick={() => setComposerOpen((open) => !open)}
          >
            <Plus aria-hidden className="size-4" />
          </button>
          <button
            aria-label="Nhân bản section trên canvas"
            className="grid size-8 place-items-center rounded-md text-white/75 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            disabled={!selectedBlockDuplicable}
            type="button"
            onClick={postDuplicate}
          >
            <Copy aria-hidden className="size-4" />
          </button>
          <button
            aria-label="Xóa section trên canvas"
            className="grid size-8 place-items-center rounded-md text-red-300 transition hover:bg-red-500/15 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={!selectedBlockRemovable}
            type="button"
            onClick={postRemove}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
      {selectedBlock && toolbarPosition && composerOpen ? (
        <div
          aria-label="Danh mục section được phép"
          className="fixed z-[10004] grid w-[min(24rem,calc(100vw-1rem))] gap-2 rounded-xl border border-white/15 bg-black/94 p-2.5 font-vietnam text-white shadow-2xl backdrop-blur-md"
          data-cms-section-composer="true"
          id="canvas-section-catalog"
          role="dialog"
          style={{
            left: toolbarPosition.left,
            top: Math.max(
              8,
              Math.min(window.innerHeight - 430, toolbarPosition.top + 48),
            ),
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            setComposerOpen(false);
            setCatalogQuery("");
          }}
        >
          <span className="px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-white/50 uppercase">
            Thêm sau {homeBlockLabels[selectedBlock.type]}
          </span>
          <label className="relative block">
            <span className="sr-only">Tìm section</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/45"
            />
            <input
              autoFocus
              className="h-9 w-full rounded-md border border-white/15 bg-white/8 pr-3 pl-8 text-xs text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/10"
              placeholder="Tìm theo tên hoặc mục đích…"
              type="search"
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
            />
          </label>
          <div className="grid max-h-80 gap-1 overflow-y-auto pr-0.5">
            {filteredCatalog.map((definition) => (
              <button
                className="grid gap-1 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition hover:border-white/15 hover:bg-white/10 focus-visible:border-white/30 focus-visible:bg-white/10 focus-visible:outline-none"
                key={definition.type}
                type="button"
                onClick={() => postInsert(definition.type)}
              >
                <span className="text-[9px] font-semibold tracking-[0.12em] text-brand uppercase">
                  {definition.category}
                </span>
                <strong className="text-xs font-semibold text-white">
                  {definition.label}
                </strong>
                <span className="text-[11px] leading-relaxed text-white/55">
                  {definition.description}
                </span>
              </button>
            ))}
            {filteredCatalog.length === 0 ? (
              <p className="px-2 py-5 text-center text-xs text-white/45">
                Không tìm thấy section phù hợp.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[10002] flex items-center gap-2 rounded-full border border-white/15 bg-black/88 px-3 py-2 font-vietnam text-[10px] tracking-[0.08em] text-white opacity-0 shadow-2xl backdrop-blur-md transition-opacity duration-150"
        data-cms-field-hint="true"
        data-cms-field-label=""
        ref={fieldHintRef}
      >
        <span className="rounded-full bg-brand px-1.5 py-0.5 font-semibold text-black uppercase">
          Chỉnh
        </span>
        <strong className="font-medium" data-cms-field-hint-label />
      </div>
      <HomepageRenderer
        blocks={displayedBlocks}
        preview
        studioSelectedBlockId={selectedBlockId}
        studioSelectedFieldPath={selectedFieldPath}
        studioSelectionRevision={selectionRevision}
      />
    </>
  );
}
