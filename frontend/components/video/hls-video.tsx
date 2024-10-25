"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Skeleton } from "@nextui-org/skeleton";

interface HLSVideoPlayerProps {
  src: string;
}

export default function HLSVideoPlayer({ src }: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const initializeHls = useCallback(() => {
    const video = videoRef.current;
    if (!video || !window.Hls) return;

    if (window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        setIsLoaded(true);
      });

      hls.on(window.Hls.Events.ERROR, (_event: any, data: any) => {
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
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        setIsLoaded(true);
      });
    } else {
      setError("Your browser does not support HLS playback.");
    }
  }, [src]);

  useEffect(() => {
    if (window.Hls) {
      initializeHls();
    }
  }, [initializeHls]);

  const onScriptLoad = useCallback(() => {
    initializeHls();
  }, [initializeHls]);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <Script
        src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.light.min.js"
        strategy="afterInteractive"
        onLoad={onScriptLoad}
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
        <>
          {!isLoaded && (
            <Skeleton>
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200"></div>
            </Skeleton>
          )}
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="w-full rounded-lg shadow-lg"
            controls={false}
            poster={"/src/videoThump.webp"}
            preload="metadata"
          >
            <track kind="captions" label="English captions" srcLang="en" />
            Your browser does not support the video tag.
          </video>
        </>
      )}
    </div>
  );
}
