import {
  createRichTextBlockId,
  emptyRichTextDocument,
  ensureRichTextBlockIds,
  MAX_RICH_TEXT_BLOCKS,
  parseRichTextDocument,
  type RichTextDocument,
  type RichTextSpan,
} from "@rem-viet/cms";
import {
  CmsVisualOutline,
  applyCmsPlainTextPaste,
  filterCmsBlockAuthoringCatalog,
  resolveCmsMediaSelection,
} from "@agency/cms-admin";
import {
  remVietRichTextAuthoringByType,
  remVietRichTextAuthoringCatalog,
} from "@agency/cms-template-rem-viet";
import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";

import MediaPickerField from "@/components/media-picker-field";
import { createRichTextVisualOutline } from "@/lib/rich-text-visual-outline";

type Block = RichTextDocument["blocks"][number];

function initialDocument(value: string): RichTextDocument {
  const parsed = parseRichTextDocument(value);
  if (parsed) return parsed;
  const text = value.trim();
  if (!text) return structuredClone(emptyRichTextDocument);
  return {
    version: 1,
    blocks: ensureRichTextBlockIds(
      text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph) => ({
          type: "paragraph" as const,
          children: [{ text: paragraph }],
        })),
    ),
  };
}

function blockLabel(block: Block) {
  return remVietRichTextAuthoringByType[block.type].label;
}

function updateBooleanMark(
  span: RichTextSpan,
  mark: "bold" | "italic" | "code",
  enabled: boolean,
) {
  const marks = { ...span.marks };

  if (enabled) marks[mark] = true;
  else delete marks[mark];

  return {
    ...span,
    marks: Object.keys(marks).length ? marks : undefined,
  } satisfies RichTextSpan;
}

function updateHref(span: RichTextSpan, href: string) {
  const marks = { ...span.marks };

  if (href) marks.href = href;
  else delete marks.href;

  return {
    ...span,
    marks: Object.keys(marks).length ? marks : undefined,
  } satisfies RichTextSpan;
}

function InlineEditor({
  label,
  multiline = true,
  onChange,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: RichTextSpan[]) => void;
  value: RichTextSpan[];
}) {
  const spans: RichTextSpan[] = value.length ? value : [{ text: "" }];
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  function replaceSpan(index: number, span: RichTextSpan) {
    onChange(
      spans.map((current, position) => (position === index ? span : current)),
    );
  }

  function pastePlainText(
    index: number,
    span: RichTextSpan,
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const clipboardText = event.clipboardData.getData("text/plain");
    const hasHtml = Array.from(event.clipboardData.types).includes("text/html");
    if (!clipboardText && !hasHtml) return;
    event.preventDefault();
    if (!clipboardText) {
      setPasteNotice(
        "Clipboard không có văn bản thuần; nội dung HTML đã bị bỏ qua.",
      );
      return;
    }

    const control = event.currentTarget;
    const pasted = applyCmsPlainTextPaste({
      currentText: span.text,
      clipboardText,
      selectionStart: control.selectionStart ?? span.text.length,
      selectionEnd: control.selectionEnd ?? span.text.length,
    });
    replaceSpan(index, { ...span, text: pasted.text });
    setPasteNotice(
      pasted.truncated
        ? "Nội dung dán đã được cắt tại giới hạn 20.000 ký tự."
        : "Đã dán văn bản thuần; style và metadata đã được loại bỏ.",
    );
    globalThis.requestAnimationFrame(() => {
      control.setSelectionRange(pasted.selectionStart, pasted.selectionEnd);
    });
  }

  return (
    <div className="grid gap-3">
      {spans.map((span, index) => {
        const segmentLabel = `${label}, đoạn ${index + 1}`;
        const textControl = multiline ? (
          <textarea
            aria-label={`Nội dung ${segmentLabel}`}
            className="min-h-28 rounded-md border bg-background p-3 text-sm"
            value={span.text}
            onChange={(event) =>
              replaceSpan(index, { ...span, text: event.target.value })
            }
            onPaste={(event) => pastePlainText(index, span, event)}
          />
        ) : (
          <Input
            aria-label={`Nội dung ${segmentLabel}`}
            value={span.text}
            onChange={(event) =>
              replaceSpan(index, { ...span, text: event.target.value })
            }
            onPaste={(event) => pastePlainText(index, span, event)}
          />
        );

        return (
          <div
            aria-label={segmentLabel}
            className="grid gap-3 rounded-md border border-dashed p-3"
            key={index}
            role="group"
          >
            {textControl}
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor={`rich-link-${label}-${index}`}>
                  Liên kết (không bắt buộc)
                </Label>
                <Input
                  aria-label={`Liên kết ${segmentLabel}`}
                  id={`rich-link-${label}-${index}`}
                  placeholder="/lien-he hoặc https://example.com"
                  value={span.marks?.href ?? ""}
                  onChange={(event) =>
                    replaceSpan(index, updateHref(span, event.target.value))
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {(
                  [
                    ["bold", "Đậm"],
                    ["italic", "Nghiêng"],
                    ["code", "Code inline"],
                  ] as const
                ).map(([mark, markLabel]) => (
                  <label className="flex items-center gap-1.5" key={mark}>
                    <input
                      aria-label={`${markLabel} ${segmentLabel}`}
                      checked={Boolean(span.marks?.[mark])}
                      type="checkbox"
                      onChange={(event) =>
                        replaceSpan(
                          index,
                          updateBooleanMark(span, mark, event.target.checked),
                        )
                      }
                    />
                    {markLabel}
                  </label>
                ))}
                <Button
                  aria-label={`Xóa ${segmentLabel}`}
                  disabled={spans.length === 1}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onChange(spans.filter((_, position) => position !== index))
                  }
                >
                  <Trash2 aria-hidden />
                  Xóa đoạn
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      <Button
        className="justify-self-start"
        size="sm"
        type="button"
        variant="outline"
        onClick={() => onChange([...spans, { text: "" }])}
      >
        <Plus aria-hidden />
        Thêm đoạn định dạng
      </Button>
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {pasteNotice}
      </p>
    </div>
  );
}

export default function CmsRichTextEditor({
  canWrite = true,
  contentVersion = 0,
  onSelectedBlockChange,
  showOutline = false,
  value,
  onChange,
  selectedBlockIndex,
}: {
  canWrite?: boolean;
  contentVersion?: number;
  onSelectedBlockChange?: (index: number | null) => void;
  showOutline?: boolean;
  value: string;
  onChange: (value: string, historyGroup?: string) => void;
  selectedBlockIndex?: number | null;
}) {
  const [document, setDocument] = useState(() => initialDocument(value));
  const [catalogQuery, setCatalogQuery] = useState("");
  const [localSelectedBlockIndex, setLocalSelectedBlockIndex] = useState<
    number | null
  >(selectedBlockIndex ?? null);
  const catalogDisclosure = useRef<HTMLDetailsElement>(null);
  const catalogSearchId = useId();
  const catalogResultId = `${catalogSearchId}-results`;
  const documentRef = useRef(document);
  documentRef.current = document;
  const filteredCatalog = filterCmsBlockAuthoringCatalog(
    remVietRichTextAuthoringCatalog,
    catalogQuery,
  );
  const blockLimitReached = document.blocks.length >= MAX_RICH_TEXT_BLOCKS;
  const effectiveSelectedBlockIndex =
    selectedBlockIndex === undefined
      ? localSelectedBlockIndex
      : selectedBlockIndex;
  const visualOutline = useMemo(
    () =>
      showOutline
        ? createRichTextVisualOutline({
            document,
            selectedBlockIndex: effectiveSelectedBlockIndex,
            version: contentVersion,
            canWrite,
          })
        : [],
    [
      canWrite,
      contentVersion,
      document,
      effectiveSelectedBlockIndex,
      showOutline,
    ],
  );

  useEffect(() => {
    if (parseRichTextDocument(value)) return;
    onChange(JSON.stringify(document));
    // Normalize legacy/plain content once when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = parseRichTextDocument(value);
    if (!next || JSON.stringify(next) === JSON.stringify(documentRef.current))
      return;
    setDocument(next);
  }, [value]);

  function commit(next: RichTextDocument, historyGroup?: string) {
    setDocument(next);
    onChange(JSON.stringify(next), historyGroup);
  }

  useEffect(() => {
    if (effectiveSelectedBlockIndex === null) return;
    globalThis.document
      .getElementById(`post-content-block-${effectiveSelectedBlockIndex}`)
      ?.focus();
  }, [effectiveSelectedBlockIndex]);

  function selectBlock(index: number | null) {
    setLocalSelectedBlockIndex(index);
    onSelectedBlockChange?.(index);
    if (index !== null) {
      queueMicrotask(() =>
        globalThis.document
          .getElementById(`post-content-block-${index}`)
          ?.focus(),
      );
    }
  }

  function replace(index: number, block: Block) {
    commit(
      {
        ...document,
        blocks: document.blocks.map((current, position) =>
          position === index ? block : current,
        ),
      },
      `post-content:block:${index}`,
    );
  }

  function add(type: Block["type"]) {
    if (!canWrite || blockLimitReached) return;
    const id = createRichTextBlockId(
      type,
      document.blocks.map((block) => block.id),
    );
    const block: Block =
      type === "heading"
        ? { id, type, level: 2, children: [{ text: "Tiêu đề mới" }] }
        : type === "quote"
          ? { id, type, children: [{ text: "Trích dẫn" }] }
          : type === "list"
            ? { id, type, ordered: false, items: [[{ text: "Mục mới" }]] }
            : type === "code"
              ? { id, type, language: "", code: "" }
              : type === "image"
                ? {
                    id,
                    type,
                    src: "/assets/placeholder.webp",
                    alt: "Ảnh nội dung",
                    caption: "",
                  }
                : type === "video"
                  ? {
                      id,
                      type,
                      url: "https://www.youtube.com/watch?v=",
                      title: "Video",
                    }
                  : { id, type: "paragraph", children: [{ text: "" }] };
    commit({ ...document, blocks: [...document.blocks, block] });
    selectBlock(document.blocks.length);
    setCatalogQuery("");
    catalogDisclosure.current?.removeAttribute("open");
  }

  function move(index: number, targetIndex: number) {
    if (
      !canWrite ||
      index < 0 ||
      targetIndex < 0 ||
      index >= document.blocks.length ||
      targetIndex >= document.blocks.length
    ) {
      return;
    }
    const blocks = [...document.blocks];
    [blocks[index], blocks[targetIndex]] = [
      blocks[targetIndex]!,
      blocks[index]!,
    ];
    commit({ ...document, blocks });
    selectBlock(targetIndex);
  }

  function duplicate(index: number) {
    if (!canWrite || blockLimitReached) return;
    const source = document.blocks[index];
    if (!source) return;
    const id = createRichTextBlockId(
      source.type,
      document.blocks.map((block) => block.id),
    );
    const copy = { ...structuredClone(source), id };
    commit({
      ...document,
      blocks: [
        ...document.blocks.slice(0, index + 1),
        copy,
        ...document.blocks.slice(index + 1),
      ],
    });
    selectBlock(index + 1);
  }

  function remove(index: number) {
    if (!canWrite || index < 0 || index >= document.blocks.length) return;
    const blocks = document.blocks.filter(
      (_, position) => position !== index,
    );
    commit({ ...document, blocks });
    selectBlock(blocks.length === 0 ? null : Math.min(index, blocks.length - 1));
  }

  return (
    <div className="grid gap-3">
      <details
        className="group overflow-hidden rounded-xl border bg-muted/20"
        ref={catalogDisclosure}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden">
          <span className="flex items-center gap-2">
            <Plus aria-hidden className="size-4" />
            Thêm block nội dung
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="grid gap-3 border-t bg-background p-4">
          <div className="grid gap-2">
            <Label htmlFor={catalogSearchId}>Tìm block nội dung</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-describedby={catalogResultId}
                className="pl-9"
                id={catalogSearchId}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Ví dụ: tiêu đề, ảnh, danh sách…"
                type="search"
                value={catalogQuery}
              />
            </div>
          </div>
          <p
            aria-live="polite"
            className="text-xs text-muted-foreground"
            id={catalogResultId}
          >
            {!canWrite
              ? "Phiên làm việc chỉ đọc; thao tác cấu trúc đã bị khóa."
              : blockLimitReached
                ? `Đã đạt giới hạn ${MAX_RICH_TEXT_BLOCKS.toLocaleString("vi-VN")} block.`
                : `${filteredCatalog.length} lựa chọn phù hợp.`}
          </p>
          {filteredCatalog.length ? (
            <div
              aria-label="Danh mục block nội dung"
              className="grid gap-2 sm:grid-cols-2"
              role="list"
            >
              {filteredCatalog.map((definition) => (
                <div key={definition.type} role="listitem">
                  <Button
                    aria-label={`Thêm ${definition.label.toLocaleLowerCase("vi")}`}
                    className="h-auto min-h-20 w-full items-start justify-start whitespace-normal px-3 py-3 text-left"
                    disabled={!canWrite || blockLimitReached}
                    onClick={() => add(definition.type)}
                    type="button"
                    variant="outline"
                  >
                    <span className="grid gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{definition.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {definition.category}
                        </span>
                      </span>
                      <span className="text-xs font-normal leading-5 text-muted-foreground">
                        {definition.description}
                      </span>
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Không có block phù hợp với “{catalogQuery}”.
            </p>
          )}
        </div>
      </details>
      <p className="text-xs text-muted-foreground">
        Có thể dán trực tiếp từ Google Docs. Trình soạn thảo chỉ nhận văn bản
        thuần, chuẩn hóa khoảng trắng và loại bỏ style hoặc metadata ẩn.
      </p>
      {showOutline ? (
        <section
          aria-label="Cấu trúc block nội dung bài viết"
          className="grid gap-2 rounded-xl border bg-muted/20 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <strong className="text-xs uppercase tracking-wider">
              Cấu trúc nội dung
            </strong>
            <span className="text-[11px] text-muted-foreground">
              {document.blocks.length.toLocaleString("vi-VN")} block
            </span>
          </div>
          <CmsVisualOutline
            className="grid gap-1"
            empty={
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Chưa có block nội dung. Chọn một block từ danh mục phía trên.
              </p>
            }
            itemClassName={(item) =>
              `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5 ${item.selected ? "border-primary bg-primary/10" : "bg-background"}`
            }
            items={visualOutline}
            label="Outline block nội dung bài viết"
            treeItemClassName="min-w-0 truncate text-left text-xs font-medium"
            onSelectNode={(nodeId) => {
              const index = document.blocks.findIndex(
                (block) => block.id === nodeId,
              );
              if (index >= 0) selectBlock(index);
            }}
            renderLabel={(item) => (
              <span>
                {item.index + 1}. {item.label}
              </span>
            )}
            renderActions={(item) => (
              <div className="flex shrink-0">
                <Button
                  aria-label={`Nhân bản ${item.label}`}
                  disabled={!item.actions.duplicate}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => duplicate(item.index)}
                >
                  <Copy aria-hidden />
                </Button>
                <Button
                  aria-label={`Đưa ${item.label} lên`}
                  disabled={!item.actions.move || item.index === 0}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => move(item.index, item.index - 1)}
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  aria-label={`Đưa ${item.label} xuống`}
                  disabled={
                    !item.actions.move ||
                    item.index === document.blocks.length - 1
                  }
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => move(item.index, item.index + 1)}
                >
                  <ChevronDown aria-hidden />
                </Button>
                <Button
                  aria-label={`Xóa ${item.label}`}
                  disabled={!item.actions.remove}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => remove(item.index)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            )}
          />
        </section>
      ) : null}
      {document.blocks.map((block, index) => (
        <section
          aria-label={`Block ${index + 1}: ${blockLabel(block)}`}
          className="grid gap-3 rounded-md border p-4"
          data-cms-rich-text-block-id={block.id}
          id={`post-content-block-${index}`}
          key={block.id}
          role="group"
          tabIndex={-1}
        >
          <header className="flex items-center justify-between gap-3">
            <strong className="text-xs uppercase tracking-wider">
              {index + 1}. {blockLabel(block)}
            </strong>
            {showOutline ? null : (
              <div className="flex">
                <Button
                  aria-label="Đưa lên"
                  disabled={index === 0}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    move(index, index - 1);
                  }}
                >
                  <ChevronUp />
                </Button>
                <Button
                  aria-label="Đưa xuống"
                  disabled={index === document.blocks.length - 1}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    move(index, index + 1);
                  }}
                >
                  <ChevronDown />
                </Button>
                <Button
                  aria-label="Xóa block"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </header>
          {block.type === "paragraph" || block.type === "quote" ? (
            <InlineEditor
              label={`${blockLabel(block)} ${index + 1}`}
              value={block.children}
              onChange={(children) => replace(index, { ...block, children })}
            />
          ) : block.type === "heading" ? (
            <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
              <select
                aria-label={`Cấp tiêu đề ${index + 1}`}
                className="h-9 border bg-background px-2 text-sm"
                value={block.level}
                onChange={(event) =>
                  replace(index, {
                    ...block,
                    level: Number(event.target.value) as 2 | 3 | 4,
                  })
                }
              >
                {[2, 3, 4].map((level) => (
                  <option key={level} value={level}>
                    H{level}
                  </option>
                ))}
              </select>
              <InlineEditor
                label={`Tiêu đề ${index + 1}`}
                multiline={false}
                value={block.children}
                onChange={(children) => replace(index, { ...block, children })}
              />
            </div>
          ) : block.type === "list" ? (
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={block.ordered}
                  onChange={(event) =>
                    replace(index, { ...block, ordered: event.target.checked })
                  }
                />
                Danh sách đánh số
              </label>
              {block.items.map((item, itemIndex) => (
                <div className="grid gap-2" key={itemIndex}>
                  <InlineEditor
                    label={`Mục ${itemIndex + 1} của danh sách ${index + 1}`}
                    value={item}
                    onChange={(children) =>
                      replace(index, {
                        ...block,
                        items: block.items.map((current, position) =>
                          position === itemIndex ? children : current,
                        ),
                      })
                    }
                  />
                  <Button
                    aria-label={`Xóa mục ${itemIndex + 1} của danh sách ${index + 1}`}
                    className="justify-self-start"
                    disabled={block.items.length === 1}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      replace(index, {
                        ...block,
                        items: block.items.filter(
                          (_, position) => position !== itemIndex,
                        ),
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                    Xóa mục
                  </Button>
                </div>
              ))}
              <Button
                className="justify-self-start"
                size="sm"
                type="button"
                variant="outline"
                onClick={() =>
                  replace(index, {
                    ...block,
                    items: [...block.items, [{ text: "Mục mới" }]],
                  })
                }
              >
                <Plus aria-hidden />
                Thêm mục
              </Button>
            </div>
          ) : block.type === "code" ? (
            <div className="grid gap-3">
              <Input
                placeholder="Ngôn ngữ (js, css...)"
                value={block.language}
                onChange={(event) =>
                  replace(index, { ...block, language: event.target.value })
                }
              />
              <textarea
                className="min-h-40 rounded-md border bg-muted/30 p-3 font-mono text-xs"
                value={block.code}
                onChange={(event) =>
                  replace(index, { ...block, code: event.target.value })
                }
              />
            </div>
          ) : block.type === "image" ? (
            <div className="grid gap-3">
              <MediaPickerField
                id={`rich-image-${index}`}
                label="Ảnh"
                value={block.src}
                onChange={(src) => replace(index, { ...block, src })}
                onAssetSelect={(asset) =>
                  replace(index, {
                    ...block,
                    ...resolveCmsMediaSelection({
                      asset,
                      currentAlt: block.alt,
                    }),
                  })
                }
              />
              <div className="grid gap-2">
                <Label htmlFor={`rich-alt-${index}`}>Alt ảnh (bắt buộc)</Label>
                <Input
                  id={`rich-alt-${index}`}
                  value={block.alt}
                  onChange={(event) =>
                    replace(index, { ...block, alt: event.target.value })
                  }
                />
              </div>
              <Input
                placeholder="Caption"
                value={block.caption}
                onChange={(event) =>
                  replace(index, { ...block, caption: event.target.value })
                }
              />
            </div>
          ) : (
            <div className="grid gap-3">
              <Input
                type="url"
                placeholder="YouTube/Vimeo URL"
                value={block.url}
                onChange={(event) =>
                  replace(index, { ...block, url: event.target.value })
                }
              />
              <Input
                placeholder="Tiêu đề video"
                value={block.title}
                onChange={(event) =>
                  replace(index, {
                    ...block,
                    title: event.target.value || "Video",
                  })
                }
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
