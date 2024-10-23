"use server";

import { TextGenerateEffect } from "@/components/animation/text-generate-effect";
import { Button } from "@nextui-org/button";
import Link from "next/link";
import NextImage from "next/image";
import React from "react";
import { heroSection } from "@/config/site";

//import image
import heroImage from "@/public/src/heroimage.webp";

export default async function HeroSection() {
  return (
    <div className="w-screen relative overflow-hidden">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col items-center text-center justify-center lg:flex-row lg:text-left">
          <div className="flex flex-col text-center items-center justify-center space-x-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {heroSection.hello}
              <br />
              <span className="text-primary">{heroSection.title}</span>
            </h1>
            <div className="mt-3 sm:mx-auto sm:mt-5 sm:max-w-xl sm:text-lg md:mt-5 md:text-xl lg:mx-0">
              <TextGenerateEffect words={heroSection.description} />
            </div>
            <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
              <Button
                as={Link}
                prefetch={false}
                className="w-full sm:w-auto"
                color="primary"
                href="/#newsletter"
              >
                Tư vấn ngay
              </Button>
              <Button
                as={Link}
                prefetch={false}
                className="w-full sm:w-auto mt-3 sm:mt-0 sm:ml-3"
                color="secondary"
                href="/danh-sach-san-pham"
              >
                Xem danh sách sản phẩm
              </Button>
            </div>
          </div>
          <div className="mt-10 lg:mt-0">
            <div className="">
              <NextImage
                priority
                alt="Hero image"
                width={400}
                height={400}
                src={heroImage}
                // className="object-cover rounded-lg"
                // sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
