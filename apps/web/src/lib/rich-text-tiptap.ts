import {
  Extension,
  Node,
  mergeAttributes,
  type JSONContent,
} from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import {
  emptyRichTextDocument,
  ensureRichTextBlockIds,
  parseRichTextDocument,
  richTextDocumentSchema,
  type RichTextDocument,
  type RichTextSpan,
} from "@rem-viet/cms";

const blockIdentityTypes = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "codeBlock",
];

const CmsBlockIdentity = Extension.create({
  name: "cmsBlockIdentity",
  addGlobalAttributes() {
    return [
      {
        types: blockIdentityTypes,
        attributes: {
          cmsBlockId: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-cms-rich-text-block-id"),
            renderHTML: (attributes) =>
              attributes.cmsBlockId
                ? {
                    "data-cms-rich-text-block-id": String(
                      attributes.cmsBlockId,
                    ),
                  }
                : {},
          },
        },
      },
    ];
  },
});

const CmsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cmsBlockId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-cms-rich-text-block-id"),
        renderHTML: (attributes) =>
          attributes.cmsBlockId
            ? { "data-cms-rich-text-block-id": String(attributes.cmsBlockId) }
            : {},
      },
    };
  },
});

const CmsVideo = Node.create({
  name: "cmsVideo",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      cmsBlockId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-cms-rich-text-block-id"),
        renderHTML: (attributes) =>
          attributes.cmsBlockId
            ? { "data-cms-rich-text-block-id": String(attributes.cmsBlockId) }
            : {},
      },
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-video-url"),
        renderHTML: (attributes) => ({
          "data-video-url": String(attributes.url ?? ""),
        }),
      },
      title: {
        default: "Video",
        parseHTML: (element) => element.getAttribute("data-video-title"),
        renderHTML: (attributes) => ({
          "data-video-title": String(attributes.title ?? "Video"),
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-cms-video]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-cms-video": "true",
        class: "cms-tiptap-video",
      }),
      `Video: ${String(node.attrs.title ?? "Video")}`,
    ];
  },
  renderMarkdown: (node) => {
    const url = String(node.attrs?.url ?? "").replaceAll('"', "&quot;");
    const title = String(node.attrs?.title ?? "Video").replaceAll(
      '"',
      "&quot;",
    );
    return `<div data-cms-video="true" data-video-url="${url}" data-video-title="${title}"></div>`;
  },
});

export const cmsRichTextExtensions = [
  StarterKit.configure({
    hardBreak: false,
    heading: { levels: [2, 3, 4] },
    horizontalRule: false,
    link: false,
    strike: false,
    underline: false,
  }),
  Link.configure({
    autolink: true,
    defaultProtocol: "https",
    enableClickSelection: true,
    openOnClick: false,
  }),
  CmsBlockIdentity,
  CmsImage.configure({ allowBase64: false, inline: false }),
  CmsVideo,
  Markdown.configure({
    indentation: { style: "space", size: 2 },
    markedOptions: { breaks: false, gfm: true },
  }),
];

export function initialRichTextDocument(value: string): RichTextDocument {
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

function spanMarks(span: RichTextSpan): JSONContent["marks"] {
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (span.marks?.bold) marks.push({ type: "bold" });
  if (span.marks?.italic) marks.push({ type: "italic" });
  if (span.marks?.code) marks.push({ type: "code" });
  if (span.marks?.href) {
    marks.push({ type: "link", attrs: { href: span.marks.href } });
  }
  return marks.length ? marks : undefined;
}

function spansToTiptapContent(spans: readonly RichTextSpan[]) {
  return spans.flatMap<JSONContent>((span) =>
    span.text
      ? [{ type: "text", text: span.text, marks: spanMarks(span) }]
      : [],
  );
}

export function richTextDocumentToTiptapJson(
  document: RichTextDocument,
): JSONContent {
  return {
    type: "doc",
    content: document.blocks.map((block) => {
      const cmsBlockId = block.id ?? null;
      switch (block.type) {
        case "paragraph":
          return {
            type: "paragraph",
            attrs: { cmsBlockId },
            content: spansToTiptapContent(block.children),
          };
        case "heading":
          return {
            type: "heading",
            attrs: { cmsBlockId, level: block.level },
            content: spansToTiptapContent(block.children),
          };
        case "quote":
          return {
            type: "blockquote",
            attrs: { cmsBlockId },
            content: [
              {
                type: "paragraph",
                content: spansToTiptapContent(block.children),
              },
            ],
          };
        case "list":
          return {
            type: block.ordered ? "orderedList" : "bulletList",
            attrs: { cmsBlockId },
            content: block.items.map((item) => ({
              type: "listItem",
              content: [
                { type: "paragraph", content: spansToTiptapContent(item) },
              ],
            })),
          };
        case "code":
          return {
            type: "codeBlock",
            attrs: { cmsBlockId, language: block.language || null },
            content: block.code
              ? [{ type: "text", text: block.code }]
              : undefined,
          };
        case "image":
          return {
            type: "image",
            attrs: {
              cmsBlockId,
              src: block.src,
              alt: block.alt,
              title: block.caption || null,
            },
          };
        case "video":
          return {
            type: "cmsVideo",
            attrs: { cmsBlockId, url: block.url, title: block.title },
          };
      }
    }),
  };
}

function inlineMarks(node: JSONContent): RichTextSpan["marks"] {
  const marks: NonNullable<RichTextSpan["marks"]> = {};
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") marks.bold = true;
    else if (mark.type === "italic") marks.italic = true;
    else if (mark.type === "code") marks.code = true;
    else if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      marks.href = mark.attrs.href;
    }
  }
  return Object.keys(marks).length ? marks : undefined;
}

function collectTextNodes(node: JSONContent): JSONContent[] {
  if (node.type === "text") return [node];
  return (node.content ?? []).flatMap(collectTextNodes);
}

function tiptapNodeToSpans(node: JSONContent): RichTextSpan[] {
  const spans = collectTextNodes(node).map((textNode) => ({
    text: textNode.text ?? "",
    marks: inlineMarks(textNode),
  }));
  return spans.length ? spans : [{ text: "" }];
}

function blockId(node: JSONContent) {
  return typeof node.attrs?.cmsBlockId === "string"
    ? node.attrs.cmsBlockId
    : undefined;
}

export function tiptapJsonToRichTextDocument(
  json: JSONContent,
): RichTextDocument {
  const blocks = (json.content ?? []).map((node) => {
    const id = blockId(node);
    switch (node.type) {
      case "paragraph":
        return {
          id,
          type: "paragraph" as const,
          children: tiptapNodeToSpans(node),
        };
      case "heading":
        return {
          id,
          type: "heading" as const,
          level: [2, 3, 4].includes(Number(node.attrs?.level))
            ? (Number(node.attrs?.level) as 2 | 3 | 4)
            : 2,
          children: tiptapNodeToSpans(node),
        };
      case "blockquote":
        return {
          id,
          type: "quote" as const,
          children: tiptapNodeToSpans(node),
        };
      case "bulletList":
      case "orderedList":
        return {
          id,
          type: "list" as const,
          ordered: node.type === "orderedList",
          items: (node.content ?? []).map(tiptapNodeToSpans),
        };
      case "codeBlock":
        return {
          id,
          type: "code" as const,
          language:
            typeof node.attrs?.language === "string" ? node.attrs.language : "",
          code: collectTextNodes(node)
            .map((child) => child.text ?? "")
            .join(""),
        };
      case "image":
        return {
          id,
          type: "image" as const,
          src: String(node.attrs?.src ?? ""),
          alt: String(node.attrs?.alt ?? "").trim(),
          caption: String(node.attrs?.title ?? ""),
        };
      case "cmsVideo":
        return {
          id,
          type: "video" as const,
          url: String(node.attrs?.url ?? ""),
          title: String(node.attrs?.title ?? "").trim(),
        };
      default:
        throw new Error(`Unsupported editor node: ${node.type ?? "unknown"}`);
    }
  });

  return richTextDocumentSchema.parse({ version: 1, blocks });
}
