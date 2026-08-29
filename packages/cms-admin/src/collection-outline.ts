import {
  isCmsFieldVisible,
  type CmsBuiltInField,
  type CmsCollectionDefinition,
} from "@agency/cms-core";
import {
  CMS_VISUAL_FIELD_PATH_PATTERN,
  createCmsVisualComponentRegistry,
  createCmsVisualOutline,
  type CmsVisualNode,
} from "@agency/cms-visual-editor";

const MAX_CMS_COLLECTION_OUTLINE_NODES = 10_000;
const structuralActions = new Set(["insert", "move", "duplicate", "remove"]);

type CmsCollectionFieldNodeData = Readonly<{
  fieldPath: string;
  kind: string;
  readOnly: boolean;
}>;

function parseCollectionFieldNodeData(
  value: unknown,
): CmsCollectionFieldNodeData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CMS collection outline field data is invalid.");
  }
  const data = value as Partial<CmsCollectionFieldNodeData>;
  if (
    typeof data.fieldPath !== "string" ||
    data.fieldPath.length > 4_096 ||
    !CMS_VISUAL_FIELD_PATH_PATTERN.test(data.fieldPath) ||
    typeof data.kind !== "string" ||
    !/^[a-z][a-z0-9-]{0,63}$/u.test(data.kind) ||
    typeof data.readOnly !== "boolean"
  ) {
    throw new Error("CMS collection outline field data is invalid.");
  }
  return Object.freeze({
    fieldPath: data.fieldPath,
    kind: data.kind,
    readOnly: data.readOnly,
  });
}

const collectionFieldRegistry = createCmsVisualComponentRegistry([
  {
    type: "collectionField",
    schemaVersion: 1,
    fields: [],
    defaults: () => ({
      fieldPath: "field",
      kind: "text",
      readOnly: false,
    }),
    validate: parseCollectionFieldNodeData,
    renderer: "cms-collection-field-outline",
    editor: "cms-collection-field-control",
    constraints: {
      max: MAX_CMS_COLLECTION_OUTLINE_NODES,
      allowedChildren: ["collectionField"],
      allowedParents: [null, "collectionField"],
      slots: {
        fields: {
          max: MAX_CMS_COLLECTION_OUTLINE_NODES,
          allowedChildren: ["collectionField"],
        },
      },
    },
    actionCapabilities: {
      insert: ["content.collection.structure"],
      edit: ["content.field.edit"],
      move: ["content.collection.structure"],
      duplicate: ["content.collection.structure"],
      remove: ["content.collection.structure"],
    },
  },
]);

function stableFieldNodeId(fieldPath: string): string {
  const readable = `field:${fieldPath}`;
  if (readable.length <= 128) return readable;
  let hash = 0xcbf29ce484222325n;
  for (const character of fieldPath) {
    hash ^= BigInt(character.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `field:${fieldPath.slice(0, 104)}:${hash.toString(16).padStart(16, "0")}`;
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function isDerivedField(field: CmsBuiltInField): boolean {
  return (
    field.kind === "computed" ||
    field.kind === "virtual" ||
    field.kind === "join"
  );
}

export type CmsCollectionFieldOutlineModel = Readonly<{
  items: ReturnType<typeof createCmsVisualOutline>;
  fieldPathByNodeId: Readonly<Record<string, string>>;
  nodeIdByFieldPath: Readonly<Record<string, string>>;
}>;

/**
 * Adapts visible schema fields and concrete array rows to the shared outline.
 * Collection structure remains schema-owned, so the model can only expose
 * permission-aware field focus/edit actions.
 */
export function createCmsCollectionFieldOutline(input: {
  collection: CmsCollectionDefinition;
  data: Readonly<Record<string, unknown>>;
  selectedFieldPath: string | null;
  canWrite: boolean;
}): CmsCollectionFieldOutlineModel {
  const labels = new Map<string, string>();
  const fieldPathByNodeId = new Map<string, string>();
  const nodeIdByFieldPath = new Map<string, string>();
  let nodeCount = 0;

  const register = (
    fieldPath: string,
    label: string,
    kind: string,
    readOnly: boolean,
    children: readonly CmsVisualNode<CmsCollectionFieldNodeData>[] = [],
  ): CmsVisualNode<CmsCollectionFieldNodeData> => {
    nodeCount += 1;
    if (nodeCount > MAX_CMS_COLLECTION_OUTLINE_NODES) {
      throw new Error(
        `CMS collection outline exceeds ${MAX_CMS_COLLECTION_OUTLINE_NODES} nodes.`,
      );
    }
    const id = stableFieldNodeId(fieldPath);
    const existingPath = fieldPathByNodeId.get(id);
    if (existingPath && existingPath !== fieldPath) {
      throw new Error("CMS collection outline field identity collision.");
    }
    if (nodeIdByFieldPath.has(fieldPath)) {
      throw new Error(`Duplicate CMS collection outline path: ${fieldPath}`);
    }
    labels.set(id, label);
    fieldPathByNodeId.set(id, fieldPath);
    nodeIdByFieldPath.set(fieldPath, id);
    return {
      id,
      type: "collectionField",
      schemaVersion: 1,
      enabled: true,
      data: { fieldPath, kind, readOnly },
      ...(children.length
        ? { slots: { fields: Object.freeze([...children]) } }
        : {}),
    };
  };

  const buildFields = (
    fields: readonly CmsBuiltInField[],
    record: Readonly<Record<string, unknown>>,
    parentPath: string | null,
    inheritedReadOnly: boolean,
  ): readonly CmsVisualNode<CmsCollectionFieldNodeData>[] =>
    fields.flatMap((field) => {
      if (!isCmsFieldVisible(field, record)) return [];
      const fieldPath = parentPath ? `${parentPath}.${field.name}` : field.name;
      const readOnly =
        inheritedReadOnly ||
        Boolean(field.admin?.readOnly) ||
        isDerivedField(field);
      const value = record[field.name] ?? field.defaultValue;
      if (field.kind === "group") {
        const children = buildFields(
          field.fields as readonly CmsBuiltInField[],
          recordValue(value),
          fieldPath,
          readOnly,
        );
        return [
          register(fieldPath, field.label, field.kind, readOnly, children),
        ];
      }
      if (field.kind === "array") {
        const rows = Array.isArray(value)
          ? value.filter(
              (row): row is Readonly<Record<string, unknown>> =>
                Boolean(row) && typeof row === "object" && !Array.isArray(row),
            )
          : [];
        const rowNodes = rows.map((row, index) => {
          const rowPath = `${fieldPath}.${index}`;
          const children = buildFields(
            field.fields as readonly CmsBuiltInField[],
            row,
            rowPath,
            readOnly,
          );
          return register(
            rowPath,
            `${field.label} ${index + 1}`,
            "array-row",
            readOnly,
            children,
          );
        });
        return [
          register(fieldPath, field.label, field.kind, readOnly, rowNodes),
        ];
      }
      return [register(fieldPath, field.label, field.kind, readOnly)];
    });

  const nodes = buildFields(
    input.collection.fields as readonly CmsBuiltInField[],
    input.data,
    null,
    false,
  );
  const selectedNodeId = input.selectedFieldPath
    ? (nodeIdByFieldPath.get(input.selectedFieldPath) ?? null)
    : null;
  const items = createCmsVisualOutline({
    document: {
      id: `collection-${input.collection.slug}`,
      siteId: "cms-admin",
      schemaVersion: 1,
      version: 0,
      nodes,
    },
    registry: collectionFieldRegistry,
    grants: new Set(input.canWrite ? ["content.field.edit"] : []),
    selection: { nodeId: selectedNodeId },
    maxNodes: MAX_CMS_COLLECTION_OUTLINE_NODES,
    actionFilter: (node, _definition, action) =>
      !structuralActions.has(action) &&
      action === "edit" &&
      !(node.data as CmsCollectionFieldNodeData).readOnly,
    label: (node) => labels.get(node.id) ?? node.type,
  });

  return Object.freeze({
    items,
    fieldPathByNodeId: Object.freeze(
      Object.fromEntries(fieldPathByNodeId.entries()),
    ),
    nodeIdByFieldPath: Object.freeze(
      Object.fromEntries(nodeIdByFieldPath.entries()),
    ),
  });
}
