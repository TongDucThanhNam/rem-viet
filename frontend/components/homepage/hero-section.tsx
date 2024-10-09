import React from "react";
import { Button, Link } from "@nextui-org/react";
import { heroSection } from "@/config/site";

export default function HeroSection() {
  return (
    <div className="container px-4 md:px-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          {heroSection.hello} <br />
          <span className="text-primary">{heroSection.title}</span>
        </h1>
        <p className="mx-auto max-w-[700px] text-base sm:text-lg md:text-xl text-muted-foreground">
          {heroSection.description}
        </p>
        <div className="space-x-4">
          <Button as={Link} href="#footer" color="primary">
            Tư vấn ngay
          </Button>
          <Button as={Link} href="/danh-sach-san-pham" color="secondary">
            Xem sản phẩm
          </Button>
        </div>
      </div>
    </div>
  );
}
