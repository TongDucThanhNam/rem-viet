export const CMS_VISUAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export const CMS_VISUAL_TYPE_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/;
export const CMS_VISUAL_FIELD_PATH_PATTERN =
  /^[A-Za-z][A-Za-z0-9_-]*(?:\.(?:[A-Za-z0-9][A-Za-z0-9_-]*))*$/;

export type CmsVisualNode<TData = unknown> = Readonly<{
  id: string;
  type: string;
  schemaVersion: number;
  enabled: boolean;
  data: TData;
  slots?: Readonly<Record<string, readonly CmsVisualNode[]>>;
}>;

export type CmsVisualDocument<TNode extends CmsVisualNode = CmsVisualNode> =
  Readonly<{
    id: string;
    siteId: string;
    schemaVersion: number;
    version: number;
    nodes: readonly TNode[];
  }>;

export type CmsVisualAction =
  "insert" | "edit" | "move" | "duplicate" | "remove";

export type CmsVisualFieldKind =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "media"
  | "richText"
  | "relationship"
  | "custom";

export type CmsVisualFieldDefinition = Readonly<{
  path: string;
  label: string;
  kind: CmsVisualFieldKind;
  required?: boolean;
  editCapabilities?: readonly string[];
  inlineText?: Readonly<{
    maxLength?: number;
    multiline?: boolean;
  }>;
}>;

export type CmsVisualComponentConstraints = Readonly<{
  min?: number;
  max?: number;
  pinned?: "start" | "end";
  allowedChildren?: readonly string[];
  allowedParents?: readonly (string | null)[];
  slots?: Readonly<
    Record<
      string,
      Readonly<{
        min?: number;
        max?: number;
        allowedChildren: readonly string[];
      }>
    >
  >;
}>;

export type CmsVisualComponentDefinition<TData = unknown> = Readonly<{
  type: string;
  schemaVersion: number;
  fields: readonly CmsVisualFieldDefinition[];
  defaults: () => TData;
  validate: (value: unknown) => TData;
  renderer: string;
  editor: string;
  constraints?: CmsVisualComponentConstraints;
  actionCapabilities?: Partial<
    Readonly<Record<CmsVisualAction, readonly string[]>>
  >;
}>;

export type CmsVisualComponentRegistry = Readonly<{
  definitions: readonly CmsVisualComponentDefinition[];
  get(type: string): CmsVisualComponentDefinition | undefined;
  require(type: string): CmsVisualComponentDefinition;
}>;

function assertBoundedString(
  value: string,
  label: string,
  pattern: RegExp,
): void {
  if (!pattern.test(value)) throw new Error(`${label} is invalid: ${value}`);
}

function validateCapabilities(values: readonly string[] | undefined): void {
  if (!values) return;
  const seen = new Set<string>();
  for (const value of values) {
    if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value)) {
      throw new Error(`Visual editor capability is invalid: ${value}`);
    }
    if (seen.has(value)) {
      throw new Error(`Duplicate visual editor capability: ${value}`);
    }
    seen.add(value);
  }
}

function validateCardinality(
  minValue: number | undefined,
  maxValue: number | undefined,
  label: string,
): void {
  const min = minValue ?? 0;
  const max = maxValue ?? Number.MAX_SAFE_INTEGER;
  if (
    !Number.isSafeInteger(min) ||
    min < 0 ||
    !Number.isSafeInteger(max) ||
    max < min
  ) {
    throw new Error(`Invalid visual component cardinality for ${label}.`);
  }
}

export function defineCmsVisualComponent<TData>(
  definition: CmsVisualComponentDefinition<TData>,
): CmsVisualComponentDefinition<TData> {
  assertBoundedString(
    definition.type,
    "Visual component type",
    CMS_VISUAL_TYPE_PATTERN,
  );
  if (
    !Number.isSafeInteger(definition.schemaVersion) ||
    definition.schemaVersion < 1
  ) {
    throw new Error(
      "Visual component schemaVersion must be a positive integer.",
    );
  }
  if (!definition.renderer.trim() || !definition.editor.trim()) {
    throw new Error("Visual components require renderer and editor mappings.");
  }

  const paths = new Set<string>();
  for (const field of definition.fields) {
    assertBoundedString(
      field.path,
      "Visual field path",
      CMS_VISUAL_FIELD_PATH_PATTERN,
    );
    if (!field.label.trim())
      throw new Error(`Visual field ${field.path} requires a label.`);
    if (paths.has(field.path))
      throw new Error(`Duplicate visual field path: ${field.path}`);
    paths.add(field.path);
    validateCapabilities(field.editCapabilities);
    if (field.inlineText) {
      const maxLength = field.inlineText.maxLength ?? 256;
      if (
        field.kind !== "text" ||
        !Number.isSafeInteger(maxLength) ||
        maxLength < 1 ||
        maxLength > 10_000 ||
        (field.inlineText.multiline !== undefined &&
          typeof field.inlineText.multiline !== "boolean")
      ) {
        throw new Error(
          `Visual inline text field ${definition.type}.${field.path} requires a text field, maxLength between 1 and 10000, and an optional boolean multiline flag.`,
        );
      }
    }
  }
  for (const values of Object.values(definition.actionCapabilities ?? {})) {
    validateCapabilities(values);
  }

  const constraints = definition.constraints;
  if (constraints) {
    const max = constraints.max ?? Number.MAX_SAFE_INTEGER;
    validateCardinality(constraints.min, constraints.max, definition.type);
    if (constraints.pinned && max !== 1) {
      throw new Error(
        `Pinned visual component ${definition.type} must have max 1.`,
      );
    }
    for (const child of constraints.allowedChildren ?? []) {
      assertBoundedString(child, "Allowed child type", CMS_VISUAL_TYPE_PATTERN);
    }
    for (const parent of constraints.allowedParents ?? []) {
      if (parent !== null) {
        assertBoundedString(
          parent,
          "Allowed parent type",
          CMS_VISUAL_TYPE_PATTERN,
        );
      }
    }
    for (const [slot, slotDefinition] of Object.entries(
      constraints.slots ?? {},
    )) {
      assertBoundedString(slot, "Visual slot", CMS_VISUAL_TYPE_PATTERN);
      validateCardinality(
        slotDefinition.min,
        slotDefinition.max,
        `${definition.type}.${slot}`,
      );
      for (const child of slotDefinition.allowedChildren) {
        assertBoundedString(
          child,
          "Allowed slot child type",
          CMS_VISUAL_TYPE_PATTERN,
        );
      }
    }
  }

  definition.validate(definition.defaults());
  return Object.freeze({
    ...definition,
    fields: Object.freeze([...definition.fields]),
  });
}

export function createCmsVisualComponentRegistry(
  definitions: readonly CmsVisualComponentDefinition[],
): CmsVisualComponentRegistry {
  const byType = new Map<string, CmsVisualComponentDefinition>();
  for (const input of definitions) {
    const definition = defineCmsVisualComponent(input);
    if (byType.has(definition.type)) {
      throw new Error(`Duplicate visual component type: ${definition.type}`);
    }
    byType.set(definition.type, definition);
  }
  for (const definition of byType.values()) {
    for (const child of definition.constraints?.allowedChildren ?? []) {
      if (!byType.has(child)) {
        throw new Error(
          `Visual component ${definition.type} allows unknown child ${child}.`,
        );
      }
    }
    for (const parent of definition.constraints?.allowedParents ?? []) {
      if (parent !== null && !byType.has(parent)) {
        throw new Error(
          `Visual component ${definition.type} allows unknown parent ${parent}.`,
        );
      }
    }
    for (const slot of Object.values(definition.constraints?.slots ?? {})) {
      for (const child of slot.allowedChildren) {
        if (!byType.has(child)) {
          throw new Error(
            `Visual component ${definition.type} slot allows unknown child ${child}.`,
          );
        }
      }
    }
  }
  const frozen = Object.freeze([...byType.values()]);
  return Object.freeze({
    definitions: frozen,
    get: (type: string) => byType.get(type),
    require: (type: string) => {
      const definition = byType.get(type);
      if (!definition)
        throw new Error(`Unknown visual component type: ${type}`);
      return definition;
    },
  });
}

function validateNode(
  node: CmsVisualNode,
  parentType: string | null,
  registry: CmsVisualComponentRegistry,
  ids: Set<string>,
  counts: Map<string, number>,
): CmsVisualNode {
  assertBoundedString(node.id, "Visual node ID", CMS_VISUAL_ID_PATTERN);
  if (ids.has(node.id)) throw new Error(`Duplicate visual node ID: ${node.id}`);
  ids.add(node.id);
  const definition = registry.require(node.type);
  if (node.schemaVersion !== definition.schemaVersion) {
    throw new Error(
      `Visual node ${node.id} requires migration from schema ${node.schemaVersion} to ${definition.schemaVersion}.`,
    );
  }
  if (typeof node.enabled !== "boolean") {
    throw new Error(`Visual node ${node.id} has an invalid enabled flag.`);
  }
  definition.validate(node.data);
  const allowedParents = definition.constraints?.allowedParents;
  if (allowedParents && !allowedParents.includes(parentType)) {
    throw new Error(
      `Visual node ${node.id} is not allowed under ${parentType ?? "root"}.`,
    );
  }
  counts.set(node.type, (counts.get(node.type) ?? 0) + 1);

  const slotDefinitions = definition.constraints?.slots;
  for (const [slot, children] of Object.entries(node.slots ?? {})) {
    if (!CMS_VISUAL_TYPE_PATTERN.test(slot)) {
      throw new Error(
        `Visual node ${node.id} has an invalid slot name: ${slot}`,
      );
    }
    const slotDefinition = slotDefinitions?.[slot];
    if (slotDefinitions && !slotDefinition) {
      throw new Error(`Visual node ${node.id} has an unknown slot: ${slot}.`);
    }
    const allowed =
      slotDefinition?.allowedChildren ??
      definition.constraints?.allowedChildren;
    if (slotDefinition) {
      validateCardinality(
        slotDefinition.min,
        slotDefinition.max,
        `${node.type}.${slot}`,
      );
      const min = slotDefinition.min ?? 0;
      const max = slotDefinition.max ?? Number.MAX_SAFE_INTEGER;
      if (children.length < min || children.length > max) {
        throw new Error(
          `Visual node ${node.id} slot ${slot} requires ${min}-${max} children.`,
        );
      }
    }
    for (const child of children) {
      if (allowed && !allowed.includes(child.type)) {
        throw new Error(
          `Visual node ${node.id} does not allow child type ${child.type}.`,
        );
      }
      validateNode(child, node.type, registry, ids, counts);
    }
  }
  for (const [slot, slotDefinition] of Object.entries(slotDefinitions ?? {})) {
    const count = node.slots?.[slot]?.length ?? 0;
    if (count < (slotDefinition.min ?? 0)) {
      throw new Error(
        `Visual node ${node.id} slot ${slot} requires at least ${slotDefinition.min} children.`,
      );
    }
  }
  return node;
}

export function parseCmsVisualDocument<TNode extends CmsVisualNode>(
  document: CmsVisualDocument<TNode>,
  registry: CmsVisualComponentRegistry,
): CmsVisualDocument<TNode> {
  assertBoundedString(document.id, "Visual document ID", CMS_VISUAL_ID_PATTERN);
  assertBoundedString(document.siteId, "Visual site ID", CMS_VISUAL_ID_PATTERN);
  if (
    !Number.isSafeInteger(document.schemaVersion) ||
    document.schemaVersion < 1
  ) {
    throw new Error(
      "Visual document schemaVersion must be a positive integer.",
    );
  }
  if (!Number.isSafeInteger(document.version) || document.version < 0) {
    throw new Error("Visual document version must be a non-negative integer.");
  }
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  for (const node of document.nodes)
    validateNode(node, null, registry, ids, counts);
  for (const definition of registry.definitions) {
    const count = counts.get(definition.type) ?? 0;
    const min = definition.constraints?.min ?? 0;
    const max = definition.constraints?.max ?? Number.MAX_SAFE_INTEGER;
    if (count < min || count > max) {
      throw new Error(
        `Visual component ${definition.type} count ${count} is outside ${min}..${max}.`,
      );
    }
  }
  const startPinned = registry.definitions.find(
    (definition) => definition.constraints?.pinned === "start",
  );
  const endPinned = registry.definitions.find(
    (definition) => definition.constraints?.pinned === "end",
  );
  if (startPinned && document.nodes[0]?.type !== startPinned.type) {
    throw new Error(`Visual component ${startPinned.type} must remain first.`);
  }
  if (endPinned && document.nodes.at(-1)?.type !== endPinned.type) {
    throw new Error(`Visual component ${endPinned.type} must remain last.`);
  }
  return document;
}

export function hasCmsVisualCapabilities(
  required: readonly string[] | undefined,
  grants: ReadonlySet<string>,
): boolean {
  return (required ?? []).every((capability) => grants.has(capability));
}

export function canCmsVisualAction(input: {
  registry: CmsVisualComponentRegistry;
  nodeType: string;
  action: CmsVisualAction;
  grants: ReadonlySet<string>;
  fieldPath?: string;
}): boolean {
  const definition = input.registry.get(input.nodeType);
  if (!definition) return false;
  if (
    !hasCmsVisualCapabilities(
      definition.actionCapabilities?.[input.action],
      input.grants,
    )
  ) {
    return false;
  }
  if (input.action !== "edit" || input.fieldPath === undefined) return true;
  const field = definition.fields.find(
    (candidate) => candidate.path === input.fieldPath,
  );
  return Boolean(
    field && hasCmsVisualCapabilities(field.editCapabilities, input.grants),
  );
}
