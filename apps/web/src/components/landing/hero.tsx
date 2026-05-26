import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useMagnetic } from "../../hooks/use-magnetic";

function ParallaxImage({
  src,
  alt,
  speed = 0.15,
  className,
}: {
  src: string;
  alt: string;
  speed?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", `${speed * 100}%`]);

  return (
    <div ref={containerRef} className="img-mask h-full w-full overflow-hidden">
      <motion.img
        src={src}
        alt={alt}
        className={className}
        style={{ y, scale: 1.2 }}
      />
    </div>
  );
}

export function Hero({ isLoaded }: { isLoaded: boolean }) {
  const { ref: btnRef, x: btnX, y: btnY } = useMagnetic();

  const titleWordVariants = {
    hidden: { y: "100%" },
    visible: (custom: number) => ({
      y: "0%",
      transition: {
        duration: 1.2,
        ease: [0.19, 1, 0.22, 1] as const,
        delay: custom * 0.1 + 0.2, // Loader complete offset
      },
    }),
  };

  const descVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        ease: [0.19, 1, 0.22, 1] as const,
        delay: 0.8,
      },
    },
  };

  const maskVariants = {
    hidden: { clipPath: "inset(100% 0 0 0)" },
    visible: {
      clipPath: "inset(0% 0 0 0)",
      transition: {
        duration: 1.5,
        ease: [0.76, 0, 0.24, 1] as const,
        delay: 0.6,
      },
    },
  };

  return (
    <section className="hero font-sans" id="vision">
      <div className="hero-grid">
        <div className="hero-text-wrapper">
          <div className="hero-eyebrow font-vietnam">
            <span>(01)</span>
            <span>Lưới chống muỗi may đo</span>
          </div>
          <h1 className="hero-heading font-playfair">
            <div className="line">
              <motion.span
                className="word"
                variants={titleWordVariants}
                initial="hidden"
                animate={isLoaded ? "visible" : "hidden"}
                custom={0}
              >
                Thoáng
              </motion.span>
            </div>
            <div className="line">
              <motion.span
                className="word italic"
                variants={titleWordVariants}
                initial="hidden"
                animate={isLoaded ? "visible" : "hidden"}
                custom={1}
              >
                Đẳng cấp.
              </motion.span>
            </div>
          </h1>
          <motion.div
            className="hero-desc font-vietnam"
            variants={descVariants}
            initial="hidden"
            animate={isLoaded ? "visible" : "hidden"}
          >
            <p>
              Giải pháp lưới chống muỗi may đo cao cấp. Tinh tế đến từng milimet,
              bảo vệ không gian sống mà không đánh đổi tính thẩm mỹ của kiến trúc hiện đại.
            </p>
            <motion.a
              ref={btnRef as any}
              href="#order"
              className="btn-explore hover-target"
              data-cursor="Khám phá"
              style={{ x: btnX, y: btnY }}
            >
              <svg viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="24" />
              </svg>
              <span>Khám phá</span>
            </motion.a>
          </motion.div>
        </div>
        <div className="hero-visual">
          <motion.div
            className="h-full w-full"
            variants={maskVariants}
            initial="hidden"
            animate={isLoaded ? "visible" : "hidden"}
            style={{ overflow: "hidden" }}
          >
            <ParallaxImage
              src="/assets/window-mosquito-net-hero.png"
              alt="Hero Image"
              className="parallax-img"
              speed={0.15}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
