import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CmsEditorShell, CmsEditorShellPanel } from "../src";

describe("visual editor shell", () => {
  test("renders template-neutral document identity and accessible landmarks", () => {
    const html = renderToStaticMarkup(
      <CmsEditorShell
        documentId="home"
        documentType="homepage"
        label="Homepage editor"
        mode="focused"
        status="Draft saved"
        templateId="fixture-template"
      >
        <CmsEditorShellPanel kind="outline" label="Document outline">
          Outline
        </CmsEditorShellPanel>
        <CmsEditorShellPanel kind="canvas" label="Visual canvas">
          Canvas
        </CmsEditorShellPanel>
        <CmsEditorShellPanel kind="inspector" label="Field inspector">
          Inspector
        </CmsEditorShellPanel>
      </CmsEditorShell>,
    );

    expect(html).toContain('data-cms-editor-shell="v1"');
    expect(html).toContain('data-cms-editor-template="fixture-template"');
    expect(html).toContain('data-cms-editor-document-id="home"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-cms-editor-panel="outline"');
    expect(html).toContain('data-cms-editor-panel="canvas"');
    expect(html).toContain('data-cms-editor-panel="inspector"');
  });

  test("uses a non-modal region in the standard workspace", () => {
    const html = renderToStaticMarkup(
      <CmsEditorShell
        documentId="post-1"
        documentType="post"
        label="Post editor"
        templateId="fixture-template"
      >
        Content
      </CmsEditorShell>,
    );
    expect(html).toContain('role="region"');
    expect(html).not.toContain("aria-modal");
  });
});
