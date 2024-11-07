import React from "react";
import BackgroundVideo from "next-video/background-video"; // const ResponsiveVideoLazy = lazy(() => import("@/components/video/video"));

interface ResponsiveVideoProps {
  videoSrc: string;
}

export default function BackgroundVideoCompnent(
  { videoSrc }: ResponsiveVideoProps = {
    videoSrc: "https://rem-viet.s3.ap-southeast-2.amazonaws.com/HeroImage.webp",
  },
) {
  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <BackgroundVideo
        src={"https://rem-viet.s3.ap-southeast-2.amazonaws.com/output.m3u8"}
        title="Rèm Việt"
        poster={"/src/videoThump.webp"}
        autoPlay
        playsInline
      ></BackgroundVideo>
    </div>
  );
}
