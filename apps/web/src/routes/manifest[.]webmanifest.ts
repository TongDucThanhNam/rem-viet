import { createFileRoute } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          name: siteConfig.name,
          short_name: siteConfig.name,
          description: siteConfig.description,
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#4a90e2",
          icons: [
            {
              src: "/src/icon-192x192.webp",
              sizes: "192x192",
              type: "image/webp",
            },
            {
              src: "/src/icon-256x256.webp",
              sizes: "256x256",
              type: "image/webp",
            },
            {
              src: "/src/icon-384x384.webp",
              sizes: "384x384",
              type: "image/webp",
            },
            {
              src: "/src/icon-512x512.webp",
              sizes: "512x512",
              type: "image/webp",
            },
          ],
          categories: ["shopping", "home", "lifestyle"],
          orientation: "any",
          lang: "vi-VN",
          prefer_related_applications: false,
        }),
    },
  },
});
