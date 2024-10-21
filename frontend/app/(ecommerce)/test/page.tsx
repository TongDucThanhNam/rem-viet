import React, { Suspense } from "react";
import { cn } from "@/components/lib/server-utils/utils";
import HeroSection from "@/components/homepage/hero-section";
import VideoSection from "@/components/homepage/video-section";
import Mosquito from "@/components/animation/mosquito";
import Scene from "@/components/homepage/window-section";
import FeatureSection from "@/components/homepage/feature-section";
import OurStrength from "@/components/homepage/our-strength";
import CustomerReviewSection from "@/components/homepage/customer-review-section";
import GuideSection from "@/components/homepage/guide-section";
import MaterialSection from "@/components/homepage/material-section";
import FaqSection from "@/components/homepage/faq-section";
import NewsletterSection from "@/components/homepage/newsletter-section";
import Footer from "@/components/footer/footer";

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

        <Suspense fallback={<p>Loading</p>}>
          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center "
            id="video"
          >
            <VideoSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center "
            id="mosquito"
          >
            <Mosquito />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center"
            id="window"
          >
            <Scene />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-hidden"
            id="feature"
          >
            <FeatureSection />
          </Section>
          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-row justify-center items-center overflow-visible "
            id="our_strength"
          >
            <OurStrength />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-hidden "
            id="customer_review"
          >
            <CustomerReviewSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-visible "
            id="guide"
          >
            <GuideSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex items-center justify-center  overflow-visible "
            id="materials"
          >
            <MaterialSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center overflow-visible"
            id="faq"
          >
            <FaqSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center overflow-visible"
            id="newsletter"
          >
            <NewsletterSection />
          </Section>

          <Section
            id={"footer"}
            className={"flex flex-col justify-center overflow-visible"}
          >
            <Footer />
          </Section>
        </Suspense>
      </div>
    </div>
  );
}
