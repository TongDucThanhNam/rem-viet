import { useRef } from "react";
import {
  defaultThreatNarrativeBlock,
  type ThreatNarrativeBlock,
} from "@rem-viet/cms";

import {
  gsap,
  ScrollTrigger,
  useGSAP,
  shouldUseStaticLanding,
} from "@/lib/gsap";

/**
 * Threat — a pinned three-act narrative on desktop, and a static story on
 * small screens or when reduced motion is requested.
 */
export function Threat({
  content = defaultThreatNarrativeBlock,
}: {
  content?: ThreatNarrativeBlock;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage || shouldUseStaticLanding()) return;

      const media = gsap.matchMedia();

      media.add("(min-width: 769px)", () => {
        const steps = gsap.utils.toArray<HTMLElement>(
          stage.querySelectorAll(".threat-step"),
        );
        const backdrops = gsap.utils.toArray<HTMLElement>(
          section.querySelectorAll(".threat-backdrop-item"),
        );
        const images = gsap.utils.toArray<HTMLImageElement>(
          section.querySelectorAll(".threat-backdrop-img"),
        );
        const progressItems = gsap.utils.toArray<HTMLElement>(
          section.querySelectorAll(".threat-progress-item"),
        );
        const progressFills = gsap.utils.toArray<HTMLElement>(
          section.querySelectorAll(".threat-progress-fill"),
        );

        if (!steps.length || steps.length !== backdrops.length) return;

        gsap.set(steps, { autoAlpha: 0, y: 34 });
        gsap.set(steps[0], { autoAlpha: 1, y: 0 });
        gsap.set(backdrops, { autoAlpha: 0, scale: 1.1 });
        gsap.set(backdrops[0], { autoAlpha: 1, scale: 1.04 });
        gsap.set(progressItems, { opacity: 0.34 });
        gsap.set(progressItems[0], { opacity: 1 });
        gsap.set(progressFills, { scaleX: 0, transformOrigin: "left center" });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=200%",
            pin: true,
            scrub: 1,
            anticipatePin: 1,
          },
        });

        timeline.to(images, { yPercent: -5, duration: 1, ease: "none" }, 0);

        const slice = 1 / steps.length;

        steps.forEach((step, index) => {
          const at = index * slice;
          const inner = gsap.utils.toArray<HTMLElement>(
            step.querySelectorAll(".threat-step-copy > *"),
          );

          timeline.to(
            progressFills[index],
            { scaleX: 1, duration: slice * 0.88, ease: "none" },
            at,
          );

          if (index === 0) return;

          timeline
            .to(
              backdrops[index - 1],
              {
                autoAlpha: 0,
                scale: 1.01,
                duration: slice * 0.42,
                ease: "power2.inOut",
              },
              at,
            )
            .fromTo(
              backdrops[index],
              { autoAlpha: 0, scale: 1.1 },
              {
                autoAlpha: 1,
                scale: 1.04,
                duration: slice * 0.5,
                ease: "power2.inOut",
              },
              at,
            )
            .to(
              steps[index - 1],
              {
                autoAlpha: 0,
                y: -34,
                duration: slice * 0.32,
                ease: "power2.in",
              },
              at,
            )
            .fromTo(
              step,
              { autoAlpha: 0, y: 34 },
              {
                autoAlpha: 1,
                y: 0,
                duration: slice * 0.42,
                ease: "cinematic",
              },
              at + slice * 0.06,
            )
            .fromTo(
              inner,
              { y: 22, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: slice * 0.32,
                stagger: 0.04,
                ease: "power2.out",
              },
              at + slice * 0.1,
            )
            .to(
              progressItems[index - 1],
              { opacity: 0.34, duration: slice * 0.2 },
              at,
            )
            .to(
              progressItems[index],
              { opacity: 1, duration: slice * 0.2 },
              at,
            );
        });

        const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 300);
        return () => window.clearTimeout(refresh);
      });

      return () => media.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="threat pinned relative overflow-hidden bg-black font-sans text-white"
      id="threat"
      ref={sectionRef}
    >
      <div className="threat-motion relative h-dvh overflow-hidden">
        <div
          className="threat-backdrop absolute inset-0 z-0"
          aria-hidden="true"
        >
          {content.steps.map((step) => (
            <div
              className="threat-backdrop-item absolute inset-0 overflow-hidden will-change-[transform,opacity]"
              data-tone={step.image.tone}
              key={step.id}
            >
              <img
                className="threat-backdrop-img h-[112%] w-full object-cover will-change-transform"
                src={step.image.src}
                alt=""
                decoding="async"
                loading="lazy"
                fetchPriority="low"
                style={{ objectPosition: step.image.position }}
              />
              <span className="threat-backdrop-grade absolute inset-0" />
            </div>
          ))}
        </div>

        <div
          className="threat-stage absolute inset-y-0 left-[4vw] z-2 w-[min(760px,66vw)]"
          ref={stageRef}
        >
          {content.steps.map((step, index) => (
            <article
              className="threat-step absolute inset-0 flex items-end pb-[clamp(88px,13vh,168px)] will-change-[transform,opacity]"
              key={step.id}
            >
              <div className="threat-step-copy flex max-w-[720px] flex-col items-start gap-5 text-left">
                <p className="font-vietnam text-label tracking-[0.22em] text-brand-soft uppercase">
                  ({String(index + 1).padStart(2, "0")}) {step.eyebrow}
                </p>
                <h2 className="max-w-[14ch] font-playfair text-h1 leading-[1.02] font-normal tracking-[-0.025em] text-balance">
                  {step.title}
                </h2>
                <p className="max-w-[48ch] font-vietnam text-lead leading-[1.55] text-white/72">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <ol
          className="threat-progress absolute top-1/2 right-[4vw] z-3 w-[clamp(150px,15vw,220px)] -translate-y-1/2"
          aria-hidden="true"
        >
          {content.steps.map((step, index) => (
            <li
              className="threat-progress-item relative grid grid-cols-[2rem_1fr] items-center gap-2 py-4 font-vietnam text-[11px] tracking-[0.16em] uppercase will-change-[opacity]"
              key={step.id}
            >
              <span className="font-playfair text-[15px] tracking-normal text-brand-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{step.eyebrow}</span>
              <span className="threat-progress-track absolute inset-x-0 bottom-0 h-px bg-white/18">
                <span className="threat-progress-fill block h-full w-full origin-left scale-x-0 bg-brand" />
              </span>
            </li>
          ))}
        </ol>

        <p className="absolute right-[4vw] bottom-8 z-3 font-vietnam text-[10px] tracking-[0.2em] text-white/44 uppercase">
          {content.scrollLabel}
        </p>
      </div>

      <div className="threat-static">
        {content.steps.map((step, index) => (
          <article
            className="threat-static-card relative min-h-[76dvh] overflow-hidden"
            data-tone={step.image.tone}
            key={step.id}
          >
            <img
              className="threat-static-img absolute inset-0 h-full w-full object-cover"
              src={step.image.src}
              alt={step.image.alt}
              decoding="async"
              loading="lazy"
              fetchPriority="low"
              style={{ objectPosition: step.image.mobilePosition }}
            />
            <span
              className="threat-static-grade absolute inset-0"
              aria-hidden="true"
            />
            <div className="absolute inset-x-[6vw] bottom-[clamp(40px,8vh,72px)] z-2 flex flex-col items-start gap-4 text-left">
              <p className="font-vietnam text-label tracking-[0.2em] text-brand-soft uppercase">
                ({String(index + 1).padStart(2, "0")}) {step.eyebrow}
              </p>
              <h2 className="max-w-[15ch] font-playfair text-h2 leading-[1.05] font-normal tracking-[-0.02em] text-balance">
                {step.title}
              </h2>
              <p className="max-w-[42ch] font-vietnam text-body leading-[1.55] text-white/76">
                {step.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
