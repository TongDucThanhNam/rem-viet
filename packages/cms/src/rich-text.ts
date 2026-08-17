import { z } from "zod";

import {
  safeHttpUrlSchema,
  safeMediaSourceSchema,
  safePublicLinkSchema,
} from "./url";

const textMarksSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  code: z.boolean().optional(),
  href: safePublicLinkSchema.optional(),
});

export const richTextSpanSchema = z.object({
  text: z.string().max(20_000),
  marks: textMarksSchema.optional(),
});
export type RichTextSpan = z.infer<typeof richTextSpanSchema>;

const richTextInlineSchema = z.array(richTextSpanSchema).max(500);

export const MAX_RICH_TEXT_BLOCKS = 500;
export const MAX_RICH_TEXT_BLOCK_ID_LENGTH = 128;

const richTextBlockIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_RICH_TEXT_BLOCK_ID_LENGTH);

const richTextBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("paragraph"),
    children: richTextInlineSchema,
  }),
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    children: richTextInlineSchema,
  }),
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("quote"),
    children: richTextInlineSchema,
  }),
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("list"),
    ordered: z.boolean().default(false),
    items: z.array(richTextInlineSchema).min(1).max(100),
  }),
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("code"),
    language: z.string().max(40).default(""),
    code: z.string().max(50_000),
  }),
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("image"),
    src: safeMediaSourceSchema,
    alt: z.string().trim().min(1, "Alt ảnh là bắt buộc."),
    caption: z.string().max(500).default(""),
  }),
  z.object({
    id: richTextBlockIdSchema.optional(),
    type: z.literal("video"),
    url: safeHttpUrlSchema,
    title: z.string().trim().min(1).max(200),
  }),
]);

export type RichTextBlock = z.infer<typeof richTextBlockSchema>;
export type IdentifiedRichTextBlock = RichTextBlock & { id: string };

export function createRichTextBlockId(
  type: RichTextBlock["type"],
  existingIds: Iterable<string>,
  entropy = crypto.randomUUID(),
) {
  const claimed = new Set(existingIds);
  const safeEntropy =
    entropy
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "block";
  const base = `rich-${type}-${safeEntropy}`.slice(
    0,
    MAX_RICH_TEXT_BLOCK_ID_LENGTH,
  );
  let candidate = base;
  let suffix = 2;
  while (claimed.has(candidate)) {
    const marker = `-${suffix++}`;
    candidate = `${base.slice(0, MAX_RICH_TEXT_BLOCK_ID_LENGTH - marker.length)}${marker}`;
  }
  return candidate;
}

/**
 * Preserves unique persisted IDs and deterministically upgrades legacy or
 * duplicate body blocks. IDs are document-scoped and remain stable once the
 * normalized working copy is saved.
 */
export function ensureRichTextBlockIds(
  blocks: readonly RichTextBlock[],
): IdentifiedRichTextBlock[] {
  const claimed = new Set<string>();
  return blocks.map((block, index) => {
    const existing = block.id?.trim();
    let id = existing && !claimed.has(existing) ? existing : "";
    if (!id) {
      const base = `rich-${index}-${block.type}`;
      id = base;
      let suffix = 2;
      while (claimed.has(id)) id = `${base}-${suffix++}`;
    }
    claimed.add(id);
    return block.id === id
      ? (block as IdentifiedRichTextBlock)
      : { ...block, id };
  });
}

export const richTextDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(richTextBlockSchema).max(MAX_RICH_TEXT_BLOCKS),
  })
  .strict()
  .transform((document) => ({
    ...document,
    blocks: ensureRichTextBlockIds(document.blocks),
  }));

export type RichTextDocument = z.infer<typeof richTextDocumentSchema>;

export const emptyRichTextDocument: RichTextDocument = {
  version: 1,
  blocks: [
    { id: "rich-0-paragraph", type: "paragraph", children: [{ text: "" }] },
  ],
};

export function parseRichTextDocument(value: string): RichTextDocument | null {
  try {
    const parsed = richTextDocumentSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
