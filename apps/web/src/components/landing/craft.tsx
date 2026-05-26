import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

function RevealImage({
  src,
  alt,
  aspect = "portrait",
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

export function Craft() {
  return (
    <section className="craft font-sans" id="craft">
      <div className="container">
        <div className="grid-12 align-center">
          <div className="col-6">
            <RevealImage
              src="/assets/craft_mesh.png"
              alt="Craftsmanship"
              aspect="portrait"
            />
          </div>
          <div className="col-6 craft-text font-vietnam">
            <h2 className="craft-title font-playfair text-3xl md:text-5xl font-medium tracking-tight">Nghệ Nhân Chế Tác</h2>
            <p className="craft-desc text-[#555] mt-4 leading-relaxed">
              Mỗi mét vuông lưới đều là sự kết tinh của công nghệ hiện đại và bàn
              tay khéo léo của các nghệ nhân lành nghề, đảm bảo độ bền bỉ vượt
              thời gian.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
