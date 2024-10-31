import React from "react";
import { cn } from "@/components/lib/server-utils/utils";

// Server components (default in App Router)
import HeroSection from "@/components/homepage/hero-section";
import MyNavbar from "@/components/my-navbar/my-navbar";
import VideoSection from "@/components/homepage/video-section";
import Mosquito from "@/components/animation/mosquito";
import SceneWrapper from "@/components/homepage/window-section";
import FeatureSection from "@/components/homepage/feature-section";
import OurStrength from "@/components/homepage/our-strength";
import CustomerReviewSection from "@/components/homepage/customer-review-section";
import GuideSection from "@/components/homepage/guide-section";
import MaterialSection from "@/components/homepage/material-section";
import FaqSection from "@/components/homepage/faq-section";
import NewsletterSection from "@/components/homepage/newsletter-section";
import Footer from "@/components/footer/footer";
import FABButton from "@/components/button/fab-button";

const Section = ({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={cn("w-screen md:snap-start", className)} id={id}>
    {children}
  </section>
);

export default function Home() {
  return (
    <div className="flex flex-col max-w-screen max-h-screen">
      <MyNavbar />
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

        {[
          { id: "video", Component: VideoSection },
          { id: "mosquito", Component: Mosquito },
          { id: "window", Component: SceneWrapper },
          {
            id: "feature",
            Component: FeatureSection,
            className: "overflow-hidden",
          },
          {
            id: "our_strength",
            Component: OurStrength,
            className: "flex-row overflow-visible",
          },
          {
            id: "customer_review",
            Component: CustomerReviewSection,
            className: "overflow-hidden",
          },
          {
            id: "guide",
            Component: GuideSection,
            className: "overflow-visible",
          },
          {
            id: "materials",
            Component: MaterialSection,
            className: "items-center justify-center overflow-visible",
          },
          { id: "faq", Component: FaqSection, className: "overflow-visible" },
          {
            id: "newsletter",
            Component: NewsletterSection,
            className: "overflow-visible",
          },
        ].map(({ id, Component, className = "" }) => (
          <Section
            key={id}
            className={`min-h-fit sm:min-h-[calc(100vh-4rem)] flex flex-col justify-center ${className}`}
            id={id}
          >
            <Component />
          </Section>
        ))}

        <Section
          id="footer"
          className="flex flex-col justify-center overflow-visible"
        >
          <Footer />
        </Section>
      </div>

      <FABButton />
    </div>
  );
}
