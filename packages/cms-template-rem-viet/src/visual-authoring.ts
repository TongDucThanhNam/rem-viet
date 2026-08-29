import {
  createCmsVisualComponentRegistry,
  createCmsVisualPatternRegistry,
  defineCmsVisualComponent,
  defineCmsVisualPattern,
  parseCmsVisualDocument,
  type CmsVisualDocument,
  type CmsVisualEditorAdapter,
  type CmsVisualFieldDefinition,
} from "@agency/cms-visual-editor";

import {
  defaultRemVietTemplateBlocks,
  defaultProductGridBlock,
  defaultReusableContentBlock,
  defaultRichTextBlock,
  defaultStandardCtaBlock,
  productGridBlockDataSchema,
  reusableContentBlockDataSchema,
  REM_VIET_BLOCK_SCHEMA_VERSION,
  richTextBlockDataSchema,
  remVietTemplateBlockSchema,
  remVietTemplateBlockTypes,
  remVietTemplateComposition,
  standardCtaBlockDataSchema,
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

const standardVisualPermissions = {
  insert: ["content.compose.insert"],
  edit: ["content.component.edit"],
  move: ["content.compose.move"],
  duplicate: ["content.compose.duplicate"],
  remove: ["content.compose.remove"],
} as const;

const standardFieldCapability = ["content.field.edit"] as const;

export const remVietStandardVisualComponentRegistry =
  createCmsVisualComponentRegistry([
    defineCmsVisualComponent({
      type: "richText",
      schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
      fields: [
        {
          path: "content",
          label: "Nội dung",
          kind: "richText",
          editCapabilities: standardFieldCapability,
        },
      ],
      defaults: () => structuredClone(defaultRichTextBlock.data),
      validate: (value) => richTextBlockDataSchema.parse(value),
      renderer: "@agency/cms-template-rem-viet/richText/renderer",
      editor: "@agency/cms-template-rem-viet/richText/editor",
      constraints: { allowedParents: [null] },
      actionCapabilities: standardVisualPermissions,
    }),
    defineCmsVisualComponent({
      type: "productGrid",
      schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
      fields: [
        {
          path: "categoryId",
          label: "Danh mục",
          kind: "relationship",
          editCapabilities: standardFieldCapability,
        },
        {
          path: "limit",
          label: "Số sản phẩm",
          kind: "number",
          editCapabilities: standardFieldCapability,
        },
      ],
      defaults: () => structuredClone(defaultProductGridBlock.data),
      validate: (value) => productGridBlockDataSchema.parse(value),
      renderer: "@agency/cms-template-rem-viet/productGrid/renderer",
      editor: "@agency/cms-template-rem-viet/productGrid/editor",
      constraints: { allowedParents: [null] },
      actionCapabilities: standardVisualPermissions,
    }),
    defineCmsVisualComponent({
      type: "cta",
      schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
      fields: [
        {
          path: "title",
          label: "Tiêu đề",
          kind: "text",
          editCapabilities: standardFieldCapability,
        },
        {
          path: "href",
          label: "Liên kết",
          kind: "relationship",
          editCapabilities: standardFieldCapability,
        },
      ],
      defaults: () => structuredClone(defaultStandardCtaBlock.data),
      validate: (value) => standardCtaBlockDataSchema.parse(value),
      renderer: "@agency/cms-template-rem-viet/cta/renderer",
      editor: "@agency/cms-template-rem-viet/cta/editor",
      constraints: { allowedParents: [null] },
      actionCapabilities: standardVisualPermissions,
    }),
    defineCmsVisualComponent({
      type: "reusableContent",
      schemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
      fields: [
        {
          path: "reference",
          label: "Nội dung tái sử dụng",
          kind: "custom",
          editCapabilities: standardFieldCapability,
        },
      ],
      defaults: () => structuredClone(defaultReusableContentBlock.data),
      validate: (value) => reusableContentBlockDataSchema.parse(value),
      renderer: "@agency/cms-template-rem-viet/reusableContent/renderer",
      editor: "@agency/cms-template-rem-viet/reusableContent/editor",
      constraints: { allowedParents: [null] },
      actionCapabilities: standardVisualPermissions,
    }),
  ]);

function starterRichText(title: string, body: string) {
  return JSON.stringify({
    version: 1,
    blocks: [
      {
        id: "pattern-heading",
        type: "heading",
        level: 2,
        children: [{ text: title }],
      },
      {
        id: "pattern-paragraph",
        type: "paragraph",
        children: [{ text: body }],
      },
    ],
  });
}

export const remVietStandardVisualPatternRegistry =
  createCmsVisualPatternRegistry([
    defineCmsVisualPattern({
      id: "content-and-cta",
      label: "Nội dung và kêu gọi hành động",
      description:
        "Khởi tạo một phần giới thiệu có văn bản và nút chuyển đổi tiếp theo.",
      category: "Bố cục",
      keywords: ["intro", "text", "cta", "giới thiệu", "liên hệ"],
      createNodes: ({ createId }) => [
        {
          ...structuredClone(defaultRichTextBlock),
          id: createId("richText"),
          data: {
            content: starterRichText(
              "Tiêu đề phần nội dung",
              "Thay đoạn giới thiệu này bằng thông tin hữu ích cho khách hàng.",
            ),
          },
        },
        {
          ...structuredClone(defaultStandardCtaBlock),
          id: createId("cta"),
        },
      ],
    }),
    defineCmsVisualPattern({
      id: "catalog-section",
      label: "Giới thiệu danh mục sản phẩm",
      description:
        "Khởi tạo tiêu đề, lưới sản phẩm và lời kêu gọi hành động đồng bộ.",
      category: "Thương mại",
      keywords: ["catalog", "products", "grid", "sản phẩm", "danh mục"],
      createNodes: ({ createId }) => [
        {
          ...structuredClone(defaultRichTextBlock),
          id: createId("richText"),
          data: {
            content: starterRichText(
              "Sản phẩm nổi bật",
              "Giới thiệu ngắn gọn lý do khách hàng nên khám phá danh mục này.",
            ),
          },
        },
        {
          ...structuredClone(defaultProductGridBlock),
          id: createId("productGrid"),
        },
        {
          ...structuredClone(defaultStandardCtaBlock),
          id: createId("cta"),
          data: { title: "Xem toàn bộ sản phẩm", href: "/san-pham" },
        },
      ],
    }),
  ]);

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
