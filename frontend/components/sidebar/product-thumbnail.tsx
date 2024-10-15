"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import React, { useState } from "react";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";
import "@/styles/styles.css";
import { FreeMode, Navigation, Thumbs } from "swiper/modules";
import { Image, Skeleton } from "@nextui-org/react";

export default function SwiperThumbnail({
  imageUrls,
  isLoading,
}: {
  imageUrls: string[];
  isLoading: boolean;
}) {
  const [thumbsSwiper, setThumbsSwiper] = useState(null);

  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  return (
    <div
      className="relative shadow-black/5 shadow-none rounded-large"
      style={{
        width: "100%",
        maxWidth: "fit-content",
      }}
    >
      {isLoading ? (
        <Swiper
          className="mySwiper2"
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          navigation={true}
          spaceBetween={10}
          style={{
            width: "100%",
            height: "100%",
            // padding: '10px',
          }}
          thumbs={{ swiper: thumbsSwiper }}
        >
          {imageUrls.map((url, index) => (
            <SwiperSlide key={index}>
              <Skeleton>
                <Image isBlurred isZoomed alt={"product"} src={url} />
              </Skeleton>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <Swiper
          className="mySwiper2"
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          navigation={true}
          spaceBetween={10}
          style={{
            width: "100%",
            height: "100%",
            // padding: '10px',
          }}
          thumbs={{ swiper: thumbsSwiper }}
        >
          {imageUrls.map((url, index) => (
            <SwiperSlide key={index}>
              <Image
                isBlurred
                isZoomed
                alt={"product"}
                // src={url}
                src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${url}`}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      {isLoading ? (
        <Swiper
          // @ts-ignore
          className="mySwiper "
          freeMode={true}
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          slidesPerView={4}
          spaceBetween={10}
          watchSlidesProgress={true}
          // @ts-ignore
          onSwiper={setThumbsSwiper}
        >
          {imageUrls.map((url, index) => (
            <SwiperSlide key={index}>
              <Skeleton>
                <Image alt={"product"} src={url} />
              </Skeleton>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <Swiper
          // @ts-ignore
          className="mySwiper "
          freeMode={true}
          loop={true}
          modules={[FreeMode, Navigation, Thumbs]}
          slidesPerView={4}
          spaceBetween={10}
          watchSlidesProgress={true}
          // @ts-ignore
          onSwiper={setThumbsSwiper}
        >
          {imageUrls.map((url, index) => (
            <SwiperSlide key={index}>
              <Image
                alt={"product"}
                // src={url}
                src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${url}`}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}
