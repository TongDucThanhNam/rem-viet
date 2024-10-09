// app/admin/layout.tsx
import { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import React from "react";

export const metadata: Metadata = {
  title: {
    default: "Bài viết",
    template: `%s - ${siteConfig.name}`,
  },
  description: "Danh sách các bài viết",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.image,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <main>
        <section className="flex items-center h-screen justify-center p-4">
          <div className="max-w-8xl h-full w-full px-2 lg:px-24">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
