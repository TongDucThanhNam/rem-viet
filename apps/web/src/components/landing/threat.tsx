import { useRef } from "react";

import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from "@/lib/gsap";

const STEPS = [
  {
    eyebrow: "Mối đe dọa",
    title: "Muỗi len vào từ những khe nhỏ nhất.",
    desc: "Một khe hở 3mm đã đủ cho côn trùng xâm nhập. Cửa sổ hở, cửa lưới lỗi, viền nới lỏng — đều là lối vào.",
    image: {
      src: "/assets/invisible_threat.png",
      position: "50% 50%",
      tone: "danger",
    },
  },
  {
    eyebrow: "Giải pháp",
    title: "Một lớp chắn gần như vô hình.",
    desc: "Lưới may đo từng khung, bám sát từng milimet — chắn côn trùng mà vẫn giữ ánh sáng và gió tự nhiên.",
    image: {
      src: "/assets/fiberglass-mesh.png",
      position: "58% 48%",
      tone: "solution",
    },
  },
  {
    eyebrow: "Kết quả",
    title: "Nhà thoáng, sạch và yên tĩnh.",
    desc: "Bảo vệ gia đình mỗi ngày mà không phải hy sinh cảm giác rộng mở của căn phòng bạn thương.",
    image: {
      src: "/assets/lifestyle_breeze.png",
      position: "58% 50%",
      tone: "result",
    },
  },
] as const;

/**
 * Threat — a PINNED narrative section.
 *
 * As the user scrolls, the full-viewport section pins and three statements
 * cross-fade one after another (eyebrow → title → desc per step). Each step
 * owns a different art-directed backdrop, so the scroll has a visual state
 * change instead of placing new text on a static image.
 *
 * Structure:
 *   <section.threat>            ← the pinned element
 *     <div.threat-backdrop>      ← backdrop stack (absolute)
 *     <div.threat-stage>        ← centered text stage
 *       <div.threat-step> × 3   ← absolutely stacked, cross-faded by scroll
 *
 * The pin lasts for +200% of the viewport height (≈ 2 screens of scroll to
 * play through the three steps), then releases.
 */
export function Threat() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;

      if (prefersReducedMotion()) {
        // Show only the first step statically; keep the others hidden so the
        // section still reads, without the scroll choreography.
        const steps = stage.querySelectorAll<HTMLElement>(".threat-step");
        steps.forEach((s, i) => gsap.set(s, { autoAlpha: i === 0 ? 1 : 0 }));
        section
          .querySelectorAll<HTMLElement>(".threat-backdrop-item")
          .forEach((layer, i) =>
            gsap.set(layer, { autoAlpha: i === 0 ? 1 : 0, scale: 1.04 }),
          );
        return;
      }

      const steps = stage.querySelectorAll<HTMLElement>(".threat-step");
      const backdrops =
        section.querySelectorAll<HTMLElement>(".threat-backdrop-item");
      const images =
        section.querySelectorAll<HTMLImageElement>(".threat-backdrop-img");
      if (steps.length === 0) return;

      // Initial state: step 0 visible (so the section reads correctly the
      // moment it pins, even before the user scrolls), the rest hidden.
      steps.forEach((step, i) =>
        gsap.set(step, { autoAlpha: i === 0 ? 1 : 0, y: 0 }),
      );
      // Step 0's inner children animate in over the first slice too.
      const firstInner = steps[0].querySelectorAll<HTMLElement>(".threat-step > *");
      gsap.set(firstInner, { y: 0, opacity: 1 });
      backdrops.forEach((layer, i) =>
        gsap.set(layer, {
          autoAlpha: i === 0 ? 1 : 0,
          scale: i === 0 ? 1.04 : 1.12,
        }),
      );

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=200%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      // A slow drift across all backdrop images gives depth even while each
      // state is holding. The fade/scale transitions below remain the main
      // narrative change.
      tl.to(images, { yPercent: -6, duration: 1, ease: "none" }, 0);

      // Choreography: each step occupies an equal slice of the pin. The
      // transition into step i fades step i-1 out (up) while step i fades in.
      const slice = 1 / steps.length;
      steps.forEach((step, i) => {
        const inner = step.querySelectorAll<HTMLElement>(".threat-step > *");
        const at = i * slice;
        if (i > 0) {
          // Fade the previous step out + this one in, centered on the slice.
          tl.to(
            backdrops[i - 1],
            {
              autoAlpha: 0,
              scale: 1.02,
              duration: slice * 0.48,
              ease: "power2.inOut",
            },
            at,
          )
            .fromTo(
              backdrops[i],
              { autoAlpha: 0, scale: 1.12 },
              {
                autoAlpha: 1,
                scale: 1.04,
                duration: slice * 0.52,
                ease: "power2.inOut",
              },
              at,
            )
            .to(
              steps[i - 1],
              {
                autoAlpha: 0,
                y: -30,
                duration: slice * 0.38,
                ease: "power2.inOut",
              },
              at,
            )
            .fromTo(
              step,
              { autoAlpha: 0, y: 30 },
              {
                autoAlpha: 1,
                y: 0,
                duration: slice * 0.44,
                ease: "power2.inOut",
              },
              at,
            )
            .fromTo(
              inner,
              { y: 24, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: slice * 0.36,
                stagger: 0.06,
                ease: "power2.out",
              },
              at + slice * 0.08,
            );
        }
        // i === 0 needs no entering tween — it's already visible at progress 0.
      });

      // Ensure a clean refresh after fonts/images settle the layout.
      const refresh = () => ScrollTrigger.refresh();
      const t = window.setTimeout(refresh, 300);
      return () => window.clearTimeout(t);
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="threat pinned relative flex h-dvh items-center justify-center overflow-hidden bg-black font-sans text-white"
      id="threat"
      ref={sectionRef}
    >
      <div className="threat-backdrop absolute inset-0 z-0" aria-hidden="true">
        {STEPS.map((step) => (
          <div
            className="threat-backdrop-item absolute inset-0 overflow-hidden will-change-[transform,opacity]"
            data-tone={step.image.tone}
            key={step.eyebrow}
          >
            <img
              className="threat-backdrop-img h-full w-full object-cover will-change-transform"
              src={step.image.src}
              alt=""
              decoding="async"
              loading={step.image.tone === "danger" ? "eager" : "lazy"}
              style={{ objectPosition: step.image.position }}
            />
            <span className="threat-backdrop-grade absolute inset-0" />
          </div>
        ))}
      </div>

      <div
        className="threat-stage relative z-2 w-[min(980px,88vw)] text-center"
        ref={stageRef}
      >
        {STEPS.map((step, i) => (
          <div
            className="threat-step absolute inset-0 flex flex-col items-center justify-center gap-5 will-change-[transform,opacity] first:relative"
            key={i}
          >
            <p className="font-vietnam text-[12px] tracking-[0.22em] text-[var(--accent-soft)] uppercase">
              ({String(i + 1).padStart(2, "0")}) {step.eyebrow}
            </p>
            <h2 className="max-w-[16ch] font-playfair text-h1 font-normal leading-[1.08] tracking-[-0.01em]">
              {step.title}
            </h2>
            <p className="max-w-[52ch] font-vietnam text-lead leading-[1.6] text-white/78">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
