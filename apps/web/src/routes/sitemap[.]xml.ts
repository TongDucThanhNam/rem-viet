import { listPosts } from "@rem-viet/api/services/posts";
import { listProducts } from "@rem-viet/api/services/products";
import { createFileRoute } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config";

type SitemapEntry = {
  url: string;
  lastModified?: string;
  changeFrequency?: "daily" | "weekly";
  priority?: number;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sitemapXml(entries: SitemapEntry[]) {
  const urls = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>`
        : "";
      const changeFrequency = entry.changeFrequency
        ? `<changefreq>${entry.changeFrequency}</changefreq>`
        : "";
      const priority =
        entry.priority === undefined
          ? ""
          : `<priority>${entry.priority}</priority>`;

      return `<url><loc>${escapeXml(entry.url)}</loc>${lastModified}${changeFrequency}${priority}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [productResult, posts] = await Promise.all([
          listProducts({
            sort: "updatedAt",
            order: "desc",
          }),
          listPosts({ status: "published" }),
        ]);

        const entries: SitemapEntry[] = [
          {
            url: siteConfig.url,
            lastModified: new Date().toISOString(),
            changeFrequency: "weekly",
            priority: 1,
          },
          {
            url: `${siteConfig.url}/danh-sach-san-pham`,
            lastModified: new Date().toISOString(),
            changeFrequency: "weekly",
            priority: 0.9,
          },
          {
            url: `${siteConfig.url}/san-pham`,
            lastModified: new Date().toISOString(),
            changeFrequency: "weekly",
            priority: 0.9,
          },
          {
            url: `${siteConfig.url}/gioi-thieu`,
            lastModified: new Date().toISOString(),
            changeFrequency: "weekly",
            priority: 0.8,
          },
          ...productResult.data.map((product) => ({
            url: `${siteConfig.url}/san-pham/${product._id}`,
            lastModified: product.updatedAt,
            changeFrequency: "weekly" as const,
            priority: 0.5,
          })),
          ...posts.map((post) => ({
            url: `${siteConfig.url}/bai-viet/${post.slug}.html`,
            lastModified: post.last_edited_time,
            changeFrequency: "daily" as const,
            priority: 0.8,
          })),
        ];

        return new Response(sitemapXml(entries), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
          },
        });
      },
    },
  },
});
