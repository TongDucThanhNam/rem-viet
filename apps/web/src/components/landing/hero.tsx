import { useRef } from "react";
import { ArrowDownRight, Ruler, ShieldCheck, Sparkles, Wind } from "lucide-react";

import {
  gsap,
  SplitText,
  useGSAP,
  prefersReducedMotion,
} from "@/lib/gsap";

const features = [
  {
    icon: ShieldCheck,
    label: "Bảo vệ vô hình",
    value: "99.9% chống muỗi",
  },
  {
    icon: Ruler,
    label: "May đo",
    value: "Vừa khít từng mm",
  },
  {
    icon: Wind,
    label: "Thông thoáng",
    value: "Giữ ánh sáng tự nhiên",
  },
  {
    icon: Sparkles,
    label: "Thẩm mỹ",
    value: "Hợp kiến trúc hiện đại",
  },
] as const;

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
 * bg image (slow downward drift), grain (medium), content (counter-drift
 * up) + a fade-out as the hero leaves — giving cinematic depth.
 *
 * `isLoaded` MUST stay in the signature — the Loader contract depends on it.
 */
export function Hero({ isLoaded }: { isLoaded: boolean }) {
  const heroRef = useRef<HTMLElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const title1Ref = useRef<HTMLSpanElement>(null);
  const title2Ref = useRef<HTMLSpanElement>(null);
  const kickerRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const featuresBarRef = useRef<HTMLDivElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);

  // Scroll-driven parallax runs once on mount (independent of isLoaded) —
  // the layers should always drift with scroll, even before the entrance
  // plays (the loader covers them anyway).
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const hero = heroRef.current;
      const bgImg = bgImgRef.current;
      const grain = grainRef.current;
      const content = hero?.querySelector<HTMLElement>(".hero-new-content");
      const features = featuresBarRef.current;
      if (!hero || !bgImg) return;

      const st = { trigger: hero, start: "top top", end: "bottom top", scrub: true };

      // 3-layer parallax: bg slow, grain medium, content counter-drifts up.
      // Different yPercent ranges create the depth illusion. useGSAP's scope
      // auto-reverts these tweens + ScrollTriggers on unmount.
      gsap.to(bgImg, { yPercent: 18, ease: "none", scrollTrigger: st });
      if (grain) gsap.to(grain, { yPercent: 8, ease: "none", scrollTrigger: st });
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

      const reduce = prefersReducedMotion();

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
        })
        : null;
      const split2 = title2Ref.current
        ? new SplitText(title2Ref.current, {
          type: "chars",
          charsClass: "hero-title-char",
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
      <div className="hero-new-bg absolute inset-0 -z-2 overflow-hidden" aria-hidden="true">
        <img
          className="h-[115%] w-full object-cover object-center will-change-transform"
          src="/assets/7c9323bc-888a-4cba-b876-f0aa79b35158.png"
          alt=""
          ref={bgImgRef}
        />
      </div>
      <div className="hero-vignette" aria-hidden="true" ref={vignetteRef} />

      <div className="hero-new-content relative z-2 w-full max-w-[760px]">
        <p
          className="hero-new-kicker relative mb-5 pb-3.5 font-vietnam text-[12px] font-medium leading-tight tracking-[0.18em] text-white/78 uppercase"
          ref={kickerRef}
        >
          (01) Lưới chống muỗi may đo
        </p>

        <h1 className="hero-new-title m-0 font-playfair text-display font-normal leading-[0.82] tracking-[-0.01em] xl:text-[clamp(54px,10vw,112px)] lg:text-[clamp(42px,9vw,78px)] sm:text-[54px] sm:leading-[0.88]">
          <span className="hero-title-line block overflow-hidden">
            <span className="inline-block" ref={title1Ref}>
              Rèm
            </span>
          </span>
          <span className="hero-title-line block overflow-hidden">
            <span className="inline-block text-brand italic" ref={title2Ref}>
              Vina
            </span>
          </span>
        </h1>

        <p
          className="mt-7.5 max-w-[540px] font-vietnam text-body leading-[1.7] text-white/78 lg:max-w-[480px] lg:text-[15px] sm:mt-[22px] sm:text-[14px] sm:leading-[1.65]"
          ref={descRef}
        >
          Giải pháp lưới chống muỗi cao cấp cho cửa sổ và cửa đi. May đo theo
          từng khung, giữ không gian thoáng sáng mà vẫn bảo vệ gia đình mỗi ngày.
        </p>

        <div className="hero-new-actions mt-8.5" ref={actionsRef}>
          <a
            href="#order"
            className="hero-new-link hover-target inline-flex min-h-12 w-auto items-center justify-start gap-3 rounded-lg border border-white/28 bg-white/12 px-4.5 text-[12px] font-medium tracking-[0.12em] text-white uppercase no-underline backdrop-blur-[14px] will-change-transform sm:w-full sm:justify-center"
            data-cursor="Đặt may"
          >
            <ArrowDownRight aria-hidden="true" size={18} strokeWidth={1.7} className="text-brand" />
            <span>Tư vấn kích thước</span>
          </a>
        </div>
      </div>

      <div className="hero-features-bar font-vietnam" ref={featuresBarRef}>
        {features.map(({ icon: Icon, label, value }) => (
          <div
            className="hero-feature flex min-h-24 items-center gap-3.5 bg-black/18 p-5 xl:p-[18px] lg:min-h-[82px] lg:p-4 sm:min-h-15 sm:gap-3 sm:px-3.5 sm:py-3"
            key={label}
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
        ))}
      </div>
    </section>
  );
}
