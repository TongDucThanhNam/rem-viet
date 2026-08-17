import { useEffect, useRef, useState } from "react";
import { ArrowDownRight } from "lucide-react";
import {
  defaultFaqBlock,
  type FaqBlockData,
} from "@agency/cms-template-rem-viet";

import { gsap, useGSAP, shouldUseStaticLanding } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

function FaqItem({
  index,
  question,
  answer,
  isActive,
  onToggle,
}: {
  index: number;
  question: string;
  answer: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState(0);
  const bodyId = `faq-answer-${index + 1}`;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const measure = () => setInnerH(body.scrollHeight);
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(body);
    return () => resizeObserver.disconnect();
  }, [answer]);

  return (
    <article
      className={`faq-item relative border-t border-hairline ${isActive ? "active" : ""}`}
    >
      <button
        type="button"
        className="faq-head hover-target group grid w-full grid-cols-[3rem_1fr_auto] items-center gap-[clamp(14px,2vw,30px)] border-0 bg-transparent py-[clamp(26px,4vh,42px)] text-left text-[var(--text-color)] [font:inherit] max-[560px]:grid-cols-[2rem_1fr_auto]"
        aria-controls={bodyId}
        aria-expanded={isActive}
        onClick={onToggle}
      >
        <span className="faq-index font-playfair text-base text-faint-ink [transition:color_0.4s_var(--ease-out-expo)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="faq-question max-w-[28ch] font-vietnam text-[clamp(17px,1.55vw,22px)] font-medium leading-[1.35] [transition:transform_0.4s_var(--ease-out-expo)]">
          {question}
        </span>
        <span
          className="faq-icon inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline-strong text-[var(--accent)] [transition:transform_0.4s_var(--ease-out-expo),background-color_0.4s_var(--ease-out-expo)] max-[560px]:h-8 max-[560px]:w-8"
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div
        className="faq-body overflow-hidden [transition:height_0.55s_var(--ease-out-expo)]"
        id={bodyId}
        style={{ height: isActive ? innerH : 0 }}
      >
        <div
          className="pr-[5vw] pb-[clamp(28px,5vh,52px)] pl-[calc(3rem+clamp(14px,2vw,30px))] max-[560px]:pr-0 max-[560px]:pl-[calc(2rem+14px)]"
          ref={bodyRef}
        >
          <p className="max-w-[640px] font-vietnam text-[15px] leading-[1.75] text-muted-ink">
            {answer}
          </p>
        </div>
      </div>
    </article>
  );
}

export function Faq({
  content = defaultFaqBlock.data,
}: {
  content?: FaqBlockData;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
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

      const extras = gsap.utils.toArray<HTMLElement>(
        section.querySelectorAll(".faq-eyebrow, .faq-intro, .faq-cta"),
      );
      const items = gsap.utils.toArray<HTMLElement>(
        section.querySelectorAll(".faq-item"),
      );

      if (shouldUseStaticLanding()) {
        gsap.set([...extras, ...items], { autoAlpha: 1, x: 0, y: 0 });
        return;
      }

      gsap.from(extras, {
        autoAlpha: 0,
        y: 22,
        duration: 0.85,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector(".faq-aside"),
          start: "top 82%",
          once: true,
        },
      });

      gsap.from(items, {
        autoAlpha: 0,
        x: 46,
        duration: 0.9,
        ease: "cinematic",
        stagger: 0.09,
        scrollTrigger: {
          trigger: section.querySelector(".faq-accordion"),
          start: "top 82%",
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="faq-section relative overflow-hidden py-section font-sans"
      id="faq"
      ref={sectionRef}
    >
      <span
        className="faq-backdrop-label pointer-events-none absolute -top-[0.18em] -left-[0.04em] font-playfair text-[clamp(180px,32vw,520px)] leading-none tracking-[-0.08em] text-transparent"
        aria-hidden="true"
        style={{
          WebkitTextStroke:
            "1px color-mix(in srgb, var(--text-color) 8%, transparent)",
        }}
      >
        {content.backdropLabel}
      </span>

      <div className="container relative z-1 grid grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)] items-start gap-[clamp(64px,10vw,170px)] max-[900px]:grid-cols-1">
        <aside className="faq-aside sticky top-[18vh] max-[900px]:static">
          <p className="faq-eyebrow section-eyebrow text-brand">
            {content.eyebrow}
          </p>
          <h2
            className="mt-6 max-w-[8ch] font-playfair text-h1 font-normal leading-[0.98] tracking-[-0.025em] text-balance"
            ref={titleRef}
          >
            {content.title}
          </h2>
          <p className="faq-intro mt-7 max-w-[36ch] font-vietnam text-small leading-[1.75] text-muted-ink">
            {content.intro}
          </p>
          <a
            className="faq-cta hover-target mt-10 inline-flex items-center gap-4 border-b border-hairline-strong pb-3 font-vietnam text-[11px] tracking-[0.16em] text-[var(--text-color)] uppercase no-underline"
            href={content.cta.href}
            data-cursor={content.cta.cursorLabel}
          >
            <span className="faq-cta-label">{content.cta.label}</span>
            <ArrowDownRight size={16} strokeWidth={1.4} aria-hidden="true" />
          </a>
        </aside>

        <div className="faq-accordion font-vietnam">
          {content.items.map((item, index) => (
            <FaqItem
              key={item.id}
              index={index}
              question={item.question}
              answer={item.answer}
              isActive={activeIndex === index}
              onToggle={() =>
                setActiveIndex(activeIndex === index ? null : index)
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
