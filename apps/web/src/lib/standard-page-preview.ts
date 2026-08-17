export const unsavedStandardPagePreviewId = "__new-standard-page__";

export function isUnsavedStandardPagePreviewId(pageId: string) {
  return pageId === unsavedStandardPagePreviewId;
}
