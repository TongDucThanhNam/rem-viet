import { useRef } from "react";
import {
  defaultCraftProcessBlock,
  type CraftProcessBlock,
} from "@rem-viet/cms";

import { gsap, useGSAP, shouldUseStaticLanding } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

/**
 * (03) Quy trình — adapted from the supplied `stacked-architectural-scroll`
 * reference. Desktop keeps one viewport-sized visual stack sticky while the
 * three task stages scroll beside it. Mobile and reduced-motion users receive
 * the same content as a normal interleaved story with no pinning or scrubbing.
 */
export function Craft({
  content = defaultCraftProcessBlock,
}: {
  content?: CraftProcessBlock;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useSplitReveal<HTMLHeadingElement>({
    type: "words",
    start: "top 82%",
  });

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || shouldUseStaticLanding()) return;

      const steps = gsap.utils.toArray<HTMLElement>(".process-step");
      const panels = gsap.utils.toArray<HTMLElement>(".process-panel");
      if (steps.length !== panels.length) return;

      gsap.set(panels, {
        zIndex: (index) => index + 1,
      });
      gsap.set(panels.slice(1), {
        clipPath: "inset(100% 0 0 0)",
      });

      steps.forEach((step, index) => {
        if (index === 0) return;

        gsap.to(panels[index], {
          clipPath: "inset(0% 0 0 0)",
          ease: "none",
          scrollTrigger: {
            trigger: step,
            start: "top 88%",
            end: "top 16%",
            scrub: 1,
          },
        });

        const previousImage = panels[index - 1]?.querySelector("img");
        if (previousImage) {
          gsap.to(previousImage, {
            scale: 1.08,
            ease: "none",
            scrollTrigger: {
              trigger: step,
              start: "top 88%",
              end: "top 16%",
              scrub: 1,
            },
          });
        }
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="craft-process bg-canvas font-sans text-ink"
      id="craft"
      ref={sectionRef}
    >
      <div className="container process-intro grid min-h-[72dvh] grid-cols-[0.72fr_1.28fr] items-end gap-[8vw] py-section max-[900px]:grid-cols-1 max-[900px]:gap-8 max-[640px]:min-h-0">
        <p className="section-eyebrow self-start text-brand">
          {content.eyebrow}
        </p>
        <div>
          <h2
            className="max-w-[13ch] font-playfair text-h1 font-normal leading-[0.98] tracking-[-0.02em]"
            ref={titleRef}
          >
            {content.title}
          </h2>
          <p className="mt-8 max-w-[58ch] font-vietnam text-body leading-[1.75] text-muted-ink">
            {content.intro}
          </p>
        </div>
      </div>

      <div className="container process-grid grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-[8vw] max-[768px]:block">
        <div className="process-copy">
          {content.steps.map((step, index) => {
            const number = String(index + 1).padStart(2, "0");
            return (
              <article
                className="process-step flex min-h-dvh flex-col justify-center border-t border-hairline py-[12vh] max-[768px]:min-h-0 max-[768px]:py-[12vh]"
                key={step.id}
              >
                <div className="mb-12 flex items-baseline justify-between gap-6 font-vietnam text-eyebrow tracking-[0.18em] uppercase">
                  <span className="text-brand">{number}</span>
                  <span className="text-faint-ink">{step.eyebrow}</span>
                </div>
                <h3 className="max-w-[12ch] font-playfair text-h2 font-normal leading-[1.08] tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-6 max-w-[46ch] font-vietnam text-body leading-[1.75] text-muted-ink">
                  {step.description}
                </p>
                <div className="process-mobile-media mt-10 hidden aspect-[4/5] overflow-hidden rounded-2xl max-[768px]:block">
                  <img
                    className="h-full w-full object-cover"
                    src={step.image.src}
                    alt={step.image.alt}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
            );
          })}
        </div>

        <div
          className="process-media sticky top-0 h-dvh self-start py-[8vh] max-[768px]:hidden"
          aria-hidden="true"
        >
          <div className="relative h-full overflow-hidden rounded-2xl bg-black">
            {content.steps.map((step, index) => {
              const number = String(index + 1).padStart(2, "0");
              return (
                <figure
                  className="process-panel absolute inset-0 overflow-hidden"
                  key={step.id}
                >
                  <img
                    className="h-full w-full object-cover will-change-transform"
                    src={step.image.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 z-2 flex items-end justify-between gap-6 bg-gradient-to-t from-black/70 to-transparent p-8 pt-24 font-vietnam text-white">
                    <span className="text-[11px] tracking-[0.18em] text-white/70 uppercase">
                      {number} / {String(content.steps.length).padStart(2, "0")}
                    </span>
                    <span className="text-[12px] tracking-[0.16em] uppercase">
                      {step.eyebrow}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
