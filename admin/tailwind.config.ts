import type { Config } from "tailwindcss";

import { nextui } from "@nextui-org/theme";
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette";

const config: Config = {
  mode: "jit",
  content: [
    // "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        "meteor-effect": "meteor 15s linear infinite",
        "text-reveal": "text-reveal 1.5s cubic-bezier(0.77, 0, 0.175, 1) 0.5s",
        scroll:
            "scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite",
      },
      keyframes: {
        "text-reveal": {
          "0%": {
            transform: "translate(0, 100%)",
          },
          "100%": {
            transform: "translate(0, 0)",
          },
        },
        scroll: {
          to: {
            transform: "translate(calc(-50% - 0.5rem))",
          },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    nextui({
      prefix: "nextui", // prefix for themes variables
      // addCommonColors: true, // override common colors (e.g. "blue", "green", "pink").
      // defaultTheme: "light", // default motion from the themes object
      // defaultExtendTheme: "light", // default motion to extend on custom themes
      layout: {}, // common layout tokens (applied to all themes)
      themes: {
        light: {},
        dark: {},
      },
    }),
    addVariablesForColors,
  ],
};

// This plugin adds each Tailwind color as a global CSS variable, e.g. var(--gray-200).
function addVariablesForColors({ addBase, theme }: any) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
      Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
  );

  addBase({
    ":root": newVars,
  });
}

export default config;