import { Button } from "@rem-viet/ui/components/button";
import { Link } from "@tanstack/react-router";

import { TextGenerateEffect } from "./text-generate-effect";

const heroSectionConfig = {
  hello: "Chào mừng đến với",
  title: "Rèm Việt",
  description:
    "Mang đến sự bảo vệ toàn diện cho gia đình bạn khỏi những tác nhân như côn trùng, khói bụi, ...",
};

export default function HeroSection() {
  return (
    <div className="relative w-full max-w-full overflow-hidden">
      <div className="container mx-auto py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col items-center justify-center text-center lg:flex-row lg:text-left">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {heroSectionConfig.hello}
              <br />
              <span className="text-primary">{heroSectionConfig.title}</span>
            </h1>
            <div className="mt-3 sm:mx-auto sm:mt-5 sm:max-w-xl sm:text-lg md:mt-5 md:text-xl lg:mx-0">
              <TextGenerateEffect words={heroSectionConfig.description} />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center lg:justify-start">
              <Link to="/" hash="newsletter">
                <Button className="w-full sm:w-auto" size="lg">
                  Tư vấn ngay
                </Button>
              </Link>
              <Link to="/danh-sach-san-pham">
                <Button className="w-full sm:w-auto" size="lg" variant="outline">
                  Xem danh sách sản phẩm
                </Button>
              </Link>
            </div>
          </div>
          <div className="mt-10 lg:mt-0">
            <div className="size-[400px]">
              <img
                alt="hero"
                className="size-full object-contain"
                loading="eager"
                src="/HeroImage.webp"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
