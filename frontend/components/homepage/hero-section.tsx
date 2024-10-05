import React from "react";
import {Button, Link, Spacer} from "@nextui-org/react";
import { heroSection } from "@/config/site";

export default function HeroSection() {
  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-8">
        {/* Preload phần heading */}
        <h1 className="text-3xl md:text-6xl font-bold mb-4">
          {heroSection.hello}
        </h1>

        {/* Preload nội dung tĩnh */}
        <p className=" font-bold mb-4 text-5xl md:text-7xl bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{heroSection.title}</p>

        {/* Spacer không nên gây ra thay đổi layout */}
        <Spacer y={2} />

        {/* Phần nội dung dynamic được lazy load */}
        <div className="relative min-h-[6rem] md:min-h-[8rem]">
          <span
            className="absolute top-0 left-0 right-0 text-xl md:text-2xl max-w-2xl mx-auto"
            aria-live="polite"
          >
            Mang đến sự bảo vệ cho gia đình bạn khỏi những tác nhân như côn
            trùng, khói bụi, ...
          </span>
        </div>
      </div>

      {/* Button layout tối ưu với kích thước được xác định trước */}
      <div className="w-screen flex flex-row justify-center items-center space-x-4">
        <Button as={Link} href="#footer" color="primary">
          Liên hệ tư vấn
        </Button>
        <Button as={Link} href="#productGrid" color="secondary">
          Xem danh mục sản phẩm
        </Button>
      </div>
    </div>
  );
}