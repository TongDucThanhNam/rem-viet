import React from "react";
import dynamic from "next/dynamic";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { cn } from "@nextui-org/react";
import Footer from "@/components/footer/footer";
import { features, our_strength } from "@/config/site";
import HeroSection from "@/components/homepage/hero-section";
import { FabButton } from "@/components/button/fab-button";

// Dynamically import components
const Mosquito = dynamic(() => import("@/components/motion/mosquito"));
const FeatureSection = dynamic(
  () => import("@/components/homepage/feature-section"),
);
const OurStrength = dynamic(() => import("@/components/homepage/our-strength"));
const NewsletterSection = dynamic(
  () => import("@/components/homepage/newsletter-section"),
);
const FaqSection = dynamic(() => import("@/components/homepage/faq-section"));
const MaterialSection = dynamic(
  () => import("@/components/homepage/material-section"),
);
const GuideSection = dynamic(
  () => import("@/components/homepage/guide-section"),
);
const CustomerReviewSection = dynamic(
  () => import("@/components/homepage/customer-review-section"),
);
const ProductGridLazy = dynamic(
  () => import("@/components/product-grid/product-grid"),
);
const VideoLazy = dynamic(
  () => import("@/components/homepage/video-section"),
  {},
);

export default function Home() {
  return (
    <div className="flex flex-col h-screen w-screen select-none">
      <MyNavbar />
      <div
        className={cn(
          "flex-1 w-full",
          "overflow-y-auto md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth",
          "bg-white bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
        )}
      >
        {/* Hero Section */}
        <section
          id={"hero"}
          className="h-full w-screen flex flex-col justify-center items-center md:snap-start "
        >
          <HeroSection />
        </section>

        {/* Video Section */}
        <section
          id={"video"}
          className="w-screen h-full flex flex-col justify-center items-center md:snap-start"
        >
          <VideoLazy />
        </section>

        {/* Mosquito section */}
        <section
          id={"mosquito"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <Mosquito />
        </section>

        {/* Feature Section */}
        <section
          id={"feature"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <FeatureSection features={features} />
        </section>

        {/* Our Strength Section */}
        <section
          id={"our_strength"}
          className="sm:min-h-full md:h-full w-screen flex flex-row justify-center md:snap-start items-center overflow-visible"
        >
          <OurStrength />
        </section>

        {/* Testimonials Section */}
        <section
          id={"testimonials"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center md:snap-start overflow-visible"
        >
          <CustomerReviewSection />
        </section>

        {/* Guide Section */}
        <section
          id={"guide"}
          className="h-full w-screen flex flex-col justify-center md:snap-start overflow-visible"
        >
          <GuideSection />
        </section>

        {/* Product Grid Section */}
        <section
          id={"productGrid"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center md:snap-start overflow-hidden"
        >
          <ProductGridLazy />
        </section>

        {/* Materials & Sustainability Section */}
        <section
          id="materials"
          className="w-full sm:min-h-full md:h-full flex items-center justify-center md:snap-start overflow-visible"
        >
          <MaterialSection />
        </section>

        {/* FAQ Section */}
        <section
          id={"faq"}
          className="sm:min-h-full h-full w-screen flex flex-col justify-center md:snap-start overflow-visible"
        >
          <FaqSection />
        </section>

        {/* Newsletter Subscription Section */}
        <section
          id={"newsletter"}
          className="sm:min-h-full h-full w-screen flex flex-col justify-center md:snap-start overflow-visible"
        >
          <NewsletterSection />
        </section>

        {/* Footer Section */}
        <section
          id={"footer"}
          className="sm:min-h-full h-full w-screen md:flex md:flex-col md:snap-start justify-end"
        >
          <Footer />
        </section>
      </div>

      {/* Fab Button */}
      <FabButton />
    </div>
  );
}
