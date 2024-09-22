"use client"; // This is a comment

import React, { lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { cn } from "@nextui-org/react";
import Footer from "@/components/footer/footer";
import Mosquito from "@/components/motion/mosquito";
import HeroSection from "@/components/homepage/hero-section";
import FeatureSection from "@/components/homepage/feature-section";
import OurStrength from "@/components/homepage/our-strength";
import { FabButton } from "@/components/button/fab-button";
import { features, heroSection } from "@/config/site";
import NextImage from "next/image";
import videoThumb from "@/public/src/videoThump.webp";

const ResponsiveVideoLazy = lazy(() => import("@/components/video/video"));

const ProductGrid = dynamic(
  () => import("@/components/product-grid/product-grid"),
  {
    ssr: false,
  },
);

export default function Home() {
  return (
    <div className={"flex flex-col h-screen w-screen"}>
      <MyNavbar />

      <div
        className={cn(
          "flex-grow w-screen ",
          "overflow-y-scroll md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth", // Note: This might require additional setup for cross-browser support
          // "relative flex flex-col",
        )}
      >
        {/*Hero Section*/}
        <section
          id={"hero"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start"
        >
          <HeroSection />
        </section>

        {/*Video Section*/}
        <section
          id={"video"}
          className="w-screen h-full flex flex-col justify-center items-center md:snap-start"
        >
          <div className="mb-4">
            {" "}
            {/* Margin-bottom để đẩy video xuống một chút */}
            <h1 className="text-center text-4xl md:text-6xl font-bold mb-4 ">
              Lưới chống muỗi
              <br />
              <span className="text-2xl md:text-4xl font-normal">
                Sản xuất tại Việt Nam
              </span>
            </h1>
          </div>

          <Suspense
            fallback={
              <div className="relative w-full h-96 flex justify-center items-center">
                {" "}
                {/* Đảm bảo fallback video cũng được căn giữa */}
                <NextImage
                  src={videoThumb}
                  alt="Video thumbnail"
                  layout="fill"
                  objectFit="cover"
                />
              </div>
            }
          >
            <div className="relative w-full h-96 flex justify-center items-center">
              {" "}
              {/* Căn giữa video */}
              <ResponsiveVideoLazy videoSrc={heroSection.videoUrl} />
            </div>
          </Suspense>
        </section>

        {/* Mosquito section */}
        <section
          id={"mosquito"}
          className="h-full w-screen flex flex-col justify-center md:snap-start"
        >
          <Mosquito />
        </section>

        {/*Feature Section*/}
        <section
          id={"feature"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <FeatureSection features={features} />
        </section>

        {/*Our Strength Section*/}
        <section
          id={"our_strength"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <OurStrength />
        </section>

        {/*Testimonials Section*/}
        <section
          id={"testimonials"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
              Đánh giá từ khách hàng
            </h1>
          </div>
        </section>

        {/*Guide Section*/}
        <section
          id={"guide"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
              Hướng dẫn sử dụng
            </h1>
          </div>
        </section>

        {/*Product Grid Section*/}
        <section
          id={"productGrid"}
          className="md:h-full sm:h-fit w-screen  flex flex-col justify-center md:snap-start overflow-y-auto"
        >
          <ProductGrid />
        </section>

        {/*Materials & Sustainability Section*/}
        <section
          id={"materials"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
              Vật liệu & Bền vững
            </h1>
          </div>
        </section>

        {/*FAQ Section*/}
        <section
          id={"faq"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
              Câu hỏi thường gặp
            </h1>
          </div>
        </section>

        {/*Newsletter Subscription Section*/}
        <section
          id={"newsletter"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
              Đăng ký nhận tin
            </h1>
          </div>
        </section>

        {/*Footer Section*/}
        <section
          id={"footer"}
          className="h-full w-screen md:flex md:flex-col md:snap-start justify-end"
        >
          <Footer />
        </section>
      </div>

      <FabButton />
    </div>
  );
}
