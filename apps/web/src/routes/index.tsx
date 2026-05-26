import { ReactLenis } from "@studio-freight/react-lenis";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CustomCursorRaw } from "@/components/custom-cursor-raw";
import { LoadingScreenRaw } from "@/components/loading-screen-raw";
import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
import { Threat } from "@/components/landing/threat";
import { Marquee } from "@/components/landing/marquee";
import { Craft } from "@/components/landing/craft";
import { BentoDetails } from "@/components/landing/bento-details";
import { HorizontalGallery } from "@/components/landing/horizontal-gallery";
import { MeasureGuide } from "@/components/landing/measure-guide";
import { CurtainFooter } from "@/components/landing/curtain-footer";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <ReactLenis root>
      {/* Film Grain overlay */}
      <div className="noise-overlay" />

      {/* Luxury Custom Cursor */}
      <CustomCursorRaw />

      {/* Smooth Loading Screen */}
      <LoadingScreenRaw onComplete={() => setIsLoaded(true)} />

      {/* Navigation */}
      <Navigation />

      {/* Main scrolling wrapper */}
      <main id="smooth-wrapper" className="font-sans">
        <Hero isLoaded={isLoaded} />
        <Threat />
        <Marquee />
        <Craft />
        <BentoDetails />
        <HorizontalGallery />
        <MeasureGuide />
      </main>

      {/* Curtain Footer */}
      <CurtainFooter />
    </ReactLenis>
  );
}
