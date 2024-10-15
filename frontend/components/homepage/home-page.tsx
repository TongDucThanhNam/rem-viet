import React, { Suspense } from "react";
import dynamic from "next/dynamic";

import { cn } from "@/components/lib/server-utils/utils";
import HeroSection from "@/components/homepage/hero-section";
import { heroSection } from "@/config/site";

const MyNavbar = dynamic(() => import("@/components/my-navbar/my-navbar"), {
  ssr: false,
});

// Dynamic imports with custom loading states

const VideoSection = dynamic(
  () => import("@/components/homepage/video-section"),
  { ssr: false },
);
const Mosquito = dynamic(() => import("@/components/motion/mosquito"), {
  ssr: false,
});
const FeatureSection = dynamic(
  () => import("@/components/homepage/feature-section"),
  { ssr: false },
);
const OurStrength = dynamic(
  () => import("@/components/homepage/our-strength"),
  { ssr: false },
);
const CustomerReviewSection = dynamic(
  () => import("@/components/homepage/customer-review-section"),
  { ssr: false },
);
const GuideSection = dynamic(
  () => import("@/components/homepage/guide-section"),
  { ssr: false },
);
const MaterialSection = dynamic(
  () => import("@/components/homepage/material-section"),
  { ssr: false },
);
const FaqSection = dynamic(() => import("@/components/homepage/faq-section"), {
  ssr: false,
});
const NewsletterSection = dynamic(
  () => import("@/components/homepage/newsletter-section"),
  { ssr: false },
);

const Footer = dynamic(() => import("@/components/footer/footer"), {
  ssr: false,
});

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

export default function HomePage() {
  return (
    <div className={"flex flex-col max-w-screen max-h-screen"}>
      <MyNavbar />
      <div
        className={cn(
          "max-w-full h-full",
          "overflow-y-auto md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth",
          "bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
        )}
      >
        <Section
          className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center"
          id="hero"
        >
          <HeroSection heroSection={heroSection} />
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
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center "
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
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center overflow-visible "
            id="customer_review"
          >
            <CustomerReviewSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center overflow-visible "
            id="guide"
          >
            <GuideSection />
          </Section>

          <Section
            className="min-h-fit sm:min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-visible "
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
