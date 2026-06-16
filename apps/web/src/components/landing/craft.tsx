import { useRef } from "react";

import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { RevealImage } from "@/components/landing/reveal-image";

/**
 * (03) Chế tác — image reveal (left) + staggered copy reveal (right).
 *
 * GSAP replaces framer-motion `whileInView`. The eyebrow, title and
 * description animate up with a small stagger as the column enters view.
 */
export function Craft() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const textCol = section.querySelector<HTMLElement>(".craft-text");
      if (!textCol) return;

      if (prefersReducedMotion()) {
        gsap.set(textCol.children, { opacity: 1, y: 0 });
        return;
      }

      gsap.from(textCol.children, {
        opacity: 0,
        y: 24,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: textCol,
          start: "top 80%",
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="craft py-[var(--space-section)] font-sans max-[640px]:py-[12vh]"
      id="craft"
      ref={sectionRef}
    >
      <div className="container">
        <div className="grid-12 align-center">
          <div className="col-6">
            <RevealImage
              src="/assets/craft_mesh.png"
              alt="Cận cảnh thao tác may lưới chống muỗi"
              aspect="portrait"
              scaleFrom={1.2}
              scaleRest={1.08}
              parallax={18}
              direction="left"
            />
          </div>
          <div className="col-6 font-vietnam pl-[4vw] max-[1024px]:pl-0 max-[1024px]:pt-[5vh]">
            <p className="section-eyebrow mb-[18px] text-[11px] font-medium leading-[1.4] tracking-[0.18em] opacity-72 uppercase">
              (03) Chế tác
            </p>
            <h2 className="mb-[2vh] font-playfair text-h2 font-normal max-[1024px]:text-[8vw]">
              Tinh chỉnh từng mép lưới cho vừa khung cửa thật.
            </h2>
            <p className="text-[14px] leading-[1.6] text-[color:var(--text-muted)]">
              Mỗi bộ lưới được đo, cắt, may và kiểm tra thủ công để đường viền ôm
              sát bề mặt dán. Kết quả là một lớp bảo vệ gọn nhẹ, bền và không làm
              nặng hình khối kiến trúc.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
