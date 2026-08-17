import { useRef } from "react";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { defaultFooterCtaBlock, type FooterCtaBlock } from "@rem-viet/cms";

import { useSiteChrome } from "@/hooks/use-site-chrome";
import {
  gsap,
  ScrollTrigger,
  SplitText,
  useGSAP,
  shouldUseStaticLanding,
} from "@/lib/gsap";

/**
 * A threshold-driven curtain ending adapted from the supplied footer reveal
 * references. The footer still sits behind `#smooth-wrapper`, but its content
 * now wakes up only while the final viewport of reserved scroll space exposes
 * it — and reverses cleanly when the user scrolls back.
 */
export function CurtainFooter({
  content = defaultFooterCtaBlock,
}: {
  content?: FooterCtaBlock;
}) {
  const { settings } = useSiteChrome();
  const footerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const footer = footerRef.current;
      const trigger = document.querySelector<HTMLElement>("#smooth-wrapper");
      if (!footer || !trigger) return;

      const kicker = footer.querySelector<HTMLElement>(".footer-kicker");
      const title = footer.querySelector<HTMLElement>(".footer-cta h2");
      const cta = footer.querySelector<HTMLElement>(".massive-link");
      const bottom = footer.querySelector<HTMLElement>(".footer-bottom");
      const progress = footer.querySelector<HTMLElement>(
        ".footer-progress-fill",
      );
      const progressValue = footer.querySelector<HTMLElement>(
        ".footer-progress-value",
      );
      const glow = footer.querySelector<HTMLElement>(".footer-glow");
      if (!kicker || !title || !cta || !bottom || !progress || !glow) return;

      if (shouldUseStaticLanding()) {
        gsap.set([kicker, title, cta, bottom], { autoAlpha: 1, x: 0, y: 0 });
        gsap.set(progress, { scaleX: 1 });
        gsap.set(glow, { autoAlpha: 0.55, scale: 1 });
        if (progressValue) progressValue.textContent = "100";
        return;
      }

      const split = new SplitText(title, { type: "lines", mask: "lines" });

      gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
      gsap.set(glow, { autoAlpha: 0, scale: 0.78 });
      gsap.set(kicker, { autoAlpha: 0, y: 20 });
      gsap.set(split.lines, { yPercent: 115 });
      gsap.set(cta, { autoAlpha: 0, y: 46 });
      gsap.set(bottom, { autoAlpha: 0, y: 22 });

      const timeline = gsap.timeline({
        scrollTrigger: {
          id: "curtain-footer-reveal",
          trigger,
          start: "bottom bottom",
          // The reserved curtain space can vary (100dvh desktop / 70dvh
          // mobile), so the document maximum is the authoritative 100%.
          end: "max",
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressValue) {
              progressValue.textContent = String(
                Math.round(self.progress * 100),
              ).padStart(3, "0");
            }
          },
        },
      });

      timeline
        .to(progress, { scaleX: 1, duration: 1, ease: "none" }, 0)
        .to(
          glow,
          { autoAlpha: 0.55, scale: 1, duration: 0.68, ease: "cinematic" },
          0.04,
        )
        .to(
          kicker,
          { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" },
          0.14,
        )
        .to(
          split.lines,
          {
            yPercent: 0,
            duration: 0.34,
            stagger: 0.045,
            ease: "cinematic",
          },
          0.24,
        )
        .to(cta, { autoAlpha: 1, y: 0, duration: 0.3, ease: "cinematic" }, 0.48)
        .to(
          bottom,
          { autoAlpha: 0.82, y: 0, duration: 0.22, ease: "power2.out" },
          0.68,
        );

      const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 300);
      return () => window.clearTimeout(refreshId);
    },
    { scope: footerRef },
  );

  return (
    <footer
      className="footer curtain-footer fixed bottom-0 left-0 z-[1] flex h-dvh w-full flex-col overflow-hidden bg-[#0d0d0d] px-[4vw] pt-[clamp(78px,12vh,130px)] pb-[clamp(24px,5vh,56px)] font-sans text-[#f8f5ef] max-[1024px]:h-[70dvh]"
      id="order"
      ref={footerRef}
    >
      <span
        className="footer-glow pointer-events-none absolute top-1/2 left-1/2 h-[min(90vw,1100px)] w-[min(90vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        aria-hidden="true"
      />

      <div className="footer-progress absolute top-[clamp(26px,4vh,48px)] right-[4vw] left-[4vw] z-3 font-vietnam">
        <div className="mb-3 flex items-center justify-between gap-6 text-[9px] tracking-[0.22em] text-white/50 uppercase">
          <span>{content.eyebrow}</span>
          <span>
            <span className="footer-progress-value tabular-nums">000</span>%
          </span>
        </div>
        <div className="h-px overflow-hidden bg-white/16">
          <span className="footer-progress-fill block h-full w-full origin-left bg-[var(--accent)]" />
        </div>
      </div>

      <div className="footer-cta relative z-2 m-0 flex w-full flex-1 flex-col items-center justify-center text-center">
        <p className="footer-kicker mb-5 font-vietnam text-[10px] tracking-[0.22em] text-[var(--accent-soft)] uppercase">
          {content.kicker}
        </p>
        <h2 className="max-w-[11ch] font-playfair text-[clamp(46px,8vw,126px)] font-normal leading-[0.9] tracking-[-0.035em] text-balance">
          <span className="footer-title-prefix">{content.title.prefix}</span>{" "}
          <span className="footer-title-accent">{content.title.accent}</span>
        </h2>
        <a
          href={`mailto:${content.email}`}
          className="massive-link hover-target group mt-[clamp(26px,5vh,58px)] inline-flex items-center gap-[clamp(14px,2vw,30px)] font-playfair text-[clamp(27px,5.4vw,82px)] font-normal leading-none text-[var(--accent)] italic no-underline"
          data-cursor={content.cursorLabel}
        >
          <span>{content.emailLabel}</span>
          <span className="footer-link-arrow grid h-[clamp(42px,6vw,82px)] w-[clamp(42px,6vw,82px)] shrink-0 place-items-center rounded-full border border-white/20 text-[#f8f5ef]">
            <ArrowUpRight
              className="h-[42%] w-[42%]"
              strokeWidth={1.2}
              aria-hidden="true"
            />
          </span>
        </a>
      </div>

      <div className="footer-bottom relative z-2 grid w-full grid-cols-[1fr_auto_1fr] items-end gap-8 border-t border-white/12 pt-[clamp(18px,3vh,34px)] font-vietnam text-[10px] tracking-[0.14em] text-white/58 uppercase max-[760px]:grid-cols-2 max-[520px]:gap-4">
        <p className="max-[520px]:col-span-2">{content.copyright}</p>
        <div className="footer-socials flex gap-[clamp(18px,3vw,40px)] max-[760px]:justify-self-end max-[520px]:justify-self-start">
          <a
            href={settings.socials.facebook}
            className="hover-target text-white/72 no-underline transition-colors duration-300 hover:text-white"
            rel="noreferrer"
            target="_blank"
            data-cursor={content.socialCursorLabel}
          >
            <span className="footer-social-label">
              {content.socialLabels.facebook}
            </span>
          </a>
          <a
            href={settings.socials.shopee}
            className="hover-target text-white/72 no-underline transition-colors duration-300 hover:text-white"
            rel="noreferrer"
            target="_blank"
            data-cursor={content.socialCursorLabel}
          >
            <span className="footer-social-label">
              {content.socialLabels.shopee}
            </span>
          </a>
        </div>
        <a
          href="#home"
          className="footer-back-to-top hover-target flex items-center justify-self-end gap-2 text-white/72 no-underline transition-colors duration-300 hover:text-white"
          data-cursor={content.backToTopCursorLabel}
        >
          <span className="footer-back-label">{content.backToTopLabel}</span>
          <ArrowUp size={13} strokeWidth={1.4} aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
