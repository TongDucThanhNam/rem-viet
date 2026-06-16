import { useEffect, useRef, useState } from "react";

import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

const FAQ_ITEMS = [
  {
    question: "Kích thước có bao gồm phần viền không?",
    answer:
      "Có. Kích thước sản xuất là kích thước phủ bì, đã tính cả phần viền dán. Bạn chỉ cần đo mép ngoài cùng của khung cửa.",
  },
  {
    question: "Nên đo bên trong hay bên ngoài khung?",
    answer:
      "Hãy đo cạnh ngoài của khung để lưới che phủ toàn bộ mép cửa. Nếu khung có gờ hoặc tay nắm đặc biệt, gửi thêm ảnh để được tư vấn.",
  },
  {
    question: "Lưới có làm tối nhà không?",
    answer:
      "Không. Mắt lưới mảnh nên vẫn giữ ánh sáng tự nhiên và tầm nhìn thoáng khi nhìn từ khoảng cách sinh hoạt thông thường.",
  },
  {
    question: "Có nhận may kích thước cửa lớn không?",
    answer:
      "Có. Đội ngũ có thể tư vấn phương án chia tấm hoặc may khổ lớn tùy cấu trúc cửa để hạn chế nhăn, võng và hở mép.",
  },
] as const;

/**
 * (07) Câu hỏi thường gặp.
 *
 * The accordion open/close is CSS-driven (`.faq-body` measured-height +
 * `transition: height`), so FaqItem keeps its height-measurement logic. GSAP
 * only handles the entrance: eyebrow + SplitText title + a staggered fade-up
 * for each FAQ row.
 */
function FaqItem({
  question,
  answer,
  isActive,
  onToggle,
}: {
  question: string;
  answer: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState(0);

  useEffect(() => {
    if (bodyRef.current) setInnerH(bodyRef.current.scrollHeight);
  }, [answer, isActive]);

  return (
    <div className={`faq-item border-t border-[color:color-mix(in_srgb,var(--text-color)_12%,transparent)] ${isActive ? "active" : ""}`}>
      <button
        type="button"
        className="faq-head hover-target flex w-full items-center justify-between gap-6 border-0 bg-transparent py-7 text-left text-lg font-medium leading-[1.35] text-[var(--text-color)] [font:inherit] max-[640px]:py-6 max-[640px]:text-base"
        aria-expanded={isActive}
        onClick={onToggle}
      >
        <span>{question}</span>
        <span
          className="faq-icon inline-grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[var(--accent)] [border-color:color-mix(in_srgb,var(--text-color)_16%,transparent)] [transition:transform_0.35s_var(--ease-out-expo)]"
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div
        className="overflow-hidden [transition:height_0.45s_var(--ease-out-expo)]"
        style={{ height: isActive ? innerH : 0 }}
      >
        <div
          className="pt-0 pr-[56px] pb-[30px] pl-0 max-[640px]:pr-0"
          ref={bodyRef}
        >
          <p className="max-w-[680px] text-[15px] leading-[1.7] text-[color:color-mix(in_srgb,var(--text-color)_66%,transparent)]">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
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

      const eyebrow = section.querySelector<HTMLElement>(".section-eyebrow");
      const items = section.querySelectorAll<HTMLElement>(".faq-item");

      if (prefersReducedMotion()) return;

      if (eyebrow) {
        gsap.from(eyebrow, {
          opacity: 0,
          y: 18,
          duration: 0.8,
          ease: "expo.out",
          scrollTrigger: { trigger: eyebrow, start: "top 85%", once: true },
        });
      }

      gsap.from(items, {
        opacity: 0,
        y: 28,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector(".faq-accordion"),
          start: "top 80%",
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="pt-[16vh] pb-[20vh] font-sans max-[640px]:py-[12vh]"
      id="faq"
      ref={sectionRef}
    >
      <div className="container">
        <div className="mb-[8vh] max-w-[920px]">
          <p className="section-eyebrow mb-[18px] font-vietnam text-[11px] font-medium leading-[1.4] tracking-[0.18em] opacity-72 uppercase">
            (07) Câu hỏi thường gặp
          </p>
          <h2
            className="massive-text font-playfair text-center text-display leading-[0.85] tracking-[-0.02em]"
            ref={titleRef}
          >
            Trước khi đặt may.
          </h2>
        </div>
        <div className="ml-auto max-w-[920px] font-vietnam max-[640px]:ml-0">
          {FAQ_ITEMS.map((item, index) => (
            <FaqItem
              key={item.question}
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
