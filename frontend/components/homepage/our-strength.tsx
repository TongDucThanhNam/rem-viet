import {YouTubeEmbed} from "@next/third-parties/google";
import React from "react";

export default function OurStrength() {
    return (
        <>
            <div className="my-auto flex h-full w-full max-w-7xl flex-col gap-2 p-4">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-8">
                    <div className="w-full lg:w-1/2 space-y-4">
                        <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                            Ưu thế của chúng tôi
                        </h2>
                        <p className="text-base sm:text-lg leading-relaxed">
                            Chúng tôi cam kết mang đến cho bạn những sản phẩm chất
                            lượng nhất, giá cả phải chăng nhất và dịch vụ hỗ trợ tốt
                            nhất.
                        </p>
                        <p className="text-base sm:text-lg leading-relaxed">
                            Không như các loại sản phẩm khác, sản phẩm của chúng tôi
                            bền hơn rất nhiều, giúp bạn tiết kiệm chi phí và thời
                            gian.
                        </p>
                        <p className="text-base sm:text-lg leading-relaxed">
                            Nếu bạn cần tư vấn, hãy liên hệ với chúng tôi ngay hôm nay
                            để được tư vấn miễn phí.
                        </p>
                        <div className="pt-2">
                            <a
                                href="/"
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out"
                            >
                                Liên hệ ngay
                            </a>
                        </div>
                    </div>
                    <div className="w-full lg:w-1/2 mt-4 lg:mt-0">
                        <div className="aspect-w-16 aspect-h-9">
                            <YouTubeEmbed
                                videoid="ogfYd705cRs"
                                params="controls=1"
                                playlabel="Watch video"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}