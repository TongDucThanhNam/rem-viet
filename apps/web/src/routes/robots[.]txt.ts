import { createFileRoute } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          [
            "User-agent: *",
            "Allow: /",
            `Sitemap: ${siteConfig.url}/sitemap.xml`,
            `Host: ${siteConfig.url}`,
            "",
          ].join("\n"),
          {
            headers: {
              "content-type": "text/plain; charset=utf-8",
            },
          },
        ),
    },
  },
});
