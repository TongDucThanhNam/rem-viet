import { CmsEditorShell, type CmsEditorShellProps } from "@agency/cms-admin";
import { forwardRef } from "react";

export type RemVietEditorShellProps = Omit<CmsEditorShellProps, "templateId">;

export const RemVietEditorShell = forwardRef<
  HTMLDivElement,
  RemVietEditorShellProps
>(function RemVietEditorShell(props, ref) {
  return (
    <CmsEditorShell
      {...props}
      ref={ref}
      templateId="@agency/cms-template-rem-viet"
    />
  );
});
