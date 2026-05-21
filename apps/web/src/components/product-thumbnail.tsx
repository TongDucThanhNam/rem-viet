import { useState } from "react";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";
import { FreeMode, Navigation, Thumbs } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { Skeleton } from "@rem-viet/ui/components/skeleton";

import { productImageUrl } from "@/lib/site-config";

export default function SwiperThumbnail({
  imageUrls,
  isLoading,
}: {
  imageUrls: string[];
  isLoading?: boolean;
}) {
  const [thumbsSwiper, setThumbsSwiper] = useState(null);

  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-lg">
      {isLoading ? (
        <Swiper
          className="mySwiper2 aspect-square w-full"
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          navigation={true}
          spaceBetween={10}
          thumbs={{ swiper: thumbsSwiper }}
        >
          {imageUrls.map((_, index) => (
            <SwiperSlide key={index}>
              <Skeleton className="size-full" />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <Swiper
          className="mySwiper2 aspect-square w-full"
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          navigation={true}
          spaceBetween={10}
          thumbs={{ swiper: thumbsSwiper }}
        >
          {imageUrls.map((url, index) => (
            <SwiperSlide key={index}>
              <img
                alt="product"
                className="size-full object-contain"
                src={productImageUrl(url)}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      {isLoading ? (
        <Swiper
          className="mySwiper mt-2 h-24 w-full"
          freeMode={true}
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          slidesPerView={4}
          spaceBetween={10}
          watchSlidesProgress={true}
          // @ts-expect-error Swiper types are loose
          onSwiper={setThumbsSwiper}
        >
          {imageUrls.map((_, index) => (
            <SwiperSlide key={index}>
              <Skeleton className="size-full" />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <Swiper
          className="mySwiper mt-2 h-24 w-full"
          freeMode={true}
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          slidesPerView={4}
          spaceBetween={10}
          watchSlidesProgress={true}
          // @ts-expect-error Swiper types are loose
          onSwiper={setThumbsSwiper}
        >
          {imageUrls.map((url, index) => (
            <SwiperSlide key={index}>
              <img
                alt="product thumbnail"
                className="size-full cursor-pointer object-cover"
                src={productImageUrl(url)}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}
