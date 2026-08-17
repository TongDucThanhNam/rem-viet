import { getPageBySlug, getSiteSettings } from "@rem-viet/api/services/content";
import { homeBlockSchema } from "@rem-viet/cms";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { HomepageRenderer } from "@/components/landing/homepage-renderer";
import { siteConfig, siteManifest } from "@/lib/site-config";
import {
  buildOrganizationStructuredData,
  serializeStructuredData,
} from "@/lib/structured-data";

export const Route = createFileRoute("/")({
  loader: () => getHomePageData(),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.seoTitle || siteConfig.name },
      {
        name: "description",
        content: loaderData?.seoDescription || siteConfig.description,
      },
      {
        name: "robots",
        content: `${loaderData?.robotsIndex === false ? "noindex" : "index"}, ${loaderData?.robotsFollow === false ? "nofollow" : "follow"}`,
      },
      {
        property: "og:title",
        content: loaderData?.seoTitle || siteConfig.name,
      },
      {
        property: "og:description",
        content: loaderData?.seoDescription || siteConfig.description,
      },
      {
        property: "og:image",
        content: loaderData?.ogImage || siteConfig.image,
      },
    ],
    links: [
      { rel: "canonical", href: loaderData?.canonicalUrl || siteConfig.url },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: serializeStructuredData(
          buildOrganizationStructuredData(
            siteManifest,
            loaderData?.siteSettings,
          ),
        ),
      },
    ],
  }),
  component: HomeComponent,
});

const getHomePageData = createServerFn({ method: "GET" }).handler(async () => {
  const [page, siteSettings] = await Promise.all([
    getPageBySlug({ slug: "home", status: "published" }),
    getSiteSettings(),
  ]);
  if (!page) {
    throw new Error("Published homepage is unavailable.");
  }

  return {
    blocks: homeBlockSchema.array().parse(page.blocks),
    source: "cms" as const,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    canonicalUrl: page.canonicalUrl,
    ogImage: page.ogImage,
    robotsIndex: page.robotsIndex,
    robotsFollow: page.robotsFollow,
    siteSettings: {
      address: siteSettings.address,
      logo: siteSettings.logo,
      phone: siteSettings.phone,
      socials: siteSettings.socials,
    },
  };
});

function HomeComponent() {
  const content = Route.useLoaderData();
  return <HomepageRenderer blocks={content.blocks} />;
}
