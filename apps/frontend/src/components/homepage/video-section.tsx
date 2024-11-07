"use server";

import React from "react";
import NextImage from "next/image";

import videoThumb from "public/src/videoThump.webp";
import { TypewriterEffectSmooth } from "@/components/animation/typewriter-effect";
import dynamic from "next/dynamic";
import { heroSection } from "@/config/site";

const BackgroundVideoCompnent = dynamic(
  () => import("@/components/video/background-video"),
  {
    loading: () => (
      <NextImage loading={"lazy"} fill alt="Video thumbnail" src={videoThumb} />
    ),
  },
);

const words = [
  { text: "Dễ dàng lắp đặt,", className: "text-2xl md:text-4xl font-normal" },
  { text: "Tiện dụng hiệu quả", className: "text-2xl md:text-4xl font-normal" },
];

export default async function VideoSection() {
  return (
    <>
      <div className="mb-4 flex flex-col items-center">
        {/* Margin-bottom để đẩy video xuống một chút */}
        <h1 className="text-center text-4xl md:text-6xl font-bold mb-4">
          Lưới chống muỗi
          <br />
          <span className="text-2xl md:text-4xl font-normal">
            Sản xuất tại Việt Nam
          </span>
        </h1>
        <TypewriterEffectSmooth words={words} />
      </div>

      <div className="relative w-full h-96 flex justify-center items-center">
        {" "}
        {/* Căn giữa video */}
        {/*<ResponsiveVideoLazy videoSrc={heroSection.videoUrl} />*/}
        {/*<DynamicVideoPlayer*/}
        {/*  src={"https://rem-viet.s3.ap-southeast-2.amazonaws.com/output.m3u8"}*/}
        {/*/>*/}
        <BackgroundVideoCompnent videoSrc={heroSection.videoHls} />
      </div>
    </>
  );
}
