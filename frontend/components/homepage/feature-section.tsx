"use client";

import FacebookIcon from "@/components/icons/icons";
import React from "react";
import { motion } from "framer-motion";
import { features } from "@/config/site";

export default function FeatureSection() {
  const MULTIDIRECTION_SLIDE_VARIANTS = {
    hidden: { opacity: 0, x: "-25vw" },
    visible: { opacity: 1, x: 0 },
    right: { opacity: 0, x: "25vw" },
  };

  return (
    <>
      {/*Feature Section*/}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7">
              Sản phẩm chất lượng
            </h2>
            <div className="overflow-hidden">
              {" "}
              {/* Add this wrapper to prevent overflow */}
              <motion.p
                initial="hidden"
                whileInView="visible"
                variants={MULTIDIRECTION_SLIDE_VARIANTS}
                transition={{ duration: 1.5 }}
                className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              >
                Mang đến không gian sống an toàn, tiện nghi
              </motion.p>
              <motion.p
                initial="hidden"
                whileInView="visible"
                variants={MULTIDIRECTION_SLIDE_VARIANTS}
                transition={{ duration: 1.5 }}
                className="mt-6 text-lg leading-8"
              >
                Chúng tôi cung cấp các sản phẩm chất lượng, giá cả phải chăng,
                đảm bảo an toàn, tiện nghi cho gia đình bạn. Hãy đến với chúng
                tôi để trải nghiệm ngay hôm nay!
              </motion.p>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {features.map((feature: any) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  key={feature.name}
                  className="flex flex-col"
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7">
                    <FacebookIcon
                      aria-hidden="true"
                      className="h-5 w-5 flex-none text-indigo-400"
                    />
                    {feature.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7">
                    <p className="flex-auto">{feature.description}</p>
                    <p className="mt-6">
                      <a
                        href={feature.href}
                        className="text-sm font-semibold leading-6 text-primary"
                      >
                        Tìm hiểu thêm
                        <span aria-hidden="true">→</span>
                      </a>
                    </p>
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
