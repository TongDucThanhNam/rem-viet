import { useRef } from "react";

import {
  gsap,
  ScrollTrigger,
  useGSAP,
  shouldUseStaticLanding,
} from "@/lib/gsap";

/**
 * Thin top-of-viewport progress bar that tracks page scroll position.
 *
 * GSAP implementation:
 *  - A page-spanning ScrollTrigger (start 0 → end "max") reports the overall
 *    scroll progress on every Lenis-driven scroll tick.
 *  - `gsap.quickTo` feeds that progress into the bar's `scaleX` with a short
 *    trailing tween — this replaces framer-motion's `useSpring` and keeps the
 *    bar feeling alive (it lags slightly, then settles) even on instant
 *    scroll-to-anchor jumps.
 *  - `scaleX` (not `width`) keeps the work on the compositor thread.
 *  - Color uses `var(--accent-color)` from `landing.css`, which the
 *    `useThemeBySection()` hook re-binds on `<html data-theme="...">`, so the
 *    bar picks up section-driven theme changes for free.
 *  - `z-index: 9999` keeps it above the loader (9000); the cursor (10000)
 *    sits on top of everything (cursor > progress > loader > page).
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!barRef.current) return;

      if (shouldUseStaticLanding()) {
        const bar = barRef.current;
        let frame = 0;
        const update = () => {
          frame = 0;
          const max =
            document.documentElement.scrollHeight - window.innerHeight;
          const progress = max > 0 ? window.scrollY / max : 0;
          bar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
        };
        const schedule = () => {
          if (!frame) frame = window.requestAnimationFrame(update);
        };

        update();
        window.addEventListener("scroll", schedule, { passive: true });
        return () => {
          window.removeEventListener("scroll", schedule);
          if (frame) window.cancelAnimationFrame(frame);
        };
      }

      const setX = gsap.quickTo(barRef.current, "scaleX", {
        duration: 0.4,
        ease: "power3",
      });

      gsap.set(barRef.current, { scaleX: 0 });

      const st = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => setX(self.progress),
      });

      // Set the initial position from current progress (in case the user
      // lands mid-page on a refresh).
      setX(st.progress);
    },
    { scope: barRef },
  );

  return <div ref={barRef} aria-hidden="true" className="scroll-progress" />;
}
