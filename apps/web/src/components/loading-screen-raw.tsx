import { useRef } from "react";

import { gsap, CustomEase, useGSAP } from "@/lib/gsap";

// The two cubic-bezier eases the original loader was tuned to. Preserved
// exactly (they're part of the documented loader contract in AGENTS.md).
const EASE_LOAD = CustomEase.create("loader-load", "0.76, 0, 0.24, 1");
const EASE_REVEAL = CustomEase.create("loader-reveal", "0.19, 1, 0.22, 1");

/**
 * AWWWARDS-style loading screen.
 *
 * GSAP timeline sequence (matches the original framer-motion contract):
 *   1. Count 0% → 100% over 2s (`loader-load` ease).
 *   2. Fade + lift the counter (opacity 0, y -50, 0.5s, `loader-reveal`).
 *   3. `scaleY: 0` both panels (1s, 0.2s delay, `loader-load` ease) — the top
 *      panel has `transform-origin: top` so it slides up, the bottom panel
 *      `transform-origin: bottom` so it slides down.
 *   4. On the bottom panel's `onComplete`: remove `body.is-loading`
 *      (CSS `overflow: hidden`), hide the loader, call the parent `onComplete`
 *      so `routes/index.tsx` flips `isLoaded = true` and the Hero animates.
 *
 * Markup must stay `.loader > .loader-counter + .loader-overlay-top +
 * .loader-overlay-bottom` (the CSS in `landing.css` styles every piece).
 */
export function LoadingScreenRaw({ onComplete }: { onComplete?: () => void }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const topOverlayRef = useRef<HTMLDivElement>(null);
  const bottomOverlayRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useGSAP(
    () => {
      const counterEl = counterRef.current;
      const topEl = topOverlayRef.current;
      const bottomEl = bottomOverlayRef.current;
      const loaderEl = loaderRef.current;
      if (!counterEl || !topEl || !bottomEl || !loaderEl) return;

      document.body.classList.add("is-loading");

      const counter = { value: 0 };

      const tl = gsap.timeline({
        defaults: { ease: EASE_LOAD, duration: 1 },
      });

      tl.to(
        counter,
        {
          value: 100,
          duration: 2,
          ease: EASE_LOAD,
          onUpdate: () => {
            counterEl.textContent = Math.round(counter.value) + "%";
          },
        },
      )
        .to(
          counterEl,
          {
            opacity: 0,
            y: -50,
            duration: 0.5,
            ease: EASE_REVEAL,
          },
          ">-0.1",
        )
        .to(
          topEl,
          {
            scaleY: 0,
            duration: 1,
            ease: EASE_LOAD,
          },
          ">0.1",
        )
        .to(
          bottomEl,
          {
            scaleY: 0,
            duration: 1,
            ease: EASE_LOAD,
            onComplete: () => {
              loaderEl.style.display = "none";
              document.body.classList.remove("is-loading");
              onCompleteRef.current?.();
            },
          },
          "<",
        );

      return () => {
        tl.kill();
        document.body.classList.remove("is-loading");
      };
    },
    { scope: loaderRef },
  );

  return (
    <div
      className="loader pointer-events-none fixed top-0 left-0 z-[9000] flex h-dvh w-screen items-center justify-center"
      id="loader"
      ref={loaderRef}
    >
      <div
        className="font-playfair relative z-[9001] text-[15vw] font-normal text-[var(--bg-color)]"
        ref={counterRef}
      >
        0%
      </div>
      <div
        className="absolute left-0 h-[50dvh] w-full bg-[var(--text-color)]"
        style={{ top: 0, transformOrigin: "top" }}
        ref={topOverlayRef}
      />
      <div
        className="absolute left-0 h-[50dvh] w-full bg-[var(--text-color)]"
        style={{ bottom: 0, transformOrigin: "bottom" }}
        ref={bottomOverlayRef}
      />
    </div>
  );
}
