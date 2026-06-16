import { useEffect } from "react";
import { useLenis } from "lenis/react";

import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * The canonical GSAP × Lenis integration — the bulletproof setup.
 *
 * 1. `ReactLenis` is mounted with `autoRaf: false` (in routes/index.tsx) so it
 *    does NOT run its own RAF loop.
 * 2. Lenis's `raf` is driven from GSAP's ticker → a single animation loop, so
 *    every ScrollTrigger update stays in perfect lock-step with the eased
 *    scroll. (`gsap.ticker.lagSmoothing(0)` prevents GSAP from catching up in
 *    big jumps that would desync the smooth scroll.)
 * 3. `lenis.on("scroll", ScrollTrigger.update)` is belt-and-suspenders so any
 *    scroll tick immediately nudges ScrollTrigger.
 * 4. `ScrollTrigger.refresh()` once the page settles.
 *
 * Must be rendered as a child of `<ReactLenis>` so `useLenis()` resolves.
 */
export function GsapScrollSync() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) {
      // Lenis creates its instance asynchronously (in ReactLenis's own effect).
      // When it resolves, this effect re-runs via the [lenis] dependency and
      // wires everything below. Nothing to do on the first pass.
      return;
    }

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const refresh = () => ScrollTrigger.refresh();
    const t = window.setTimeout(refresh, 400);
    window.addEventListener("load", refresh);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      window.clearTimeout(t);
      window.removeEventListener("load", refresh);
    };
  }, [lenis]);

  return null;
}
