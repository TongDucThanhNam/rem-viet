import { useEffect, useRef } from "react";

import { gsap } from "@/lib/gsap";

/**
 * Per-link magnetic pull — used by `<MagneticLink>` in the navigation.
 *
 * GSAP implementation: `quickTo` creates a single reusable fast tween per axis.
 * On `mousemove` we feed the pull offset (capped at 30% of the cursor distance
 * from the element center); on `mouseleave` we return to 0 with a bouncier
 * elastic settle. A subtle scale-up on hover adds the "lift" that makes the
 * link feel tactile — the small detail that separates a premium nav from a
 * stock one.
 *
 * Returns only the `ref` now — the hook applies the transform to the element
 * directly, so the link can be a plain `<a>`.
 */
export function useMagnetic() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip on touch devices — magnetic is a pointer-fine interaction.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    // Smooth trailing follow per axis.
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });

    let rect: DOMRect | null = null;

    const handleMouseEnter = () => {
      rect = el.getBoundingClientRect();
      // Subtle scale-up — the "lift". transform-origin center keeps it
      // symmetric with the magnetic drift.
      gsap.to(el, { scale: 1.04, duration: 0.4, ease: "power3.out" });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!rect) rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      xTo((e.clientX - centerX) * 0.3);
      yTo((e.clientY - centerY) * 0.3);
    };

    const handleMouseLeave = () => {
      // Bouncier elastic return to rest — the signature AWWWARDS settle.
      gsap.to(el, {
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "elastic.out(1, 0.5)",
        overwrite: true,
      });
      rect = null;
    };

    el.addEventListener("mouseenter", handleMouseEnter);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mouseenter", handleMouseEnter);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return { ref };
}
