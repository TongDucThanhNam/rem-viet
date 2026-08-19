import type { CmsVisualDocument, CmsVisualNode } from "./registry.js";

export type CmsVisualEditorAdapterCapabilities = Readonly<{
  clickToEdit: boolean;
  dragAndDrop: boolean;
  nestedSlots: boolean;
  responsivePreview: boolean;
  keyboardComposition: boolean;
}>;

export interface CmsVisualEditorAdapter<
  TState,
  TNode extends CmsVisualNode = CmsVisualNode,
> {
  readonly id: string;
  readonly version: string;
  readonly capabilities: CmsVisualEditorAdapterCapabilities;
  fromCanonical(document: CmsVisualDocument<TNode>): TState;
  toCanonical(
    state: TState,
    baseline: CmsVisualDocument<TNode>,
  ): CmsVisualDocument<TNode>;
}

export function assertCmsVisualAdapterRoundTrip<
  TState,
  TNode extends CmsVisualNode,
>(input: {
  adapter: CmsVisualEditorAdapter<TState, TNode>;
  document: CmsVisualDocument<TNode>;
}): void {
  const result = input.adapter.toCanonical(
    input.adapter.fromCanonical(input.document),
    input.document,
  );
  if (stableJson(result) !== stableJson(input.document)) {
    throw new Error(
      `Visual editor adapter ${input.adapter.id} changed canonical content.`,
    );
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
