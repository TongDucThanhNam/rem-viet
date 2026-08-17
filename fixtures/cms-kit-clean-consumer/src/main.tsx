import { CmsBlockEditor, createBlockEditorRegistry } from "@agency/cms-admin";
import { CmsBlockRenderer } from "@agency/cms-react";
import {
  createRemVietBlockRegistry,
  defaultRemVietTemplateBlocks,
  type RemVietTemplateBlock,
} from "@agency/cms-template-rem-viet";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const registry = createRemVietBlockRegistry<Record<string, never>>({
  hero: ({ block }) => <h1>{block.data.title.prefix}</h1>,
  threatNarrative: ({ block }) => (
    <section>{block.data.steps[0]?.title}</section>
  ),
  marquee: ({ block }) => <p>{block.data.text}</p>,
  benefits: ({ block }) => <section>{block.data.title}</section>,
  craftProcess: ({ block }) => <section>{block.data.title}</section>,
  bentoDetails: ({ block }) => <section>{block.data.title}</section>,
  horizontalGallery: ({ block }) => (
    <section>{block.data.titleLines.join(" ")}</section>
  ),
  measurementGuide: ({ block }) => <section>{block.data.title}</section>,
  faq: ({ block }) => (
    <section>
      <h2>{block.data.title}</h2>
      <p>{block.data.items[0]?.question}</p>
    </section>
  ),
  footerCta: ({ block }) => <footer>{block.data.title.prefix}</footer>,
});

const blocks: RemVietTemplateBlock[] = [...defaultRemVietTemplateBlocks];
type HeroBlock = Extract<RemVietTemplateBlock, { type: "hero" }>;
const editableHero: HeroBlock = defaultRemVietTemplateBlocks[0];
const heroEditorRegistry = createBlockEditorRegistry<HeroBlock, undefined>({
  hero: {
    label: "Hero",
    Editor: ({ block }) => <aside>{block.data.kicker}</aside>,
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>
      {blocks.map((block) => (
        <CmsBlockRenderer
          block={block}
          context={{}}
          key={block.id}
          registry={registry}
        />
      ))}
      <CmsBlockEditor
        block={editableHero}
        context={undefined}
        registry={heroEditorRegistry}
        onChange={() => undefined}
      />
    </main>
  </StrictMode>,
);
