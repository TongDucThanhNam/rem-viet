import { getPageBySlug } from "@rem-viet/api/services/content";
import { resolveRedirect } from "@rem-viet/api/services/operations";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import CmsPageBlocks from "@/components/cms-page-blocks";
import { siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const result = await getCmsPageData({ data: { slug: params.slug } });
    if (result.redirect) {
      throw redirect({
        href: result.redirect.newPath,
        statusCode: result.redirect.statusCode,
      });
    }
    return result.page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: `Page not found - ${siteConfig.name}` },
          { name: "description", content: "Page not found" },
        ],
      };
    }

    const title = `${loaderData.seoTitle || loaderData.title} - ${siteConfig.name}`;
    const description =
      loaderData.seoDescription || `${loaderData.title} - ${siteConfig.name}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        {
          property: "og:image",
          content: loaderData.ogImage || siteConfig.image,
        },
        {
          name: "robots",
          content: `${loaderData.robotsIndex ? "index" : "noindex"}, ${loaderData.robotsFollow ? "follow" : "nofollow"}`,
        },
      ],
      links: [
        {
          rel: "canonical",
          href:
            loaderData.canonicalUrl || `${siteConfig.url}/${loaderData.slug}`,
        },
      ],
    };
  },
  component: CmsPageRoute,
});

const getCmsPageData = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const page = await getPageBySlug({ slug: data.slug, status: "published" });
    if (page) return { page, redirect: null };
    return { page: null, redirect: await resolveRedirect(`/${data.slug}`) };
  });

function CmsPageRoute() {
  const page = Route.useLoaderData();

  if (!page) {
    return (
      <main className="grid min-h-[70svh] place-items-center px-4 py-16">
        <div className="flex max-w-md flex-col items-center gap-3 border bg-background p-8 text-center">
          <FileText aria-hidden className="size-8 text-muted-foreground" />
          <div>
            <h1 className="text-sm font-medium">Không tìm thấy page</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Page này chưa được xuất bản hoặc không tồn tại.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <CmsPageBlocks blocks={page.blocks} />
    </main>
  );
}
