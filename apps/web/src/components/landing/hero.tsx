import { useRef } from "react";
import {
  ArrowDownRight,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wind,
} from "lucide-react";
import {
  defaultHeroBlock,
  type HeroBlockData,
  type HeroFeatureIconKey,
} from "@agency/cms-template-rem-viet";

import { gsap, SplitText, useGSAP, shouldUseStaticLanding } from "@/lib/gsap";

const featureIcons = {
  ruler: Ruler,
  shield: ShieldCheck,
  sparkles: Sparkles,
  wind: Wind,
} satisfies Record<HeroFeatureIconKey, typeof ShieldCheck>;

const backgroundPosition = {
  bottom: "center bottom",
  center: "center center",
  left: "left center",
  right: "right center",
  top: "center top",
} satisfies Record<HeroBlockData["background"]["position"], string>;

type HeroProps = {
  content?: HeroBlockData;
  isLoaded: boolean;
};

function isExternalHref(href: string) {
  return /^(https?:)?\/\//.test(href);
}

/**
 * Hero — full-bleed background with layered parallax, overlay content
 * (left) + feature bar + scroll cue.
 *
 * The entrance is gated on `isLoaded` (set true by `<LoadingScreenRaw>`'s
 * `onComplete`). When it flips, a single GSAP timeline plays the whole
 * choreography:
 *   kicker (underline draws) 0.10 → Rèm 0.18 → Vina 0.30 → desc 0.58
 *   → CTA 0.76 → features 0.90 → scroll cue 1.05.
 *
 * The title uses SplitText to split each masked line (`.hero-title-line` =
 * `overflow: hidden`) into chars, revealed with a staggered translate-up +
 * blur-to-sharp on the shared `cinematic` CustomEase.
 *
 * Separately, a scrubbed ScrollTrigger drives a 3-layer parallax on scroll:
 * bg image (slow downward drift) and content (counter-drift up) + a fade-out
 * as the hero leaves — giving cinematic depth without darkening the photo.
 *
 * `isLoaded` MUST stay in the signature — the Loader contract depends on it.
 */
export function Hero({ content = defaultHeroBlock.data, isLoaded }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const title1Ref = useRef<HTMLSpanElement>(null);
  const title2Ref = useRef<HTMLSpanElement>(null);
  const kickerRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const featuresBarRef = useRef<HTMLDivElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);
  const primaryExternal = isExternalHref(content.primaryCta.href);
  const secondaryExternal = isExternalHref(content.secondaryCta.href);

  // Scroll-driven parallax runs once on mount (independent of isLoaded) —
  // the layers should always drift with scroll, even before the entrance
  // plays (the loader covers them anyway).
  useGSAP(
    () => {
      if (shouldUseStaticLanding()) return;

      const hero = heroRef.current;
      const bgImg = bgImgRef.current;
      const content = hero?.querySelector<HTMLElement>(".hero-new-content");
      const features = featuresBarRef.current;
      if (!hero || !bgImg) return;

      const st = {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true,
      };

      // The bg drifts down while the content counter-drifts up. useGSAP's
      // scope auto-reverts these tweens + ScrollTriggers on unmount.
      gsap.to(bgImg, { yPercent: 18, ease: "none", scrollTrigger: st });
      if (content) {
        gsap.to(content, {
          yPercent: -8,
          opacity: 0.4,
          ease: "none",
          scrollTrigger: st,
        });
      }
      if (features) {
        // Feature bar exits faster (first half of the hero scroll).
        gsap.to(features, {
          yPercent: -30,
          opacity: 0,
          ease: "none",
          scrollTrigger: { ...st, end: "50% top" },
        });
      }
    },
    { scope: heroRef },
  );

  // Entrance choreography — re-runs when isLoaded flips (loader complete).
  useGSAP(
    () => {
      if (!isLoaded) return;

      const reduce = shouldUseStaticLanding();

      const els = [
        kickerRef.current,
        title1Ref.current,
        title2Ref.current,
        descRef.current,
        actionsRef.current,
        featuresBarRef.current,
      ];

      if (reduce) {
        gsap.set(els, { opacity: 1, y: 0, filter: "none" });
        gsap.set(scrollCueRef.current, { opacity: 1 });
        gsap.set(kickerRef.current, { "--kicker-underline-w": 1 });
        return;
      }

      // Split each masked title line into chars (mask = .hero-title-line).
      const split1 = title1Ref.current
        ? new SplitText(title1Ref.current, {
            type: "chars",
            charsClass: "hero-title-char",
            aria: "none",
          })
        : null;
      const split2 = title2Ref.current
        ? new SplitText(title2Ref.current, {
            type: "chars",
            charsClass: "hero-title-char",
            aria: "none",
          })
        : null;

      const tl = gsap.timeline({ defaults: { ease: "cinematic" } });

      tl.from(kickerRef.current, { opacity: 0, y: 28, duration: 1 }, 0.1)
        // Underline draws in alongside the kicker.
        .fromTo(
          kickerRef.current,
          { "--kicker-underline-w": 0 },
          { "--kicker-underline-w": 1, duration: 0.8, ease: "power2.out" },
          0.3,
        )
        .from(
          split1?.chars ?? [],
          {
            yPercent: 115,
            stagger: 0.05,
            duration: 1.15,
            filter: "blur(10px)",
          },
          0.18,
        )
        .from(
          split2?.chars ?? [],
          {
            yPercent: 115,
            stagger: 0.05,
            duration: 1.15,
            filter: "blur(10px)",
          },
          0.3,
        )
        .from(descRef.current, { opacity: 0, y: 28, duration: 1 }, 0.58)
        .from(actionsRef.current, { opacity: 0, y: 28, duration: 1 }, 0.76)
        .from(featuresBarRef.current, { opacity: 0, y: 24, duration: 0.9 }, 0.9)
        // Scroll cue fades in last, then its inner line starts bouncing.
        .fromTo(
          scrollCueRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.8 },
          1.05,
        );

      // Perpetual bounce on the scroll-cue line — the "inviting" loop.
      const cueLine = scrollCueRef.current?.querySelector(
        ".hero-scroll-cue-line",
      );
      if (cueLine) {
        gsap.to(cueLine, {
          scaleY: 0.6,
          transformOrigin: "top",
          duration: 0.9,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
    },
    { dependencies: [isLoaded], revertOnUpdate: true, scope: heroRef },
  );

  return (
    <section
      className="hero-new relative isolate flex h-dvh w-full min-w-0 items-end overflow-hidden bg-black px-[4vw] pt-[14vh] pb-[16vh] font-sans text-white lg:pb-[28vh] sm:px-[22px] sm:pt-[12vh] sm:pb-[32vh]"
      id="home"
      ref={heroRef}
    >
      <div
        className="hero-new-bg absolute inset-0 -z-2 overflow-hidden"
        aria-hidden="true"
      >
        <img
          className="h-[115%] w-full object-cover object-center will-change-transform"
          src={content.background.src}
          alt={content.background.alt}
          width={1672}
          height={941}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          style={{
            objectPosition: backgroundPosition[content.background.position],
          }}
          ref={bgImgRef}
        />
      </div>
      <div className="hero-new-content relative z-2 w-full max-w-[760px]">
        <p
          className="hero-new-kicker relative mb-5 pb-3.5 font-vietnam text-[12px] font-medium leading-tight tracking-[0.18em] text-white/78 uppercase"
          ref={kickerRef}
        >
          {content.kicker}
        </p>

        <h1 className="hero-new-title m-0 font-playfair text-display font-normal leading-[0.82] tracking-[-0.01em] xl:text-[clamp(54px,10vw,112px)] lg:text-[clamp(42px,9vw,78px)] sm:text-[54px] sm:leading-[0.88]">
          <span className="hero-title-line hero-title-line-single">
            <span className="hero-title-word" ref={title1Ref}>
              {content.title.prefix}
            </span>
            <span className="hero-title-word text-brand italic" ref={title2Ref}>
              {content.title.accent}
            </span>
          </span>
        </h1>

        <p
          className="mt-7.5 max-w-[540px] font-vietnam text-body leading-[1.7] text-white/78 lg:max-w-[480px] lg:text-[15px] sm:mt-[22px] sm:text-[14px] sm:leading-[1.65]"
          ref={descRef}
        >
          {content.description}
        </p>

        {/* Hero Actions */}
        <div
          className="hero-new-actions mt-8.5 grid w-full max-w-[540px] grid-cols-2 gap-3"
          ref={actionsRef}
        >
          <a
            href={content.primaryCta.href}
            className="hero-new-link hover-target inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-brand-solid bg-brand-solid px-5 text-[12px] font-semibold tracking-[0.12em] text-white uppercase no-underline shadow-[0_12px_32px_rgba(0,0,0,0.24)] will-change-transform transition-[background-color,border-color,color] duration-300 hoverable:hover:border-brand-soft hoverable:hover:bg-brand-soft hoverable:hover:text-black"
            data-cursor={content.primaryCta.cursorLabel}
            target={primaryExternal ? "_blank" : undefined}
            rel={primaryExternal ? "noopener noreferrer" : undefined}
          >
            <ArrowDownRight
              aria-hidden="true"
              size={18}
              strokeWidth={1.7}
              className="text-black/70"
            />
            <span>{content.primaryCta.label}</span>
          </a>
          <a
            href={content.secondaryCta.href}
            className="hero-new-link hover-target inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-white/28 bg-white/12 px-4.5 text-[12px] font-medium tracking-[0.12em] text-white uppercase no-underline backdrop-blur-[14px] will-change-transform"
            data-cursor={content.secondaryCta.cursorLabel}
            target={secondaryExternal ? "_blank" : undefined}
            rel={secondaryExternal ? "noopener noreferrer" : undefined}
          >
            <ShoppingBag
              aria-hidden="true"
              size={18}
              strokeWidth={1.7}
              className="text-brand"
            />
            <span>{content.secondaryCta.label}</span>
          </a>
        </div>
      </div>

      <div
        className="hero-scroll-cue font-vietnam"
        aria-hidden="true"
        ref={scrollCueRef}
      >
        <span>{content.scrollLabel}</span>
        <span className="hero-scroll-cue-line" />
      </div>

      <div className="hero-features-bar font-vietnam" ref={featuresBarRef}>
        {content.features.map(({ iconKey, id, label, value }) => {
          const Icon = featureIcons[iconKey];

          return (
            <div
              className="hero-feature flex min-h-24 items-center gap-3.5 bg-black/18 p-5 xl:p-[18px] lg:min-h-[82px] lg:p-4 sm:min-h-15 sm:gap-3 sm:px-3.5 sm:py-3"
              key={id}
            >
              <Icon
                aria-hidden="true"
                size={20}
                strokeWidth={1.5}
                className="text-brand shrink-0 sm:h-[18px] sm:w-[18px]"
              />
              <div>
                <span className="block text-[11px] tracking-[0.12em] leading-[1.3] text-white/62 uppercase sm:text-[10px]">
                  {label}
                </span>
                <strong className="mt-1.5 block text-[14px] font-medium leading-[1.45] text-white sm:mt-[3px] sm:text-[13px]">
                  {value}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
