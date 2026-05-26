import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";

function ParallaxImage({ src, alt, speed = 0.2 }: { src: string; alt: string; speed?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", `${speed * 100}%`]);

  return (
    <motion.div
      ref={containerRef}
      className="img-mask portrait-mask"
      initial={{ clipPath: "inset(100% 0 0 0)" }}
      whileInView={{ clipPath: "inset(0% 0 0 0)" }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] as const }}
    >
      <motion.img
        src={src}
        alt={alt}
        className="parallax-img"
        style={{ y, scale: 1.2 }}
        initial={{ scale: 1.2 }}
        whileInView={{ scale: 1.0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] as const }}
      />
    </motion.div>
  );
}

export function MeasureGuide() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const accordionItems = [
    {
      title: "01. Chiều rộng (Ngay)",
      content:
        "Đo từ mép ngoài cùng bên trái sang mép ngoài cùng bên phải của khung cửa. Khuyên dùng thước cuộn để đảm bảo độ chính xác (mm).",
    },
    {
      title: "02. Chiều cao (Dọc)",
      content:
        "Đo từ mép ngoài cùng phía trên xuống mép ngoài cùng phía dưới. Ghi chép cẩn thận số liệu.",
    },
    {
      title: "03. Xác nhận & Đặt may",
      content:
        "Gửi cặp số đo Rộng x Cao cho đội ngũ nghệ nhân của chúng tôi để tiến hành chế tác riêng cho bạn.",
    },
  ];

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="measure font-sans" id="measure">
      <div className="container">
        <div className="measure-header">
          <h2 className="massive-text font-playfair font-medium">CHUẨN XÁC</h2>
        </div>
        <div className="grid-12">
          <div className="col-6">
            <ParallaxImage
              src="/assets/measurement-guide.png"
              alt="Measure Guide"
              speed={0.2}
            />
          </div>
          <div className="col-6 measure-content font-vietnam">
            <h3 className="text-sm font-semibold tracking-widest text-[#111] uppercase mb-4">
              (03) Hướng Dẫn Đo Phủ Bì
            </h3>
            <p className="measure-desc font-playfair text-xl md:text-2xl font-light leading-relaxed text-[#111] mb-12">
              Để có một sản phẩm hoàn mỹ, số đo là yếu tố tiên quyết. Hãy làm
              theo 3 bước chuẩn xác sau.
            </p>

            <div className="accordion">
              {accordionItems.map((item, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={index}
                    className={`acc-item ${isOpen ? "is-open" : ""}`}
                  >
                    <div
                      className="acc-head hover-target flex justify-between items-center py-6 cursor-pointer"
                      onClick={() => handleToggle(index)}
                    >
                      <span className="font-medium text-lg text-[#111]">
                        {item.title}
                      </span>
                      <span className="acc-icon text-xl text-[#111]">
                        {isOpen ? "-" : "+"}
                      </span>
                    </div>
                    <div className="acc-body">
                      <div className="acc-body-inner">
                        <p className="text-[#666] leading-relaxed pb-6 text-sm">
                          {item.content}
                        </p>
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
