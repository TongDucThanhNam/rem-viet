import React from "react";
import { Button, Link, Spacer } from "@nextui-org/react";
import { heroSection } from "@/config/site";
import { TextReveal } from "@/components/text-effect/TextReveal";
import { TextTypingEffectWithTexts } from "@/components/text-effect/typing-text-effect";

export default function HeroSection() {
  return (
    <div className={"flex flex-col items-center "}>
      <div className="text-center mb-8">
        {/*<TextEffect*/}
        {/*  per="word"*/}
        {/*  as="h1"*/}
        {/*  preset="blur"*/}
        {/*  className={"text-4xl md:text-6xl font-bold mb-4"}*/}
        {/*>*/}
        {/*  {heroSection.hello}*/}
        {/*</TextEffect>*/}
        <TextReveal
          myclass={"text-4xl md:text-6xl font-bold mb-4"}
          text={heroSection.hello}
        />

        <h1 className="text-4xl md:text-6xl font-bold mb-4  inline-block bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-800 via-slate-100 to-sky-900 bg-clip-text text-transparent">
          {heroSection.title}
        </h1>

        <Spacer y={2} />

        {/*<TextEffect*/}
        {/*  per="char"*/}
        {/*  preset="fade"*/}
        {/*  className="text-xl md:text-2xl max-w-2xl mx-auto"*/}
        {/*>*/}
        {/*  {heroSection.description}*/}
        {/*</TextEffect>*/}
        <TextTypingEffectWithTexts />
      </div>

      <div
        className={
          "w-screen flex flex-row justify-center items-center space-x-4"
        }
      >
        <Button as={Link} href={"#footer"} color={"primary"}>
          Liên hệ tư vấn
        </Button>
        <Button as={Link} href={"#productGrid"} color={"secondary"}>
          Xem danh mục sản phẩm
        </Button>
      </div>
    </div>
  );
}
