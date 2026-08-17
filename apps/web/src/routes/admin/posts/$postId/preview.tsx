import { parseRichTextDocument } from "@rem-viet/cms";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  FileText,
  GripVertical,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import PostContent from "@/components/post-content";
import { getPreviewAdminUser } from "@/functions/get-preview-admin-user";
import {
  isPostPreviewField,
  isPostPreviewMessage,
  type PostPreviewField,
  type PostPreviewMessage,
} from "@/lib/post-preview";
import type { PostRichTextCompositionCommand } from "@/lib/post-rich-text-composition";
import { cloudflareImageUrl, siteConfig } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/posts/$postId/preview")({
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
      { title: `Xem trước bản nháp bài viết — ${siteConfig.name} CMS` },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: PostPreviewRoute,
});

const blogThemeStyle = {
  "--bg-color": "#111111",
  "--text-color": "#F8F5EF",
  "--accent": "#D6BB82",
  "--accent-soft": "#E2C896",
} as CSSProperties;

function formatDate(value?: string) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function postBlockLabel(type: string) {
  return (
    {
      paragraph: "Đoạn văn",
      heading: "Tiêu đề",
      quote: "Trích dẫn",
      list: "Danh sách",
      code: "Code",
      image: "Ảnh",
      video: "Video",
    }[type] ?? "Nội dung"
  );
}

function PostPreviewRoute() {
  const { postId } = Route.useParams();
  const trpc = useTRPC();
  const postQuery = useQuery(trpc.content.posts.byId.queryOptions({ postId }));
  const post = postQuery.data?.data;
  const [workingCopy, setWorkingCopy] = useState<PostPreviewMessage | null>(
    null,
  );
  const fieldHintRef = useRef<HTMLDivElement>(null);
  const draggedPostBlockRef = useRef<{ id: string; index: number } | null>(
    null,
  );
  const previewPost = workingCopy?.values ?? post;
  const coverImage = previewPost?.coverImage
    ? cloudflareImageUrl(previewPost.coverImage)
    : "";
  const sendComposition = useCallback(
    (command: PostRichTextCompositionCommand) => {
      if (!workingCopy) return;
      window.parent.postMessage(
        {
          type: "cms:post-preview-compose",
          postId,
          content: workingCopy.values.content,
          command,
        },
        window.location.origin,
      );
    },
    [postId, workingCopy],
  );

  useEffect(() => {
    const receiveWorkingCopy = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        !isPostPreviewMessage(event.data, postId)
      )
        return;
      setWorkingCopy(event.data);
    };
    window.addEventListener("message", receiveWorkingCopy);
    window.parent.postMessage(
      { type: "cms:post-preview-ready", postId },
      window.location.origin,
    );
    return () => window.removeEventListener("message", receiveWorkingCopy);
  }, [postId]);

  useEffect(() => {
    if (!workingCopy) return;
    const selectField = (event: MouseEvent | KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        event instanceof KeyboardEvent &&
        (event.repeat || (event.key !== "Enter" && event.key !== " "))
      )
        return;
      const action = target.closest<HTMLElement>("[data-cms-post-action]");
      if (action) {
        if (event instanceof KeyboardEvent) return;
        const targetIndex = Number(action.dataset.cmsPostBlockIndex);
        const targetId = action.dataset.cmsPostBlockId;
        if (!Number.isInteger(targetIndex) || !targetId) return;
        const actionName = action.dataset.cmsPostAction;
        event.preventDefault();
        event.stopPropagation();
        if (actionName === "move-up" && targetIndex > 0)
          sendComposition({
            type: "move",
            sourceId: targetId,
            sourceIndex: targetIndex,
            targetId: workingCopy.values.content
              ? (parseRichTextDocument(workingCopy.values.content)?.blocks[
                  targetIndex - 1
                ]?.id ?? "")
              : "",
            targetIndex: targetIndex - 1,
            placement: "before",
          });
        if (actionName === "move-down")
          sendComposition({
            type: "move",
            sourceId: targetId,
            sourceIndex: targetIndex,
            targetId:
              parseRichTextDocument(workingCopy.values.content)?.blocks[
                targetIndex + 1
              ]?.id ?? "",
            targetIndex: targetIndex + 1,
            placement: "after",
          });
        if (actionName === "insert-after")
          sendComposition({
            type: "insert-paragraph",
            targetId,
            targetIndex,
            placement: "after",
          });
        if (actionName === "duplicate")
          sendComposition({ type: "duplicate", targetId, targetIndex });
        if (actionName === "remove")
          sendComposition({ type: "remove", targetId, targetIndex });
        return;
      }
      const field = target.closest<HTMLElement>("[data-cms-post-field]");
      const fieldName = field?.dataset.cmsPostField;
      if (!isPostPreviewField(fieldName)) return;
      const block = target.closest<HTMLElement>("[data-cms-post-block-index]");
      const blockIndex = block
        ? Number(block.dataset.cmsPostBlockIndex)
        : undefined;
      const blockId = block?.dataset.cmsPostBlockId;
      event.preventDefault();
      event.stopPropagation();
      setWorkingCopy((current) =>
        current
          ? {
              ...current,
              selectedField: fieldName,
              selectedBlockIndex:
                Number.isInteger(blockIndex) &&
                blockId &&
                fieldName === "content"
                  ? blockIndex!
                  : null,
            }
          : current,
      );
      window.parent.postMessage(
        {
          type: "cms:post-preview-select",
          postId,
          field: fieldName,
          ...(Number.isInteger(blockIndex) && blockId && fieldName === "content"
            ? { blockId, blockIndex, content: workingCopy.values.content }
            : {}),
        },
        window.location.origin,
      );
    };
    const updateFieldHint = (event: PointerEvent) => {
      const hint = fieldHintRef.current;
      if (!hint) return;
      const target = event.target;
      const field =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-cms-post-field]")
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
    document.addEventListener("click", selectField, true);
    document.addEventListener("keydown", selectField, true);
    document.addEventListener("pointermove", updateFieldHint, true);
    document.addEventListener("pointerleave", hideFieldHint, true);
    return () => {
      document.removeEventListener("click", selectField, true);
      document.removeEventListener("keydown", selectField, true);
      document.removeEventListener("pointermove", updateFieldHint, true);
      document.removeEventListener("pointerleave", hideFieldHint, true);
    };
  }, [postId, sendComposition, workingCopy]);

  useEffect(() => {
    if (!workingCopy) return;
    const clearDropEdges = () =>
      document
        .querySelectorAll("[data-cms-drop-active]")
        .forEach((edge) => edge.removeAttribute("data-cms-drop-active"));
    const dragOverBlock = (event: DragEvent) => {
      const source = draggedPostBlockRef.current;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              '[data-cms-preview-field="true"][data-cms-post-block-index]',
            )
          : null;
      const targetIndex = Number(target?.dataset.cmsPostBlockIndex);
      const targetId = target?.dataset.cmsPostBlockId;
      if (
        source === null ||
        !target ||
        !Number.isInteger(targetIndex) ||
        !targetId ||
        source.index === targetIndex
      ) {
        clearDropEdges();
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      clearDropEdges();
      const bounds = target.getBoundingClientRect();
      const placement =
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      target
        .querySelector<HTMLElement>(
          `[data-cms-post-drop-placement="${placement}"]`,
        )
        ?.setAttribute("data-cms-drop-active", "true");
    };
    const dropBlock = (event: DragEvent) => {
      const source = draggedPostBlockRef.current;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              '[data-cms-preview-field="true"][data-cms-post-block-index]',
            )
          : null;
      const targetIndex = Number(target?.dataset.cmsPostBlockIndex);
      const targetId = target?.dataset.cmsPostBlockId;
      const activeEdge = target?.querySelector<HTMLElement>(
        "[data-cms-drop-active]",
      );
      const placement = activeEdge?.dataset.cmsPostDropPlacement;
      if (
        source !== null &&
        Number.isInteger(targetIndex) &&
        targetId &&
        source.index !== targetIndex &&
        (placement === "before" || placement === "after")
      ) {
        event.preventDefault();
        event.stopPropagation();
        sendComposition({
          type: "move",
          sourceId: source.id,
          sourceIndex: source.index,
          targetId,
          targetIndex,
          placement,
        });
      }
      draggedPostBlockRef.current = null;
      clearDropEdges();
    };
    const finishDrag = () => {
      draggedPostBlockRef.current = null;
      clearDropEdges();
    };
    window.addEventListener("dragover", dragOverBlock, true);
    window.addEventListener("drop", dropBlock, true);
    window.addEventListener("dragend", finishDrag, true);
    return () => {
      window.removeEventListener("dragover", dragOverBlock, true);
      window.removeEventListener("drop", dropBlock, true);
      window.removeEventListener("dragend", finishDrag, true);
    };
  }, [sendComposition, workingCopy]);

  const authoringFieldProps = (field: PostPreviewField, label: string) =>
    workingCopy
      ? {
          "aria-label": `Chỉnh ${label}`,
          "data-cms-field-label": label,
          "data-cms-post-field": field,
          "data-cms-preview-field": "true",
          "data-cms-preview-field-selected":
            workingCopy.selectedField === field ? "true" : undefined,
          role: "button" as const,
          tabIndex: 0,
        }
      : {};

  return (
    <main
      aria-label="Bản xem trước trực quan bài viết"
      className="relative min-h-svh overflow-hidden bg-[#111] text-[#F8F5EF]"
      style={blogThemeStyle}
    >
      <div className="noise-overlay" />
      <div className="vignette-overlay" />
      <div className="fixed right-4 top-4 z-[10001] rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
        {workingCopy
          ? "Bản đang soạn · riêng tư"
          : "Bản nháp đã lưu · riêng tư"}
      </div>
      {workingCopy ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[10002] flex items-center gap-2 rounded-full border border-white/15 bg-black/88 px-3 py-2 font-vietnam text-[10px] uppercase tracking-[0.08em] text-white opacity-0 shadow-2xl backdrop-blur-md transition-opacity duration-150"
          data-cms-field-hint="true"
          data-cms-field-label=""
          ref={fieldHintRef}
        >
          <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-semibold text-black">
            Chỉnh
          </span>
          <strong className="font-medium" data-cms-field-hint-label />
        </div>
      ) : null}

      <article className="relative z-10 mx-auto max-w-[1180px] px-[4vw] pb-28 pt-[12vh]">
        <Link
          className="inline-flex items-center gap-3 font-vietnam text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] no-underline transition-opacity hover:opacity-70"
          params={{ postId }}
          to="/admin/posts/$postId/edit"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Quay lại editor
        </Link>

        {postQuery.isLoading && !workingCopy ? (
          <div className="grid min-h-80 place-items-center text-sm">
            Đang tải bản nháp…
          </div>
        ) : previewPost ? (
          <>
            <header className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.62fr)_minmax(320px,0.38fr)] lg:items-end">
              <div>
                <div {...authoringFieldProps("publishDate", "Ngày xuất bản")}>
                  <p className="font-vietnam text-[11px] uppercase tracking-[0.22em] text-white/60">
                    {previewPost.publishDate
                      ? formatDate(previewPost.publishDate)
                      : "Bản nháp đang soạn"}
                  </p>
                </div>
                <div className="mt-5 h-px w-14 bg-[var(--accent)]" />
                <div {...authoringFieldProps("title", "Tiêu đề")}>
                  <h1 className="mt-9 font-playfair text-[clamp(48px,7vw,104px)] font-normal leading-[0.9] tracking-normal text-[var(--text-color)]">
                    {previewPost.title || "Bản nháp chưa đặt tên"}
                  </h1>
                </div>
                {previewPost.description ? (
                  <div {...authoringFieldProps("description", "Mô tả")}>
                    <p className="mt-8 max-w-[720px] font-vietnam text-[17px] leading-8 text-white/70">
                      {previewPost.description}
                    </p>
                  </div>
                ) : null}
              </div>

              {coverImage ? (
                <div
                  className="aspect-[4/5] overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.04]"
                  {...authoringFieldProps("coverImage", "Ảnh đại diện")}
                >
                  <img
                    alt={`Ảnh bìa của ${previewPost.title || "bản nháp"}`}
                    className="size-full object-cover opacity-90"
                    src={coverImage}
                  />
                </div>
              ) : null}
            </header>

            <div
              className="mt-10 flex min-h-14 flex-wrap items-center gap-3 border-y border-white/12 py-5"
              {...authoringFieldProps("tags", "Thẻ")}
            >
              {previewPost.tags.map((tag, index) => (
                <span
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-vietnam text-[10px] uppercase tracking-[0.08em] text-white/70"
                  key={`${tag}-${index}`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <section
              className="relative mt-14"
              data-cms-field-label={
                workingCopy ? "Nội dung bài viết" : undefined
              }
              data-cms-post-field={workingCopy ? "content" : undefined}
              data-cms-preview-field={workingCopy ? "true" : undefined}
              data-cms-preview-field-selected={
                workingCopy?.selectedField === "content" ? "true" : undefined
              }
            >
              {workingCopy ? (
                <button
                  aria-label="Chỉnh nội dung bài viết"
                  className="absolute right-0 top-0 z-20 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 font-vietnam text-[10px] font-semibold uppercase tracking-[0.08em] text-black shadow-lg"
                  data-cms-field-label="Nội dung bài viết"
                  data-cms-post-field="content"
                  type="button"
                >
                  <PencilLine aria-hidden className="size-3" />
                  Chỉnh nội dung
                </button>
              ) : null}
              <div className="mx-auto max-w-[760px]">
                <PostContent
                  content={previewPost.content}
                  wrapStructuredBlock={
                    workingCopy
                      ? ({ block, count, index, rendered }) => (
                          <div
                            aria-label={`Chỉnh block ${index + 1}: ${postBlockLabel(block.type)}`}
                            className={`group/post-block relative -mx-3 rounded-md px-3 py-2 outline outline-1 transition-[outline-color,background-color] hover:bg-white/[0.025] hover:outline-white/20 focus:outline-[var(--accent)] ${
                              workingCopy.selectedBlockIndex === index
                                ? "bg-white/[0.04] outline-[var(--accent)]"
                                : "outline-transparent"
                            }`}
                            data-cms-field-label={`Block ${index + 1}: ${postBlockLabel(block.type)}`}
                            data-cms-post-block-id={block.id}
                            data-cms-post-block-index={index}
                            data-cms-post-field="content"
                            data-cms-preview-field="true"
                            tabIndex={0}
                          >
                            <div
                              className="absolute inset-x-3 top-0 z-20 h-5 -translate-y-1/2 rounded-full bg-transparent transition-colors data-[cms-drop-active]:bg-[var(--accent)]"
                              data-cms-post-drop-index={index}
                              data-cms-post-block-id={block.id}
                              data-cms-post-drop-placement="before"
                            />
                            <div className="absolute right-2 top-2 z-30 flex items-center rounded-md border border-white/15 bg-black/90 p-0.5 opacity-0 shadow-xl backdrop-blur transition-opacity group-hover/post-block:opacity-100 group-focus-within/post-block:opacity-100">
                              <button
                                aria-label={`Kéo block ${index + 1}`}
                                className="grid size-7 cursor-grab place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white active:cursor-grabbing"
                                data-cms-post-block-index={index}
                                data-cms-post-block-id={block.id}
                                data-cms-post-drag-handle="true"
                                draggable
                                type="button"
                                onDragEnd={(event) => {
                                  event.currentTarget.removeAttribute(
                                    "data-cms-dragging",
                                  );
                                  draggedPostBlockRef.current = null;
                                }}
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  draggedPostBlockRef.current = {
                                    id: block.id,
                                    index,
                                  };
                                  event.currentTarget.setAttribute(
                                    "data-cms-dragging",
                                    "true",
                                  );
                                  event.dataTransfer.setData(
                                    "text/plain",
                                    String(index),
                                  );
                                  event.dataTransfer.effectAllowed = "move";
                                }}
                              >
                                <GripVertical
                                  aria-hidden
                                  className="size-3.5"
                                />
                              </button>
                              <button
                                aria-label={`Đưa block ${index + 1} lên`}
                                className="grid size-7 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
                                data-cms-post-action="move-up"
                                data-cms-post-block-id={block.id}
                                data-cms-post-block-index={index}
                                disabled={index === 0}
                                type="button"
                              >
                                <ArrowUp aria-hidden className="size-3.5" />
                              </button>
                              <button
                                aria-label={`Đưa block ${index + 1} xuống`}
                                className="grid size-7 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
                                data-cms-post-action="move-down"
                                data-cms-post-block-id={block.id}
                                data-cms-post-block-index={index}
                                disabled={index === count - 1}
                                type="button"
                              >
                                <ArrowDown aria-hidden className="size-3.5" />
                              </button>
                              <button
                                aria-label={`Thêm đoạn sau block ${index + 1}`}
                                className="grid size-7 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white"
                                data-cms-post-action="insert-after"
                                data-cms-post-block-id={block.id}
                                data-cms-post-block-index={index}
                                type="button"
                              >
                                <Plus aria-hidden className="size-3.5" />
                              </button>
                              <button
                                aria-label={`Nhân bản block ${index + 1}`}
                                className="grid size-7 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white"
                                data-cms-post-action="duplicate"
                                data-cms-post-block-id={block.id}
                                data-cms-post-block-index={index}
                                type="button"
                              >
                                <Copy aria-hidden className="size-3.5" />
                              </button>
                              <button
                                aria-label={`Xóa block ${index + 1}`}
                                className="grid size-7 place-items-center rounded text-white/70 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-30"
                                data-cms-post-action="remove"
                                data-cms-post-block-id={block.id}
                                data-cms-post-block-index={index}
                                disabled={count === 1}
                                type="button"
                              >
                                <Trash2 aria-hidden className="size-3.5" />
                              </button>
                            </div>
                            {rendered}
                            <div
                              className="absolute inset-x-3 bottom-0 z-20 h-5 translate-y-1/2 rounded-full bg-transparent transition-colors data-[cms-drop-active]:bg-[var(--accent)]"
                              data-cms-post-drop-index={index}
                              data-cms-post-block-id={block.id}
                              data-cms-post-drop-placement="after"
                            />
                          </div>
                        )
                      : undefined
                  }
                />
              </div>
            </section>
          </>
        ) : (
          <div className="mt-14 flex min-h-80 flex-col items-center justify-center gap-4 rounded-[8px] border border-white/12 bg-white/[0.035] text-center">
            <FileText aria-hidden className="size-8 text-[var(--accent)]" />
            <div>
              <h1 className="font-vietnam text-sm font-medium uppercase tracking-[0.08em]">
                Không tìm thấy bản nháp
              </h1>
              <p className="mt-2 font-vietnam text-xs text-white/60">
                Bài viết này không còn tồn tại.
              </p>
            </div>
          </div>
        )}
      </article>
    </main>
  );
}
