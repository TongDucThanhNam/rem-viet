import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

let initialized = false;

/** Register GSAP only in the browser; Cloudflare forbids timers at module scope. */
export function ensureGsapPlugins() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, useGSAP);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });

  // Shared names keep the motion language consistent across components.
  CustomEase.create("cinematic", "0.16, 1, 0.3, 1");
  CustomEase.create("settle", "0.34, 1.56, 0.64, 1");
  CustomEase.create("loader-load", "0.76, 0, 0.24, 1");
  CustomEase.create("loader-reveal", "0.19, 1, 0.22, 1");
}

ensureGsapPlugins();

// Keep ScrollTrigger in lock-step with Lenis's smoothed scroll. The actual
// wiring of `lenis.on("scroll", ScrollTrigger.update)` lives in
// <GsapScrollSync /> (rendered inside <ReactLenis> in routes/index.tsx) so it
// has access to the live Lenis instance.

export { gsap, ScrollTrigger, SplitText, CustomEase, useGSAP };

/** True when the user prefers reduced motion. Check before running big animations. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Use the static landing presentation when motion is user-disabled or the
 * device has a coarse/small viewport. Mobile sections already provide
 * non-pinned equivalents, so skipping page-wide GSAP setup avoids expensive
 * SplitText and ScrollTrigger measurement without removing any content.
 */
export const shouldUseStaticLanding = () =>
  typeof window !== "undefined" &&
  window.matchMedia(
    "(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 768px)",
  ).matches;
