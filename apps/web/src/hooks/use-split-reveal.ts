import { useRef } from "react";

import { gsap, SplitText, useGSAP, prefersReducedMotion } from "@/lib/gsap";

type SplitRevealOptions = {
  /** Split granularity: "chars", "words", or "lines". */
  type?: "chars" | "words" | "lines";
  /** Seconds between each unit animating in. */
  stagger?: number;
  /** Travel distance as a yPercent of the unit. Default 110 (fully masked). */
  yPercent?: number;
  /** Animation duration in seconds. */
  duration?: number;
  /** ScrollTrigger start position. */
  start?: string;
  /** Delay before the reveal begins (seconds). */
  delay?: number;
  /** Only play once (no reverse on scroll back). */
  once?: boolean;
};

/**
 * Splits a heading into words/chars/lines and reveals them with a masked
 * translate-up animation as it scrolls into view — the signature AWWWARDS
 * text reveal. Returns a ref to attach to the text element.
 *
 * The SplitText instance is created inside `useGSAP`'s scope, so it (and its
 * generated DOM) is automatically reverted on unmount.
 */
export function useSplitReveal<T extends HTMLElement = HTMLElement>(
  options: SplitRevealOptions = {},
) {
  const ref = useRef<T>(null);
  const {
    type = "words",
    stagger = 0.06,
    yPercent = 110,
    duration = 1,
    start = "top 85%",
    delay = 0,
    once = true,
  } = options;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // Respect users who prefer reduced motion: show the text immediately.
      if (prefersReducedMotion()) {
        gsap.set(el, { opacity: 1 });
        return;
      }

      const split = new SplitText(el, {
        type,
        mask: type,
        linesClass: "split-line",
        wordsClass: "split-word",
        charsClass: "split-char",
      });
      const targets = split[type] as HTMLElement[];

      gsap.from(targets, {
        yPercent,
        duration,
        ease: "power4.out",
        stagger,
        delay,
        scrollTrigger: {
          trigger: el,
          start,
          once,
        },
      });
    },
    { scope: ref },
  );

  return ref;
}
