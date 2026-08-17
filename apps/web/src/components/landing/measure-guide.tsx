import { useRef, useState } from "react";
import {
  defaultMeasurementGuideBlock,
  type MeasurementGuideBlock,
} from "@rem-viet/cms";

import { gsap, useGSAP, shouldUseStaticLanding } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

/**
 * A calm adaptation of the supplied parallax-mask references: the outer mask
 * opens once, the inner photograph moves on a smaller opposing scroll range,
 * and the active measurement overlay is animated independently.
 */
function MeasureVisual({
  activeIndex,
  content,
}: {
  activeIndex: number | null;
  content: MeasurementGuideBlock;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return;

      if (shouldUseStaticLanding()) {
        gsap.set(container, { clipPath: "inset(0% 0% 0% 0%)" });
        gsap.set(img, { scale: 1.04, yPercent: 0 });
        return;
      }

      const reveal = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top 84%",
          once: true,
        },
      });

      reveal
        .fromTo(
          container,
          { clipPath: "inset(100% 0% 0% 0%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.45,
            ease: "cinematic",
          },
          0,
        )
        .fromTo(
          img,
          { scale: 1.16 },
          { scale: 1.06, duration: 1.65, ease: "cinematic" },
          0,
        );

      gsap.fromTo(
        img,
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: "none",
          scrollTrigger: {
            trigger: container,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        },
      );
    },
    { scope: containerRef },
  );

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;

      const overlays = gsap.utils.toArray<HTMLElement>(
        container.querySelectorAll(".measure-overlay"),
      );
      gsap.set(overlays, { autoAlpha: 0 });

      if (activeIndex === null) return;
      const active = overlays[activeIndex];
      if (!active) return;

      const horizontalLines = gsap.utils.toArray<HTMLElement>(
        active.querySelectorAll(".measure-line-x"),
      );
      const verticalLines = gsap.utils.toArray<HTMLElement>(
        active.querySelectorAll(".measure-line-y"),
      );
      const labels = gsap.utils.toArray<HTMLElement>(
        active.querySelectorAll(".measure-overlay-label"),
      );
      const corners = gsap.utils.toArray<HTMLElement>(
        active.querySelectorAll(".measure-focus-corner"),
      );

      if (shouldUseStaticLanding()) {
        gsap.set(active, { autoAlpha: 1 });
        if (horizontalLines.length) gsap.set(horizontalLines, { scaleX: 1 });
        if (verticalLines.length) gsap.set(verticalLines, { scaleY: 1 });
        const overlayDetails = [...labels, ...corners];
        if (overlayDetails.length) {
          gsap.set(overlayDetails, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
          });
        }
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: "cinematic", overwrite: "auto" },
      });

      timeline.fromTo(
        active,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.25 },
        0,
      );

      if (horizontalLines.length) {
        timeline.fromTo(
          horizontalLines,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.75, stagger: 0.08 },
          0.04,
        );
      }

      if (verticalLines.length) {
        timeline.fromTo(
          verticalLines,
          { scaleY: 0 },
          { scaleY: 1, duration: 0.75, stagger: 0.08 },
          0.04,
        );
      }

      if (corners.length) {
        timeline.fromTo(
          corners,
          { autoAlpha: 0, scale: 0.65 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.05,
          },
          0.1,
        );
      }

      if (labels.length) {
        timeline.fromTo(
          labels,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08 },
          0.22,
        );
      }
    },
    {
      dependencies: [activeIndex],
      revertOnUpdate: true,
      scope: containerRef,
    },
  );

  const activeItem = activeIndex === null ? null : content.steps[activeIndex];

  return (
    <figure
      ref={containerRef}
      className="measure-media-shell relative h-[min(76dvh,820px)] min-h-[620px] overflow-hidden rounded-[clamp(18px,2vw,30px)] bg-black max-[900px]:h-[72dvh] max-[900px]:min-h-[520px] max-[560px]:h-[66dvh] max-[560px]:min-h-[460px]"
    >
      <img
        ref={imgRef}
        className="absolute inset-0 h-[108%] w-full object-cover will-change-transform"
        src={content.image.src}
        alt={content.image.alt}
        loading="lazy"
        decoding="async"
      />
      <span
        className="measure-media-grade absolute inset-0"
        aria-hidden="true"
      />

      <div className="measure-overlay measure-overlay-width" aria-hidden="true">
        <span className="measure-dimension-x">
          <span className="measure-line measure-line-x" />
          <span className="measure-overlay-label">
            {content.steps[0].overlayLabel}
          </span>
        </span>
      </div>

      <div
        className="measure-overlay measure-overlay-height"
        aria-hidden="true"
      >
        <span className="measure-dimension-y">
          <span className="measure-line measure-line-y" />
          <span className="measure-overlay-label">
            {content.steps[1].overlayLabel}
          </span>
        </span>
      </div>

      <div className="measure-overlay measure-overlay-photo" aria-hidden="true">
        <span className="measure-focus-corner measure-focus-corner-tl" />
        <span className="measure-focus-corner measure-focus-corner-tr" />
        <span className="measure-focus-corner measure-focus-corner-bl" />
        <span className="measure-focus-corner measure-focus-corner-br" />
        <span className="measure-overlay-label measure-photo-label">
          {content.steps[2].overlayLabel}
        </span>
      </div>

      <figcaption className="absolute inset-x-0 bottom-0 z-4 flex items-end justify-between gap-6 p-[clamp(22px,3vw,38px)] font-vietnam text-white">
        <span className="measure-figure-eyebrow text-[10px] tracking-[0.2em] text-white/58 uppercase">
          {content.figureEyebrow}
        </span>
        <span className="max-w-[22ch] text-right text-[11px] tracking-[0.14em] uppercase">
          {activeItem
            ? `${String(activeIndex! + 1).padStart(2, "0")} / ${String(content.steps.length).padStart(2, "0")} — ${activeItem.shortLabel}`
            : content.idleLabel}
        </span>
      </figcaption>
    </figure>
  );
}

export function MeasureGuide({
  content = defaultMeasurementGuideBlock,
}: {
  content?: MeasurementGuideBlock;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useSplitReveal<HTMLHeadingElement>({
    type: "words",
    stagger: 0.04,
    start: "top 85%",
  });

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const eyebrow = section.querySelector<HTMLElement>(".section-eyebrow");
      const intro = section.querySelector<HTMLElement>(".measure-intro");
      const items = gsap.utils.toArray<HTMLElement>(
        section.querySelectorAll(".acc-item"),
      );

      if (shouldUseStaticLanding()) {
        const visibleTargets = [eyebrow, intro, ...items].filter(
          (target): target is HTMLElement => Boolean(target),
        );
        gsap.set(visibleTargets, { autoAlpha: 1, x: 0, y: 0 });
        return;
      }

      gsap.from([eyebrow, intro], {
        autoAlpha: 0,
        y: 20,
        duration: 0.85,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector(".measure-heading"),
          start: "top 84%",
          once: true,
        },
      });

      gsap.from(items, {
        autoAlpha: 0,
        x: 30,
        duration: 0.85,
        ease: "cinematic",
        stagger: 0.09,
        scrollTrigger: {
          trigger: section.querySelector(".accordion"),
          start: "top 82%",
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="measure py-section font-sans"
      id="measure"
      ref={sectionRef}
    >
      <div className="container">
        <div className="measure-heading mb-block grid grid-cols-12 items-end gap-x-[4vw] gap-y-7 max-[800px]:grid-cols-1">
          <div className="col-span-4 max-[800px]:col-span-1">
            <p className="section-eyebrow text-brand">{content.eyebrow}</p>
            <p className="measure-intro mt-6 max-w-[34ch] font-vietnam text-small leading-[1.7] text-muted-ink">
              {content.intro}
            </p>
          </div>
          <h2
            className="col-span-8 max-w-[12ch] font-playfair text-h1 font-normal leading-[1.01] tracking-[-0.025em] text-balance max-[800px]:col-span-1"
            ref={titleRef}
          >
            {content.title}
          </h2>
        </div>

        <div className="measure-grid grid grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] items-start gap-[clamp(56px,8vw,140px)] max-[900px]:grid-cols-1">
          <div className="sticky top-[12vh] max-[900px]:static">
            <MeasureVisual activeIndex={openIndex} content={content} />
          </div>

          <div className="measure-content pt-[8vh] font-vietnam max-[900px]:pt-0">
            <p className="measure-step-label mb-5 text-[10px] tracking-[0.2em] text-brand uppercase">
              {content.contentEyebrow}
            </p>
            <h3 className="mb-6 max-w-[18ch] font-playfair text-h3 font-normal leading-[1.12] tracking-[-0.01em]">
              {content.contentTitle}
            </h3>
            <p className="mb-[clamp(42px,7vh,72px)] max-w-[48ch] text-body leading-[1.75] text-muted-ink">
              {content.contentDescription}
            </p>

            <div className="accordion border-t border-hairline">
              {content.steps.map((item, index) => {
                const isOpen = openIndex === index;
                const bodyId = `measure-step-${index + 1}`;

                return (
                  <div
                    key={item.id}
                    className={`acc-item border-b border-hairline ${isOpen ? "is-open" : ""}`}
                  >
                    <button
                      type="button"
                      className="acc-head hover-target group grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-4 border-0 bg-transparent py-[30px] text-left text-[var(--text-color)] [font:inherit]"
                      aria-controls={bodyId}
                      aria-expanded={isOpen}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                    >
                      <span className="font-playfair text-lg text-brand">
                        {item.code}
                      </span>
                      <span className="text-[15px] font-medium leading-[1.4]">
                        {item.title.replace(/^\d+\.\s*/, "")}
                      </span>
                      <span
                        className="acc-icon inline-grid h-8 w-8 place-items-center rounded-full border border-hairline-strong text-[var(--accent)] [transition:transform_0.35s_var(--ease-out-expo)]"
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>
                    <div
                      className="acc-body grid grid-rows-[0fr] text-muted-ink [transition:grid-template-rows_0.55s_var(--ease-out-expo)]"
                      id={bodyId}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-[30px] pl-[calc(2.75rem+1rem)] text-sm leading-[1.7]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
