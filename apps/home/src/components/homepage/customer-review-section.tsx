
import React from "react";

import { InfiniteMovingCards } from "@/components/animation/infinite-moving-cards";

export default function CustomerReviewSection() {
  return (
    <div className="min-h-[20rem] md:h-[40rem] rounded-md flex flex-col antialiased items-center justify-center relative overflow-hidden px-4 py-8 md:py-0">
      <h2 className="text-2xl md:text-4xl font-bold text-center mb-4 md:mb-8">
        Khách hàng nói gì về chúng tôi ?
      </h2>
      <InfiniteMovingCards
        direction="right"
        items={testimonials}
        speed="slow"
        className={"w-full md:w-[80%] h-[20rem] md:h-[40rem]"}
      />
    </div>
  );
}

const testimonials = [
  {
    quote:
      "Sử dụng sản phẩm của Rèm Việt, tôi rất hài lòng với chất lượng và dịch vụ của họ.",
    name: "Lê Phương Hoàn Mỹ",
    title: "Rất tốt",
  },
  {
    quote: "Sản phẩm chất lượng, giá cả phải chăng, dịch vụ tốt..",
    name: "Mai Tai Sơn",
    title: "Tuyệt vời",
  },
  {
    quote: "I'm very satisfied with the san-pham and service of Rèm Việt.",
    name: "Giang Văn Cốt",
    title: "Very good",
  },
  {
    quote: "I'm very satisfied with the san-pham and service of Rèm Việt.",
    name: "Jon Slow",
    title: "Incredible",
  },
];
