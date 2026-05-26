import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

function RevealImage({
  src,
  alt,
  aspect = "wide",
}: {
  src: string;
  alt: string;
  aspect?: "wide" | "portrait" | "landscape";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.4, 1],
    ["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  );

  const scale = useTransform(scrollYProgress, [0, 0.4, 1], [1.3, 1, 1.1]);
  const y = useTransform(scrollYProgress, [0, 0.4, 1], ["0%", "8%", "20%"]);

  return (
    <div
      ref={containerRef}
      className="reveal-container"
      data-aspect={aspect}
      style={{ overflow: "hidden", width: "100%" }}
    >
      <motion.div
        className="reveal-mask"
        style={{ clipPath, width: "100%", overflow: "hidden" }}
      >
        <motion.img
          src={src}
          alt={alt}
          className="reveal-img"
          style={{
            scale,
            y,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </motion.div>
    </div>
  );
}

export function Threat() {
  return (
    <section className="threat dark-theme font-sans" id="threat">
      <div className="container">
        <div className="threat-content text-center">
          <h2 className="threat-title font-playfair">Mối Đe Dọa Vô Hình</h2>
          <p className="threat-desc font-vietnam text-[#999]">
            Không gian sống an bình của bạn đang bị đe dọa bởi những tác nhân nhỏ
            bé nhưng nguy hiểm.
          </p>
        </div>
        <RevealImage
          src="/assets/invisible_threat.png"
          alt="Invisible Threat"
          aspect="wide"
        />
      </div>
    </section>
  );
}
