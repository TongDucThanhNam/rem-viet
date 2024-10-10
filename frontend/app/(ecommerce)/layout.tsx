import "@/styles/globals.css";
import { Metadata } from "next";
import { siteConfig } from "@/config/site";
import React from "react";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { FabButton } from "@/components/button/fab-button";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
};
// export const viewport: Viewport = {
//     themeColor: [
//         {media: "(prefers-color-scheme: light)", color: "white"},
//         {media: "(prefers-color-scheme: dark)", color: "black"},
//     ],
// }

export default async function EcomerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={""}>
      <MyNavbar />
      {children}
      <FabButton />
    </div>
  );
}
