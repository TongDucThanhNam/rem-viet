import type { HomeBlock } from "@rem-viet/cms";
import { CmsBlockRenderer } from "@agency/cms-react";
import {
  createRemVietBlockRegistry,
  toRemVietTemplateBlock,
} from "@agency/cms-template-rem-viet";
import { ReactLenis } from "lenis/react";
import { useEffect, useState } from "react";

import { CustomCursorRaw } from "@/components/custom-cursor-raw";
import { GsapScrollSync } from "@/components/gsap-scroll-sync";
import { LoadingScreenRaw } from "@/components/loading-screen-raw";
import { ScrollProgress } from "@/components/scroll-progress";
import { useMagneticScope } from "@/hooks/use-magnetic-scope";
import { useThemeBySection } from "@/hooks/use-theme-by-section";
import { getHomeVisualFieldTargets } from "@/lib/home-visual-editing";
import { isPinnedHomeBlock } from "@/lib/home-visual-order";

import { Benefits } from "./benefits";
import { BentoDetails } from "./bento-details";
import { Craft } from "./craft";
import { CurtainFooter } from "./curtain-footer";
import { Faq } from "./faq";
import { Hero } from "./hero";
import { HorizontalGallery } from "./horizontal-gallery";
import { Marquee } from "./marquee";
import { MeasureGuide } from "./measure-guide";
import { Navigation } from "./navigation";
import { Threat } from "./threat";

export type HomepageRendererProps = {
  blocks: HomeBlock[];
  preview?: boolean;
  studioSelectedBlockId?: string | null;
  studioSelectedFieldPath?: string | null;
  studioSelectionRevision?: number;
};

type RemVietBlockRenderContext = {
  isLoaded: boolean;
  sectionId?: string;
};

const remVietBlockRegistry =
  createRemVietBlockRegistry<RemVietBlockRenderContext>({
    hero: ({ block, context }) => (
      <Hero content={block.data} isLoaded={context.isLoaded} />
    ),
    threatNarrative: ({ block }) => (
      <Threat
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
      />
    ),
    marquee: ({ block }) => (
      <Marquee
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
      />
    ),
    benefits: ({ block, context }) => (
      <Benefits
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
        sectionId={context.sectionId}
      />
    ),
    craftProcess: ({ block }) => (
      <Craft
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
      />
    ),
    bentoDetails: ({ block }) => (
      <BentoDetails
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
      />
    ),
    horizontalGallery: ({ block }) => (
      <HorizontalGallery
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
      />
    ),
    measurementGuide: ({ block }) => (
      <MeasureGuide
        content={{
          id: block.id,
          enabled: block.enabled,
          type: block.type,
          ...block.data,
        }}
      />
    ),
    faq: ({ block }) => <Faq content={block.data} />,
    footerCta: () => null,
  });

function renderHomeBlock(
  block: HomeBlock,
  isLoaded: boolean,
  sectionId?: string,
) {
  const extractedBlock = toRemVietTemplateBlock(block);
  if (!extractedBlock.success) return null;
  return (
    <CmsBlockRenderer
      block={extractedBlock.data}
      context={{ isLoaded, sectionId }}
      key={block.id}
      registry={remVietBlockRegistry}
    />
  );
}

export function HomepageRenderer({
  blocks,
  preview = false,
  studioSelectedBlockId = null,
  studioSelectedFieldPath = null,
  studioSelectionRevision = 0,
}: HomepageRendererProps) {
  const [isLoaded, setIsLoaded] = useState(preview);
  const enabledBlocks = blocks.filter((block) => block.enabled);
  const footer = enabledBlocks.find(
    (block): block is Extract<HomeBlock, { type: "footerCta" }> =>
      block.type === "footerCta",
  );
  const firstBenefitsBlockId = enabledBlocks.find(
    (block) => block.type === "benefits",
  )?.id;
  const enabledSectionIds = enabledBlocks.flatMap((block) => {
    switch (block.type) {
      case "hero":
        return ["home"];
      case "threatNarrative":
        return ["threat"];
      case "benefits":
        return ["benefits"];
      case "craftProcess":
        return ["craft"];
      case "bentoDetails":
        return ["details"];
      case "horizontalGallery":
        return ["lifestyle"];
      case "measurementGuide":
        return ["measure"];
      case "faq":
        return ["faq"];
      case "footerCta":
        return ["order"];
      case "marquee":
        return [];
    }
  });

  useThemeBySection();
  useMagneticScope();

  useEffect(() => {
    if (!preview) return;
    const selectors = {
      hero: "#home",
      threatNarrative: "#threat",
      marquee: ".marquee",
      benefits: ".benefits",
      craftProcess: "#craft",
      bentoDetails: "#details",
      horizontalGallery: "#lifestyle",
      measurementGuide: "#measure",
      faq: "#faq",
      footerCta: "#order",
    } satisfies Record<HomeBlock["type"], string>;
    const annotated = Array.from(
      document.querySelectorAll<HTMLElement>("[data-cms-preview-block]"),
    );
    for (const element of annotated) {
      delete element.dataset.cmsPreviewBlock;
      delete element.dataset.cmsBlockId;
      delete element.dataset.cmsBlockType;
      delete element.dataset.cmsPreviewSelected;
      delete element.dataset.cmsPreviewMovable;
      delete element.dataset.cmsPreviewDragging;
      delete element.dataset.cmsDropPlacement;
    }
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-cms-preview-field]",
    )) {
      delete element.dataset.cmsPreviewField;
      delete element.dataset.cmsFieldPath;
      delete element.dataset.cmsFieldLabel;
      delete element.dataset.cmsControlId;
      delete element.dataset.cmsPreviewFieldSelected;
    }
    const occurrenceByType = new Map<HomeBlock["type"], number>();
    for (const block of enabledBlocks) {
      const elements = document.querySelectorAll<HTMLElement>(
        selectors[block.type],
      );
      const occurrence = occurrenceByType.get(block.type) ?? 0;
      occurrenceByType.set(block.type, occurrence + 1);
      const element = elements[occurrence];
      if (!element) continue;
      element.dataset.cmsPreviewBlock = "true";
      element.dataset.cmsBlockId = block.id;
      element.dataset.cmsBlockType = block.type;
      element.dataset.cmsPreviewMovable = isPinnedHomeBlock(block)
        ? "false"
        : "true";
      if (block.id === studioSelectedBlockId) {
        element.dataset.cmsPreviewSelected = "true";
      }
      for (const field of getHomeVisualFieldTargets(block)) {
        for (const fieldElement of element.querySelectorAll<HTMLElement>(
          field.selector,
        )) {
          fieldElement.dataset.cmsPreviewField = "true";
          fieldElement.dataset.cmsFieldPath = field.path;
          fieldElement.dataset.cmsFieldLabel = field.label;
          fieldElement.dataset.cmsControlId = field.controlId;
          if (
            block.id === studioSelectedBlockId &&
            field.path === studioSelectedFieldPath
          ) {
            fieldElement.dataset.cmsPreviewFieldSelected = "true";
          }
        }
      }
    }
    return () => {
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-cms-preview-block]",
      )) {
        delete element.dataset.cmsPreviewBlock;
        delete element.dataset.cmsBlockId;
        delete element.dataset.cmsBlockType;
        delete element.dataset.cmsPreviewSelected;
        delete element.dataset.cmsPreviewMovable;
        delete element.dataset.cmsPreviewDragging;
        delete element.dataset.cmsDropPlacement;
      }
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-cms-preview-field]",
      )) {
        delete element.dataset.cmsPreviewField;
        delete element.dataset.cmsFieldPath;
        delete element.dataset.cmsFieldLabel;
        delete element.dataset.cmsControlId;
        delete element.dataset.cmsPreviewFieldSelected;
      }
    };
  }, [blocks, preview, studioSelectedBlockId, studioSelectedFieldPath]);

  useEffect(() => {
    if (!preview || !studioSelectedBlockId) return;
    const selected = document.querySelector<HTMLElement>(
      `[data-cms-block-id="${CSS.escape(studioSelectedBlockId)}"]`,
    );
    const scrollTarget =
      selected?.dataset.cmsBlockType === "footerCta"
        ? document.querySelector<HTMLElement>("[data-cms-footer-scroll-target]")
        : selected;
    scrollTarget?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: selected?.dataset.cmsBlockType === "footerCta" ? "end" : "center",
    });
  }, [preview, studioSelectedBlockId, studioSelectionRevision]);

  return (
    <ReactLenis
      root
      options={{
        autoRaf: false,
        duration: 1.25,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      <div className="noise-overlay" />
      <GsapScrollSync />
      <CustomCursorRaw />
      {preview ? null : (
        <LoadingScreenRaw onComplete={() => setIsLoaded(true)} />
      )}
      <ScrollProgress />
      <Navigation enabledSectionIds={enabledSectionIds} />

      <main
        aria-label={
          preview ? "Bản xem trước trực quan Trang chủ" : "Nội dung Trang chủ"
        }
        id="smooth-wrapper"
        className="font-sans"
        style={footer ? undefined : { marginBottom: 0 }}
      >
        {enabledBlocks.map((block) =>
          renderHomeBlock(
            block,
            isLoaded,
            block.type === "benefits"
              ? block.id === firstBenefitsBlockId
                ? "benefits"
                : block.id
              : undefined,
          ),
        )}
      </main>

      {preview && footer ? (
        <span
          aria-hidden="true"
          className="pointer-events-none block size-px"
          data-cms-footer-scroll-target="true"
        />
      ) : null}
      {footer ? <CurtainFooter content={footer} /> : null}
    </ReactLenis>
  );
}
