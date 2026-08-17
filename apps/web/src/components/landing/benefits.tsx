import { useRef } from "react";
import { Home, Ruler, ShieldCheck, Waves } from "lucide-react";
import {
  defaultBenefitsBlock,
  type BenefitIconKey,
  type BenefitsBlock,
} from "@rem-viet/cms";

import { gsap, useGSAP, shouldUseStaticLanding } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

const benefitIconRegistry = {
  waves: Waves,
  ruler: Ruler,
  shield: ShieldCheck,
  home: Home,
} satisfies Record<BenefitIconKey, typeof Waves>;

const FULL_CLIP = "inset(0% 0% 0% 0%)";

function getDirectionalClip(event: PointerEvent, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;

  if (Math.abs(x) > Math.abs(y)) {
    return x > 0 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)";
  }

  return y > 0 ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)";
}

function BenefitCard({
  benefit,
  index,
  total,
  cardKicker,
  cursorLabel,
}: {
  benefit: BenefitsBlock["items"][number];
  index: number;
  total: number;
  cardKicker: string;
  cursorLabel: string;
}) {
  const cardRef = useRef<HTMLElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const card = cardRef.current;
      const media = card?.querySelector<HTMLElement>(".benefit-card-media");
      const image = card?.querySelector<HTMLImageElement>(
        ".benefit-card-media img",
      );
      if (!card || !media || !image) return;

      const isStatic =
        shouldUseStaticLanding() ||
        window.matchMedia("(hover: none), (pointer: coarse)").matches;

      if (isStatic) {
        card.classList.add("is-active", "is-static");
        gsap.set(media, { clipPath: FULL_CLIP });
        gsap.set(image, { scale: 1 });
        return () => card.classList.remove("is-active", "is-static");
      }

      if (!contextSafe) return;

      gsap.set(media, { clipPath: "inset(100% 0% 0% 0%)" });
      gsap.set(image, { scale: 1.1 });

      const reveal = contextSafe((clipPath: string) => {
        gsap.killTweensOf([media, image]);
        card.classList.add("is-active");

        gsap
          .timeline({ defaults: { overwrite: "auto" } })
          .fromTo(
            media,
            { clipPath },
            {
              clipPath: FULL_CLIP,
              duration: 0.9,
              ease: "cinematic",
            },
            0,
          )
          .fromTo(
            image,
            { scale: 1.14 },
            { scale: 1, duration: 1.2, ease: "cinematic" },
            0,
          );
      });

      const conceal = contextSafe((clipPath: string) => {
        gsap.killTweensOf([media, image]);

        gsap
          .timeline({
            defaults: { overwrite: "auto" },
            onComplete: () => card.classList.remove("is-active"),
          })
          .to(media, { clipPath, duration: 0.7, ease: "power3.inOut" }, 0)
          .to(image, { scale: 1.1, duration: 0.8, ease: "power3.inOut" }, 0);
      });

      const onPointerEnter = (event: PointerEvent) =>
        reveal(getDirectionalClip(event, card));
      const onPointerLeave = (event: PointerEvent) =>
        conceal(getDirectionalClip(event, card));
      const onFocus = () => reveal("inset(100% 0% 0% 0%)");
      const onBlur = () => conceal("inset(0% 0% 100% 0%)");

      card.addEventListener("pointerenter", onPointerEnter);
      card.addEventListener("pointerleave", onPointerLeave);
      card.addEventListener("focus", onFocus);
      card.addEventListener("blur", onBlur);

      return () => {
        card.removeEventListener("pointerenter", onPointerEnter);
        card.removeEventListener("pointerleave", onPointerLeave);
        card.removeEventListener("focus", onFocus);
        card.removeEventListener("blur", onBlur);
      };
    },
    { scope: cardRef },
  );

  const isWide = index === 0 || index === total - 1;
  const Icon = benefitIconRegistry[benefit.iconKey];
  const number = String(index + 1).padStart(2, "0");

  return (
    <article
      ref={cardRef}
      className={`benefit-card relative isolate min-h-[clamp(390px,43vw,620px)] overflow-hidden rounded-[clamp(18px,2vw,30px)] border border-hairline bg-[color:color-mix(in_srgb,var(--text-color)_4%,transparent)] outline-none max-[760px]:col-span-1 max-[760px]:min-h-[520px] max-[520px]:min-h-[440px] ${isWide ? "col-span-7" : "col-span-5"}`}
      tabIndex={0}
      data-cursor={cursorLabel}
      aria-label={`${number}. ${benefit.title}`}
    >
      <div className="benefit-card-media absolute inset-0 z-0 will-change-[clip-path]">
        <img
          className="h-full w-full object-cover will-change-transform"
          src={benefit.image.src}
          alt={benefit.image.alt}
          loading="lazy"
          decoding="async"
        />
        <span className="benefit-card-grade absolute inset-0" />
      </div>

      <span
        className="benefit-card-ghost pointer-events-none absolute top-1/2 right-[clamp(18px,3vw,46px)] z-1 -translate-y-1/2 font-playfair text-[clamp(110px,18vw,280px)] leading-none tracking-[-0.08em]"
        aria-hidden="true"
      >
        {number}
      </span>

      <div className="benefit-card-copy relative z-2 flex h-full min-h-[inherit] flex-col justify-between p-[clamp(26px,3vw,48px)]">
        <div className="flex items-start justify-between gap-8">
          <span className="benefit-card-index font-vietnam text-[11px] tracking-[0.2em] uppercase">
            {number} / {String(total).padStart(2, "0")}
          </span>
          <span
            className="benefit-card-icon grid h-12 w-12 place-items-center rounded-full border border-current/20"
            aria-hidden="true"
          >
            <Icon size={22} strokeWidth={1.35} />
          </span>
        </div>

        <div className="max-w-[520px]">
          <p className="benefit-card-kicker mb-4 font-vietnam text-[10px] tracking-[0.2em] uppercase">
            {cardKicker}
          </p>
          <h3 className="max-w-[11ch] font-playfair text-h2 font-normal leading-[1.03] tracking-[-0.02em]">
            {benefit.title}
          </h3>
          <p className="benefit-card-description mt-5 max-w-[46ch] font-vietnam text-body leading-[1.7]">
            {benefit.description}
          </p>
        </div>
      </div>
    </article>
  );
}

/**
 * A directional editorial grid inspired by the supplied
 * `grid-item-reveal-on-hover` AWWWARDS reference. Each benefit remains fully
 * readable without interaction; fine-pointer hover only adds an art-directed
 * image reveal from the edge where the pointer entered.
 */
export function Benefits({
  content = defaultBenefitsBlock,
  sectionId = "benefits",
}: {
  content?: BenefitsBlock;
  sectionId?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useSplitReveal<HTMLHeadingElement>({
    type: "words",
    stagger: 0.05,
    start: "top 85%",
  });

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const headerExtras = gsap.utils.toArray<HTMLElement>(
        section.querySelectorAll(".benefits-eyebrow, .benefits-intro"),
      );
      const cards = gsap.utils.toArray<HTMLElement>(
        section.querySelectorAll(".benefit-card"),
      );

      if (shouldUseStaticLanding()) {
        gsap.set([...headerExtras, ...cards], { autoAlpha: 1, y: 0 });
        return;
      }

      gsap.from(headerExtras, {
        autoAlpha: 0,
        y: 24,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector(".benefits-header"),
          start: "top 82%",
          once: true,
        },
      });

      gsap.from(cards, {
        autoAlpha: 0,
        y: 64,
        rotationX: 8,
        transformOrigin: "50% 100%",
        duration: 1.15,
        ease: "cinematic",
        stagger: 0.1,
        clearProps: "transform,opacity,visibility",
        scrollTrigger: {
          trigger: section.querySelector(".benefits-grid"),
          start: "top 84%",
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="benefits overflow-hidden py-section font-sans"
      id={sectionId}
      ref={sectionRef}
    >
      <div className="container">
        <div className="benefits-header mb-block grid grid-cols-12 items-end gap-x-[4vw] gap-y-8 max-[760px]:grid-cols-1">
          <div className="col-span-4 max-[760px]:col-span-1">
            <p className="benefits-eyebrow section-eyebrow text-brand">
              {content.eyebrow}
            </p>
            <p className="benefits-intro mt-6 max-w-[34ch] font-vietnam text-small leading-[1.7] text-muted-ink">
              {content.intro}
            </p>
          </div>
          <h2
            className="col-span-8 max-w-[12ch] font-playfair text-h1 font-normal leading-[0.98] tracking-[-0.025em] text-balance max-[760px]:col-span-1"
            ref={titleRef}
          >
            {content.title}
          </h2>
        </div>

        <div className="benefits-grid grid grid-cols-12 gap-[clamp(14px,1.5vw,24px)] max-[760px]:grid-cols-1">
          {content.items.map((benefit, index) => (
            <BenefitCard
              benefit={benefit}
              index={index}
              total={content.items.length}
              cardKicker={content.cardKicker}
              cursorLabel={content.cursorLabel}
              key={benefit.id}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
