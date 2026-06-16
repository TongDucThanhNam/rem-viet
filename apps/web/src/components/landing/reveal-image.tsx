import { useRef } from "react";

import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

type RevealDirection = "center" | "left" | "right" | "top";

type RevealImageProps = {
  src: string;
  alt: string;
  aspect?: "wide" | "portrait" | "landscape";
  /** Initial image scale (zoomed-in start). */
  scaleFrom?: number;
  /** Resting scale once revealed. */
  scaleRest?: number;
  /** Vertical parallax travel as yPercent across the full pass. */
  parallax?: number;
  /**
   * Which edge the clip-path opens from. Each section uses a different one
   * for visual variety — AWWWARDS sites never repeat the same reveal twice.
   *  - center (default): horizontal slit opens outward (the original)
   *  - left:  reveals left→right
   *  - right: reveals right→left
   *  - top:   reveals top→bottom
   */
  direction?: RevealDirection;
};

/** The closed clip-path per direction — what the mask starts at. */
const CLOSED_CLIP: Record<RevealDirection, string> = {
  center: "inset(0% 50% 0% 50%)",
  left: "inset(0% 0% 0% 100%)",
  right: "inset(0% 100% 0% 0%)",
  top: "inset(0% 0% 100% 0%)",
};

/**
 * Cinematic scroll reveal shared across sections (Threat, Craft, Measure).
 *
 * As the image scrolls into view the mask opens (clip-path from the chosen
 * direction → fully open), reaching `inset(0)` by the time it hits viewport
 * center. Meanwhile the image does a scale + vertical parallax across its
 * FULL pass through the viewport. Both are scrubbed to scroll.
 *
 * The `direction` prop varies the reveal edge so each section feels fresh.
 */
export function RevealImage({
  src,
  alt,
  aspect = "wide",
  scaleFrom = 1.25,
  scaleRest = 1.08,
  parallax = 16,
  direction = "center",
}: RevealImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      const mask = maskRef.current;
      const img = imgRef.current;
      if (!container || !mask || !img) return;

      if (prefersReducedMotion()) {
        gsap.set(mask, { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      // 1. Mask opens as the element enters and reaches center, from the
      //    chosen direction.
      gsap.fromTo(
        mask,
        { clipPath: CLOSED_CLIP[direction] },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          ease: "none",
          scrollTrigger: {
            trigger: container,
            start: "top bottom",
            end: "center center",
            scrub: true,
          },
        },
      );

      // 2. Image scale + vertical parallax across the full pass. Keyframes
      //    dip through 1.0 mid-pass for a subtle "settle" feel.
      gsap.fromTo(
        img,
        { scale: scaleFrom, yPercent: 0 },
        {
          keyframes: {
            scale: [scaleFrom, 1, scaleRest],
            yPercent: [0, parallax * 0.4, parallax],
          },
          ease: "none",
          scrollTrigger: {
            trigger: container,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className="reveal-container js-reveal mx-auto w-full"
      data-aspect={aspect}
    >
      <div ref={maskRef} className="reveal-mask w-full overflow-hidden will-change-[clip-path]">
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className="reveal-img h-full w-full object-cover will-change-transform"
        />
      </div>
    </div>
  );
}
