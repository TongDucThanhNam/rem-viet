import React from "react";
import { cn } from "@/components/lib/server-utils/utils";
import HeroSection from "@/components/homepage/hero-section";

const Section = ({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: React.ReactNode;
}) => (
  <section className={cn("w-screen md:snap-start", className)} id={id}>
    {children}
  </section>
);

export default async function Home() {
  return (
    <div className={"flex flex-col max-w-screen max-h-screen"}>
      <div
        className={cn(
          "max-w-screen h-full",
          "overflow-y-auto md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth",
          "bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
        )}
      >
        <Section
          className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center"
          id="hero"
        >
          <HeroSection />
        </Section>
      </div>
    </div>
  );
}
