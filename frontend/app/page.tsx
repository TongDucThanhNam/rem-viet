import React from "react";
import dynamic from "next/dynamic";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { cn } from "@nextui-org/react";
import Footer from "@/components/footer/footer";
import Mosquito from "@/components/motion/mosquito";
import FeatureSection from "@/components/homepage/feature-section";
import OurStrength from "@/components/homepage/our-strength";
import { FabButton } from "@/components/button/fab-button";
import { features, our_strength } from "@/config/site";
import NewsletterSection from "@/components/homepage/newsletter-section";
import FaqSection from "@/components/homepage/faq-section";
import MaterialSection from "@/components/homepage/material-section";
import GuideSection from "@/components/homepage/guide-section";
import CustomerReviewSection from "@/components/homepage/customer-review-section";
import VideoSection from "@/components/homepage/video-section";
import HeroSection from "@/components/homepage/hero-section";

const ProductGridLazy = dynamic(
  () => import("@/components/product-grid/product-grid"),
  // {
  //   ssr: false,
  // },
);

export default function Home() {
  return (
    <div className={"flex flex-col h-screen w-screen  select-none "}>
      <MyNavbar />
      <div
        className={cn(
          "flex-grow w-screen ",
          "overflow-y-scroll md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth", // Note: This might require additional setup for cross-browser support
          "absolute inset-0 h-full w-full bg-white bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
          // "relative flex flex-col",
        )}
      >
        {/*Hero Section*/}
        <section
          id={"hero"}
          className="h-full w-screen flex flex-col justify-center items-center md:snap-start"
        >
          <HeroSection />
        </section>

        {/*Video Section*/}
        <section
          id={"video"}
          className="w-screen h-full flex flex-col justify-center items-center md:snap-start"
        >
          <VideoSection />
        </section>

        {/* Mosquito section */}
        <section
          id={"mosquito"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <Mosquito />
        </section>

        {/*Feature Section*/}
        <section
          id={"feature"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <FeatureSection features={features} />
        </section>

        {/*Our Strength Section*/}
        <section
          id={"our_strength"}
          className="sm:min-h-full md:h-full w-screen flex flex-row justify-center md:snap-start items-center overflow-visible"
        >
          <OurStrength />
        </section>

        {/*Testimonials Section*/}
        <section
          id={"testimonials"}
          className="sm:min-h-full md:h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <CustomerReviewSection />
        </section>

        {/*Guide Section*/}
        <section
          id={"guide"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <GuideSection />
        </section>

        {/*Product Grid Section*/}
        <section
          id={"productGrid"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center md:snap-start overflow-hidden"
        >
          <ProductGridLazy />
        </section>

        {/*Materials & Sustainability Section*/}
        <section
          id="materials"
          className="py-16 px-4 sm:px-6 lg:px-8 w-full min-h-screen flex items-center justify-center md:snap-start overflow-visible"
        >
          <MaterialSection />
        </section>

        {/*FAQ Section*/}
        <section
          id={"faq"}
          className="sm:min-h-full h-full w-screen flex flex-col justify-center md:snap-start overflow-visible"
        >
          <FaqSection />
        </section>

        {/*Newsletter Subscription Section*/}
        <section
          id={"newsletter"}
          className="sm:min-h-full h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <NewsletterSection />
        </section>

        {/*Footer Section*/}
        <section
          id={"footer"}
          className="sm:min-h-full h-full w-screen md:flex md:flex-col md:snap-start justify-end"
        >
          <Footer />
        </section>
      </div>

      {/*Fab Button*/}
      <FabButton />
    </div>
  );
}