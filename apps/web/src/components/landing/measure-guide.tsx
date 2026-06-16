import { useRef, useState } from "react";

import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

/**
 * Image with a top-down clip reveal + scale settle on enter, plus a scrubbed
 * vertical parallax across its full pass through the viewport.
 */
function ParallaxImage({
  src,
  alt,
  speed = 0.2,
}: {
  src: string;
  alt: string;
  speed?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return;

      if (prefersReducedMotion()) {
        gsap.set(container, { clipPath: "inset(0% 0 0 0)" });
        gsap.set(img, { scale: 1 });
        return;
      }

      // Reveal: clip opens top→bottom while the image settles from 1.2→1.
      gsap.fromTo(
        container,
        { clipPath: "inset(100% 0 0 0)" },
        {
          clipPath: "inset(0% 0 0 0)",
          duration: 1.5,
          ease: "expo.out",
          scrollTrigger: { trigger: container, start: "top 85%", once: true },
        },
      );
      gsap.fromTo(
        img,
        { scale: 1.2 },
        {
          scale: 1,
          duration: 1.5,
          ease: "expo.out",
          scrollTrigger: { trigger: container, start: "top 85%", once: true },
        },
      );

      // Parallax y across the full pass.
      gsap.fromTo(
        img,
        { yPercent: 0 },
        {
          yPercent: speed * 100,
          ease: "none",
          scrollTrigger: {
            trigger: container,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="img-mask portrait-mask">
      <img ref={imgRef} src={src} alt={alt} className="parallax-img" />
    </div>
  );
}

const ACCORDION_ITEMS = [
  {
    title: "01. Đo chiều rộng",
    content:
      "Đo từ mép ngoài cùng bên trái sang mép ngoài cùng bên phải của khung cửa. Ghi số đo theo milimet để thợ may căn chính xác.",
  },
  {
    title: "02. Đo chiều cao",
    content:
      "Đo từ mép ngoài phía trên xuống mép ngoài phía dưới. Nên đo ở hai vị trí nếu khung cửa cũ hoặc không đều.",
  },
  {
    title: "03. Gửi hình khung cửa",
    content:
      "Gửi kèm ảnh tổng thể và ảnh cận mép khung để đội ngũ tư vấn chọn kiểu viền phù hợp trước khi sản xuất.",
  },
] as const;

export function MeasureGuide() {
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
      if (eyebrow) {
        gsap.from(eyebrow, {
          opacity: 0,
          y: 18,
          duration: 0.8,
          ease: "expo.out",
          scrollTrigger: { trigger: eyebrow, start: "top 85%", once: true },
        });
      }

      if (prefersReducedMotion()) return;

      // Slide-in reveal for the copy + accordion items (opacity + x + y).
      const revealItems =
        section.querySelectorAll<HTMLElement>(".reveal-item, .acc-item");
      gsap.from(revealItems, {
        opacity: 0,
        y: 24,
        x: -16,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector(".measure-content"),
          start: "top 80%",
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section className="measure py-[10vh] font-sans" id="measure" ref={sectionRef}>
      <div className="container">
        <div className="mb-[8vh] max-w-[980px]">
          <p className="section-eyebrow mb-[18px] font-vietnam text-[11px] font-medium leading-[1.4] tracking-[0.18em] opacity-72 uppercase">
            (06) Cách đo
          </p>
          <h2
            className="font-playfair text-center text-display leading-[0.85] tracking-[-0.02em]"
            style={{ marginBottom: "10vh" }}
            ref={titleRef}
          >
            Chuẩn xác từ số đo đầu tiên.
          </h2>
        </div>

        <div className="grid-12 measure-grid">
          <div className="col-6">
            <ParallaxImage
              src="/assets/measurement-guide.png"
              alt="Hướng dẫn đo kích thước khung cửa"
              speed={0.2}
            />
          </div>
          <div className="col-6 measure-content font-vietnam pt-[20vh] max-[1024px]:pt-[5vh]">
            <h3 className="reveal-item mb-5 text-[12px] tracking-[0.2em] uppercase">
              Hướng dẫn đo phủ bì
            </h3>
            <p className="reveal-item measure-desc mb-[60px] font-playfair text-h2 leading-[1.4]">
              Số đo đúng giúp lớp lưới ôm khít, không hở mép và giữ bề mặt phẳng
              đẹp sau khi dán lên khung.
            </p>

            <div className="accordion border-t border-[color:var(--hairline)]">
              {ACCORDION_ITEMS.map((item, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={item.title}
                    className={`acc-item border-b border-[color:var(--hairline)] ${isOpen ? "is-open" : ""}`}
                  >
                    <button
                      type="button"
                      className="acc-head hover-target flex w-full items-center justify-between border-0 bg-transparent py-[30px] text-left font-vietnam text-base font-medium text-[var(--text-color)] [font:inherit]"
                      aria-expanded={isOpen}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                    >
                      <span>{item.title}</span>
                      <span
                        className="acc-icon inline-grid h-7 w-7 place-items-center text-[var(--accent)] [transition:transform_0.35s_var(--ease-out-expo)]"
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>
                    <div className="acc-body grid grid-rows-[0fr] text-[color:var(--text-muted)] [transition:grid-template-rows_0.5s_var(--ease-out-expo)]">
                      <div className="overflow-hidden">
                        <p className="pb-[30px] text-sm leading-[1.6]">{item.content}</p>
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
