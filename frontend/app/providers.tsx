"use client";

import { NextUIProvider } from "@nextui-org/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes/dist/types";
import React from "react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextUIProvider>
      <NextThemesProvider attribute="class">{children}</NextThemesProvider>
    </NextUIProvider>
  );
}
