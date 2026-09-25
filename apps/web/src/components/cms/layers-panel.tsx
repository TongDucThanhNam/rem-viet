import { cn } from "@rem-viet/ui/lib/utils";
import type { CmsVisualNode } from "@agency/cms-visual-editor";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { editorMotion } from "./design-tokens";

type LayersPanelProps = {
  /** Root nodes của document. Mỗi node có thể có children qua `slots`. */
  roots: readonly CmsVisualNode[];
  selectedId?: string;
  hoveredId?: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Optional action chip đặt ở header (e.g. "Sync từ canvas"). */
  headerAction?: ReactNode;
};

function flattenNodes(roots: readonly CmsVisualNode[]): CmsVisualNode[] {
  const out: CmsVisualNode[] = [];
  const visit = (node: CmsVisualNode) => {
    out.push(node);
    if (node.slots) {
      for (const children of Object.values(node.slots)) {
        for (const child of children) visit(child);
      }
    }
  };
  for (const root of roots) visit(root);
  return out;
}

function countAllNodes(roots: readonly CmsVisualNode[]): number {
  return flattenNodes(roots).length;
}

function matchesQuery(node: CmsVisualNode, query: string): boolean {
  if (!query) return true;
  const type = node.type.toLowerCase();
  if (type.includes(query)) return true;
  // Try to read className from data — best effort, type-safe via unknown.
  const data = node.data as { className?: unknown } | null;
  if (data && typeof data.className === "string") {
    return data.className.toLowerCase().includes(query);
  }
  return false;
}

function nodeClassName(node: CmsVisualNode): string | null {
  const data = node.data as { className?: unknown } | null;
  if (data && typeof data.className === "string" && data.className.length > 0) {
    return data.className;
  }
  return null;
}

/**
 * Layers panel — mirror document tree, two-way binding với canvas.
 *
 * Instatic convention: tree bên trái khớp DOM, click row → highlight node,
 * hover row → highlight DOM qua postMessage (Phase 4 chưa wire postMessage —
 * đó là Phase 4.5 enhancement sau khi visual smoke test pass).
 */
export function LayersPanel({
  roots,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  headerAction,
}: LayersPanelProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const total = countAllNodes(roots);

  return (
    <aside
      aria-label="Layers panel"
      className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-white/10 bg-zinc-900/80 backdrop-blur"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Layers
        </h2>
        <span className="font-mono text-[10px] text-zinc-500">{total} nodes</span>
      </header>

      <div className="border-b border-white/10 p-2">
        <label className="relative block">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500"
          />
          <input
            aria-label="Tìm layer theo type hoặc class"
            className={cn(
              "w-full rounded-md border border-white/10 bg-black/35",
              "py-1.5 pl-7 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500",
              "focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-700/60",
              editorMotion.transition,
              editorMotion.reducedMotion,
            )}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo type hoặc class…"
            type="search"
            value={search}
          />
        </label>
        {headerAction ? (
          <div className="mt-2">{headerAction}</div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {roots.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-0.5" role="tree">
            {roots.map((root) => (
              <NodeRow
                depth={0}
                key={root.id}
                node={root}
                onHover={onHover}
                onSelect={onSelect}
                query={query}
                selectedId={selectedId}
                hoveredId={hoveredId}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function NodeRow({
  node,
  depth,
  query,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  node: CmsVisualNode;
  depth: number;
  query: string;
  selectedId?: string;
  hoveredId?: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const children: CmsVisualNode[] = node.slots
    ? Object.values(node.slots).flat()
    : [];
  const hasChildren = children.length > 0;
  const isSelected = node.id === selectedId;
  const isHovered = node.id === hoveredId;

  if (query && !matchesQuery(node, query) && !hasChildren) return null;

  const className = nodeClassName(node);
  const firstClass = className?.split(/\s+/)[0] ?? null;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={cn(
          "group flex w-full items-center gap-1.5 rounded px-1.5 py-1",
          "text-left text-xs cursor-pointer select-none",
          editorMotion.transition,
          editorMotion.reducedMotion,
          isSelected
            ? "bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
            : isHovered
              ? "bg-white/8 text-zinc-100"
              : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
        )}
        data-node-id={node.id}
        data-selected={isSelected || undefined}
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        <button
          aria-label={expanded ? "Thu gọn" : "Mở rộng"}
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded text-zinc-500",
            "hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1",
            "focus-visible:ring-zinc-700/60",
            editorMotion.transition,
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((current) => !current);
          }}
          tabIndex={hasChildren ? 0 : -1}
          type="button"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown aria-hidden className="size-3" />
            ) : (
              <ChevronRight aria-hidden className="size-3" />
            )
          ) : (
            <span aria-hidden className="size-1 rounded-full bg-zinc-700" />
          )}
        </button>

        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded font-mono text-[10px]",
            isSelected
              ? "bg-emerald-500/30 text-emerald-100"
              : "bg-white/5 text-zinc-500 group-hover:bg-white/10 group-hover:text-zinc-300",
          )}
        >
          {node.type.slice(0, 2)}
        </span>

        <span className="truncate font-medium">{node.type}</span>

        {firstClass ? (
          <span
            className="ml-auto truncate font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400"
            title={className ?? undefined}
          >
            .{firstClass}
          </span>
        ) : null}
      </div>

      {expanded && hasChildren ? (
        <ul className="flex flex-col gap-0.5" role="group">
          {children.map((child) => (
            <NodeRow
              depth={depth + 1}
              hoveredId={hoveredId}
              key={child.id}
              node={child}
              onHover={onHover}
              onSelect={onSelect}
              query={query}
              selectedId={selectedId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-2 px-4 py-12 text-center">
      <div className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5">
        <ChevronRight aria-hidden className="size-4 text-zinc-500" />
      </div>
      <p className="text-xs font-medium text-zinc-300">Chưa có layer nào</p>
      <p className="text-[11px] text-zinc-500">
        Click vào canvas hoặc thêm block mới để bắt đầu.
      </p>
    </div>
  );
}
