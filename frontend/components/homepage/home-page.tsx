// import { Suspense } from "react";
// import { cn } from "@/components/lib/utils";
// import dynamic from "next/dynamic";
// import Footer from "@/components/footer/footer";
// import { FabButton } from "@/components/button/fab-button";
// import Loading from "@/app/loading";
// import HeroSection from "@/components/homepage/hero-section";
//
// // Dynamic imports with custom loading states
// const VideoSection = dynamic(
//   () => import("@/components/homepage/video-section"),
//   {
//     // loading: () => <Loading />,
//   },
// );
// const Mosquito = dynamic(() => import("@/components/motion/mosquito"), {
//   // loading: () => <Loading />,
// });
// const FeatureSection = dynamic(
//   () => import("@/components/homepage/feature-section"),
//   {
//     // loading: () => <Loading />,
//   },
// );
// const OurStrength = dynamic(
//   () => import("@/components/homepage/our-strength"),
//   {
//     // loading: () => <Loading />,
//   },
// );
// const CustomerReviewSection = dynamic(
//   () => import("@/components/homepage/customer-review-section"),
//   {
//     // loading: () => <Loading />,
//   },
// );
// const GuideSection = dynamic(
//   () => import("@/components/homepage/guide-section"),
//   {
//     // loading: () => <Loading />,
//   },
// );
// const MaterialSection = dynamic(
//   () => import("@/components/homepage/material-section"),
//   {
//     // loading: () => <Loading />,
//   },
// );
// const FaqSection = dynamic(() => import("@/components/homepage/faq-section"), {
//   // loading: () => <Loading />,
// });
// const NewsletterSection = dynamic(
//   () => import("@/components/homepage/newsletter-section"),
//   {
//     // loading: () => <Loading />,
//   },
// );
//
// const MyNavbarDynamic = dynamic(
//   () => import("@/components/my-navbar/my-navbar"),
//   {
//     loading: () => <p>Loading</p>,
//   },
// );
//
// const Section = ({
//   id,
//   className,
//   children,
// }: {
//   id: string;
//   className: string;
//   children: React.ReactNode;
// }) => (
//   <section id={id} className={cn("w-screen md:snap-start", className)}>
//     <Suspense fallback={<Loading />}>{children}</Suspense>
//   </section>
// );
//
// export default function HomePage() {
//   return (
//     <div className="flex flex-col h-screen w-screen">
//       <Suspense fallback={<p style={{ height: "60px" }}>Loading</p>}>
//         <MyNavbarDynamic />
//       </Suspense>
//       <div
//         className={cn(
//           "flex-1 w-full",
//           "overflow-y-auto md:snap-y md:snap-mandatory",
//           "scrollbar-hide scroll-smooth",
//           "bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
//         )}
//       >
//         <Section
//           id="hero"
//           className="h-full flex flex-col justify-center items-center w-screen md:snap-start"
//         >
//           <Suspense fallback={<Loading />}>
//             <HeroSection />
//           </Suspense>
//         </Section>
//
//         <Section
//           id="video"
//           className="h-full flex flex-col justify-center items-center"
//         >
//           <VideoSection />
//         </Section>
//
//         <Section
//           id="mosquito"
//           className="h-full flex flex-col justify-center items-center"
//         >
//           <Mosquito />
//         </Section>
//
//         <Section
//           id="feature"
//           className="h-full flex flex-col justify-center items-center"
//         >
//           <FeatureSection />
//         </Section>
//
//         <Section
//           id="our_strength"
//           className="sm:min-h-full md:h-full flex flex-row justify-center items-center overflow-visible"
//         >
//           <OurStrength />
//         </Section>
//
//         <Section
//           id="testimonials"
//           className="sm:min-h-full md:h-full flex flex-col justify-center overflow-visible"
//         >
//           <CustomerReviewSection />
//         </Section>
//
//         <Section
//           id="guide"
//           className="h-full flex flex-col justify-center overflow-visible"
//         >
//           <GuideSection />
//         </Section>
//
//         <Section
//           id="materials"
//           className="w-full sm:min-h-full md:h-full flex items-center justify-center overflow-visible"
//         >
//           <MaterialSection />
//         </Section>
//
//         <Section
//           id="faq"
//           className="sm:min-h-full h-full flex flex-col justify-center overflow-visible"
//         >
//           <FaqSection />
//         </Section>
//
//         <Section
//           id="newsletter"
//           className="sm:min-h-full h-full flex flex-col justify-center overflow-visible"
//         >
//           <NewsletterSection />
//         </Section>
//
//         <Section
//           id="footer"
//           className="sm:min-h-full h-full md:flex md:flex-col justify-end"
//         >
//           <Footer />
//         </Section>
//       </div>
//
//       <FabButton />
//     </div>
//   );
// }

import React, { Suspense } from "react";
import { cn } from "@/components/lib/utils";
import dynamic from "next/dynamic";
import Footer from "@/components/footer/footer";
import { FabButton } from "@/components/button/fab-button";
import Loading from "@/app/loading";
import HeroSection from "@/components/homepage/hero-section"; // Dynamic imports with custom loading states

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

const MyNavbarDynamic = dynamic(
  () => import("@/components/my-navbar/my-navbar"),
  {
    loading: () => <p>Loading</p>,
  },
);

const Section = ({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: React.ReactNode;
}) => (
  <section id={id} className={cn("w-screen md:snap-start", className)}>
    {children}
  </section>
);

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen w-screen">
      <Suspense fallback={<p style={{ height: "60px" }}>Loading</p>}>
        <MyNavbarDynamic />
      </Suspense>
      <div
        className={cn(
          "flex-1 w-full",
          "overflow-y-auto md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth",
          "bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
        )}
      >
        <Section
          id="hero"
          className="sm:min-h-full h-full flex flex-col justify-center items-center w-screen md:snap-start"
        >
          <HeroSection />
        </Section>

        <Suspense fallback={<Loading />}>
          <Section
            id="video"
            className="sm:min-h-full h-full flex flex-col justify-center items-center"
          >
            <VideoSection />
          </Section>

          <Section
            id="mosquito"
            className="sm:min-h-full h-full flex flex-col justify-center items-center"
          >
            <Mosquito />
          </Section>

          <Section
            id="feature"
            className="sm:min-h-full h-full flex flex-col justify-center items-center"
          >
            <FeatureSection />
          </Section>

          <Section
            id="our_strength"
            className="sm:min-h-full md:h-full flex flex-row justify-center items-center overflow-visible"
          >
            <OurStrength />
          </Section>

          <Section
            id="testimonials"
            className="sm:min-h-full md:h-full flex flex-col justify-center overflow-visible"
          >
            <CustomerReviewSection />
          </Section>

          <Section
            id="guide"
            className="sm:min-h-full h-full flex flex-col justify-center overflow-visible"
          >
            <GuideSection />
          </Section>

          <Section
            id="materials"
            className="w-full sm:min-h-full md:h-full flex items-center justify-center overflow-visible"
          >
            <MaterialSection />
          </Section>

          <Section
            id="faq"
            className="sm:min-h-full h-full flex flex-col justify-center overflow-visible"
          >
            <FaqSection />
          </Section>

          <Section
            id="newsletter"
            className="sm:min-h-full h-full flex flex-col justify-center overflow-visible"
          >
            <NewsletterSection />
          </Section>

          <Section
            id="footer"
            className="sm:min-h-full h-full md:flex md:flex-col justify-end"
          >
            <Footer />
          </Section>
        </Suspense>
      </div>

      <FabButton />
    </div>
  );
}
