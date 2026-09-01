import { z } from "zod";

export const homeBlockSpacingSchema = z.enum([
  "compact",
  "balanced",
  "spacious",
]);
export type HomeBlockSpacing = z.infer<typeof homeBlockSpacingSchema>;

export const homeBlockAlignmentSchema = z.enum(["native", "left", "center"]);
export type HomeBlockAlignment = z.infer<typeof homeBlockAlignmentSchema>;

export const homeBlockToneSchema = z.enum(["native", "quiet", "brand"]);
export type HomeBlockTone = z.infer<typeof homeBlockToneSchema>;

export const homeBlockMediaFrameSchema = z.enum(["native", "square", "soft"]);
export type HomeBlockMediaFrame = z.infer<typeof homeBlockMediaFrameSchema>;

/**
 * Closed presentation vocabulary for homepage authoring. These values are
 * resolved to known production styles; editors never persist arbitrary CSS or
 * Tailwind class strings.
 */
export const homeBlockDesignSchema = z.object({
  spacing: homeBlockSpacingSchema,
  alignment: homeBlockAlignmentSchema,
  tone: homeBlockToneSchema,
  mediaFrame: homeBlockMediaFrameSchema,
});
export type HomeBlockDesign = z.infer<typeof homeBlockDesignSchema>;

export const defaultHomeBlockDesign = {
  spacing: "balanced",
  alignment: "native",
  tone: "native",
  mediaFrame: "native",
} as const satisfies HomeBlockDesign;

export function resolveHomeBlockDesign(
  design: Partial<HomeBlockDesign> | null | undefined,
): HomeBlockDesign {
  return homeBlockDesignSchema.parse({
    ...defaultHomeBlockDesign,
    ...design,
  });
}
