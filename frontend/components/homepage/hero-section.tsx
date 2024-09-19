import ResponsiveVideo from "@/components/video/video";
import React from "react";
import {TextEffect} from "@/components/text-effect/base-text-effect";
import {Spacer} from "@nextui-org/react";

export default function HeroSection() {
    return (
        <>
            <div className="z-10 text-center mb-8">
                <TextEffect per='word' as='h1' preset='blur' className={"text-4xl md:text-6xl font-bold mb-4"}>
                    Chào mừng đến với cửa hàng
                </TextEffect>

                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 inline-block text-transparent bg-clip-text">
                    Rèm Việt
                </h1>

                <Spacer y={2}/>

                <TextEffect per='char' preset='fade' className="text-xl md:text-2xl max-w-2xl mx-auto">
                    Mang đến sự bảo vệ cho gia đình bạn khỏi những tác nhân như côn trùng, khói bụi, ...
                </TextEffect>
            </div>
            <ResponsiveVideo
                videoSrc={
                    "https://rem-viet.hcm.ss.bfcplatform.vn/videoplayback.webm"
                }
            />
        </>
    )
}