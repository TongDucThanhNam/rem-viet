import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type CmsEditorShellMode = "standard" | "focused";
export type CmsEditorShellProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children"
> &
  Readonly<{
    label: string;
    documentId: string;
    documentType: string;
    templateId: string;
    mode?: CmsEditorShellMode;
    status?: ReactNode;
    children: ReactNode;
  }>;

/**
 * Template-neutral visual-editor landmark. Consumers own presentation while
 * the package keeps document identity, focus mode, live status, and landmark
 * semantics consistent across templates and routes.
 */
export const CmsEditorShell = forwardRef<HTMLDivElement, CmsEditorShellProps>(
  function CmsEditorShell(
    {
      children,
      documentId,
      documentType,
      label,
      mode = "standard",
      role,
      status,
      templateId,
      ...props
    },
    ref,
  ) {
    const focused = mode === "focused";
    return (
      <div
        {...props}
        aria-label={label}
        aria-modal={focused || undefined}
        data-cms-editor-document-id={documentId}
        data-cms-editor-document-type={documentType}
        data-cms-editor-mode={mode}
        data-cms-editor-shell="v1"
        data-cms-editor-template={templateId}
        ref={ref}
        role={role ?? (focused ? "dialog" : "region")}
      >
        {status === undefined ? null : (
          <output aria-live="polite" data-cms-editor-status="true">
            {status}
          </output>
        )}
        {children}
      </div>
    );
  },
);

export type CmsEditorShellPanelKind = "outline" | "canvas" | "inspector";
export type CmsEditorShellPanelProps = Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
> &
  Readonly<{
    kind: CmsEditorShellPanelKind;
    label: string;
    children: ReactNode;
  }>;

/** A consistent, discoverable landmark for shell outline/canvas/inspector slots. */
export function CmsEditorShellPanel({
  children,
  kind,
  label,
  ...props
}: CmsEditorShellPanelProps) {
  const Element = kind === "canvas" ? "section" : "aside";
  return (
    <Element
      {...props}
      aria-label={label}
      data-cms-editor-panel={kind}
      role="region"
    >
      {children}
    </Element>
  );
}
