import {
  createCmsVisualComponentRegistry,
  defineCmsVisualComponent,
  parseCmsVisualDocument,
  type CmsVisualDocument,
  type CmsVisualEditorAdapter,
  type CmsVisualFieldDefinition,
} from "@agency/cms-visual-editor";

import {
  defaultRemVietTemplateBlocks,
  REM_VIET_BLOCK_SCHEMA_VERSION,
  remVietTemplateBlockSchema,
  remVietTemplateBlockTypes,
  remVietTemplateComposition,
  type RemVietTemplateBlock,
  type RemVietTemplateBlockType,
} from "./index.js";

export const REM_VIET_VISUAL_DOCUMENT_SCHEMA_VERSION = 1 as const;

function visualFieldLabel(path: string): string {
  const name = path.split(".").at(-1) ?? path;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

function inferRemVietVisualFields(
  value: unknown,
  prefix = "",
): readonly CmsVisualFieldDefinition[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const common = {
      path,
      label: visualFieldLabel(path),
      editCapabilities: ["content.field.edit"],
    } as const;
    if (Array.isArray(child) || child === null) {
      return [{ ...common, kind: "custom" as const }];
    }
    if (typeof child === "object") {
      return inferRemVietVisualFields(child, path);
    }
    if (typeof child === "boolean") {
      return [{ ...common, kind: "boolean" as const }];
    }
    if (typeof child === "number") {
      return [{ ...common, kind: "number" as const }];
    }
    return [
      {
        ...common,
        kind:
          key === "src" || key === "mediaId"
            ? ("media" as const)
            : key === "href"
              ? ("relationship" as const)
              : ("text" as const),
      },
    ];
  });
}

const remVietDefaultBlockByType = Object.freeze(
  Object.fromEntries(
    defaultRemVietTemplateBlocks.map((block) => [block.type, block]),
  ) as Record<RemVietTemplateBlockType, RemVietTemplateBlock>,
);

export const remVietVisualComponentRegistry = createCmsVisualComponentRegistry(
  remVietTemplateBlockTypes.map((type) => {
    const defaultBlock = remVietDefaultBlockByType[type];
    const rule = remVietTemplateComposition[type];
    return defineCmsVisualComponent({
      type,
      schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
      fields: inferRemVietVisualFields(defaultBlock.data),
      defaults: () => structuredClone(defaultBlock.data),
      validate: (data) =>
        remVietTemplateBlockSchema.parse({ ...defaultBlock, data }).data,
      renderer: `@agency/cms-template-rem-viet/${type}/renderer`,
      editor: `@agency/cms-template-rem-viet/${type}/editor`,
      constraints: {
        min: rule.minInstances,
        max: rule.maxInstances,
        pinned: rule.pinned ?? undefined,
        allowedChildren: [],
        allowedParents: [null],
      },
      actionCapabilities: {
        insert: ["content.compose.insert"],
        edit: ["content.component.edit"],
        move: ["content.compose.move"],
        duplicate: ["content.compose.duplicate"],
        remove: ["content.compose.remove"],
      },
    });
  }),
);

export type RemVietVisualEditorState = Readonly<{
  id: string;
  siteId: string;
  schemaVersion: number;
  version: number;
  blocks: readonly RemVietTemplateBlock[];
}>;

export function toRemVietVisualDocument(input: {
  id: string;
  siteId: string;
  version: number;
  blocks: readonly RemVietTemplateBlock[];
}): CmsVisualDocument {
  return parseCmsVisualDocument(
    {
      id: input.id,
      siteId: input.siteId,
      schemaVersion: REM_VIET_VISUAL_DOCUMENT_SCHEMA_VERSION,
      version: input.version,
      nodes: input.blocks,
    },
    remVietVisualComponentRegistry,
  );
}

export function fromRemVietVisualDocument(
  document: CmsVisualDocument,
): RemVietVisualEditorState {
  const parsed = parseCmsVisualDocument(
    document,
    remVietVisualComponentRegistry,
  );
  return Object.freeze({
    id: parsed.id,
    siteId: parsed.siteId,
    schemaVersion: parsed.schemaVersion,
    version: parsed.version,
    blocks: Object.freeze(
      parsed.nodes.map((node) => remVietTemplateBlockSchema.parse(node)),
    ),
  });
}

export const remVietCustomVisualEditorAdapter = Object.freeze({
  id: "rem-viet-custom",
  version: "1",
  capabilities: {
    clickToEdit: true,
    dragAndDrop: true,
    nestedSlots: false,
    responsivePreview: true,
    keyboardComposition: true,
  },
  fromCanonical: fromRemVietVisualDocument,
  toCanonical: (state: RemVietVisualEditorState) =>
    toRemVietVisualDocument(state),
}) satisfies CmsVisualEditorAdapter<RemVietVisualEditorState>;
