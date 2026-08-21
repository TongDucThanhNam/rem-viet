import {
  isCmsVisualEditorMessage,
  type CmsVisualEditorStateMessage,
} from "@agency/cms-visual-editor";
import {
  remVietStandardBlockSchema,
  type RemVietStandardBlock,
} from "@agency/cms-template-rem-viet";
import { pageBlockListSchema, type PageBlock } from "@rem-viet/cms";

export const unsavedStandardPagePreviewId = "new-standard-page-draft";

export function isUnsavedStandardPagePreviewId(pageId: string) {
  return pageId === unsavedStandardPagePreviewId;
}

export type StandardPagePreviewState = Readonly<{
  pageId: string;
  title: string;
  blocks: PageBlock[];
  visualState: CmsVisualEditorStateMessage<RemVietStandardBlock>;
}>;

export function parseStandardPagePreviewState(
  value: unknown,
  expectedPageId: string,
): StandardPagePreviewState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.pageId !== expectedPageId ||
    typeof candidate.title !== "string" ||
    candidate.title.length > 500 ||
    !isCmsVisualEditorMessage(candidate.visualState) ||
    candidate.visualState.type !== "state"
  ) {
    return null;
  }
  const blocks = pageBlockListSchema.safeParse(candidate.blocks);
  const visualBlocks = remVietStandardBlockSchema
    .array()
    .safeParse(candidate.visualState.blocks);
  if (!blocks.success || !visualBlocks.success) return null;
  return Object.freeze({
    pageId: expectedPageId,
    title: candidate.title,
    blocks: blocks.data,
    visualState: Object.freeze({
      ...candidate.visualState,
      blocks: visualBlocks.data,
    }),
  });
}
