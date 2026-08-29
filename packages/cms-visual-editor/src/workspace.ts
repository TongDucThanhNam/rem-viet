import {
  canCmsVisualAction,
  parseCmsVisualDocument,
  type CmsVisualAction,
  type CmsVisualComponentDefinition,
  type CmsVisualComponentRegistry,
  type CmsVisualDocument,
  type CmsVisualFieldDefinition,
  type CmsVisualNode,
} from "./registry.js";

export type CmsVisualSelection = Readonly<{
  nodeId: string | null;
  fieldPath?: string;
}>;

export type CmsVisualInspectorField = Readonly<{
  definition: CmsVisualFieldDefinition;
  value: unknown;
  editable: boolean;
  denialReason?: string;
}>;

export type CmsVisualInspectorModel = Readonly<{
  selection: CmsVisualSelection;
  node: CmsVisualNode | null;
  fields: readonly CmsVisualInspectorField[];
}>;

export type CmsVisualWorkspaceState = Readonly<{
  selection: CmsVisualSelection;
  viewport: "desktop" | "tablet" | "mobile";
  inspectorOpen: boolean;
}>;

export type CmsVisualOutlineActions = Readonly<
  Record<CmsVisualAction, boolean>
>;

export type CmsVisualOutlineItem = Readonly<{
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  parentId: string | null;
  slot?: string;
  index: number;
  depth: number;
  selected: boolean;
  actions: CmsVisualOutlineActions;
  children: readonly CmsVisualOutlineItem[];
}>;

export type CmsVisualOutlineKeyboardKey =
  | "ArrowDown"
  | "ArrowUp"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "Enter"
  | " ";

export type CmsVisualOutlineKeyboardResult = Readonly<{
  focusNodeId: string | null;
  expandedNodeIds: readonly string[];
  activateNodeId: string | null;
}>;

export function normalizeCmsVisualSelection(input: {
  selection: CmsVisualSelection;
  nodeIds: ReadonlySet<string>;
}): CmsVisualSelection {
  if (input.selection.nodeId === null) return Object.freeze({ nodeId: null });
  if (!input.nodeIds.has(input.selection.nodeId)) {
    return Object.freeze({ nodeId: null });
  }
  return Object.freeze({ ...input.selection });
}

function normalizeOutlineLabel(value: string, fallback: string): string {
  const label = value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!label) return fallback;
  return [...label].slice(0, 160).join("");
}

/**
 * Builds the permission-aware nested outline from the canonical document.
 * Labels are presentation-only; identity, nesting, selection, and action
 * availability always come from the validated registry and grants.
 */
export function createCmsVisualOutline(input: {
  document: CmsVisualDocument;
  registry: CmsVisualComponentRegistry;
  grants: ReadonlySet<string>;
  selection: CmsVisualSelection;
  maxNodes?: number;
  label?: (
    node: CmsVisualNode,
    definition: CmsVisualComponentDefinition,
  ) => string;
}): readonly CmsVisualOutlineItem[] {
  const document = parseCmsVisualDocument(input.document, input.registry);
  const nodeIds = new Set<string>();
  const nodesById = new Map<string, CmsVisualNode>();
  const typeCounts = new Map<string, number>();
  const collectIds = (nodes: readonly CmsVisualNode[]) => {
    for (const node of nodes) {
      nodeIds.add(node.id);
      nodesById.set(node.id, node);
      typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
      for (const children of Object.values(node.slots ?? {})) {
        collectIds(children);
      }
    }
  };
  collectIds(document.nodes);
  if (
    input.maxNodes !== undefined &&
    (!Number.isSafeInteger(input.maxNodes) ||
      input.maxNodes < 1 ||
      nodeIds.size > input.maxNodes)
  ) {
    throw new Error(
      "Visual outline maxNodes must be a positive integer no smaller than the current document.",
    );
  }
  const selection = normalizeCmsVisualSelection({
    selection: input.selection,
    nodeIds,
  });

  const subtreeTypeCounts = (root: CmsVisualNode) => {
    const counts = new Map<string, number>();
    const pending = [root];
    while (pending.length > 0) {
      const node = pending.pop()!;
      counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
      for (const children of Object.values(node.slots ?? {})) {
        pending.push(...children);
      }
    }
    return counts;
  };

  const respectsGlobalCounts = (
    node: CmsVisualNode,
    direction: "add" | "remove",
  ) => {
    for (const [type, delta] of subtreeTypeCounts(node)) {
      const definition = input.registry.require(type);
      const current = typeCounts.get(type) ?? 0;
      const next = current + (direction === "add" ? delta : -delta);
      if (
        next < (definition.constraints?.min ?? 0) ||
        next > (definition.constraints?.max ?? Number.MAX_SAFE_INTEGER)
      ) {
        return false;
      }
    }
    return true;
  };

  const respectsDocumentNodeLimit = (node: CmsVisualNode) => {
    if (input.maxNodes === undefined) return true;
    const subtreeSize = [...subtreeTypeCounts(node).values()].reduce(
      (total, count) => total + count,
      0,
    );
    return nodeIds.size + subtreeSize <= input.maxNodes;
  };

  const slotBounds = (
    parentId: string | null,
    slot: string | undefined,
    siblingCount: number,
  ) => {
    if (!parentId || !slot) {
      return { canAdd: true, canRemove: true } as const;
    }
    const parent = nodesById.get(parentId);
    const constraint = parent
      ? input.registry.require(parent.type).constraints?.slots?.[slot]
      : undefined;
    return {
      canAdd:
        siblingCount < (constraint?.max ?? Number.MAX_SAFE_INTEGER),
      canRemove: siblingCount > (constraint?.min ?? 0),
    } as const;
  };

  const build = (
    nodes: readonly CmsVisualNode[],
    parentId: string | null,
    slot: string | undefined,
    depth: number,
  ): readonly CmsVisualOutlineItem[] =>
    Object.freeze(
      nodes.map((node, index) => {
        const definition = input.registry.require(node.type);
        const children = Object.entries(node.slots ?? {}).flatMap(
          ([childSlot, childNodes]) =>
            build(childNodes, node.id, childSlot, depth + 1),
        );
        const action = (value: CmsVisualAction) =>
          canCmsVisualAction({
            registry: input.registry,
            nodeType: node.type,
            action: value,
            grants: input.grants,
          });
        const bounds = slotBounds(parentId, slot, nodes.length);
        const pinned = Boolean(definition.constraints?.pinned);
        const movableSiblingCount = nodes.filter(
          (candidate) =>
            !input.registry.require(candidate.type).constraints?.pinned,
        ).length;
        return Object.freeze({
          id: node.id,
          type: node.type,
          label: normalizeOutlineLabel(
            input.label?.(node, definition) ?? node.type,
            node.type,
          ),
          enabled: node.enabled,
          parentId,
          ...(slot === undefined ? {} : { slot }),
          index,
          depth,
          selected: selection.nodeId === node.id,
          actions: Object.freeze({
            insert:
              action("insert") &&
              bounds.canAdd &&
              respectsGlobalCounts(node, "add") &&
              respectsDocumentNodeLimit(node),
            edit: action("edit"),
            move: action("move") && !pinned && movableSiblingCount > 1,
            duplicate:
              action("duplicate") &&
              !pinned &&
              bounds.canAdd &&
              respectsGlobalCounts(node, "add") &&
              respectsDocumentNodeLimit(node),
            remove:
              action("remove") &&
              !pinned &&
              bounds.canRemove &&
              respectsGlobalCounts(node, "remove"),
          }),
          children: Object.freeze(children),
        });
      }),
    );

  return build(document.nodes, null, undefined, 0);
}

export function flattenCmsVisualOutline(
  items: readonly CmsVisualOutlineItem[],
  expandedNodeIds?: ReadonlySet<string>,
): readonly CmsVisualOutlineItem[] {
  const flattened: CmsVisualOutlineItem[] = [];
  const visit = (nodes: readonly CmsVisualOutlineItem[]) => {
    for (const item of nodes) {
      flattened.push(item);
      if (expandedNodeIds === undefined || expandedNodeIds.has(item.id)) {
        visit(item.children);
      }
    }
  };
  visit(items);
  return Object.freeze(flattened);
}

export function getCmsVisualOutlineExpandableNodeIds(
  items: readonly CmsVisualOutlineItem[],
): readonly string[] {
  return Object.freeze(
    flattenCmsVisualOutline(items)
      .filter(({ children }) => children.length > 0)
      .map(({ id }) => id),
  );
}

function orderedExpandedIds(
  items: readonly CmsVisualOutlineItem[],
  expanded: ReadonlySet<string>,
): readonly string[] {
  return Object.freeze(
    getCmsVisualOutlineExpandableNodeIds(items).filter((id) =>
      expanded.has(id),
    ),
  );
}

/**
 * Resolves WAI-ARIA tree keyboard behavior without DOM or framework coupling.
 * The UI applies the returned focus/expansion state and activates selection
 * only when `activateNodeId` is non-null.
 */
export function reduceCmsVisualOutlineKeyboard(input: {
  items: readonly CmsVisualOutlineItem[];
  focusedNodeId: string | null;
  expandedNodeIds: ReadonlySet<string>;
  key: CmsVisualOutlineKeyboardKey;
}): CmsVisualOutlineKeyboardResult {
  const expandable = new Set(getCmsVisualOutlineExpandableNodeIds(input.items));
  const expanded = new Set(
    [...input.expandedNodeIds].filter((id) => expandable.has(id)),
  );
  const visible = flattenCmsVisualOutline(input.items, expanded);
  if (visible.length === 0) {
    return Object.freeze({
      focusNodeId: null,
      expandedNodeIds: Object.freeze([]),
      activateNodeId: null,
    });
  }
  let index = visible.findIndex(({ id }) => id === input.focusedNodeId);
  if (index < 0) index = 0;
  const current = visible[index]!;
  let focusNodeId = current.id;
  let activateNodeId: string | null = null;

  if (input.key === "ArrowDown") {
    focusNodeId = visible[Math.min(index + 1, visible.length - 1)]!.id;
  } else if (input.key === "ArrowUp") {
    focusNodeId = visible[Math.max(index - 1, 0)]!.id;
  } else if (input.key === "Home") {
    focusNodeId = visible[0]!.id;
  } else if (input.key === "End") {
    focusNodeId = visible.at(-1)!.id;
  } else if (input.key === "ArrowRight" && current.children.length > 0) {
    if (!expanded.has(current.id)) expanded.add(current.id);
    else focusNodeId = current.children[0]!.id;
  } else if (input.key === "ArrowLeft") {
    if (current.children.length > 0 && expanded.has(current.id)) {
      expanded.delete(current.id);
    } else if (current.parentId) {
      focusNodeId = current.parentId;
    }
  } else if (input.key === "Enter" || input.key === " ") {
    activateNodeId = current.id;
  }

  return Object.freeze({
    focusNodeId,
    expandedNodeIds: orderedExpandedIds(input.items, expanded),
    activateNodeId,
  });
}
