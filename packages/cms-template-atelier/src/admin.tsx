import { CmsEditorShell, type CmsEditorShellProps } from "@agency/cms-admin";
import { forwardRef } from "react";

export type AtelierEditorShellProps = Omit<CmsEditorShellProps, "templateId">;

export const AtelierEditorShell = forwardRef<
  HTMLDivElement,
  AtelierEditorShellProps
>(function AtelierEditorShell(props, ref) {
  return (
    <CmsEditorShell
      {...props}
      ref={ref}
      templateId="@agency/cms-template-atelier"
    />
  );
});
