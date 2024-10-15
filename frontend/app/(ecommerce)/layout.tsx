// import "@/styles/globals.css";
import { Metadata } from "next";
import React, { Suspense } from "react";

import { siteConfig } from "@/config/site";
import dynamic from "next/dynamic";

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

const NavbarDynamic = dynamic(
  () => import("@/components/my-navbar/my-navbar"),
  {
    ssr: false,
    loading: () => <p>Navbar Loading</p>,
  },
);

const FABButton = dynamic(() => import("@/components/button/fab-button"), {
  ssr: false,
  loading: () => <p>Loading</p>,
});

export default async function EcomerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={"flex flex-col h-screen max-w-screen"}>
      <NavbarDynamic />
      <main className={"flex-grow"}>{children}</main>
      <FABButton />
    </div>
  );
}
