"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric);

    if (metric.attribution) {
      console.log("Attribution:", metric.attribution);
    }

    switch (metric.name) {
      case "CLS":
        console.log("CLS:", metric.value);
        break;
      case "LCP":
        console.log("LCP:", metric.value);
        break;
      case "FID":
        console.log("FID:", metric.value);
        break;
      case "TTFB":
        console.log("TTFB:", metric.value);
        break;
      case "Next.js-hydration":
        console.log("Hydration:", metric.startTime, metric.value);
        break;
      case "Next.js-route-change-to-render":
        console.log("Route change to render:", metric.value);
        break;
      case "Next.js-render":
        console.log("Render:", metric.value);
        break;
      default:
        break;
    }
  });

  return null;
}
