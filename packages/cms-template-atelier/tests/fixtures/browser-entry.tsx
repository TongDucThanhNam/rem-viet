import {
  applyCmsVisualCommand,
  commitCmsDraftHistory,
  createCmsDraftHistory,
  undoCmsDraftHistory,
  type CmsVisualDocument,
} from "../../../cms-visual-editor/src/index";
import {
  createAtelierDefaultDocument,
  atelierTemplateFactory,
} from "../../src/visual-authoring";
import { AtelierDocument, type AtelierPublicNode } from "../../src/index";
import { useState, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";

const grants = new Set([
  "content.compose.insert",
  "content.component.edit",
  "content.compose.move",
  "content.compose.duplicate",
  "content.compose.remove",
]);

function AtelierBrowserFixture() {
  const [history, setHistory] = useState(() =>
    createCmsDraftHistory(createAtelierDefaultDocument("atelier-browser")),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const document = history.present;

  const editMasthead = () => {
    setHistory((current) => {
      const next = applyCmsVisualCommand({
        document: current.present,
        registry: atelierTemplateFactory.registry,
        grants,
        command: {
          type: "update-field",
          nodeId: "home-masthead",
          fieldPath: "title",
          value: "Atelier Browser Edition",
        },
      });
      return commitCmsDraftHistory(current, next as typeof current.present, {
        limit: 10,
      });
    });
  };

  const selectBlock = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const block = target.closest<HTMLElement>("[data-atelier-block]");
    setSelected(block?.dataset.atelierId ?? null);
  };

  return (
    <div data-document-version={document.version} onClickCapture={selectBlock}>
      <nav aria-label="Atelier authoring controls">
        <button type="button" onClick={editMasthead}>
          Edit masthead
        </button>
        <button
          disabled={history.past.length === 0}
          type="button"
          onClick={() => setHistory((current) => undoCmsDraftHistory(current))}
        >
          Undo
        </button>
        <output aria-live="polite">
          {selected ? `Selected ${selected}` : "Nothing selected"}
        </output>
      </nav>
      <AtelierDocument
        nodes={
          (document as CmsVisualDocument).nodes as readonly AtelierPublicNode[]
        }
      />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Atelier browser fixture root is missing.");
createRoot(root).render(<AtelierBrowserFixture />);
