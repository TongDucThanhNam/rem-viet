import { Nunito } from "next/font/google";

// If loading a variable font, you don't need to specify the font weight
export const nunito = Nunito({
  subsets: ["vietnamese",],
  display: "swap",
  preload: true,
  fallback: ["sans-serif"],
  // weight: ["400", "700"],
  // variable: "--font-nunito",
});