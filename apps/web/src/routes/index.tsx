import { ReactLenis } from "lenis/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CustomCursorRaw } from "@/components/custom-cursor-raw";
import { GsapScrollSync } from "@/components/gsap-scroll-sync";
import { LoadingScreenRaw } from "@/components/loading-screen-raw";
import { ScrollProgress } from "@/components/scroll-progress";
import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
import { Threat } from "@/components/landing/threat";
import { Marquee } from "@/components/landing/marquee";
import { Benefits } from "@/components/landing/benefits";
import { Craft } from "@/components/landing/craft";
import { BentoDetails } from "@/components/landing/bento-details";
import { HorizontalGallery } from "@/components/landing/horizontal-gallery";
import { MeasureGuide } from "@/components/landing/measure-guide";
import { Faq } from "@/components/landing/faq";
import { CurtainFooter } from "@/components/landing/curtain-footer";
import { useThemeBySection } from "@/hooks/use-theme-by-section";
import { useMagneticScope } from "@/hooks/use-magnetic-scope";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const [isLoaded, setIsLoaded] = useState(false);

  // Drive `<html data-theme="...">` based on the section currently
  // crossing the viewport's middle. Affects --bg-color / --text-color
  // for the custom cursor, navigation, and any descendant that consumes
  // the CSS vars.
  useThemeBySection();

  // Scope-based magnetic effect for all non-nav hover targets.
  useMagneticScope();

  return (
    <ReactLenis
      root
      options={{
        autoRaf: false,
        duration: 1.25,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      {/* Film Grain overlay */}
      <div className="noise-overlay" />

      {/* Vignette — subtle edge darkening for cinematic depth */}
      <div className="vignette-overlay" />

      {/* Keep ScrollTrigger in lock-step with Lenis's smoothed scroll */}
      <GsapScrollSync />

      {/* Luxury Custom Cursor */}
      <CustomCursorRaw />

      {/* Smooth Loading Screen */}
      <LoadingScreenRaw onComplete={() => setIsLoaded(true)} />

      {/* Top-of-viewport scroll progress bar */}
      <ScrollProgress />

      {/* Navigation */}
      <Navigation />

      {/* Main scrolling wrapper */}
      <main id="smooth-wrapper" className="font-sans">
        <Hero isLoaded={isLoaded} />
        <Threat />
        <Marquee />
        <Benefits />
        <Craft />
        <BentoDetails />
        <HorizontalGallery />
        <MeasureGuide />
        <Faq />
      </main>

      {/* Curtain Footer */}
      <CurtainFooter />
    </ReactLenis>
  );
}
