import type { CmsVisualNode } from "./registry.js";

export const CMS_VISUAL_PATTERN_MAX_ROOTS = 32;
export const CMS_VISUAL_PATTERN_MAX_NODES = 128;

export function assertCmsVisualPatternNodeBounds(
  nodes: readonly CmsVisualNode[],
  subject: string,
): void {
  if (nodes.length === 0 || nodes.length > CMS_VISUAL_PATTERN_MAX_ROOTS) {
    throw new Error(
      `${subject} must create 1-${CMS_VISUAL_PATTERN_MAX_ROOTS} roots and at most ${CMS_VISUAL_PATTERN_MAX_NODES} total nodes.`,
    );
  }

  const pending = [...nodes];
  const visited = new Set<CmsVisualNode>();
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (visited.has(node)) {
      throw new Error(
        `${subject} cannot contain cyclic or shared node objects.`,
      );
    }
    visited.add(node);
    if (visited.size > CMS_VISUAL_PATTERN_MAX_NODES) {
      throw new Error(
        `${subject} must create 1-${CMS_VISUAL_PATTERN_MAX_ROOTS} roots and at most ${CMS_VISUAL_PATTERN_MAX_NODES} total nodes.`,
      );
    }
    for (const children of Object.values(node.slots ?? {})) {
      pending.push(...children);
    }
  }
}
