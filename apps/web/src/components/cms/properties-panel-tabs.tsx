import { cn } from "@rem-viet/ui/lib/utils";
import type { CmsVisualNode } from "@agency/cms-visual-editor";
import { Code2, Plus, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { editorMotion } from "./design-tokens";

type TabId = "attributes" | "styles";

type PropertiesPanelTabsProps = {
  selectedNode?: CmsVisualNode;
  onAttributeChange: (path: string, value: unknown) => void;
  onStyleChange: (css: string) => void;
  /** Override attribute fields render. Default: read common keys from data. */
  renderAttributeFields?: (node: CmsVisualNode) => ReactNode;
};

/**
 * Right-side properties panel — Instatic convention với 2 tabs.
 *
 * Attributes: data fields (id, type, schemaVersion, data.*)
 * Styles: scoped CSS editor (textarea inside `{ selector { ... } }` shell)
 */
export function PropertiesPanelTabs({
  selectedNode,
  onAttributeChange,
  onStyleChange,
  renderAttributeFields,
}: PropertiesPanelTabsProps) {
  const [tab, setTab] = useState<TabId>("attributes");

  if (!selectedNode) return <EmptyState />;

  return (
    <aside
      aria-label="Properties panel"
      className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-white/10 bg-zinc-900/80 backdrop-blur"
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2"
        data-selected-node={selectedNode.id}
      >
        <span className="grid size-5 shrink-0 place-items-center rounded bg-emerald-500/20 font-mono text-[10px] text-emerald-200">
          {selectedNode.type.slice(0, 2)}
        </span>
        <span className="truncate text-xs font-semibold text-zinc-100">
          {selectedNode.type}
        </span>
        <span className="ml-auto truncate font-mono text-[10px] text-zinc-500">
          {selectedNode.id.slice(0, 12)}
        </span>
      </div>

      <div
        className="flex shrink-0 border-b border-white/10"
        role="tablist"
        aria-label="Property sections"
      >
        <TabButton
          active={tab === "attributes"}
          icon={Settings2}
          label="Attributes"
          onClick={() => setTab("attributes")}
        />
        <TabButton
          active={tab === "styles"}
          icon={Code2}
          label="Styles"
          onClick={() => setTab("styles")}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "attributes" ? (
          <AttributesTab
            node={selectedNode}
            onChange={onAttributeChange}
            renderFields={renderAttributeFields}
          />
        ) : (
          <StylesTab node={selectedNode} onChange={onStyleChange} />
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Settings2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-2",
        "text-xs font-medium",
        editorMotion.transition,
        editorMotion.reducedMotion,
        active
          ? "text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5",
          active ? "bg-emerald-500" : "bg-transparent",
        )}
      />
    </button>
  );
}

function AttributesTab({
  node,
  onChange,
  renderFields,
}: {
  node: CmsVisualNode;
  onChange: (path: string, value: unknown) => void;
  renderFields?: (node: CmsVisualNode) => ReactNode;
}) {
  if (renderFields) {
    return <div className="space-y-3">{renderFields(node)}</div>;
  }

  const data = node.data as Record<string, unknown> | null;
  const fields: Array<{ key: string; value: string }> = [];
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        fields.push({ key, value: String(value) });
      }
    }
  }

  return (
    <div className="space-y-3">
      <FieldRow label="id" value={node.id} readOnly />
      <FieldRow label="type" value={node.type} readOnly />
      <FieldRow
        label="schemaVersion"
        value={String(node.schemaVersion)}
        readOnly
      />
      <FieldRow
        label="enabled"
        value={String(node.enabled)}
        readOnly
      />
      {fields.length > 0 ? (
        <>
          <div className="border-t border-white/10 pt-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Data fields
            </h3>
          </div>
          {fields.map(({ key, value }) => (
            <FieldRow
              key={key}
              label={key}
              onChange={(next) => onChange(`data.${key}`, next)}
              value={value}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        className={cn(
          "w-full rounded-md border border-white/10 bg-black/35 px-2.5 py-1.5",
          "font-mono text-xs text-zinc-100",
          "focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-700/60",
          "disabled:opacity-50",
          editorMotion.transition,
          editorMotion.reducedMotion,
        )}
        disabled={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        type="text"
        value={value}
      />
    </label>
  );
}

function StylesTab({
  node,
  onChange,
}: {
  node: CmsVisualNode;
  onChange: (css: string) => void;
}) {
  const data = node.data as { styles?: unknown } | null;
  const initial = data && typeof data.styles === "string" ? data.styles : "";
  const [css, setCss] = useState(initial);
  const selector = `[data-node-id="${node.id}"]`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Scoped CSS</span>
        <button
          aria-label="Thêm breakpoint"
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
            "text-emerald-400 hover:bg-white/5 hover:text-emerald-300",
            editorMotion.transition,
          )}
          type="button"
        >
          <Plus aria-hidden className="size-3" />
          Thêm breakpoint
        </button>
      </div>

      <div className="rounded-md border border-white/10 bg-black/35 p-2 font-mono text-xs">
        <div className="text-zinc-500">{selector} {"{"}</div>
        <textarea
          aria-label={`Scoped CSS cho ${node.type}`}
          className={cn(
            "block w-full resize-y bg-transparent px-2 py-1",
            "text-zinc-100 placeholder:text-zinc-600 focus:outline-none",
          )}
          onChange={(e) => {
            setCss(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="/* padding: 16px; */"
          rows={8}
          spellCheck={false}
          value={css}
        />
        <div className="text-zinc-500">{"}"}</div>
      </div>

      <p className="text-[10px] text-zinc-500">
        Styles áp dụng scope tới node này và children. KHÔNG leak ra ngoài.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <aside
      aria-label="Properties panel"
      className="flex h-full w-80 shrink-0 flex-col items-center justify-center border-l border-white/10 bg-zinc-900/80 p-6 text-center"
    >
      <div className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/5">
        <Settings2 aria-hidden className="size-5 text-zinc-500" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-zinc-300">Chưa chọn phần tử</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Click một phần tử trong canvas hoặc layers panel để chỉnh sửa.
      </p>
    </aside>
  );
}
