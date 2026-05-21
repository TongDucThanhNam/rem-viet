import { Button } from "@rem-viet/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { productImageUrl } from "@/lib/site-config";

type ProductGalleryProps = {
  imageUrls: string[];
  productName: string;
};

export default function ProductGallery({
  imageUrls,
  productName,
}: ProductGalleryProps) {
  const images = useMemo(
    () => (imageUrls.length ? imageUrls : [undefined]),
    [imageUrls],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [imageUrls]);

  function goToPrevious() {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }

  function goToNext() {
    setActiveIndex((index) => (index + 1) % images.length);
  }

  return (
    <div className="relative w-full max-w-[680px] rounded-lg shadow-none shadow-black/5">
      <div className="relative overflow-hidden rounded-lg">
        <div className="relative h-[300px] overflow-hidden rounded-lg bg-muted sm:h-[420px] lg:h-[520px]">
          <img
            alt={productName}
            className="size-full object-contain transition-transform duration-500 hover:scale-[1.03]"
            src={productImageUrl(activeImage)}
          />

          {images.length > 1 ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex h-24 gap-3 overflow-x-auto overscroll-x-contain py-2">
        {images.map((imageUrl, index) => {
          const selected = index === activeIndex;

          return (
            <button
              aria-label={`Xem ảnh sản phẩm ${index + 1}`}
              className={`h-full w-24 shrink-0 overflow-hidden rounded-lg bg-muted transition-all ${
                selected
                  ? "opacity-100 ring-2 ring-primary/30"
                  : "opacity-40 hover:opacity-100"
              }`}
              key={`${imageUrl ?? "fallback"}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
            >
              <img
                alt={productName}
                className="size-full object-contain"
                loading="lazy"
                src={productImageUrl(imageUrl)}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
