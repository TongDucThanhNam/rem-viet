import { useEffect, useRef, useState } from "react";

import { gsap, shouldUseStaticLanding, useGSAP } from "@/lib/gsap";

// The two cubic-bezier eases the original loader was tuned to. Preserved
// exactly (they're part of the documented loader contract in AGENTS.md).
const EASE_LOAD = "loader-load";
const EASE_REVEAL = "loader-reveal";

/**
 * AWWWARDS-style loading screen.
 *
 * GSAP timeline sequence (matches the original framer-motion contract):
 *   1. Count 0% → 100% over 0.65s (`loader-load` ease).
 *   2. Fade + lift the counter (opacity 0, y -50, 0.18s, `loader-reveal`).
 *   3. `scaleY: 0` both panels (0.45s, `loader-load` ease) — the top
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
  const [showRecovery, setShowRecovery] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const topOverlayRef = useRef<HTMLDivElement>(null);
  const bottomOverlayRef = useRef<HTMLDivElement>(null);
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finishLoading = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    if (loaderRef.current) loaderRef.current.style.display = "none";
    document.body.classList.remove("is-loading");
    onCompleteRef.current?.();
  };

  useEffect(() => {
    const recoveryId = window.setTimeout(() => {
      if (!hasCompletedRef.current) setShowRecovery(true);
    }, 4000);

    return () => window.clearTimeout(recoveryId);
  }, []);

  useGSAP(
    () => {
      const counterEl = counterRef.current;
      const topEl = topOverlayRef.current;
      const bottomEl = bottomOverlayRef.current;
      const loaderEl = loaderRef.current;
      if (!counterEl || !topEl || !bottomEl || !loaderEl) return;

      document.body.classList.add("is-loading");
      if (shouldUseStaticLanding()) {
        finishLoading();
        return;
      }

      const counter = { value: 0 };

      const tl = gsap.timeline({
        defaults: { ease: EASE_LOAD, duration: 1 },
      });

      tl.to(counter, {
        value: 100,
        duration: 0.65,
        ease: EASE_LOAD,
        onUpdate: () => {
          counterEl.textContent = Math.round(counter.value) + "%";
        },
      })
        .to(
          counterEl,
          {
            opacity: 0,
            y: -50,
            duration: 0.18,
            ease: EASE_REVEAL,
          },
          ">-0.08",
        )
        .to(
          topEl,
          {
            scaleY: 0,
            duration: 0.45,
            ease: EASE_LOAD,
          },
          ">-0.03",
        )
        .to(
          bottomEl,
          {
            scaleY: 0,
            duration: 0.45,
            ease: EASE_LOAD,
            onComplete: finishLoading,
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
      aria-label="Tiến trình tải trang"
      className="loader pointer-events-none fixed top-0 left-0 z-[9000] flex h-dvh w-screen items-center justify-center"
      id="loader"
      ref={loaderRef}
      role="region"
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
      {showRecovery ? (
        <div
          className="pointer-events-auto absolute bottom-[8vh] left-1/2 z-[9002] flex -translate-x-1/2 flex-col items-center gap-3 text-center font-vietnam text-[var(--bg-color)]"
          role="status"
        >
          <p className="text-[11px] tracking-[0.14em] uppercase opacity-70">
            Đang tải lâu hơn dự kiến
          </p>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-current/30 bg-transparent px-5 text-[12px] font-medium tracking-[0.1em] uppercase"
            onClick={finishLoading}
          >
            Tiếp tục xem trang
          </button>
        </div>
      ) : null}
    </div>
  );
}
