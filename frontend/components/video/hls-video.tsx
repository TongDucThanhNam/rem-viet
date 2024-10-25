"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface HLSVideoPlayerProps {
  src: string;
}

export default function HLSVideoPlayer({ src }: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const onScriptLoad = () => {
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls();

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case window.Hls.ErrorTypes.NETWORK_ERROR:
                setError(
                  "Network error. Please check your connection and try again.",
                );
                break;
              case window.Hls.ErrorTypes.MEDIA_ERROR:
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
    };

    if (window.Hls) {
      onScriptLoad();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
      script.onload = onScriptLoad;
      document.body.appendChild(script);
    }
  }, [src]);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <Script
        src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"
        strategy="lazyOnload"
      />
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
          poster={"/src/videoThump.webp"}
          preload={"auto"}
        >
          <track kind="captions" label="English captions" srcLang="en" />
        </video>
      )}
    </div>
  );
}
