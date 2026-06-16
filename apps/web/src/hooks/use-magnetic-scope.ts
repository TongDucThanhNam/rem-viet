import { useEffect } from "react";

import { gsap } from "@/lib/gsap";

/**
 * Applies the AWWWARDS organic magnetic pull to every `.hover-target` rendered
 * under the current document. Excludes:
 *  - the custom cursor element (id="cursor") so it does not pull itself
 *  - elements inside the fixed `.nav` (which already use the per-link
 *    `useMagnetic` hook for a smoother native spring effect)
 *
 * Mount once at the page root (e.g. in `routes/index.tsx`). It queries the
 * DOM dynamically as new hover targets appear, so dynamically mounted
 * `.hover-target` elements (e.g. those revealed after the loader hides) still
 * receive the magnetic effect.
 *
 * GSAP implementation: a `quickTo` per axis for the smooth follow, plus a
 * bouncier `elastic` return to 0 on leave — the bouncier AWWWARDS-style feel.
 */
export function useMagneticScope(selector: string = ".hover-target") {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const isExcluded = (el: HTMLElement): boolean => {
      // Skip the custom cursor element and its children.
      if (el.closest("#cursor")) return true;
      // Skip the top nav — it already uses the per-link useMagnetic hook.
      if (el.closest(".nav")) return true;
      return false;
    };

    const attach = (target: HTMLElement) => {
      if ((target as any).__magneticScopeBound) return;
      (target as any).__magneticScopeBound = true;

      const xTo = gsap.quickTo(target, "x", {
        duration: 0.6,
        ease: "power3",
      });
      const yTo = gsap.quickTo(target, "y", {
        duration: 0.6,
        ease: "power3",
      });

      const onMove = (e: MouseEvent) => {
        const rect = target.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
        xTo(x);
        yTo(y);
      };

      const onLeave = () => {
        // Bouncier return — the AWWWARDS "settle" feel.
        gsap.to(target, {
          x: 0,
          y: 0,
          duration: 0.8,
          ease: "elastic.out(1, 0.5)",
          overwrite: true,
        });
      };

      target.addEventListener("mousemove", onMove);
      target.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        target.removeEventListener("mousemove", onMove);
        target.removeEventListener("mouseleave", onLeave);
        (target as any).__magneticScopeBound = false;
      });
    };

    const queryAndBind = () => {
      const targets = document.querySelectorAll<HTMLElement>(selector);
      targets.forEach((el) => {
        if (isExcluded(el)) return;
        attach(el);
      });
    };

    // Initial pass for elements that already exist.
    if (!coarse) queryAndBind();

    // Watch for late-mounted elements (e.g. revealed after loader).
    const observer = new MutationObserver(() => {
      if (!coarse) queryAndBind();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [selector]);
}
