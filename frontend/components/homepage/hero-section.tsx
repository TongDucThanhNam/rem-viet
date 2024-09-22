import React from "react";
import { TextEffect } from "@/components/text-effect/base-text-effect";
import {Button, Link, Spacer} from "@nextui-org/react";
import { heroSection } from "@/config/site";

export default function HeroSection() {
  return (
    <div className={"flex flex-col items-center"}>
      <div className="text-center mb-8">
        <TextEffect
          per="word"
          as="h1"
          preset="blur"
          className={"text-4xl md:text-6xl font-bold mb-4"}
        >
          {heroSection.hello}
        </TextEffect>

        <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 inline-block text-transparent bg-clip-text">
          {heroSection.title}
        </h1>

        <Spacer y={2} />

        <TextEffect
          per="char"
          preset="fade"
          className="text-xl md:text-2xl max-w-2xl mx-auto"
        >
          {heroSection.description}
        </TextEffect>
      </div>

      <div
        className={
          "w-screen flex flex-row justify-center items-center space-x-4"
        }
      >
        <Button
            as={Link}
            href={"#footer"}
            color={"primary"}>Liên hệ tư vấn</Button>
        <Button
            as={Link}
            href={"#productGrid"}
            color={"secondary"}>Xem danh mục sản phẩm</Button>
      </div>
    </div>
  );
}
