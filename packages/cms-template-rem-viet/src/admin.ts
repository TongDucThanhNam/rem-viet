import {
  createBlockEditorRegistry,
  type CmsBlockEditorProps,
} from "@agency/cms-admin";
import type { ComponentType } from "react";

import {
  type ProductGridBlock,
  type RemVietStandardBlock,
  type ReusableContentBlock,
  type RichTextBlock,
  type StandardCtaBlock,
} from "./standard-blocks.js";

export * from "./editor-shell.js";

export type RemVietStandardEditors<TContext> = {
  richText: ComponentType<
    CmsBlockEditorProps<RichTextBlock> & { context: TContext }
  >;
  productGrid: ComponentType<
    CmsBlockEditorProps<ProductGridBlock> & { context: TContext }
  >;
  cta: ComponentType<
    CmsBlockEditorProps<StandardCtaBlock> & { context: TContext }
  >;
  reusableContent: ComponentType<
    CmsBlockEditorProps<ReusableContentBlock> & { context: TContext }
  >;
};

export function createRemVietStandardBlockEditorRegistry<TContext>(
  editors: RemVietStandardEditors<TContext>,
) {
  return createBlockEditorRegistry<RemVietStandardBlock, TContext>({
    richText: {
      label: "Rich text",
      Editor: editors.richText,
    },
    productGrid: {
      label: "Product grid",
      Editor: editors.productGrid,
    },
    cta: {
      label: "Call to action",
      Editor: editors.cta,
    },
    reusableContent: {
      label: "Reusable content",
      Editor: editors.reusableContent,
    },
  });
}
