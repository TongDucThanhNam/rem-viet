"use client";

import React, { lazy, Suspense } from "react";
import NextImage from "next/image";
import videoThumb from "@/public/src/videoThump.webp";
import { heroSection } from "@/config/site";

const ResponsiveVideoLazy = lazy(() => import("@/components/video/video"));

export default function VideoSection() {
  return (
    <>
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
            <NextImage src={videoThumb} alt="Video thumbnail" fill />
          </div>
        }
      >
        <div className="relative w-full h-96 flex justify-center items-center">
          {" "}
          {/* Căn giữa video */}
          <ResponsiveVideoLazy videoSrc={heroSection.videoUrl} />
        </div>
      </Suspense>
    </>
  );
}
