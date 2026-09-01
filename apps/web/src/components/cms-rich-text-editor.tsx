import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  createRichTextBlockId,
  parseRichTextDocument,
  safeHttpUrlSchema,
  safePublicLinkSchema,
  type RichTextDocument,
} from "@rem-viet/cms";
import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { Textarea } from "@rem-viet/ui/components/textarea";
import {
  Bold,
  Braces,
  Code2,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Undo2,
  Unlink,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import MediaPickerField, {
  type MediaPickerAsset,
} from "@/components/media-picker-field";
import {
  cmsRichTextExtensions,
  initialRichTextDocument,
  richTextDocumentToTiptapJson,
  tiptapJsonToRichTextDocument,
} from "@/lib/rich-text-tiptap";

type EditorMode = "visual" | "markdown";
type BlockStyle =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "heading4"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "codeBlock";

type SlashTrigger = { from: number; query: string; to: number };
type SlashCommand = {
  key: string;
  label: string;
  description: string;
  style?: BlockStyle;
  action?: "image" | "video";
};

const slashCommands = [
  {
    key: "paragraph",
    label: "Đoạn văn",
    description: "Khối nội dung thường",
    style: "paragraph",
  },
  {
    key: "heading2",
    label: "Tiêu đề lớn",
    description: "Tiêu đề cấp H2",
    style: "heading2",
  },
  {
    key: "heading3",
    label: "Tiêu đề nhỏ",
    description: "Tiêu đề cấp H3",
    style: "heading3",
  },
  {
    key: "quote",
    label: "Trích dẫn",
    description: "Làm nổi bật một nhận định",
    style: "quote",
  },
  {
    key: "bulletList",
    label: "Danh sách",
    description: "Danh sách dấu đầu dòng",
    style: "bulletList",
  },
  {
    key: "orderedList",
    label: "Danh sách số",
    description: "Danh sách có thứ tự",
    style: "orderedList",
  },
  {
    key: "codeBlock",
    label: "Khối code",
    description: "Đoạn mã có cấu trúc",
    style: "codeBlock",
  },
  {
    key: "image",
    label: "Ảnh",
    description: "Chọn từ thư viện media",
    action: "image",
  },
  {
    key: "video",
    label: "Video",
    description: "Chèn video HTTPS",
    action: "video",
  },
] as const satisfies readonly SlashCommand[];

function getSlashTrigger(editor: Editor): SlashTrigger | null {
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock) return null;
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset);
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBeforeCursor);
  if (!match) return null;
  const slashOffset = textBeforeCursor.lastIndexOf("/");
  return {
    from: $from.start() + slashOffset,
    query: (match[1] ?? "").toLocaleLowerCase("vi"),
    to: editor.state.selection.from,
  };
}

function selectedTopLevelBlock(editor: Editor) {
  const selectionFrom = editor.state.selection.from;
  let selectedIndex: number | null = null;
  editor.state.doc.forEach((node, offset, index) => {
    if (
      selectedIndex === null &&
      selectionFrom >= offset &&
      selectionFrom <= offset + node.nodeSize
    ) {
      selectedIndex = index;
    }
  });
  return selectedIndex;
}

function focusTopLevelBlock(editor: Editor, index: number) {
  const targetNode = editor.state.doc.maybeChild(index);
  if (!targetNode) return;
  let offset = 0;
  for (let nodeIndex = 0; nodeIndex < index; nodeIndex += 1) {
    offset += editor.state.doc.child(nodeIndex).nodeSize;
  }
  const chain = editor.chain().focus();
  if (targetNode.isTextblock) chain.setTextSelection(offset + 1).run();
  else chain.setNodeSelection(offset).run();
}

function activeBlockStyle(editor: Editor): BlockStyle {
  if (editor.isActive("heading", { level: 2 })) return "heading2";
  if (editor.isActive("heading", { level: 3 })) return "heading3";
  if (editor.isActive("heading", { level: 4 })) return "heading4";
  if (editor.isActive("blockquote")) return "quote";
  if (editor.isActive("bulletList")) return "bulletList";
  if (editor.isActive("orderedList")) return "orderedList";
  if (editor.isActive("codeBlock")) return "codeBlock";
  return "paragraph";
}

function applyBlockStyle(editor: Editor, style: BlockStyle) {
  const chain = editor.chain().focus();
  if (style === "heading2") chain.setHeading({ level: 2 }).run();
  else if (style === "heading3") chain.setHeading({ level: 3 }).run();
  else if (style === "heading4") chain.setHeading({ level: 4 }).run();
  else if (style === "quote") chain.setBlockquote().run();
  else if (style === "bulletList") chain.toggleBulletList().run();
  else if (style === "orderedList") chain.toggleOrderedList().run();
  else if (style === "codeBlock") chain.setCodeBlock().run();
  else chain.setParagraph().run();
}

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className={active ? "bg-primary/12 text-primary" : undefined}
      disabled={disabled}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
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
  const initialDocument = useRef(initialRichTextDocument(value));
  const [document, setDocument] = useState<RichTextDocument>(
    initialDocument.current,
  );
  const documentRef = useRef(document);
  documentRef.current = document;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const selectedBlockChangeRef = useRef(onSelectedBlockChange);
  selectedBlockChangeRef.current = onSelectedBlockChange;
  const lastEmittedValueRef = useRef<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const savedSelectionRef = useRef<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [slashTrigger, setSlashTrigger] = useState<SlashTrigger | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: canWrite,
    extensions: cmsRichTextExtensions,
    content: richTextDocumentToTiptapJson(initialDocument.current),
    editorProps: {
      attributes: {
        "aria-label": "Nội dung bài viết",
        class: "cms-tiptap-prosemirror",
      },
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      selectedBlockChangeRef.current?.(selectedTopLevelBlock(currentEditor));
      setSlashTrigger(getSlashTrigger(currentEditor));
      setSelectionRevision((revision) => revision + 1);
    },
    onUpdate: ({ editor: currentEditor }) => {
      try {
        const nextDocument = tiptapJsonToRichTextDocument(
          currentEditor.getJSON(),
        );
        const serialized = JSON.stringify(nextDocument);
        setDocument(nextDocument);
        setEditorError(null);
        setSlashTrigger(getSlashTrigger(currentEditor));
        lastEmittedValueRef.current = serialized;
        onChangeRef.current(serialized, "post-content:tiptap");
      } catch (error) {
        setEditorError(
          error instanceof Error
            ? error.message
            : "Nội dung chưa thể chuyển sang tài liệu CMS an toàn.",
        );
      }
    },
  });

  useEffect(() => {
    editor?.setEditable(canWrite);
  }, [canWrite, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextDocument = parseRichTextDocument(value);
    if (!nextDocument) return;
    const serialized = JSON.stringify(nextDocument);
    if (
      serialized === lastEmittedValueRef.current ||
      serialized === JSON.stringify(documentRef.current)
    ) {
      return;
    }
    editor.commands.setContent(richTextDocumentToTiptapJson(nextDocument), {
      emitUpdate: false,
    });
    setDocument(nextDocument);
  }, [editor, value]);

  useEffect(() => {
    if (!editor || parseRichTextDocument(value)) return;
    const serialized = JSON.stringify(initialDocument.current);
    lastEmittedValueRef.current = serialized;
    onChangeRef.current(serialized, "post-content:legacy-normalization");
  }, [editor, value]);

  useEffect(() => {
    if (
      !editor ||
      selectedBlockIndex === undefined ||
      selectedBlockIndex === null
    )
      return;
    if (selectedTopLevelBlock(editor) === selectedBlockIndex) return;
    focusTopLevelBlock(editor, selectedBlockIndex);
  }, [editor, selectedBlockIndex, contentVersion]);

  if (!editor) {
    return (
      <div className="min-h-80 animate-pulse rounded-xl border bg-muted/25" />
    );
  }
  const activeEditor = editor;

  const currentBlockStyle = activeBlockStyle(activeEditor);
  const imageActive = activeEditor.isActive("image");
  const imageAttributes = imageActive
    ? activeEditor.getAttributes("image")
    : undefined;
  const filteredSlashCommands = slashTrigger
    ? slashCommands.filter((command) =>
        `${command.key} ${command.label}`
          .toLocaleLowerCase("vi")
          .includes(slashTrigger.query),
      )
    : [];

  function openMarkdownMode() {
    setMarkdownDraft(activeEditor.getMarkdown());
    setEditorError(null);
    setMode("markdown");
  }

  function applyMarkdown() {
    try {
      if (!activeEditor.markdown)
        throw new Error("Markdown adapter chưa sẵn sàng.");
      const json = activeEditor.markdown.parse(markdownDraft);
      const nextDocument = tiptapJsonToRichTextDocument(json);
      activeEditor.commands.setContent(
        richTextDocumentToTiptapJson(nextDocument),
      );
      setEditorError(null);
      setMode("visual");
    } catch (error) {
      setEditorError(
        error instanceof Error
          ? error.message
          : "Markdown chứa cấu trúc chưa được hỗ trợ.",
      );
    }
  }

  function openLinkEditor() {
    setLinkHref(String(activeEditor.getAttributes("link").href ?? ""));
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkHref.trim();
    if (!href) {
      activeEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const parsed = safePublicLinkSchema.safeParse(href);
    if (!parsed.success) {
      setEditorError("Liên kết phải là URL an toàn hoặc đường dẫn nội bộ.");
      return;
    }
    activeEditor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: parsed.data })
      .run();
    setLinkOpen(false);
  }

  function openMediaPicker() {
    savedSelectionRef.current = activeEditor.state.selection.from;
    setMediaPickerOpen(true);
  }

  function insertImage(asset: MediaPickerAsset) {
    const selection = savedSelectionRef.current;
    const id = createRichTextBlockId(
      "image",
      documentRef.current.blocks.map((block) => block.id),
    );
    let chain = activeEditor.chain().focus();
    if (selection !== null) {
      chain = chain.setTextSelection(
        Math.min(selection, activeEditor.state.doc.content.size),
      );
    }
    chain
      .insertContent({
        type: "image",
        attrs: {
          cmsBlockId: id,
          src: asset.url,
          alt: asset.altText?.trim() || "Ảnh nội dung",
          title: "",
        },
      })
      .run();
    setMediaPickerOpen(false);
  }

  function insertVideo() {
    const parsedUrl = safeHttpUrlSchema.safeParse(videoUrl.trim());
    const title = videoTitle.trim();
    if (!parsedUrl.success || !title) {
      setEditorError("Video cần URL HTTPS hợp lệ và tiêu đề truy cập.");
      return;
    }
    const id = createRichTextBlockId(
      "video",
      documentRef.current.blocks.map((block) => block.id),
    );
    activeEditor
      .chain()
      .focus()
      .insertContent({
        type: "cmsVideo",
        attrs: { cmsBlockId: id, url: parsedUrl.data, title },
      })
      .run();
    setVideoOpen(false);
    setVideoUrl("");
    setVideoTitle("");
  }

  function runSlashCommand(command: SlashCommand) {
    if (!slashTrigger) return;
    activeEditor
      .chain()
      .focus()
      .deleteRange({ from: slashTrigger.from, to: slashTrigger.to })
      .run();
    setSlashTrigger(null);
    if (command.style) applyBlockStyle(activeEditor, command.style);
    else if (command.action === "image") openMediaPicker();
    else if (command.action === "video") setVideoOpen(true);
  }

  return (
    <div
      className="cms-tiptap-editor overflow-hidden rounded-xl border bg-background"
      data-selection-revision={selectionRevision}
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 p-2 backdrop-blur">
        <select
          aria-label="Kiểu khối văn bản"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          disabled={!canWrite}
          value={currentBlockStyle}
          onChange={(event) =>
            applyBlockStyle(editor, event.target.value as BlockStyle)
          }
        >
          <option value="paragraph">Đoạn văn</option>
          <option value="heading2">Tiêu đề H2</option>
          <option value="heading3">Tiêu đề H3</option>
          <option value="heading4">Tiêu đề H4</option>
          <option value="quote">Trích dẫn</option>
          <option value="bulletList">Danh sách</option>
          <option value="orderedList">Danh sách số</option>
          <option value="codeBlock">Khối code</option>
        </select>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          active={editor.isActive("bold")}
          disabled={!canWrite}
          label="In đậm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          disabled={!canWrite}
          label="In nghiêng"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          disabled={!canWrite}
          label="Code trong dòng"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          disabled={!canWrite}
          label="Thêm hoặc sửa liên kết"
          onClick={openLinkEditor}
        >
          <Link2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          disabled={!canWrite || !editor.isActive("link")}
          label="Xóa liên kết"
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
        >
          <Unlink aria-hidden />
        </ToolbarButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          disabled={!canWrite}
          label="Chèn ảnh từ thư viện"
          onClick={openMediaPicker}
        >
          <ImagePlus aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          disabled={!canWrite}
          label="Chèn video"
          onClick={() => setVideoOpen((open) => !open)}
        >
          <Video aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          disabled={!canWrite}
          label="Xóa định dạng"
          onClick={() =>
            editor.chain().focus().clearNodes().unsetAllMarks().run()
          }
        >
          <RemoveFormatting aria-hidden />
        </ToolbarButton>
        <span className="min-w-2 flex-1" />
        <ToolbarButton
          disabled={!canWrite || !editor.can().undo()}
          label="Hoàn tác"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          disabled={!canWrite || !editor.can().redo()}
          label="Làm lại"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden />
        </ToolbarButton>
        <Button
          size="sm"
          type="button"
          variant={mode === "markdown" ? "secondary" : "ghost"}
          onClick={
            mode === "visual" ? openMarkdownMode : () => setMode("visual")
          }
        >
          <Braces aria-hidden />
          Markdown
        </Button>
      </div>

      {slashTrigger ? (
        <div className="grid gap-1 border-b bg-background p-2 shadow-sm sm:grid-cols-2">
          {filteredSlashCommands.length ? (
            filteredSlashCommands.map((command) => (
              <button
                className="grid gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted"
                key={command.key}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand(command)}
              >
                <span className="text-xs font-medium">{command.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {command.description}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              Không có lệnh phù hợp với “/{slashTrigger.query}”.
            </p>
          )}
        </div>
      ) : null}

      {linkOpen ? (
        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/25 p-3">
          <div className="grid min-w-64 flex-1 gap-1.5">
            <Label htmlFor="cms-rich-text-link">Liên kết</Label>
            <Input
              autoFocus
              id="cms-rich-text-link"
              placeholder="/lien-he hoặc https://example.com"
              value={linkHref}
              onChange={(event) => setLinkHref(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
              }}
            />
          </div>
          <Button size="sm" type="button" onClick={applyLink}>
            Áp dụng
          </Button>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setLinkOpen(false)}
          >
            Hủy
          </Button>
        </div>
      ) : null}

      {videoOpen ? (
        <div className="grid gap-3 border-b bg-muted/25 p-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cms-video-url">URL video HTTPS</Label>
            <Input
              id="cms-video-url"
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cms-video-title">Tiêu đề truy cập</Label>
            <Input
              id="cms-video-title"
              placeholder="Video hướng dẫn đo rèm"
              value={videoTitle}
              onChange={(event) => setVideoTitle(event.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" type="button" onClick={insertVideo}>
              Chèn video
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setVideoOpen(false)}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "visual" ? (
        <>
          <EditorContent editor={editor} />
          {imageActive && imageAttributes ? (
            <div className="grid gap-3 border-t bg-muted/20 p-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cms-image-alt">Văn bản thay thế</Label>
                <Input
                  id="cms-image-alt"
                  value={String(imageAttributes.alt ?? "")}
                  onChange={(event) =>
                    editor.commands.updateAttributes("image", {
                      alt: event.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cms-image-caption">Chú thích</Label>
                <Input
                  id="cms-image-caption"
                  value={String(imageAttributes.title ?? "")}
                  onChange={(event) =>
                    editor.commands.updateAttributes("image", {
                      title: event.target.value,
                    })
                  }
                />
              </div>
              <Button
                className="justify-self-start"
                size="sm"
                type="button"
                variant="outline"
                onClick={openMediaPicker}
              >
                <ImagePlus aria-hidden />
                Thay ảnh từ thư viện
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Markdown an toàn</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Markdown chỉ là lớp nhập/xuất. Khi áp dụng, nội dung được parse
                lại thành tài liệu CMS có cấu trúc.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="button" onClick={applyMarkdown}>
                Áp dụng Markdown
              </Button>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setMode("visual")}
              >
                Hủy
              </Button>
            </div>
          </div>
          <Textarea
            aria-label="Nội dung Markdown"
            className="min-h-[56vh] resize-y font-mono text-sm leading-6"
            spellCheck={false}
            value={markdownDraft}
            onChange={(event) => setMarkdownDraft(event.target.value)}
          />
        </div>
      )}

      {showOutline ? (
        <details className="border-t bg-muted/15">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-medium marker:hidden">
            <ListTree aria-hidden className="size-4" />
            Cấu trúc bài viết · {document.blocks.length.toLocaleString(
              "vi-VN",
            )}{" "}
            khối
          </summary>
          <div className="grid gap-1 border-t p-3">
            {document.blocks.map((block, index) => {
              const icon =
                block.type === "heading" ? (
                  <Heading2 aria-hidden />
                ) : block.type === "quote" ? (
                  <Quote aria-hidden />
                ) : block.type === "list" ? (
                  block.ordered ? (
                    <ListOrdered aria-hidden />
                  ) : (
                    <List aria-hidden />
                  )
                ) : block.type === "code" ? (
                  <Code2 aria-hidden />
                ) : block.type === "image" ? (
                  <ImagePlus aria-hidden />
                ) : block.type === "video" ? (
                  <Video aria-hidden />
                ) : (
                  <Pilcrow aria-hidden />
                );
              return (
                <button
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  key={block.id}
                  type="button"
                  onClick={() => focusTopLevelBlock(editor, index)}
                >
                  <span className="[&_svg]:size-3.5">{icon}</span>
                  <span className="truncate">
                    {index + 1}. {block.type}
                  </span>
                </button>
              );
            })}
          </div>
        </details>
      ) : null}

      {editorError ? (
        <p
          aria-live="polite"
          className="border-t border-destructive/35 bg-destructive/5 px-4 py-3 text-xs text-destructive"
        >
          {editorError}
        </p>
      ) : null}

      <div className="sr-only" aria-hidden={!mediaPickerOpen}>
        <MediaPickerField
          id="cms-rich-text-media-picker"
          label="Ảnh nội dung"
          open={mediaPickerOpen}
          value=""
          onAssetSelect={insertImage}
          onChange={() => undefined}
          onOpenChange={setMediaPickerOpen}
        />
      </div>
    </div>
  );
}
