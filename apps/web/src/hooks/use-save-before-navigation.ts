import {
  openCmsPreviewAfterSave,
  useCmsDraftFlush,
  type OpenCmsPreviewResult,
} from "@agency/cms-admin";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useRef } from "react";

type SaveBeforeNavigationOptions = {
  dirty: boolean;
  saving: boolean;
  save: () => Promise<unknown | null | false>;
};

export type OpenAfterSaveResult = OpenCmsPreviewResult;

/**
 * Flushes a dirty editor before TanStack Router leaves the current page.
 * Browser/tab shutdown still uses the router's native beforeunload warning,
 * because browsers do not allow a reliable asynchronous save during unload.
 */
export function useSaveBeforeNavigation({
  dirty,
  saving,
  save,
}: SaveBeforeNavigationOptions) {
  const latestDirty = useRef(dirty);
  latestDirty.current = dirty;
  const flushCurrentDraft = useCmsDraftFlush({ dirty, saving, save });

  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: () => latestDirty.current,
    shouldBlockFn: async () => !(await flushCurrentDraft()),
  });

  const openAfterSave = useCallback(
    async (url: string): Promise<OpenAfterSaveResult> => {
      return openCmsPreviewAfterSave({
        url,
        flushDraft: flushCurrentDraft,
        openPlaceholder: () => {
          // Open synchronously inside the click event so popup blockers retain
          // the user gesture. The private URL is assigned only after save.
          const preview = window.open("about:blank", "_blank");
          if (!preview) return null;
          preview.opener = null;
          preview.document.title = "Đang chuẩn bị bản xem trước…";
          const message = preview.document.createElement("p");
          message.textContent = "Đang lưu bản nháp trước khi mở bản xem trước…";
          message.style.cssText =
            "font: 500 14px system-ui; margin: 0; padding: 32px; color: #222";
          preview.document.body.replaceChildren(message);
          return {
            close: () => preview.close(),
            navigate: (nextUrl) => preview.location.replace(nextUrl),
          };
        },
      });
    },
    [flushCurrentDraft],
  );

  return { flushCurrentDraft, openAfterSave };
}
