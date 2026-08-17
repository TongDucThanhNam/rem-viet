import { useRef, useState } from "react";
import { defaultMarqueeBlock, type MarqueeBlock } from "@rem-viet/cms";

import {
  gsap,
  ScrollTrigger,
  useGSAP,
  shouldUseStaticLanding,
} from "@/lib/gsap";

/**
 * Infinite marquee that reacts to scroll — the signature AWWWARDS marquee.
 *
 * Two scroll-driven effects layer together:
 *  1. **Speed**: a page-spanning ScrollTrigger writes `animation-duration`
 *     (30s slow at top → 12s fast at bottom). The seamless loop itself is the
 *     CSS `@keyframes` in landing.css (translateX across tripled content).
 *  2. **Velocity skew**: on fast scroll the marquee skews briefly in the scroll
 *     direction (down → skewX negative, up → positive), then settles back to 0
 *     via a smooth tween. This "the marquee feels the scroll" detail is what
 *     separates a stock marquee from a premium one.
 *
 * Hover pauses the loop via React state → `animation-play-state`.
 */
export function Marquee({
  content = defaultMarqueeBlock,
}: {
  content?: MarqueeBlock;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useGSAP(
    () => {
      const inner = innerRef.current;
      if (!inner) return;

      // Smooth setter for the skew return-to-zero — created once.
      const skewTo = gsap.quickTo(inner, "skewX", {
        duration: 0.5,
        ease: "power3.out",
      });

      const applySpeed = (progress: number) => {
        // 30s (slow, top of page) → 12s (fast, bottom).
        inner.style.animationDuration = `${30 - progress * 18}s`;
      };

      if (shouldUseStaticLanding()) {
        // Speed mapping only; skip the velocity skew.
        const st = ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => applySpeed(self.progress),
        });
        applySpeed(st.progress);
        return;
      }

      const st = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          applySpeed(self.progress);
          // getVelocity is px/s; clamp + map to ±6° skew. Down scrolls are
          // positive, up negative — flip sign so the skew follows direction.
          const v = self.getVelocity();
          const skew = gsap.utils.clamp(-6, 6, v / 400);
          skewTo(skew);
        },
      });
      applySpeed(st.progress);
    },
    { scope: innerRef },
  );

  return (
    <div
      className="marquee font-sans"
      aria-label={content.ariaLabel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={innerRef}
        className="marquee-inner"
        style={{ animationPlayState: isPaused ? "paused" : "running" }}
      >
        <span className="font-playfair italic">{content.text}</span>
        <span className="font-playfair italic" aria-hidden="true">
          {content.text}
        </span>
        <span className="font-playfair italic" aria-hidden="true">
          {content.text}
        </span>
      </div>
    </div>
  );
}
