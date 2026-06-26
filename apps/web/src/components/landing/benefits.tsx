import { useRef } from "react";
import { Home, Ruler, ShieldCheck, Waves } from "lucide-react";

import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

const BENEFITS = [
  {
    title: "Sợi thủy tinh cao cấp",
    desc: "Sợi thủy tinh bọc PVC chuyên dụng, bền bỉ khi uốn gập và giữ form tốt trong điều kiện khí hậu nóng ẩm.",
    icon: Waves,
  },
  {
    title: "May đo vừa khít",
    desc: "Từng bộ lưới được cắt may theo kích thước thực tế của khung, hạn chế hở mép và giữ tổng thể gọn gàng.",
    icon: Ruler,
  },
  {
    title: "Bảo vệ vô hình",
    desc: "Mắt lưới mảnh giúp chống muỗi, giảm côn trùng bay vào nhà mà vẫn giữ tầm nhìn và ánh sáng tự nhiên.",
    icon: ShieldCheck,
  },
  {
    title: "Lắp đặt tận nơi",
    desc: "Đội ngũ kỹ thuật đo, tư vấn, lắp và nghiệm thu tại nhà để sản phẩm sẵn sàng sử dụng ngay.",
    icon: Home,
  },
] as const;

/**
 * Lợi ích cốt lõi — header + 4-card grid.
 *
 * GSAP replaces framer-motion `useInView` + variants:
 *  - Header (eyebrow/subtitle) fades up when it enters.
 *  - The title uses SplitText (masked word reveal).
 *  - Cards use `ScrollTrigger.batch` so any cards entering around the same
 *    time animate together with a stagger (rather than each triggering alone).
 */
export function Benefits() {
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

      if (prefersReducedMotion()) {
        gsap.set(section.querySelectorAll(".benefits-eyebrow, .benefits-subtitle, .benefit-card"), {
          opacity: 1,
          y: 0,
        });
        return;
      }

      const headerExtras = section.querySelectorAll<HTMLElement>(
        ".benefits-eyebrow, .benefits-subtitle",
      );
      gsap.from(headerExtras, {
        opacity: 0,
        y: 24,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector(".benefits-header"),
          start: "top 80%",
          once: true,
        },
      });

      ScrollTrigger.batch(section.querySelectorAll<HTMLElement>(".benefit-card"), {
        start: "top 85%",
        once: true,
        onEnter: (batch) =>
          gsap.from(batch, {
            opacity: 0,
            y: 28,
            duration: 0.9,
            ease: "expo.out",
            stagger: 0.1,
            overwrite: true,
          }),
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="benefits py-[var(--space-section)] font-sans max-[640px]:py-[12vh]"
      id="benefits"
      ref={sectionRef}
    >
      <div className="container">
        <div className="mx-auto mb-[10vh] max-w-[720px] text-center font-vietnam">
          <p className="mb-[2vh] text-[11px] tracking-[0.25em] uppercase opacity-70">
            Lợi ích cốt lõi
          </p>
          <h2
            className="mb-[2.5vh] font-playfair text-h1 font-normal leading-[1.05] max-[1024px]:text-[8vw] max-[640px]:text-[42px]"
            ref={titleRef}
          >
            Giữ nhà thoáng, sạch và yên tĩnh.
          </h2>
          <p className="mx-auto max-w-[560px] text-base leading-[1.6] opacity-70">
            Bốn cam kết làm nên trải nghiệm của Rèm Vina, từ vật liệu, độ vừa
            khít đến dịch vụ lắp đặt trọn gói.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-[4vw] font-vietnam max-[1024px]:grid-cols-2 max-[1024px]:gap-[6vw] max-[600px]:grid-cols-1 max-[600px]:gap-[8vw]">
          {BENEFITS.map(({ title, desc, icon: Icon }) => (
            <article
              key={title}
              className="benefit-card hover-target relative flex flex-col gap-4 pt-6 opacity-85 border-t-2 [border-top-color:color-mix(in_srgb,currentColor_28%,transparent)] [transition:opacity_0.4s_var(--ease-out-expo)]"
            >
              <span
                className="benefit-card-icon block h-8 w-8 shrink-0 text-current [transition:transform_0.4s_var(--ease-out-expo)]"
                aria-hidden="true"
              >
                <Icon size={28} strokeWidth={1.35} className="h-full w-full" />
              </span>
              <h3 className="font-playfair text-2xl font-normal leading-[1.25]">
                {title}
              </h3>
              <p className="m-0 text-sm leading-[1.6] opacity-70">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
