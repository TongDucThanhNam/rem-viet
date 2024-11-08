'use client'; // <===== REQUIRED

import React from "react";


// import Swiper core and required modules
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';
import SwiperComponent from "@/components/swiper/swiper-components";

//Image array of local image
let images = [
    '/src/swiper1.jpg',
    '/src/swiper2.jpg',
    '/src/swiper3.jpg',
]
const SwiperComp = () => {
    return (
        <div className="p-2 z-30 ">
            <SwiperComponent images={images}/>
        </div>
    );

}

SwiperComp.displayName = 'Swiper';

export default SwiperComp;