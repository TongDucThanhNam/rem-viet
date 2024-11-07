// "use client";
//
// import React, { useEffect, useState } from "react";
// import dynamic from "next/dynamic";
// import { ErrorBoundary } from "react-error-boundary";
// // Correctly type the dynamic import
// const SpeedInsights = dynamic(
//   () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
//   {
//     ssr: false,
//   },
// );
//
// const GoogleAnalytics = dynamic(
//   () => import("@next/third-parties/google").then((mod) => mod.GoogleAnalytics),
//   {
//     ssr: false,
//   },
// );
//
// const Analytics = dynamic(
//   () => import("@vercel/analytics/react").then((mod) => mod.Analytics),
//   {
//     ssr: false,
//   },
// );
//
// function ErrorFallback({ error }: { error: Error }) {
//   return (
//     <div role="alert">
//       <p>Something went wrong:</p>
//       <pre style={{ color: "red" }}>{error.message}</pre>
//     </div>
//   );
// }
//
// export default function SpeedInsightsWrapper() {
//   const [isClient, setIsClient] = useState(false);
//
//   useEffect(() => {
//     setIsClient(true);
//   }, []);
//
//   if (!isClient) {
//     return null;
//   }
//
//   return (
//     <ErrorBoundary fallback={<p>Error</p>}>
//       <Analytics />
//       <SpeedInsights />
//       <GoogleAnalytics gaId="G-FL4SMXV2XL" />
//     </ErrorBoundary>
//   );
// }
