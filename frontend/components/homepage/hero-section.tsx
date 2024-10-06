import React from "react";
import { Button, Link } from "@nextui-org/react";
import { heroSection } from "@/config/site";

export default function HeroSection() {
  return (
    // <div className="flex flex-col items-center">
    //   <div className="container px-4 md:px-6">
    //     <div className="flex flex-col items-center space-y-4 text-center">
    //       <div className="space-y-2">
    //         <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
    //           {heroSection.hello}
    //         </h1>
    //         <p className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none bg-gradient-to-r from-primary to-primary-foreground text-transparent bg-clip-text">
    //           {heroSection.title}
    //         </p>
    //       </div>
    //       <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
    //         {heroSection.description}
    //       </p>
    //       <div className="space-x-4">
    //         <Button as={Link} href="#footer" color="primary">
    //           Liên hệ tư vấn
    //         </Button>
    //         <Button as={Link} href="#productGrid" color="secondary">
    //           Xem danh mục sản phẩm
    //         </Button>
    //       </div>
    //     </div>
    //   </div>
    // </div>
    <div className="container px-4 md:px-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          {heroSection.hello}{" "}
          <span className="text-primary">{heroSection.title}</span>
        </h1>
        <p className="mx-auto max-w-[700px] text-base sm:text-lg md:text-xl text-muted-foreground">
          {heroSection.description}
        </p>
        <div className="space-x-4">
          <Button as={Link} href="#footer" color="primary">
            Tư vấn ngay
          </Button>
          <Button as={Link} href="#productGrid" color="secondary">
            Xem sản phẩm
          </Button>
        </div>
      </div>
    </div>
  );
}
