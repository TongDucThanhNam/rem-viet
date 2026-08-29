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
  label?: (
    node: CmsVisualNode,
    definition: CmsVisualComponentDefinition,
  ) => string;
}): readonly CmsVisualOutlineItem[] {
  const document = parseCmsVisualDocument(input.document, input.registry);
  const nodeIds = new Set<string>();
  const collectIds = (nodes: readonly CmsVisualNode[]) => {
    for (const node of nodes) {
      nodeIds.add(node.id);
      for (const children of Object.values(node.slots ?? {})) {
        collectIds(children);
      }
    }
  };
  collectIds(document.nodes);
  const selection = normalizeCmsVisualSelection({
    selection: input.selection,
    nodeIds,
  });

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
            insert: action("insert"),
            edit: action("edit"),
            move: action("move"),
            duplicate: action("duplicate"),
            remove: action("remove"),
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
