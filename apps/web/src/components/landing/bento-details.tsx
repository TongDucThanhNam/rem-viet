import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  defaultBentoDetailsBlock,
  type BentoDetailsBlock,
} from "@rem-viet/cms";

import {
  gsap,
  ScrollTrigger,
  useGSAP,
  shouldUseStaticLanding,
} from "@/lib/gsap";
import { useSplitReveal } from "@/hooks/use-split-reveal";

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mql.matches);
    update();

    if (mql.addEventListener) {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }

    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  return coarse;
}

function formatNumber(n: number, decimals: number): string {
  if (decimals > 0) return n.toFixed(decimals);
  return Math.round(n).toString();
}

/**
 * Count-up that runs once when the number scrolls into view. GSAP animates a
 * proxy value and the formatted result is pushed into React state.
 */
function useCountUp(
  target: number,
  options: { duration?: number; decimals?: number; start?: number } = {},
) {
  const { duration = 1.5, decimals = 0, start = 0 } = options;
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(() => formatNumber(start, decimals));

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (shouldUseStaticLanding()) {
        setValue(formatNumber(target, decimals));
        return;
      }

      const obj = { v: start };
      const clampValue = gsap.utils.clamp(
        Math.min(start, target),
        Math.max(start, target),
      );

      gsap.to(obj, {
        v: target,
        duration,
        ease: "settle",
        // `settle` intentionally overshoots. Clamp the presented value so a
        // 99.9% product claim never flashes as 108% while the tween resolves.
        onUpdate: () => setValue(formatNumber(clampValue(obj.v), decimals)),
        onComplete: () => setValue(formatNumber(target, decimals)),
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
        },
      });
    },
    { dependencies: [target, duration, decimals, start], scope: ref },
  );

  return { ref, value };
}

function StatNumber({
  target,
  decimals = 0,
  suffix = "",
  fallback,
}: {
  target: number | null;
  decimals?: number;
  suffix?: string;
  fallback?: string;
}) {
  const finiteTarget = target !== null && Number.isFinite(target) ? target : 0;
  const finite = target !== null && Number.isFinite(target);
  const { ref, value } = useCountUp(finiteTarget, { decimals });

  return (
    <span ref={ref} className="stat-num font-playfair">
      {finite ? `${value}${suffix}` : (fallback ?? "")}
    </span>
  );
}

/** Parallax + hover-zoom background image for image-backed bento boxes. */
function BentoImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return;

      gsap.set(img, { scale: 1.05 });

      if (!shouldUseStaticLanding()) {
        // Parallax across the full pass through the viewport.
        gsap.fromTo(
          img,
          { y: 15 },
          {
            y: -15,
            ease: "none",
            scrollTrigger: {
              trigger: container,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      }

      // Hover zoom (only meaningful on fine pointers).
      const zoom = gsap.quickTo(img, "scale", {
        duration: 0.6,
        ease: "power3.out",
      });
      const onEnter = () => zoom(1.12);
      const onLeave = () => zoom(1.05);
      container.addEventListener("mouseenter", onEnter);
      container.addEventListener("mouseleave", onLeave);

      return () => {
        container.removeEventListener("mouseenter", onEnter);
        container.removeEventListener("mouseleave", onLeave);
      };
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="bento-bg">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="bento-bg-img"
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    </div>
  );
}

/** Bento tile with a 3D pointer tilt + hover lift + moving glare (fine pointers only). */
function BentoBox({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();
  const canTilt = !coarse;
  // quickTo setters, created once the element mounts.
  const tiltRef = useRef<{
    rotX: (v: number) => void;
    rotY: (v: number) => void;
    lift: (v: number) => void;
    glareX: (v: number) => void;
    glareY: (v: number) => void;
  } | null>(null);

  useGSAP(
    () => {
      const el = boxRef.current;
      if (!el) return;

      gsap.set(el, {
        transformStyle: "preserve-3d",
        transformPerspective: 1000,
      });

      if (!canTilt || shouldUseStaticLanding()) return;

      tiltRef.current = {
        rotX: gsap.quickTo(el, "rotationX", { duration: 0.4, ease: "power3" }),
        rotY: gsap.quickTo(el, "rotationY", { duration: 0.4, ease: "power3" }),
        lift: gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" }),
        // Glare position tracked as CSS vars (0–1) the ::before reads.
        glareX: gsap.quickTo(el, "--glare-x", {
          duration: 0.3,
          ease: "power3",
        }),
        glareY: gsap.quickTo(el, "--glare-y", {
          duration: 0.3,
          ease: "power3",
        }),
      };
      gsap.set(el, { "--glare-x": 0.5, "--glare-y": 0.5 });
    },
    { dependencies: [canTilt], revertOnUpdate: true, scope: boxRef },
  );

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!canTilt || !tiltRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = (event.clientX - rect.left) / rect.width - 0.5;
    const cy = (event.clientY - rect.top) / rect.height - 0.5;
    tiltRef.current.rotY(cx * 8);
    tiltRef.current.rotX(-cy * 8);
    // Glare follows the cursor in 0–1 space.
    tiltRef.current.glareX(cx + 0.5);
    tiltRef.current.glareY(cy + 0.5);
  };

  const handleMouseEnter = () => {
    if (canTilt && tiltRef.current) tiltRef.current.lift(-10);
  };

  const handleMouseLeave = () => {
    if (!canTilt || !tiltRef.current) return;
    tiltRef.current.rotX(0);
    tiltRef.current.rotY(0);
    tiltRef.current.lift(0);
    // Glare drifts back to center.
    tiltRef.current.glareX(0.5);
    tiltRef.current.glareY(0.5);
  };

  return (
    <div
      className={`bento-box ${className}`}
      ref={boxRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="bento-glare" aria-hidden="true" />
      {children}
    </div>
  );
}

export function BentoDetails({
  content = defaultBentoDetailsBlock,
}: {
  content?: BentoDetailsBlock;
}) {
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

      // Staggered entrance for the tiles (opacity + scale; tilt handles the
      // rest of the transform, so we avoid `y` here to not fight it).
      if (!shouldUseStaticLanding()) {
        ScrollTrigger.batch(
          section.querySelectorAll<HTMLElement>(".bento-box"),
          {
            start: "top 88%",
            once: true,
            onEnter: (batch) =>
              gsap.from(batch, {
                opacity: 0,
                scale: 0.94,
                duration: 0.9,
                ease: "power3.out",
                stagger: 0.08,
                overwrite: true,
              }),
          },
        );
      }
    },
    { scope: sectionRef },
  );

  return (
    <section
      className="bento-details py-[var(--space-section)] font-sans max-[640px]:py-[12vh]"
      id="details"
      ref={sectionRef}
    >
      <div className="container">
        <div className="mb-block max-w-[1040px]">
          <p className="section-eyebrow font-vietnam mb-[18px] text-[11px] font-medium leading-[1.4] tracking-[0.18em] opacity-72 uppercase">
            {content.eyebrow}
          </p>
          <h2
            className="mb-0 max-w-[16ch] text-left font-playfair text-h1 leading-[1.02] tracking-[-0.025em] text-balance"
            ref={titleRef}
          >
            {content.title}
          </h2>
        </div>

        <div className="bento-grid font-vietnam">
          <BentoBox className="bento-large">
            <BentoImage
              src={content.material.image.src}
              alt={content.material.image.alt}
            />
            <div className="bento-content">
              <h3>{content.material.title}</h3>
              <p>{content.material.description}</p>
            </div>
          </BentoBox>

          {content.stats.map((stat) => (
            <BentoBox className="bento-stat" key={stat.id}>
              <div className="stat-item">
                <StatNumber
                  target={stat.value}
                  decimals={stat.decimals}
                  suffix={stat.suffix}
                  fallback={stat.fallback}
                />
                <span className="stat-lbl">{stat.label}</span>
              </div>
            </BentoBox>
          ))}

          {content.features.map((feature) => (
            <BentoBox className="bento-small" key={feature.id}>
              <div className="bento-content">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </BentoBox>
          ))}

          <BentoBox className="bento-wide">
            <BentoImage
              src={content.standards.image.src}
              alt={content.standards.image.alt}
            />
            <div className="bento-content">
              <h3>{content.standards.title}</h3>
              <p>{content.standards.description}</p>
            </div>
          </BentoBox>
        </div>
      </div>
    </section>
  );
}
