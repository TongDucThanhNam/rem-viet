import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

// Register all plugins once, at module load. Importing this module anywhere
// ensures the plugins are ready before any animation runs.
gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, useGSAP);

// Shared defaults tuned for a cinematic, AWWWARDS-style feel.
gsap.defaults({ ease: "power3.out", duration: 0.9 });

// Signature easing curves — created once at module load, shared across the
// site so the motion language is consistent. Names map to intent, not easing
// theory, so components read clearly at call sites.
//   cinematic — gentle overshoot for hero/entrance reveals
//   settle    — a quick build then slow settle for count-ups / snaps
CustomEase.create("cinematic", "0.16, 1, 0.3, 1");
CustomEase.create("settle", "0.34, 1.56, 0.64, 1");

// Keep ScrollTrigger in lock-step with Lenis's smoothed scroll. The actual
// wiring of `lenis.on("scroll", ScrollTrigger.update)` lives in
// <GsapScrollSync /> (rendered inside <ReactLenis> in routes/index.tsx) so it
// has access to the live Lenis instance.

export { gsap, ScrollTrigger, SplitText, CustomEase, useGSAP };

/** True when the user prefers reduced motion. Check before running big animations. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
