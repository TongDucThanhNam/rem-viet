import type { CmsVisualNode } from "@agency/cms-visual-editor";
import { parseRichTextDocument, type IdentifiedRichTextBlock, type RichTextBlock } from "@rem-viet/cms";

import type { CmsPostFormValues } from "@/components/cms-post-form";

const fieldSlotNames = {
  title: "title",
  publishDate: "publishDate",
  description: "description",
  coverImage: "coverImage",
  tags: "tags",
} as const;

type FieldKey = keyof typeof fieldSlotNames;

function makeFieldNode(
  key: FieldKey,
  values: CmsPostFormValues,
): CmsVisualNode {
  const data: Record<string, unknown> = {
    className: `field-${key}`,
    field: key,
  };
  switch (key) {
    case "title":
      data.value = values.title;
      break;
    case "publishDate":
      data.value = values.publishDate;
      break;
    case "description":
      data.value = values.description;
      break;
    case "coverImage":
      data.value = values.coverImage;
      break;
    case "tags":
      data.value = values.tags.join(", ");
      break;
  }
  return {
    id: `post-field-${key}`,
    type: "PostField",
    schemaVersion: 1,
    enabled: true,
    data,
    slots: {},
  };
}

function blockHasInlineChildren(
  block: IdentifiedRichTextBlock,
): block is IdentifiedRichTextBlock & { type: "paragraph" | "heading" | "quote"; children: ReadonlyArray<{ text: string; marks?: unknown }> } {
  return (
    block.type === "paragraph" ||
    block.type === "heading" ||
    block.type === "quote"
  );
}

function blockDisplaySummary(block: RichTextBlock | IdentifiedRichTextBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
      return block.children.map((c) => c.text ?? "").join("").slice(0, 40);
    case "list":
      return `${block.items.length} mục`;
    case "code":
      return block.code.slice(0, 40);
    case "image":
      return block.alt;
    case "video":
      return block.title;
  }
}

/**
 * Bridges CmsPostFormValues to a CmsVisualNode tree that LayersPanel can
 * mirror. The root has a `meta` slot (one node per form field) and a `content`
 * slot (one node per rich-text block, with nested children when present).
 */
export function createPostVisualOutline(values: CmsPostFormValues): readonly CmsVisualNode[] {
  const metaChildren = (Object.keys(fieldSlotNames) as FieldKey[]).map((key) =>
    makeFieldNode(key, values),
  );

  const document = parseRichTextDocument(values.content);
  const contentChildren: CmsVisualNode[] = [];
  if (document) {
    document.blocks.forEach((block, index) => {
      const blockId = `post-block-${block.id}`;
      const summary = blockDisplaySummary(block);
      let childNodes: CmsVisualNode[] = [];
      if (blockHasInlineChildren(block)) {
        childNodes = block.children.map(
          (child: { text: string; marks?: unknown }, childIndex: number) => ({
            id: `${blockId}-child-${childIndex}`,
            type: "RichTextLeaf",
            schemaVersion: 1,
            enabled: true,
            data: {
              className: `rich-text-leaf rich-text-${block.type}`,
              text: child.text ?? "",
            },
            slots: {},
          }),
        );
      }
      contentChildren.push({
        id: blockId,
        type: "RichTextBlock",
        schemaVersion: 1,
        enabled: true,
        data: {
          className: `rich-text-block rich-text-${block.type}`,
          blockType: block.type,
          blockIndex: index,
          blockId: block.id,
          summary,
        },
        slots: childNodes.length > 0 ? { children: childNodes } : {},
      });
    });
  }

  const root: CmsVisualNode = {
    id: "post",
    type: "Post",
    schemaVersion: 1,
    enabled: true,
    data: { className: "post-document" },
    slots: {
      meta: metaChildren,
      content: contentChildren,
    },
  };
  return [root];
}
