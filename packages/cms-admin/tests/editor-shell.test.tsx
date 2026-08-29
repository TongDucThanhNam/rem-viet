import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CmsEditorShell,
  CmsEditorShellPanel,
  CmsVisualOutline,
  createCmsVisualComponentRegistry,
  createCmsVisualOutline,
  defineCmsVisualComponent,
} from "../src";

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

  test("renders a permission-aware nested tree with injected labels and actions", () => {
    const registry = createCmsVisualComponentRegistry([
      defineCmsVisualComponent({
        type: "layout",
        schemaVersion: 1,
        fields: [],
        defaults: () => ({}),
        validate: () => ({}),
        renderer: "layout-renderer",
        editor: "layout-editor",
        constraints: {
          slots: {
            content: { allowedChildren: ["textBlock"] },
          },
        },
      }),
      defineCmsVisualComponent({
        type: "textBlock",
        schemaVersion: 1,
        fields: [],
        defaults: () => ({}),
        validate: () => ({}),
        renderer: "text-renderer",
        editor: "text-editor",
        constraints: { allowedParents: ["layout"] },
        actionCapabilities: { edit: ["content.component.edit"] },
      }),
    ]);
    const outline = createCmsVisualOutline({
      document: {
        id: "page-1",
        siteId: "site-1",
        schemaVersion: 1,
        version: 0,
        nodes: [
          {
            id: "layout-1",
            type: "layout",
            schemaVersion: 1,
            enabled: true,
            data: {},
            slots: {
              content: [
                {
                  id: "text-1",
                  type: "textBlock",
                  schemaVersion: 1,
                  enabled: true,
                  data: {},
                },
              ],
            },
          },
        ],
      },
      registry,
      grants: new Set(),
      selection: { nodeId: "text-1" },
      label: (node) => (node.type === "layout" ? "Layout" : "Text"),
    });
    const html = renderToStaticMarkup(
      <CmsVisualOutline
        items={outline}
        label="Document outline"
        onSelectNode={() => undefined}
        itemAttributes={(item) => ({
          draggable: item.actions.move,
          title: `Outline item ${item.label}`,
        })}
        renderActions={(item) => <span>Actions for {item.label}</span>}
      />,
    );
    expect(html).toContain('role="tree"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-level="2"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-cms-outline-node-id="text-1"');
    expect(html).toContain('data-cms-outline-can-edit="false"');
    expect(html).toContain('title="Outline item Text"');
    expect(html).toContain("Actions for Text");
  });
});
