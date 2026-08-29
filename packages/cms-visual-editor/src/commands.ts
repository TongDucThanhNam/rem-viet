import {
  canCmsVisualAction,
  parseCmsVisualDocument,
  type CmsVisualComponentRegistry,
  type CmsVisualDocument,
  type CmsVisualNode,
} from "./registry.js";
import { assertCmsVisualPatternNodeBounds } from "./pattern-limits.js";

export type CmsVisualInsertLocation = Readonly<{
  parentId: string | null;
  slot?: string;
  index: number;
}>;

export type CmsVisualCommand =
  | Readonly<{
      type: "update-field";
      nodeId: string;
      fieldPath: string;
      value: unknown;
    }>
  | Readonly<{
      type: "insert";
      location: CmsVisualInsertLocation;
      node: CmsVisualNode;
    }>
  | Readonly<{
      type: "insert-pattern";
      location: CmsVisualInsertLocation;
      nodes: readonly CmsVisualNode[];
    }>
  | Readonly<{
      type: "move";
      nodeId: string;
      location: CmsVisualInsertLocation;
    }>
  | Readonly<{
      type: "duplicate";
      nodeId: string;
      createId: (sourceId: string) => string;
    }>
  | Readonly<{ type: "remove"; nodeId: string }>;

type NodeMatch = Readonly<{
  node: CmsVisualNode;
  parentId: string | null;
  slot: string | undefined;
  index: number;
}>;

function findNode(
  nodes: readonly CmsVisualNode[],
  nodeId: string,
  parentId: string | null = null,
  slot?: string,
): NodeMatch | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index] as CmsVisualNode;
    if (node.id === nodeId) return { node, parentId, slot, index };
    for (const [childSlot, children] of Object.entries(node.slots ?? {})) {
      const match = findNode(children, nodeId, node.id, childSlot);
      if (match) return match;
    }
  }
  return null;
}

function mapNode(
  nodes: readonly CmsVisualNode[],
  nodeId: string,
  map: (node: CmsVisualNode) => CmsVisualNode,
): readonly CmsVisualNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return map(node);
    let changed = false;
    const slots = Object.fromEntries(
      Object.entries(node.slots ?? {}).map(([slot, children]) => {
        const next = mapNode(children, nodeId, map);
        if (next !== children && findNode(children, nodeId)) changed = true;
        return [slot, next];
      }),
    );
    return changed ? { ...node, slots } : node;
  });
}

function replaceChildren(
  nodes: readonly CmsVisualNode[],
  parentId: string | null,
  slot: string | undefined,
  replace: (children: readonly CmsVisualNode[]) => readonly CmsVisualNode[],
): readonly CmsVisualNode[] {
  if (parentId === null) {
    if (slot !== undefined)
      throw new Error("Root visual insert cannot name a slot.");
    return replace(nodes);
  }
  if (!slot) throw new Error("Nested visual insert requires a slot.");
  const parent = findNode(nodes, parentId);
  if (!parent) throw new Error(`Unknown visual parent node: ${parentId}`);
  return mapNode(nodes, parentId, (node) => ({
    ...node,
    slots: {
      ...(node.slots ?? {}),
      [slot]: replace(node.slots?.[slot] ?? []),
    },
  }));
}

function removeNode(
  nodes: readonly CmsVisualNode[],
  match: NodeMatch,
): readonly CmsVisualNode[] {
  return replaceChildren(nodes, match.parentId, match.slot, (children) =>
    children.filter((node) => node.id !== match.node.id),
  );
}

function insertNode(
  nodes: readonly CmsVisualNode[],
  location: CmsVisualInsertLocation,
  node: CmsVisualNode,
): readonly CmsVisualNode[] {
  return replaceChildren(
    nodes,
    location.parentId,
    location.slot,
    (children) => {
      if (
        !Number.isSafeInteger(location.index) ||
        location.index < 0 ||
        location.index > children.length
      ) {
        throw new Error(
          `Visual insert index is out of bounds: ${location.index}`,
        );
      }
      return [
        ...children.slice(0, location.index),
        node,
        ...children.slice(location.index),
      ];
    },
  );
}

function insertNodes(
  nodes: readonly CmsVisualNode[],
  location: CmsVisualInsertLocation,
  inserted: readonly CmsVisualNode[],
): readonly CmsVisualNode[] {
  if (inserted.length === 0) {
    throw new Error("Visual patterns must insert at least one node.");
  }
  return replaceChildren(
    nodes,
    location.parentId,
    location.slot,
    (children) => {
      if (
        !Number.isSafeInteger(location.index) ||
        location.index < 0 ||
        location.index > children.length
      ) {
        throw new Error(
          `Visual insert index is out of bounds: ${location.index}`,
        );
      }
      return [
        ...children.slice(0, location.index),
        ...inserted,
        ...children.slice(location.index),
      ];
    },
  );
}

function cloneNode(
  node: CmsVisualNode,
  createId: (sourceId: string) => string,
): CmsVisualNode {
  return {
    ...node,
    id: createId(node.id),
    slots: node.slots
      ? Object.fromEntries(
          Object.entries(node.slots).map(([slot, children]) => [
            slot,
            children.map((child) => cloneNode(child, createId)),
          ]),
        )
      : undefined,
  };
}

function setFieldValue(data: unknown, path: string, value: unknown): unknown {
  const segments = path.split(".");
  const update = (current: unknown, index: number): unknown => {
    if (index === segments.length) return value;
    const segment = segments[index] as string;
    if (Array.isArray(current)) {
      const itemIndex = Number(segment);
      if (
        !Number.isSafeInteger(itemIndex) ||
        itemIndex < 0 ||
        itemIndex >= current.length
      ) {
        throw new Error(`Visual field array segment is invalid: ${segment}`);
      }
      return current.map((item, candidate) =>
        candidate === itemIndex ? update(item, index + 1) : item,
      );
    }
    if (!current || typeof current !== "object" || !(segment in current)) {
      throw new Error(`Visual field path does not exist: ${path}`);
    }
    const record = current as Record<string, unknown>;
    return { ...record, [segment]: update(record[segment], index + 1) };
  };
  return update(data, 0);
}

function requireAction(input: {
  registry: CmsVisualComponentRegistry;
  nodeType: string;
  action: "insert" | "edit" | "move" | "duplicate" | "remove";
  grants: ReadonlySet<string>;
  fieldPath?: string;
}): void {
  if (!canCmsVisualAction(input)) {
    throw new Error(
      `Visual editor permission denied for ${input.action} on ${input.nodeType}.`,
    );
  }
}

function requireInsertTrees(input: {
  registry: CmsVisualComponentRegistry;
  nodes: readonly CmsVisualNode[];
  grants: ReadonlySet<string>;
}): void {
  const pending = [...input.nodes];
  const visited = new Set<CmsVisualNode>();
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (visited.has(node)) {
      throw new Error(
        "Visual insert cannot contain cyclic or shared node objects.",
      );
    }
    visited.add(node);
    requireAction({
      registry: input.registry,
      nodeType: node.type,
      action: "insert",
      grants: input.grants,
    });
    for (const children of Object.values(node.slots ?? {})) {
      pending.push(...children);
    }
  }
}

export function applyCmsVisualCommand<TNode extends CmsVisualNode>(input: {
  document: CmsVisualDocument<TNode>;
  command: CmsVisualCommand;
  registry: CmsVisualComponentRegistry;
  grants: ReadonlySet<string>;
}): CmsVisualDocument {
  const current = parseCmsVisualDocument(input.document, input.registry);
  let nodes: readonly CmsVisualNode[] = current.nodes;
  const command = input.command;

  if (command.type === "update-field") {
    const match = findNode(nodes, command.nodeId);
    if (!match) throw new Error(`Unknown visual node: ${command.nodeId}`);
    requireAction({
      registry: input.registry,
      nodeType: match.node.type,
      action: "edit",
      grants: input.grants,
      fieldPath: command.fieldPath,
    });
    nodes = mapNode(nodes, command.nodeId, (node) => ({
      ...node,
      data: setFieldValue(node.data, command.fieldPath, command.value),
    }));
  } else if (command.type === "insert") {
    requireInsertTrees({
      registry: input.registry,
      nodes: [command.node],
      grants: input.grants,
    });
    nodes = insertNode(nodes, command.location, command.node);
  } else if (command.type === "insert-pattern") {
    assertCmsVisualPatternNodeBounds(command.nodes, "Visual pattern command");
    requireInsertTrees({
      registry: input.registry,
      nodes: command.nodes,
      grants: input.grants,
    });
    nodes = insertNodes(nodes, command.location, command.nodes);
  } else {
    const match = findNode(nodes, command.nodeId);
    if (!match) throw new Error(`Unknown visual node: ${command.nodeId}`);
    requireAction({
      registry: input.registry,
      nodeType: match.node.type,
      action: command.type,
      grants: input.grants,
    });
    if (command.type === "remove") {
      nodes = removeNode(nodes, match);
    } else if (command.type === "duplicate") {
      const duplicate = cloneNode(match.node, command.createId);
      nodes = insertNode(
        nodes,
        { parentId: match.parentId, slot: match.slot, index: match.index + 1 },
        duplicate,
      );
    } else {
      nodes = removeNode(nodes, match);
      let index = command.location.index;
      if (
        match.parentId === command.location.parentId &&
        match.slot === command.location.slot &&
        match.index < index
      ) {
        index -= 1;
      }
      nodes = insertNode(nodes, { ...command.location, index }, match.node);
    }
  }

  return parseCmsVisualDocument(
    { ...current, version: current.version + 1, nodes },
    input.registry,
  );
}
