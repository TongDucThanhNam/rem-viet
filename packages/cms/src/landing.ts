import {
  benefitIconKeySchema,
  heroBackgroundPositionSchema,
  heroCtaSchema,
  heroFeatureIconKeySchema,
  heroFeatureSchema,
  legacyBenefitsBlockSchema,
  legacyBentoDetailsBlockSchema,
  legacyCraftProcessBlockSchema,
  legacyDefaultBenefitsBlock,
  legacyDefaultBentoDetailsBlock,
  legacyDefaultCraftProcessBlock,
  legacyDefaultFaqBlock,
  legacyDefaultFooterCtaBlock,
  legacyDefaultHeroBlock,
  legacyDefaultHorizontalGalleryBlock,
  legacyDefaultMarqueeBlock,
  legacyDefaultMeasurementGuideBlock,
  legacyDefaultThreatNarrativeBlock,
  legacyFaqBlockSchema,
  legacyFooterCtaBlockSchema,
  legacyHeroBlockContentSchema,
  legacyHeroBlockSchema,
  legacyHorizontalGalleryBlockSchema,
  legacyMarqueeBlockSchema,
  legacyMeasurementGuideBlockSchema,
  legacyThreatNarrativeBlockSchema,
  type BenefitIconKey,
  type HeroBackgroundPosition,
  type HeroFeatureIconKey,
  type LegacyBenefitsBlock,
  type LegacyBentoDetailsBlock,
  type LegacyCraftProcessBlock,
  type LegacyFaqBlock,
  type LegacyFooterCtaBlock,
  type LegacyHeroBlock,
  type LegacyHorizontalGalleryBlock,
  type LegacyMarqueeBlock,
  type LegacyMeasurementGuideBlock,
  type LegacyThreatNarrativeBlock,
} from "@agency/cms-template-rem-viet";

export {
  benefitIconKeySchema,
  heroBackgroundPositionSchema,
  heroCtaSchema,
  heroFeatureIconKeySchema,
  heroFeatureSchema,
};
export type { BenefitIconKey, HeroBackgroundPosition, HeroFeatureIconKey };

export const heroBlockContentSchema = legacyHeroBlockContentSchema;
export const heroBlockSchema = legacyHeroBlockSchema;
export type HeroBlock = LegacyHeroBlock;
export const defaultHeroBlock = legacyDefaultHeroBlock;

export const threatNarrativeBlockSchema = legacyThreatNarrativeBlockSchema;
export type ThreatNarrativeBlock = LegacyThreatNarrativeBlock;
export const defaultThreatNarrativeBlock = legacyDefaultThreatNarrativeBlock;

export const marqueeBlockSchema = legacyMarqueeBlockSchema;
export type MarqueeBlock = LegacyMarqueeBlock;
export const defaultMarqueeBlock = legacyDefaultMarqueeBlock;

export const benefitsBlockSchema = legacyBenefitsBlockSchema;
export type BenefitsBlock = LegacyBenefitsBlock;
export const defaultBenefitsBlock = legacyDefaultBenefitsBlock;

export const craftProcessBlockSchema = legacyCraftProcessBlockSchema;
export type CraftProcessBlock = LegacyCraftProcessBlock;
export const defaultCraftProcessBlock = legacyDefaultCraftProcessBlock;

export const bentoDetailsBlockSchema = legacyBentoDetailsBlockSchema;
export type BentoDetailsBlock = LegacyBentoDetailsBlock;
export const defaultBentoDetailsBlock = legacyDefaultBentoDetailsBlock;

export const horizontalGalleryBlockSchema = legacyHorizontalGalleryBlockSchema;
export type HorizontalGalleryBlock = LegacyHorizontalGalleryBlock;
export const defaultHorizontalGalleryBlock =
  legacyDefaultHorizontalGalleryBlock;

export const measurementGuideBlockSchema = legacyMeasurementGuideBlockSchema;
export type MeasurementGuideBlock = LegacyMeasurementGuideBlock;
export const defaultMeasurementGuideBlock = legacyDefaultMeasurementGuideBlock;

export const faqBlockSchema = legacyFaqBlockSchema;
export type FaqBlock = LegacyFaqBlock;
export const defaultFaqBlock = legacyDefaultFaqBlock;

export const footerCtaBlockSchema = legacyFooterCtaBlockSchema;
export type FooterCtaBlock = LegacyFooterCtaBlock;
export const defaultFooterCtaBlock = legacyDefaultFooterCtaBlock;

export const defaultHomeBlocks = [
  defaultHeroBlock,
  defaultThreatNarrativeBlock,
  defaultMarqueeBlock,
  defaultBenefitsBlock,
  defaultCraftProcessBlock,
  defaultBentoDetailsBlock,
  defaultHorizontalGalleryBlock,
  defaultMeasurementGuideBlock,
  defaultFaqBlock,
  defaultFooterCtaBlock,
] as const;
