import { RemVietEditorShell } from "@agency/cms-template-rem-viet/admin";
import type { KeyboardEventHandler, Key, ReactNode, Ref } from "react";

import CmsPostForm, { type CmsPostFormProps } from "@/components/cms-post-form";

export type PostEditorWorkspaceProps = {
  documentId: string;
  formKey?: Key;
  formProps: CmsPostFormProps;
  preview?: ReactNode;
  previewOpen?: boolean;
  workspaceFocused?: boolean;
  workspaceRef?: Ref<HTMLDivElement>;
  onWorkspaceKeyDown?: KeyboardEventHandler<HTMLDivElement>;
};

export default function PostEditorWorkspace({
  documentId,
  formKey,
  formProps,
  preview,
  previewOpen = false,
  workspaceFocused = false,
  workspaceRef,
  onWorkspaceKeyDown,
}: PostEditorWorkspaceProps) {
  const showPreview = previewOpen || workspaceFocused;

  return (
    <RemVietEditorShell
      className={
        workspaceFocused
          ? "fixed inset-3 z-[100] grid h-[calc(100dvh-1.5rem)] min-h-0 grid-cols-[minmax(0,1fr)_26rem] gap-0 overflow-hidden rounded-xl bg-background shadow-[0_30px_120px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
          : previewOpen
            ? "grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(24rem,38vw)]"
            : "contents"
      }
      data-cms-post-workspace-mode={workspaceFocused ? "focused" : "standard"}
      documentId={documentId}
      documentType="post"
      label="Không gian biên tập bài viết trực quan"
      mode={workspaceFocused ? "focused" : "standard"}
      ref={workspaceRef}
      onKeyDown={onWorkspaceKeyDown}
    >
      {showPreview && preview ? (
        <div
          className={
            workspaceFocused
              ? "order-1 min-h-0 overflow-hidden border-r"
              : "order-2 min-w-0 2xl:sticky 2xl:top-20"
          }
        >
          {preview}
        </div>
      ) : null}
      <div
        className={
          workspaceFocused
            ? "order-2 min-h-0 overflow-y-auto border-l bg-background p-4"
            : previewOpen
              ? "order-1 min-w-0"
              : "contents"
        }
      >
        <CmsPostForm key={formKey} {...formProps} />
      </div>
    </RemVietEditorShell>
  );
}
