import {
  createCmsVisualComponentRegistry,
  createCmsVisualOutline,
} from "@agency/cms-visual-editor";
import {
  remVietRichTextBlockLabels,
  remVietRichTextBlockTypes,
  type RemVietRichTextBlockType,
} from "@agency/cms-template-rem-viet";
import {
  MAX_RICH_TEXT_BLOCKS,
  richTextDocumentSchema,
  type RichTextDocument,
} from "@rem-viet/cms";

const richTextAuthoringGrants = Object.freeze([
  "content.compose.insert",
  "content.component.edit",
  "content.field.edit",
  "content.compose.move",
  "content.compose.duplicate",
  "content.compose.remove",
]);

const richTextDefaults = Object.freeze({
  paragraph: { children: [{ text: "" }] },
  heading: { level: 2, children: [{ text: "Heading" }] },
  list: { ordered: false, items: [[{ text: "Item" }]] },
  quote: { children: [{ text: "Quote" }] },
  image: {
    src: "/assets/placeholder.webp",
    alt: "Content image",
    caption: "",
  },
  video: { url: "https://example.com/video", title: "Video" },
  code: { language: "", code: "" },
} satisfies Record<RemVietRichTextBlockType, Record<string, unknown>>);

function validateRichTextBlockData(
  type: RemVietRichTextBlockType,
  value: unknown,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Rich-text visual block ${type} data is invalid.`);
  }
  const parsed = richTextDocumentSchema.safeParse({
    version: 1,
    blocks: [{ ...value, id: `visual-${type}`, type }],
  });
  const block = parsed.success ? parsed.data.blocks[0] : undefined;
  if (!block || block.type !== type) {
    throw new Error(`Rich-text visual block ${type} data is invalid.`);
  }
  const { id: _id, type: _type, ...data } = block;
  return data;
}

function toVisualData(block: RichTextDocument["blocks"][number]) {
  const { id: _id, type: _type, ...data } = block;
  return data;
}

export const richTextVisualComponentRegistry =
  createCmsVisualComponentRegistry(
    remVietRichTextBlockTypes.map((type) => ({
      type,
      schemaVersion: 1,
      fields: [],
      defaults: () => structuredClone(richTextDefaults[type]),
      validate: (value: unknown) => validateRichTextBlockData(type, value),
      renderer: `rem-viet-rich-text-${type}-renderer`,
      editor: `rem-viet-rich-text-${type}-editor`,
      constraints: { max: MAX_RICH_TEXT_BLOCKS },
      actionCapabilities: {
        insert: ["content.compose.insert"],
        edit: ["content.component.edit"],
        move: ["content.compose.move"],
        duplicate: ["content.compose.duplicate"],
        remove: ["content.compose.remove"],
      },
    })),
  );

/** Adapts the persisted structured post body to the shared visual outline. */
export function createRichTextVisualOutline(input: {
  document: RichTextDocument;
  selectedBlockIndex: number | null;
  version: number;
  canWrite: boolean;
}) {
  const selectedBlock =
    input.selectedBlockIndex === null
      ? undefined
      : input.document.blocks[input.selectedBlockIndex];
  return createCmsVisualOutline({
    document: {
      id: "post-rich-text",
      siteId: "rem-viet",
      schemaVersion: 1,
      version: input.version,
      nodes: input.document.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        schemaVersion: 1,
        enabled: true,
        data: toVisualData(block),
      })),
    },
    registry: richTextVisualComponentRegistry,
    grants: new Set(input.canWrite ? richTextAuthoringGrants : []),
    selection: { nodeId: selectedBlock?.id ?? null },
    maxNodes: MAX_RICH_TEXT_BLOCKS,
    label: (node) =>
      remVietRichTextBlockLabels[
        node.type as keyof typeof remVietRichTextBlockLabels
      ] ?? node.type,
  });
}
