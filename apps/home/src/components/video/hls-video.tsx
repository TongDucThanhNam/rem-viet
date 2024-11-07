"use client";

import { useEffect, useRef, useState } from "react";
// @ts-ignore
import Hls from "hls.js"; // Use light build of hls.

interface HLSVideoPlayerProps {
  src: string;
}

export default function HLSVideoPlayer({ src }: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError(
                "Network error. Please check your connection and try again.",
              );
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Media error. The video could not be loaded.");
              break;
            default:
              setError("An error occurred while loading the video.");
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // For browsers that natively support HLS (like Safari)
      video.src = src;
    } else {
      setError("Your browser does not support HLS playback.");
    }
  }, [src]);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {error ? (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="w-full rounded-lg shadow-lg"
          controls={false}
          poster={"/videoThump.webp"}
          preload={"auto"}
        >
          <track kind="captions" label="English captions" srcLang="en" />
        </video>
      )}
    </div>
  );
}
