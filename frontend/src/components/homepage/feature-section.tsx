"use server";

import React from "react";

import { cn } from "@/components/lib/server-utils/utils";
import {
  Fa6SolidMosquitoNet,
  FluentMdl2Design,
  FontistoDate,
  Icons8Idea,
  IcOutlineShield,
  MaterialSymbolsHighQualityOutline,
  Ri24HoursLine,
  StreamlineProductionBelt,
} from "@/components/icons/icons";

export default async function FeatureSection() {
  const features = [
    {
      title: "Sản xuất tại Việt Nam",
      description:
        "Sản phẩm được sản xuất tại Việt Nam, đảm bảo chất lượng, giá cả phải chăng.",
      icon: <StreamlineProductionBelt height={30} width={30} />,
    },
    {
      title: "Chất lượng hàng đầu",
      description:
        "Chúng tôi cam kết mang đến sản phẩm chất lượng hàng đầu cho gia đình bạn.",
      icon: <MaterialSymbolsHighQualityOutline height={30} width={30} />,
    },
    {
      title: "Công dụng hiệu quả",
      description:
        "Đảm bảo ngăn chặn muỗi, côn trùng, giúp gia đình bạn có không gian sống an toàn.",
      icon: <Fa6SolidMosquitoNet height={30} width={30} />,
    },
    {
      title: "Độ bền cao",
      description:
        "Sản phẩm có độ bền cao, giúp tiết kiệm chi phí cho gia đình bạn.",
      icon: <IcOutlineShield height={30} width={30} />,
    },
    {
      title: "Chăm sóc khách hàng 24/7",
      description: "Chúng tôi luôn sẵn lòng hỗ trợ bạn mọi lúc, mọi nơi.",
      icon: <Ri24HoursLine height={30} width={30} />,
    },
    {
      title: "Thiết kế theo yêu cầu",
      description:
        "Chúng tôi có thể thiết kế theo kích thước mà khách hàng yêu cầu.",
      icon: <FluentMdl2Design height={30} width={30} />,
    },
    {
      title: "Bảo hành dài hạn",
      description: "Chúng tôi cam kết bảo hành sản phẩm trong thời gian dài.",
      icon: <FontistoDate height={30} width={30} />,
    },
    {
      title: "Sáng tạo không giới hạn",
      description:
        "Chúng tôi luôn sáng tạo, đổi mới để mang lại sản phẩm tốt nhất.",
      icon: <Icons8Idea height={30} width={30} />,
    },
  ];

  return (
    <>
      <div className="px-8">
        <h2 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto  tracking-tight font-medium text-black dark:text-white">
          Mang đến không gian sống an toàn, tiện nghi
        </h2>

        <p className="text-sm lg:text-base  max-w-2xl  mx-auto text-neutral-500 text-center font-normal dark:text-neutral-300">
          Chúng tôi cung cấp các sản phẩm chất lượng, giá cả phải chăng, đảm bảo
          an toàn, tiện nghi cho gia đình bạn. Hãy đến với chúng tôi để trải
          nghiệm ngay hôm nay!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  relative z-10 max-w-7xl mx-auto">
        {features.map((feature, index) => (
          <Feature key={feature.title} {...feature} index={index} />
        ))}
      </div>
    </>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r  py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800",
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
