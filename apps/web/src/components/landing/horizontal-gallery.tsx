import { useEffect, useRef, useState } from "react";

import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

const GALLERY_ITEMS = [
  {
    src: "/assets/gallery_1.png",
    title: "Phòng khách mở sáng",
    meta: "Cửa sổ lớn",
  },
  {
    src: "/assets/gallery_2.png",
    title: "Góc nghỉ yên tĩnh",
    meta: "Lưới gần như vô hình",
  },
  {
    src: "/assets/gallery_3.png",
    title: "Không gian bếp sạch",
    meta: "Hạn chế côn trùng",
  },
  {
    src: "/assets/lifestyle_breeze.png",
    title: "Đón gió tự nhiên",
    meta: "Không che tầm nhìn",
  },
] as const;

/** Total slides — also drives the counter denominator + initial text. */
const TOTAL = GALLERY_ITEMS.length;

/**
 * Client-only reduced-motion flag. Initialised to `false` so SSR and the first
 * client render agree (no hydration mismatch), then flipped to the real value
 * in an effect. Mirrors the `useCoarsePointer` pattern in bento-details.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();

    if (mql.addEventListener) {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  return reduced;
}

/**
 * (05) lifestyle — pinned horizontal-scroll gallery.
 *
 * ScrollTrigger pins the full-viewport section and drives the horizontal `x`
 * of the track over the measured overflow distance. The first and last slides
 * are padded to the viewport center, so the gallery enters/exits in a balanced
 * editorial frame instead of starting with a slide pushed off-center.
 *
 * AWWWARDS layers, all GSAP (full-motion path only):
 *  - **Velocity skew**: the track leans into the scroll direction on fast
 *    scroll then settles to flat. `ease: "none"` stays on the horizontal tween
 *    so the `containerAnimation` reveals stay 1:1 with position.
 *  - **Editorial chrome**: a slide counter (`01 / 04`) + accent progress line
 *    driven by horizontal progress (written imperatively each frame — no React
 *    re-render churn during scrub).
 *  - **Per-slide choreography**: meta + title reveal staggered (meta enters
 *    slightly earlier than title) from a different clip-path edge per slide so
 *    the gallery never repeats the same reveal; the image does a scale
 *    keyframe that dips through center for depth.
 *  - **Header parallax**: the eyebrow + title drift back and recede as the
 *    gallery plays, a depth layer above the slides.
 *
 * Reduced motion: the pin is replaced by a clean vertical stack (React-driven
 * class swap, NOT runtime inline-style mangling) so every slide is reachable
 * and nothing fights the Tailwind classes. useGSAP returns early — no
 * autonomous motion.
 */
export function HorizontalGallery() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const titleRef = useSplitReveal<HTMLHeadingElement>({
    type: "lines",
    stagger: 0.12,
    start: "top 85%",
  });

  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;

      // Reduced motion: no autonomous motion at all. Layout is handled by the
      // React class swap below; nothing to do here.
      if (reduced || prefersReducedMotion()) return;

      // 1. Velocity skew setter, created first so the onUpdate closure below
      //    always sees a bound setter. Layered on the same element as the
      //    scrubbed `x` — GSAP composes transform components independently,
      //    so the horizontal position is never clobbered by the skew.
      const skewTo = gsap.quickTo(track, "skewX", {
        duration: 0.5,
        ease: "power3.out",
      });

      // 2. The horizontal drift — `ease: "none"` is mandatory here so the
      //    containerAnimation-based reveals stay locked 1:1 to position.
      const getScrollDistance = () =>
        Math.max(1, track.scrollWidth - window.innerWidth);
      const getScrollEnd = () => `+=${getScrollDistance()}`;

      const horizontalTween = gsap.to(track, {
        x: () => -getScrollDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: getScrollEnd,
          pin: true,
          anticipatePin: 1,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // Velocity skew: clamp ±3°, lean in the travel direction on fast
            // scroll then settle back to flat.
            skewTo(gsap.utils.clamp(-3, 3, self.getVelocity() / 320));
            // Counter — maps progress to the active slide index.
            const idx = Math.min(TOTAL, Math.floor(self.progress * TOTAL) + 1);
            const counter = counterRef.current;
            if (counter) counter.textContent = String(idx).padStart(2, "0");
            // Progress line — direct style write (cheap, no tween per frame).
            const progress = progressRef.current;
            if (progress) progress.style.transform = `scaleX(${self.progress})`;
          },
        },
      });

      // 3. Header parallax — drifts back and recedes as the gallery plays, a
      //    depth layer above the slides. Subtle so the title stays legible.
      const header = headerRef.current;
      if (header) {
        gsap.fromTo(
          header,
          { x: 0, opacity: 1 },
          {
            x: -30,
            opacity: 0.55,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: getScrollEnd,
              scrub: 0.5,
              invalidateOnRefresh: true,
            },
          },
        );
      }

      // 4. Per-slide caption reveal, tied to the horizontal movement. Each
      //    slide reveals from a DIFFERENT direction (clip-path) so the gallery
      //    never repeats the same reveal. Meta enters slightly earlier than
      //    the title for a staggered feel within the scrub.
      const captionDirs = [
        "inset(0 0 0 100%)", // left → right
        "inset(0 100% 0 0)", // right → left
        "inset(0 0 100% 0)", // top → bottom
        "inset(0 0 0 100%)", // left → right
      ];
      const metas = track.querySelectorAll<HTMLElement>(".gallery-caption-meta");
      const titles = track.querySelectorAll<HTMLElement>(".gallery-caption-title");

      metas.forEach((meta, i) => {
        gsap.fromTo(
          meta,
          { clipPath: captionDirs[i % captionDirs.length], opacity: 0, y: 16 },
          {
            clipPath: "inset(0 0 0 0)",
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              containerAnimation: horizontalTween,
              trigger: meta.closest(".gallery-item") as HTMLElement,
              start: "left 82%",
              end: "left 50%",
              scrub: true,
            },
          },
        );
      });
      titles.forEach((title, i) => {
        gsap.fromTo(
          title,
          { clipPath: captionDirs[i % captionDirs.length], opacity: 0, y: 24 },
          {
            clipPath: "inset(0 0 0 0)",
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              containerAnimation: horizontalTween,
              trigger: title.closest(".gallery-item") as HTMLElement,
              start: "left 72%",
              end: "left 42%",
              scrub: true,
            },
          },
        );
      });

      // 5. Image scale keyframe as each slide crosses the viewport — the scale
      //    dips through 1.0 mid-pass for a "settle" feel (mirrors RevealImage).
      const imgs = track.querySelectorAll<HTMLElement>(".gallery-item img");
      imgs.forEach((img) => {
        gsap.fromTo(
          img,
          { scale: 1.12 },
          {
            keyframes: { scale: [1.12, 1, 1.05] },
            ease: "none",
            scrollTrigger: {
              containerAnimation: horizontalTween,
              trigger: img.closest(".gallery-item") as HTMLElement,
              start: "left 90%",
              end: "right 10%",
              scrub: true,
            },
          },
        );
      });

      // Ensure a clean refresh once images/fonts settle the layout.
      const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 300);
      return () => window.clearTimeout(refreshId);
    },
    { dependencies: [reduced], revertOnUpdate: true, scope: sectionRef },
  );

  // ---- Reduced-motion layout: a clean vertical stack ----------------------
  // Class swap (not inline styles) so nothing fights Tailwind and SSR/hydration
  // stay consistent (the pinned layout renders first, then this flips).
  if (reduced) {
    return (
      <section
        ref={sectionRef}
        className="font-sans py-section"
        id="lifestyle"
      >
        <div className="container">
          <div className="mb-block">
            <p className="section-eyebrow font-vietnam mb-[14px] text-[11px] font-medium leading-[1.4] tracking-[0.18em] opacity-72 uppercase">
              (05) Lối sống
            </p>
            <h2
              className="font-playfair text-[clamp(40px,8vw,120px)] leading-[0.95] max-[640px]:text-[14vw]"
              ref={titleRef}
            >
              Không Gian
              <br />
              Tuyệt Đỉnh
            </h2>
          </div>
          <div className="flex flex-col gap-block">
            {GALLERY_ITEMS.map((item, i) => (
              <figure
                key={item.src}
                className="gallery-item relative mx-auto aspect-[3/2] w-full max-w-[1100px] overflow-hidden rounded-lg"
              >
                <img
                  className="h-full w-full object-cover"
                  src={item.src}
                  alt={item.title}
                />
                <figcaption className="absolute bottom-[22px] left-6 right-6 z-2 text-white font-vietnam">
                  <span className="block text-[11px] leading-[1.3] tracking-[0.14em] text-white/68 uppercase">
                    ({String(i + 1).padStart(2, "0")}) · {item.meta}
                  </span>
                  <strong className="mt-2 block font-playfair text-[30px] font-normal leading-[1.1]">
                    {item.title}
                  </strong>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ---- Full-motion layout: pinned horizontal scroll -----------------------
  return (
    <section
      ref={sectionRef}
      className="relative h-dvh overflow-hidden font-sans"
      id="lifestyle"
    >
      <div className="relative flex h-full items-center overflow-hidden">
        <div
          ref={headerRef}
          className="absolute top-[12vh] left-[4vw] z-10 max-[640px]:top-[9vh]"
        >
          <p className="section-eyebrow font-vietnam mb-[14px] text-[11px] font-medium leading-[1.4] tracking-[0.18em] opacity-72 uppercase">
            (05) Lối sống
          </p>
          <h2
            className="font-playfair text-[clamp(40px,8vw,120px)] leading-[0.95] max-[640px]:text-[14vw]"
            ref={titleRef}
          >
            Không Gian
            <br />
            Tuyệt Đỉnh
          </h2>
        </div>

        <div
          ref={trackRef}
          className="gallery-track js-horizontal-track flex h-[60vh] gap-[4vw] px-[20vw] will-change-transform max-[1024px]:px-[7.5vw]"
        >
          {GALLERY_ITEMS.map((item, i) => (
            <figure
              className="gallery-item hover-target relative h-full w-[60vw] flex-shrink-0 overflow-hidden rounded-lg max-[1024px]:w-[85vw]"
              data-cursor="Xem"
              key={item.src}
            >
              <img
                className="h-full w-full rounded-lg object-cover will-change-transform"
                src={item.src}
                alt={item.title}
              />
              <figcaption className="gallery-caption absolute bottom-[22px] left-6 right-6 z-2 text-white will-change-[clip-path,opacity] max-[640px]:bottom-[18px] max-[640px]:left-[18px] max-[640px]:right-[18px] font-vietnam">
                <span className="gallery-caption-meta block text-[11px] leading-[1.3] tracking-[0.14em] text-white/68 uppercase">
                  ({String(i + 1).padStart(2, "0")}) · {item.meta}
                </span>
                <strong className="gallery-caption-title mt-2 block font-playfair text-[30px] font-normal leading-[1.1]">
                  {item.title}
                </strong>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Editorial chrome: slide counter + accent progress line, driven by
            the horizontal scrub. */}
        <div className="absolute bottom-[6vh] left-[4vw] z-10 flex items-center gap-[18px] max-[640px]:bottom-[4vh] max-[640px]:gap-[14px]">
          <span className="font-vietnam text-[12px] tracking-[0.18em] text-[color:var(--text-muted)] uppercase">
            <span ref={counterRef}>01</span> / {String(TOTAL).padStart(2, "0")}
          </span>
          <div className="relative h-px w-[14rem] max-w-[40vw] bg-[color:var(--hairline)]">
            <div
              ref={progressRef}
              className="absolute inset-0 origin-left bg-[var(--accent)]"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
