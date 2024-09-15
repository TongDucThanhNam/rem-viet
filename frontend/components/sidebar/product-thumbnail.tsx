"use client";

import React, {useState} from "react";
// Import Swiper React components
import {Swiper, SwiperSlide} from "swiper/react";

// Import Swiper styles
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";

//using style.css
import "@/styles/styles.css";
// import required modules
import {FreeMode, Navigation, Thumbs} from "swiper/modules";
import {Image} from "@nextui-org/react";

export default function SwiperThumbnail() {
    const [thumbsSwiper, setThumbsSwiper] = useState(null);

    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    return (
        <div
            className="relative shadow-black/5 shadow-none rounded-large"
            style={{
                width: "100%",
                maxWidth: "fit-content",
            }}
        >
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
                thumbs={{swiper: thumbsSwiper}}
            >
                <SwiperSlide>
                    <Image
                        isBlurred
                        isZoomed
                        src="/src/product.webp"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-2.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-3.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-4.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-5.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-6.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-7.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-8.jpg"
                    />
                </SwiperSlide>
                <SwiperSlide>
                    <Image
                        isBlurred
                        src="https://swiperjs.com/demos/images/nature-10.jpg"
                    />
                </SwiperSlide>
            </Swiper>
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
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-1.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-2.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-3.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-4.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-5.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-6.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-7.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-8.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-9.jpg"/>
                </SwiperSlide>
                <SwiperSlide>
                    <Image src="https://swiperjs.com/demos/images/nature-10.jpg"/>
                </SwiperSlide>
            </Swiper>
        </div>
    );
}
