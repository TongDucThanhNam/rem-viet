import "@/app/styles/globals.css";
import { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { nunito } from "@/app/fonts";
import { Providers } from "./providers";
import { GoogleAnalytics } from "@next/third-parties/google";
import React from "react";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    follow: true,
    index: true,
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.image,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.image],
    creator: "@tongducthanhnam",
  },
};

// export const viewport: Viewport = {
//   themeColor: [
//     { media: "(prefers-color-scheme: light)", color: "white" },
//     { media: "(prefers-color-scheme: dark)", color: "black" },
//   ],
//   width: "device-width",
//   initialScale: 1,
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={nunito.className}>
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
      <GoogleAnalytics gaId="G-FL4SMXV2XL" />
    </html>
  );
}
