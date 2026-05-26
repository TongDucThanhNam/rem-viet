import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function HorizontalGallery() {
  const targetRef = useRef<HTMLDivElement>(null);

  // Track scroll Progress of the entire horizontal-scroll section
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"]
  });

  // Transform scroll progress (0 to 1) into horizontal displacement (-220vw)
  const x = useTransform(scrollYProgress, [0, 1], ["0vw", "-220vw"]);

  return (
    <section ref={targetRef} className="horizontal-scroll font-sans" id="lifestyle">
      <div className="sticky-wrapper">
        <h2 className="gallery-title font-playfair font-medium leading-none">
          Không Gian
          <br />
          Tuyệt Đỉnh
        </h2>
        <motion.div
          className="gallery-track js-horizontal-track"
          style={{ x }}
        >
          <div className="gallery-item">
            <img src="/assets/gallery_1.png" alt="Gallery 1" />
          </div>
          <div className="gallery-item">
            <img src="/assets/gallery_2.png" alt="Gallery 2" />
          </div>
          <div className="gallery-item">
            <img src="/assets/gallery_3.png" alt="Gallery 3" />
          </div>
          <div className="gallery-item">
            <img src="/assets/lifestyle_breeze.png" alt="Gallery 4" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
