import { Button } from "@rem-viet/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { siteConfig } from "@/lib/site-config";

const AUTOPLAY_MS = 5000;

export default function HomeCarousel() {
  const images = useMemo(() => [...siteConfig.heroImages], []);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % images.length);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [images.length]);

  function goToPrevious() {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }

  function goToNext() {
    setActiveIndex((index) => (index + 1) % images.length);
  }

  return (
    <div className="relative z-20 w-full max-w-[800px] overflow-hidden bg-background p-2 shadow-lg">
      <div className="relative h-[220px] sm:h-[300px]">
        {images.map((image, index) => (
          <img
            alt={`Rèm Việt banner ${index + 1}`}
            className={`absolute inset-0 size-full object-cover shadow-lg transition-opacity duration-500 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
            decoding={index === 0 ? "sync" : "async"}
            key={image}
            loading={index === 0 ? "eager" : "lazy"}
            src={image}
          />
        ))}
      </div>

      <Button
        aria-label="Ảnh trước"
        className="absolute left-3 top-1/2 size-9 -translate-y-1/2 rounded-full bg-background/90 p-0 shadow-md backdrop-blur hover:bg-background"
        size="icon"
        type="button"
        variant="outline"
        onClick={goToPrevious}
      >
        <ChevronLeft aria-hidden className="size-5" />
      </Button>
      <Button
        aria-label="Ảnh tiếp theo"
        className="absolute right-3 top-1/2 size-9 -translate-y-1/2 rounded-full bg-background/90 p-0 shadow-md backdrop-blur hover:bg-background"
        size="icon"
        type="button"
        variant="outline"
        onClick={goToNext}
      >
        <ChevronRight aria-hidden className="size-5" />
      </Button>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {images.map((image, index) => (
          <button
            aria-label={`Chọn ảnh ${index + 1}`}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex ? "w-8 bg-primary" : "w-2 bg-white/80"
            }`}
            key={image}
            type="button"
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
