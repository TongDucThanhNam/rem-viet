import type { CmsPostFormValues } from "@/components/cms-post-form";
import { MAX_RICH_TEXT_BLOCK_ID_LENGTH } from "@rem-viet/cms";
import {
  isPostRichTextCompositionCommand,
  type PostRichTextCompositionCommand,
} from "@/lib/post-rich-text-composition";

export type PostPreviewField =
  "publishDate" | "title" | "description" | "coverImage" | "tags" | "content";

export const postPreviewFields = [
  "publishDate",
  "title",
  "description",
  "coverImage",
  "tags",
  "content",
] as const satisfies readonly PostPreviewField[];

export type PostPreviewMessage = {
  type: "cms:post-preview";
  postId: string;
  selectedField: PostPreviewField | null;
  selectedBlockIndex: number | null;
  values: CmsPostFormValues;
};

export type PostPreviewSelectMessage = {
  type: "cms:post-preview-select";
  postId: string;
  field: PostPreviewField;
  blockId?: string;
  blockIndex?: number;
  content?: string;
};

export type PostPreviewCompositionMessage = {
  type: "cms:post-preview-compose";
  postId: string;
  content: string;
  command: PostRichTextCompositionCommand;
};

const postPreviewStringFields = [
  "content",
  "coverImage",
  "description",
  "publishDate",
  "seoDescription",
  "seoTitle",
  "canonicalUrl",
  "ogImage",
  "title",
] as const satisfies readonly (keyof CmsPostFormValues)[];

export function isPostPreviewField(value: unknown): value is PostPreviewField {
  return postPreviewFields.includes(value as PostPreviewField);
}

export function isPostPreviewMessage(
  value: unknown,
  postId: string,
): value is PostPreviewMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.type !== "cms:post-preview" ||
    candidate.postId !== postId ||
    !candidate.values ||
    typeof candidate.values !== "object"
  )
    return false;
  const values = candidate.values as Record<string, unknown>;
  return (
    (candidate.selectedField === null ||
      isPostPreviewField(candidate.selectedField)) &&
    (candidate.selectedBlockIndex === null ||
      (candidate.selectedField === "content" &&
        Number.isInteger(candidate.selectedBlockIndex) &&
        Number(candidate.selectedBlockIndex) >= 0 &&
        Number(candidate.selectedBlockIndex) < 500)) &&
    postPreviewStringFields.every(
      (field) => typeof values[field] === "string",
    ) &&
    (values.slug === undefined || typeof values.slug === "string") &&
    Array.isArray(values.tags) &&
    values.tags.every((tag) => typeof tag === "string") &&
    typeof values.robotsIndex === "boolean" &&
    typeof values.robotsFollow === "boolean"
  );
}

export function isPostPreviewSelectMessage(
  value: unknown,
  postId: string,
): value is PostPreviewSelectMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const hasBlockSelection =
    candidate.blockId !== undefined ||
    candidate.blockIndex !== undefined ||
    candidate.content !== undefined;
  return (
    candidate.type === "cms:post-preview-select" &&
    candidate.postId === postId &&
    isPostPreviewField(candidate.field) &&
    (!hasBlockSelection ||
      (candidate.field === "content" &&
        Number.isInteger(candidate.blockIndex) &&
        Number(candidate.blockIndex) >= 0 &&
        Number(candidate.blockIndex) < 500 &&
        typeof candidate.blockId === "string" &&
        candidate.blockId.trim() === candidate.blockId &&
        candidate.blockId.length > 0 &&
        candidate.blockId.length <= MAX_RICH_TEXT_BLOCK_ID_LENGTH &&
        typeof candidate.content === "string"))
  );
}

export function isPostPreviewCompositionMessage(
  value: unknown,
  postId: string,
): value is PostPreviewCompositionMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "cms:post-preview-compose" &&
    candidate.postId === postId &&
    typeof candidate.content === "string" &&
    isPostRichTextCompositionCommand(candidate.command)
  );
}
