import type { CmsBlock } from "@agency/cms-core";
import {
  createElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

export type BlockSchema<TBlock> = {
  parse(value: unknown): TBlock;
};

export type BlockRendererProps<TBlock, TContext> = {
  block: TBlock;
  context: TContext;
};

export type CmsBlockDefinition<TBlock extends CmsBlock, TContext> = {
  schema: BlockSchema<TBlock>;
  defaults: TBlock;
  Renderer: ComponentType<BlockRendererProps<TBlock, TContext>>;
};

export type CmsBlockRegistry<TBlock extends CmsBlock, TContext> = {
  [TType in TBlock["type"]]: CmsBlockDefinition<
    Extract<TBlock, { type: TType }>,
    TContext
  >;
};

export function createBlockRegistry<TBlock extends CmsBlock, TContext>(
  registry: CmsBlockRegistry<TBlock, TContext>,
) {
  return registry;
}

export type UnknownBlockPolicy<TBlock extends CmsBlock> =
  | { behavior: "skip" }
  | { behavior: "throw" }
  | {
      behavior: "fallback";
      render: (block: TBlock) => ReactNode;
    };

export type CmsBlockRendererProps<TBlock extends CmsBlock, TContext> = {
  block: TBlock;
  context: TContext;
  registry: CmsBlockRegistry<TBlock, TContext>;
  unknownBlock?: UnknownBlockPolicy<TBlock>;
};

export function CmsBlockRenderer<TBlock extends CmsBlock, TContext>({
  block,
  context,
  registry,
  unknownBlock = { behavior: "throw" },
}: CmsBlockRendererProps<TBlock, TContext>): ReactElement | null {
  const definition = registry[block.type as TBlock["type"]];

  if (!definition) {
    if (unknownBlock.behavior === "skip") return null;
    if (unknownBlock.behavior === "fallback") {
      return createElement(
        "div",
        { "data-cms-unknown-block": block.type },
        unknownBlock.render(block),
      );
    }
    throw new Error(`Unknown CMS block type: ${block.type}`);
  }

  const parsed = definition.schema.parse(block) as Extract<
    TBlock,
    { type: TBlock["type"] }
  >;
  const Renderer = definition.Renderer as ComponentType<
    BlockRendererProps<typeof parsed, TContext>
  >;

  return createElement(Renderer, { block: parsed, context });
}
