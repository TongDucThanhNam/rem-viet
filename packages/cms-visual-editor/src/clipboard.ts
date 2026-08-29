import {
  applyCmsVisualCommand,
  type CmsVisualInsertLocation,
} from "./commands.js";
import {
  CMS_VISUAL_PATTERN_MAX_NODES,
  CMS_VISUAL_PATTERN_MAX_ROOTS,
} from "./pattern-limits.js";
import {
  CMS_VISUAL_ID_PATTERN,
  CMS_VISUAL_TYPE_PATTERN,
  parseCmsVisualDocument,
  type CmsVisualComponentRegistry,
  type CmsVisualDocument,
  type CmsVisualNode,
} from "./registry.js";

export const CMS_VISUAL_CLIPBOARD_CHANNEL =
  "@agency/cms-visual-editor/clipboard/v1";
export const CMS_VISUAL_CLIPBOARD_MAX_CHARS = 1_000_000;

export type CmsVisualClipboardPayload = Readonly<{
  channel: typeof CMS_VISUAL_CLIPBOARD_CHANNEL;
  schemaVersion: 1;
  nodes: readonly CmsVisualNode[];
}>;

export type CmsVisualClipboardPasteResult = Readonly<{
  document: CmsVisualDocument;
  rootNodeIds: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertClipboardNodes(
  value: unknown,
): asserts value is CmsVisualNode[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > CMS_VISUAL_PATTERN_MAX_ROOTS
  ) {
    throw new Error(
      `Visual clipboard requires 1-${CMS_VISUAL_PATTERN_MAX_ROOTS} roots and at most ${CMS_VISUAL_PATTERN_MAX_NODES} total nodes.`,
    );
  }

  const pending: unknown[] = [...value];
  const visited = new Set<object>();
  const ids = new Set<string>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!isRecord(candidate)) {
      throw new Error("Visual clipboard contains an invalid node.");
    }
    if (visited.has(candidate)) {
      throw new Error(
        "Visual clipboard cannot contain cyclic or shared node objects.",
      );
    }
    visited.add(candidate);
    if (visited.size > CMS_VISUAL_PATTERN_MAX_NODES) {
      throw new Error(
        `Visual clipboard requires 1-${CMS_VISUAL_PATTERN_MAX_ROOTS} roots and at most ${CMS_VISUAL_PATTERN_MAX_NODES} total nodes.`,
      );
    }
    if (
      typeof candidate.id !== "string" ||
      !CMS_VISUAL_ID_PATTERN.test(candidate.id) ||
      ids.has(candidate.id) ||
      typeof candidate.type !== "string" ||
      !CMS_VISUAL_TYPE_PATTERN.test(candidate.type) ||
      !Number.isSafeInteger(candidate.schemaVersion) ||
      Number(candidate.schemaVersion) < 1 ||
      typeof candidate.enabled !== "boolean" ||
      !("data" in candidate)
    ) {
      throw new Error("Visual clipboard contains an invalid node envelope.");
    }
    ids.add(candidate.id);
    if (candidate.slots === undefined) continue;
    if (!isRecord(candidate.slots)) {
      throw new Error("Visual clipboard contains invalid node slots.");
    }
    for (const [slot, children] of Object.entries(candidate.slots)) {
      if (!CMS_VISUAL_TYPE_PATTERN.test(slot) || !Array.isArray(children)) {
        throw new Error("Visual clipboard contains invalid node slots.");
      }
      pending.push(...children);
    }
  }
}

function normalizeClipboardPayload(value: unknown): CmsVisualClipboardPayload {
  if (!isRecord(value)) {
    throw new Error("Visual clipboard payload is invalid.");
  }
  if (
    value.channel !== CMS_VISUAL_CLIPBOARD_CHANNEL ||
    value.schemaVersion !== 1
  ) {
    throw new Error("Visual clipboard channel or schema version is invalid.");
  }
  assertClipboardNodes(value.nodes);
  return value as CmsVisualClipboardPayload;
}

function serializePayload(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    throw new Error("Visual clipboard content must be serializable JSON.");
  }
  if (!text || text.length > CMS_VISUAL_CLIPBOARD_MAX_CHARS) {
    throw new Error("Visual clipboard content is too large.");
  }
  return text;
}

function visitNodes(
  nodes: readonly CmsVisualNode[],
  visit: (node: CmsVisualNode) => void,
): void {
  const pending = [...nodes];
  while (pending.length > 0) {
    const node = pending.pop()!;
    visit(node);
    for (const children of Object.values(node.slots ?? {})) {
      pending.push(...children);
    }
  }
}

export function createCmsVisualClipboardPayload(input: {
  document: CmsVisualDocument;
  registry: CmsVisualComponentRegistry;
  nodeIds: readonly string[];
}): CmsVisualClipboardPayload {
  const current = parseCmsVisualDocument(input.document, input.registry);
  if (
    input.nodeIds.length === 0 ||
    input.nodeIds.length > CMS_VISUAL_PATTERN_MAX_ROOTS ||
    new Set(input.nodeIds).size !== input.nodeIds.length
  ) {
    throw new Error("Visual clipboard requires unique selected node IDs.");
  }
  const byId = new Map<string, CmsVisualNode>();
  visitNodes(current.nodes, (node) => byId.set(node.id, node));
  const nodes = input.nodeIds.map((nodeId) => {
    const node = byId.get(nodeId);
    if (!node) throw new Error(`Unknown visual node: ${nodeId}`);
    return node;
  });
  const text = serializePayload({
    channel: CMS_VISUAL_CLIPBOARD_CHANNEL,
    schemaVersion: 1,
    nodes,
  });
  return parseCmsVisualClipboardText(text);
}

export function serializeCmsVisualClipboardPayload(
  payload: CmsVisualClipboardPayload,
): string {
  normalizeClipboardPayload(payload);
  return serializePayload(payload);
}

export function parseCmsVisualClipboardText(
  text: string,
): CmsVisualClipboardPayload {
  if (!text || text.length > CMS_VISUAL_CLIPBOARD_MAX_CHARS) {
    throw new Error("Visual clipboard content is empty or too large.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Visual clipboard content is not valid JSON.");
  }
  const payload = normalizeClipboardPayload(value);
  return Object.freeze({
    ...payload,
    nodes: Object.freeze([...payload.nodes]),
  });
}

export function applyCmsVisualClipboardPaste(input: {
  document: CmsVisualDocument;
  registry: CmsVisualComponentRegistry;
  payload: CmsVisualClipboardPayload;
  location: CmsVisualInsertLocation;
  createId: (source: Readonly<{ id: string; type: string }>) => string;
  grants: ReadonlySet<string>;
}): CmsVisualClipboardPasteResult {
  const current = parseCmsVisualDocument(input.document, input.registry);
  const payload = normalizeClipboardPayload(input.payload);
  const claimed = new Set<string>();
  visitNodes(current.nodes, (node) => claimed.add(node.id));

  const cloneNode = (source: CmsVisualNode): CmsVisualNode => {
    const id = input.createId({ id: source.id, type: source.type });
    if (!CMS_VISUAL_ID_PATTERN.test(id) || claimed.has(id)) {
      throw new Error(
        `Visual clipboard generated an invalid or duplicate ID: ${id}`,
      );
    }
    claimed.add(id);
    let data: unknown;
    try {
      data = structuredClone(source.data);
    } catch {
      throw new Error("Visual clipboard node data could not be cloned.");
    }
    return {
      ...source,
      id,
      data,
      slots: source.slots
        ? Object.fromEntries(
            Object.entries(source.slots).map(([slot, children]) => [
              slot,
              children.map(cloneNode),
            ]),
          )
        : undefined,
    };
  };

  const nodes = payload.nodes.map(cloneNode);
  const document = applyCmsVisualCommand({
    document: current,
    registry: input.registry,
    grants: input.grants,
    command: {
      type: "insert-pattern",
      location: input.location,
      nodes,
    },
  });
  return Object.freeze({
    document,
    rootNodeIds: Object.freeze(nodes.map(({ id }) => id)),
  });
}
