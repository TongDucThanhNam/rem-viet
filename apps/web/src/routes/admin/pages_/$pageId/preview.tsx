import {
  createCmsVisualEditorDuplicateMessage,
  createCmsVisualEditorInsertMessage,
  createCmsVisualEditorMoveMessage,
  createCmsVisualEditorReadyMessage,
  createCmsVisualEditorRemoveMessage,
  createCmsVisualEditorSelectionMessage,
  filterCmsBlockAuthoringCatalog,
  isCmsVisualEditorMessage,
  type CmsVisualEditorStateMessage,
} from "@agency/cms-admin";
import {
  remVietStandardBlockAuthoringByType,
  remVietStandardBlockAuthoringCatalog,
  remVietStandardBlockSchema,
  type RemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { pageBlockListSchema, type PageBlock } from "@rem-viet/cms";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  FileText,
  GripVertical,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import CmsPageBlocks from "@/components/cms-page-blocks";
import { getPreviewAdminUser } from "@/functions/get-preview-admin-user";
import { siteConfig } from "@/lib/site-config";
import { isUnsavedStandardPagePreviewId } from "@/lib/standard-page-preview";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/pages_/$pageId/preview")({
  headers: () => ({
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  }),
  beforeLoad: async () => ({ session: await getPreviewAdminUser() }),
  loader: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/dang-nhap" });
  },
  head: () => ({
    meta: [
      { title: `Xem trước bản nháp trang — ${siteConfig.name} CMS` },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: StandardPagePreviewRoute,
});

type StandardPagePreviewMessage = {
  type: "cms:standard-page-preview";
  pageId: string;
  title: string;
  blocks: PageBlock[];
};

function isStandardPagePreviewMessage(
  value: unknown,
  pageId: string,
): value is StandardPagePreviewMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "cms:standard-page-preview" &&
    candidate.pageId === pageId &&
    typeof candidate.title === "string" &&
    pageBlockListSchema.safeParse(candidate.blocks).success
  );
}

function StandardPagePreviewRoute() {
  const { pageId } = Route.useParams();
  const trpc = useTRPC();
  const isUnsavedPreview = isUnsavedStandardPagePreviewId(pageId);
  const pageQuery = useQuery({
    ...trpc.content.pages.byId.queryOptions({ pageId }),
    enabled: !isUnsavedPreview,
  });
  const page = pageQuery.data?.data;
  const [workingCopy, setWorkingCopy] =
    useState<StandardPagePreviewMessage | null>(null);
  const [visualState, setVisualState] =
    useState<CmsVisualEditorStateMessage<RemVietStandardBlock> | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [composerBlockId, setComposerBlockId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const draggedBlockIdRef = useRef<string | null>(null);

  useEffect(() => {
    const receiveWorkingCopy = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      )
        return;
      if (isStandardPagePreviewMessage(event.data, pageId)) {
        setWorkingCopy(event.data);
        return;
      }
      if (
        isCmsVisualEditorMessage(event.data) &&
        event.data.type === "state" &&
        remVietStandardBlockSchema.array().safeParse(event.data.blocks).success
      ) {
        setVisualState(
          event.data as CmsVisualEditorStateMessage<RemVietStandardBlock>,
        );
      }
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
      if (!sourceId || !target || !targetId || sourceId === targetId) {
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
        (placement === "before" || placement === "after")
      ) {
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage(
          {
            type: "cms:standard-page-preview-intent",
            pageId,
            intent: createCmsVisualEditorMoveMessage(
              sourceId,
              targetId,
              placement,
            ),
          },
          window.location.origin,
        );
      }
      finishDragging();
    };
    window.addEventListener("message", receiveWorkingCopy);
    window.addEventListener("dragover", dragOverBlock, true);
    window.addEventListener("drop", dropBlock, true);
    window.addEventListener("dragend", finishDragging, true);
    window.parent.postMessage(
      { type: "cms:standard-page-preview-ready", pageId },
      window.location.origin,
    );
    window.parent.postMessage(
      createCmsVisualEditorReadyMessage(),
      window.location.origin,
    );
    return () => {
      window.removeEventListener("message", receiveWorkingCopy);
      window.removeEventListener("dragover", dragOverBlock, true);
      window.removeEventListener("drop", dropBlock, true);
      window.removeEventListener("dragend", finishDragging, true);
    };
  }, [pageId]);

  const title = workingCopy?.title || page?.title || "Bản nháp trang";
  const blocks = workingCopy?.blocks ?? page?.blocks;
  const authoringBlocks =
    workingCopy && visualState ? visualState.blocks : null;
  const selectedBlockId = visualState?.selectedBlockId ?? null;
  const selectedFieldPath = visualState?.selectedFieldPath ?? null;
  const filteredCatalog = filterCmsBlockAuthoringCatalog(
    remVietStandardBlockAuthoringCatalog,
    catalogQuery,
  );

  const postAuthoringMessage = (intent: unknown) =>
    window.parent.postMessage(
      { type: "cms:standard-page-preview-intent", pageId, intent },
      window.location.origin,
    );
  const postToolbarIntent = (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    intent: unknown,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    postAuthoringMessage(intent);
  };
  const postToolbarKeyIntent = (
    event: KeyboardEvent<HTMLButtonElement>,
    intent: unknown,
  ) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    postToolbarIntent(event, intent);
  };
  const beginCanvasDrag = (
    event: ReactDragEvent<HTMLButtonElement>,
    blockId: string,
  ) => {
    draggedBlockIdRef.current = blockId;
    setDraggedBlockId(blockId);
    const block = document.querySelector<HTMLElement>(
      `[data-cms-block-id="${CSS.escape(blockId)}"]`,
    );
    if (block) block.dataset.cmsPreviewDragging = "true";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
  };

  return (
    <main
      aria-label="Bản xem trước trực quan trang nội dung"
      className="relative min-h-svh bg-background text-foreground"
    >
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full bg-zinc-950/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg backdrop-blur">
        <LockKeyhole aria-hidden className="size-3.5" />
        {workingCopy
          ? "Bản đang soạn · riêng tư"
          : "Bản nháp đã lưu · riêng tư"}
      </div>

      <header className="border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 pr-52">
          <h1 className="sr-only">Xem trước bản nháp: {title}</h1>
          <Link
            className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
            search={isUnsavedPreview ? {} : { pageId }}
            to="/admin/pages"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Quay lại editor
          </Link>
          <span aria-hidden className="h-4 w-px bg-border" />
          <p className="truncate text-sm text-muted-foreground">{title}</p>
        </div>
      </header>

      {(pageQuery.isLoading || isUnsavedPreview) && !workingCopy ? (
        <div className="grid min-h-[70svh] place-items-center text-sm text-muted-foreground">
          {isUnsavedPreview
            ? "Đang kết nối bản đang soạn…"
            : "Đang tải bản nháp…"}
        </div>
      ) : blocks ? (
        authoringBlocks && authoringBlocks.length === blocks.length ? (
          <div aria-label="Canvas chỉnh sửa trực tiếp">
            {blocks.map((_, index) => {
              const visualBlock = authoringBlocks[index];
              if (!visualBlock) return null;
              const selected = selectedBlockId === visualBlock.id;
              const label =
                remVietStandardBlockAuthoringByType[visualBlock.type].label;
              return (
                <section
                  className="group relative"
                  data-cms-block-id={visualBlock.id}
                  data-cms-preview-block="true"
                  data-cms-preview-selected={selected ? "true" : undefined}
                  data-cms-standard-block={visualBlock.id}
                  key={visualBlock.id}
                >
                  <CmsPageBlocks
                    authoring={{
                      selectedBlockId,
                      selectedFieldPath,
                      onSelect: (blockId, fieldPath) =>
                        postAuthoringMessage(
                          createCmsVisualEditorSelectionMessage(
                            blockId,
                            fieldPath,
                          ),
                        ),
                    }}
                    blocks={[visualBlock]}
                  />
                  {selected ? (
                    <div
                      aria-label={`Công cụ khối ${index + 1}: ${label}`}
                      className="pointer-events-auto absolute right-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-md bg-zinc-950/95 p-1.5 text-white shadow-xl backdrop-blur"
                      role="toolbar"
                    >
                      <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                        {index + 1}. {label}
                      </span>
                      <button
                        aria-label="Kéo khối để sắp xếp trên canvas"
                        className="grid size-7 cursor-grab place-items-center rounded bg-amber-300 text-zinc-950 hover:bg-amber-200 active:cursor-grabbing"
                        data-cms-drag-handle={visualBlock.id}
                        draggable
                        title="Kéo tới khối đích"
                        type="button"
                        onDragEnd={() => {
                          draggedBlockIdRef.current = null;
                          setDraggedBlockId(null);
                        }}
                        onDragStart={(event) =>
                          beginCanvasDrag(event, visualBlock.id)
                        }
                      >
                        <GripVertical aria-hidden className="size-3.5" />
                      </button>
                      <button
                        aria-label="Đưa khối lên"
                        className="grid size-7 place-items-center rounded hover:bg-white/15 disabled:opacity-35"
                        disabled={index === 0}
                        type="button"
                        onMouseDown={(event) =>
                          postToolbarIntent(
                            event,
                            createCmsVisualEditorMoveMessage(
                              visualBlock.id,
                              authoringBlocks[index - 1]!.id,
                              "before",
                            ),
                          )
                        }
                        onKeyDown={(event) =>
                          postToolbarKeyIntent(
                            event,
                            createCmsVisualEditorMoveMessage(
                              visualBlock.id,
                              authoringBlocks[index - 1]!.id,
                              "before",
                            ),
                          )
                        }
                      >
                        <ArrowUp aria-hidden className="size-3.5" />
                      </button>
                      <button
                        aria-label="Đưa khối xuống"
                        className="grid size-7 place-items-center rounded hover:bg-white/15 disabled:opacity-35"
                        disabled={index === blocks.length - 1}
                        type="button"
                        onMouseDown={(event) =>
                          postToolbarIntent(
                            event,
                            createCmsVisualEditorMoveMessage(
                              visualBlock.id,
                              authoringBlocks[index + 1]!.id,
                              "after",
                            ),
                          )
                        }
                        onKeyDown={(event) =>
                          postToolbarKeyIntent(
                            event,
                            createCmsVisualEditorMoveMessage(
                              visualBlock.id,
                              authoringBlocks[index + 1]!.id,
                              "after",
                            ),
                          )
                        }
                      >
                        <ArrowDown aria-hidden className="size-3.5" />
                      </button>
                      <button
                        aria-label="Sao chép khối"
                        className="grid size-7 place-items-center rounded hover:bg-white/15"
                        type="button"
                        onMouseDown={(event) =>
                          postToolbarIntent(
                            event,
                            createCmsVisualEditorDuplicateMessage(
                              visualBlock.id,
                            ),
                          )
                        }
                        onKeyDown={(event) =>
                          postToolbarKeyIntent(
                            event,
                            createCmsVisualEditorDuplicateMessage(
                              visualBlock.id,
                            ),
                          )
                        }
                      >
                        <Copy aria-hidden className="size-3.5" />
                      </button>
                      <button
                        aria-controls={`standard-canvas-catalog-${visualBlock.id}`}
                        aria-expanded={composerBlockId === visualBlock.id}
                        aria-haspopup="dialog"
                        aria-label="Mở danh mục khối sau khối"
                        className="flex h-7 items-center gap-1 rounded px-1.5 text-[10px] hover:bg-white/15"
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setCatalogQuery("");
                          setComposerBlockId((current) =>
                            current === visualBlock.id ? null : visualBlock.id,
                          );
                        }}
                      >
                        <Plus aria-hidden className="size-3" />
                        Thêm khối
                      </button>
                      {composerBlockId === visualBlock.id ? (
                        <div
                          aria-label={`Danh mục khối sau ${label}`}
                          className="absolute right-0 top-full z-50 mt-2 grid w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-left text-white shadow-2xl"
                          id={`standard-canvas-catalog-${visualBlock.id}`}
                          role="dialog"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <label
                            className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300"
                            htmlFor={`standard-canvas-catalog-search-${visualBlock.id}`}
                          >
                            Tìm loại khối
                          </label>
                          <div className="relative">
                            <Search
                              aria-hidden
                              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400"
                            />
                            <input
                              autoFocus
                              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-8 pr-3 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-amber-300"
                              id={`standard-canvas-catalog-search-${visualBlock.id}`}
                              placeholder="Tên, mục đích hoặc từ khóa…"
                              type="search"
                              value={catalogQuery}
                              onChange={(event) =>
                                setCatalogQuery(event.target.value)
                              }
                            />
                          </div>
                          {filteredCatalog.length ? (
                            <div className="grid gap-1.5">
                              {filteredCatalog.map((definition) => (
                                <button
                                  aria-label={`Thêm ${definition.label.toLocaleLowerCase("vi-VN")} sau khối`}
                                  className="grid gap-0.5 rounded-md border border-zinc-800 p-2.5 text-left hover:border-amber-300/70 hover:bg-white/10"
                                  key={definition.type}
                                  type="button"
                                  onMouseDown={(event) => {
                                    postToolbarIntent(
                                      event,
                                      createCmsVisualEditorInsertMessage(
                                        definition.type,
                                        visualBlock.id,
                                        "after",
                                      ),
                                    );
                                    setComposerBlockId(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (
                                      event.repeat ||
                                      (event.key !== "Enter" &&
                                        event.key !== " ")
                                    )
                                      return;
                                    postToolbarIntent(
                                      event,
                                      createCmsVisualEditorInsertMessage(
                                        definition.type,
                                        visualBlock.id,
                                        "after",
                                      ),
                                    );
                                    setComposerBlockId(null);
                                  }}
                                >
                                  <span className="text-xs font-semibold">
                                    {definition.label}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wider text-amber-300">
                                    {definition.category}
                                  </span>
                                  <span className="text-[11px] leading-4 text-zinc-300">
                                    {definition.description}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-md border border-dashed border-zinc-700 p-3 text-xs text-zinc-400">
                              Không có loại khối phù hợp.
                            </p>
                          )}
                        </div>
                      ) : null}
                      <button
                        aria-label="Xóa khối"
                        className="grid size-7 place-items-center rounded text-red-300 hover:bg-red-500/20 disabled:opacity-35"
                        disabled={blocks.length === 1}
                        type="button"
                        onMouseDown={(event) =>
                          postToolbarIntent(
                            event,
                            createCmsVisualEditorRemoveMessage(visualBlock.id),
                          )
                        }
                        onKeyDown={(event) =>
                          postToolbarKeyIntent(
                            event,
                            createCmsVisualEditorRemoveMessage(visualBlock.id),
                          )
                        }
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                      <span className="sr-only" aria-live="polite">
                        {draggedBlockId === visualBlock.id
                          ? `Đang kéo khối ${index + 1}: ${label}`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <CmsPageBlocks blocks={blocks} />
        )
      ) : (
        <div className="mx-auto grid min-h-[70svh] max-w-3xl place-items-center px-4 text-center">
          <div className="grid justify-items-center gap-3">
            <FileText aria-hidden className="size-8 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Không tìm thấy bản nháp</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Trang này không còn tồn tại hoặc bạn không có quyền xem.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
