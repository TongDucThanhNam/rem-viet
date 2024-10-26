// "use client";
"use server";

import { YouTubeEmbed } from "@next/third-parties/google";
import { Button } from "@nextui-org/button";
import React from "react";

import { our_strength } from "@/config/site";

export default async function MaterialSection() {
  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
          Vật liệu & Quy trình sản xuất
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto">
          Chúng tôi cam kết sử dụng các vật liệu bền vững và quy trình sản xuất
          thân thiện với môi trường.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="aspect-w-16 aspect-h-9">
          <YouTubeEmbed
            params="controls=1"
            playlabel="Watch video"
            videoid={our_strength.video}
          />
        </div>

        <div className="text-left max-w-xl mx-auto md:mx-0">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-6">
            Vật liệu của chúng tôi
          </h2>
          <p className="text-base sm:text-lg lg:text-xl mb-4">
            Chúng tôi tự hào sử dụng các vật liệu cao cấp và bền vững trong quá
            trình sản xuất:
          </p>
          <ul className="list-disc text-left pl-6 mb-6 text-base sm:text-lg">
            <li className="mb-2">Vải organic được chứng nhận GOTS</li>
            <li className="mb-2">Sợi tái chế từ chai nhựa PET</li>
            <li className="mb-2">Nút áo từ vỏ dừa tự nhiên</li>
            <li className="mb-2">Thuốc nhuộm tự nhiên không độc hại</li>
          </ul>
          <p className="text-base sm:text-lg lg:text-xl mb-8">
            Bằng cách sử dụng các vật liệu này, chúng tôi không chỉ tạo ra sản
            phẩm chất lượng cao mà còn góp phần bảo vệ môi trường.
          </p>
          <Button className="justify-center" variant={"shadow"}>
            Tìm hiểu thêm
          </Button>
        </div>
      </div>
    </div>
  );
}
