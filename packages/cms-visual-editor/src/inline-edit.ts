import { applyCmsVisualCommand } from "./commands.js";
import {
  canCmsVisualAction,
  type CmsVisualComponentRegistry,
  type CmsVisualDocument,
  type CmsVisualNode,
} from "./registry.js";

export type CmsVisualInlineTextTarget = Readonly<{
  blockId: string;
  fieldPath: string;
  label: string;
  maxLength: number;
  multiline: boolean;
}>;

function visitNodes(
  nodes: readonly CmsVisualNode[],
  visit: (node: CmsVisualNode) => void,
): void {
  const pending = [...nodes];
  const visited = new Set<CmsVisualNode>();
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (visited.has(node)) {
      throw new Error(
        "Visual inline-edit discovery cannot traverse cyclic or shared node objects.",
      );
    }
    visited.add(node);
    visit(node);
    for (const children of Object.values(node.slots ?? {})) {
      pending.push(...children);
    }
  }
}

export function getCmsVisualInlineTextTargets(input: {
  nodes: readonly CmsVisualNode[];
  registry: CmsVisualComponentRegistry;
  grants: ReadonlySet<string>;
}): readonly CmsVisualInlineTextTarget[] {
  const targets: CmsVisualInlineTextTarget[] = [];
  visitNodes(input.nodes, (node) => {
    const definition = input.registry.require(node.type);
    for (const field of definition.fields) {
      if (
        !field.inlineText ||
        !canCmsVisualAction({
          registry: input.registry,
          nodeType: node.type,
          action: "edit",
          grants: input.grants,
          fieldPath: field.path,
        })
      ) {
        continue;
      }
      targets.push(
        Object.freeze({
          blockId: node.id,
          fieldPath: field.path,
          label: field.label,
          maxLength: field.inlineText.maxLength ?? 256,
          multiline: field.inlineText.multiline ?? false,
        }),
      );
    }
  });
  return Object.freeze(targets);
}

export function normalizeCmsVisualInlineTextValue(input: {
  registry: CmsVisualComponentRegistry;
  nodeType: string;
  fieldPath: string;
  value: string;
}): string {
  const field = input.registry
    .require(input.nodeType)
    .fields.find((candidate) => candidate.path === input.fieldPath);
  if (!field?.inlineText) {
    throw new Error(
      `Visual field ${input.nodeType}.${input.fieldPath} does not allow inline text editing.`,
    );
  }
  const normalized = input.value.normalize("NFC").replace(/\r\n?/gu, "\n");
  if (!field.inlineText.multiline && normalized.includes("\n")) {
    throw new Error(
      `Visual inline text field ${input.nodeType}.${input.fieldPath} does not allow line breaks.`,
    );
  }
  const trimmed = normalized.trim();
  const maxLength = field.inlineText.maxLength ?? 256;
  if ((field.required && !trimmed) || [...trimmed].length > maxLength) {
    throw new Error(
      `Visual inline text field ${input.nodeType}.${input.fieldPath} must contain ${field.required ? "1" : "0"}-${maxLength} characters.`,
    );
  }
  return trimmed;
}

export function applyCmsVisualInlineTextUpdate(input: {
  document: CmsVisualDocument;
  registry: CmsVisualComponentRegistry;
  nodeId: string;
  fieldPath: string;
  value: string;
  grants: ReadonlySet<string>;
}): CmsVisualDocument {
  let node: CmsVisualNode | undefined;
  visitNodes(input.document.nodes, (candidate) => {
    if (candidate.id === input.nodeId) node = candidate;
  });
  if (!node) throw new Error(`Unknown visual node: ${input.nodeId}`);
  const value = normalizeCmsVisualInlineTextValue({
    registry: input.registry,
    nodeType: node.type,
    fieldPath: input.fieldPath,
    value: input.value,
  });
  return applyCmsVisualCommand({
    document: input.document,
    registry: input.registry,
    grants: input.grants,
    command: {
      type: "update-field",
      nodeId: input.nodeId,
      fieldPath: input.fieldPath,
      value,
    },
  });
}
