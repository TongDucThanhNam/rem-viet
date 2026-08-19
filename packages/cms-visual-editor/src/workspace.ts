import type { CmsVisualFieldDefinition, CmsVisualNode } from "./registry.js";

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
