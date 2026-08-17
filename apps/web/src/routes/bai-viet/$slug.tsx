import { getPostBySlug } from "@rem-viet/api/services/posts";
import { resolveRedirect } from "@rem-viet/api/services/operations";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import type { CSSProperties } from "react";

import { Navigation } from "@/components/landing/navigation";
import PostContent from "@/components/post-content";
import { cloudflareImageUrl, siteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/bai-viet/$slug")({
  loader: async ({ params }) => {
    const result = await getPostPageData({ data: { slug: params.slug } });
    if (result.redirect) {
      throw redirect({
        href: result.redirect.newPath,
        statusCode: result.redirect.statusCode,
      });
    }
    return result.post;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: `Post not found - ${siteConfig.name}` },
          { name: "description", content: "Post not found" },
        ],
      };
    }

    const title = `${loaderData.seoTitle || loaderData.title} - ${siteConfig.name}`;
    const description =
      loaderData.seoDescription ||
      loaderData.description ||
      `This is a blog post about ${loaderData.slug}`;
    const image =
      loaderData.ogImage || loaderData.coverImage
        ? cloudflareImageUrl(loaderData.ogImage || loaderData.coverImage)
        : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        {
          name: "robots",
          content: `${loaderData.robotsIndex ? "index" : "noindex"}, ${loaderData.robotsFollow ? "follow" : "nofollow"}`,
        },
        ...(loaderData.publishDate
          ? [
              {
                property: "article:published_time",
                content: loaderData.publishDate,
              },
            ]
          : []),
        { property: "article:author", content: siteConfig.name },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:width", content: "800" },
              { property: "og:image:height", content: "600" },
              { property: "og:image:alt", content: loaderData.title },
            ]
          : []),
      ],
      links: [
        {
          rel: "canonical",
          href:
            loaderData.canonicalUrl ||
            `${siteConfig.url}/bai-viet/${loaderData.slug}`,
        },
      ],
    };
  },
  component: PostDetailRoute,
});

const getPostPageData = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const post = await getPostBySlug({ slug: data.slug, status: "published" });
    if (post) return { post, redirect: null };
    const requestedPath = `/bai-viet/${data.slug}`;
    const exactRedirect = await resolveRedirect(requestedPath);
    const canonicalRedirect = data.slug.endsWith(".html")
      ? await resolveRedirect(
          `/bai-viet/${data.slug.slice(0, -".html".length)}`,
        )
      : null;

    return {
      post: null,
      redirect: exactRedirect ?? canonicalRedirect,
    };
  });

const blogThemeStyle = {
  "--bg-color": "#111111",
  "--text-color": "#F8F5EF",
  "--accent": "#D6BB82",
  "--accent-soft": "#E2C896",
} as CSSProperties;

function formatDate(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PostDetailRoute() {
  const post = Route.useLoaderData();
  const publishedAt = post?.publishDate || post?.created_time;
  const coverImage = post?.coverImage
    ? cloudflareImageUrl(post.coverImage)
    : "";

  return (
    <main
      className="relative min-h-svh overflow-hidden bg-[#111] text-[#F8F5EF]"
      style={blogThemeStyle}
    >
      <Navigation sectionHrefPrefix="/" />
      <div className="noise-overlay" />
      <div className="vignette-overlay" />

      <article className="relative z-10 mx-auto max-w-[1180px] px-[4vw] pb-28 pt-[18vh]">
        <Link
          className="hover-target inline-flex items-center gap-3 font-vietnam text-[11px] tracking-[0.18em] text-[var(--accent)] uppercase no-underline transition-opacity hoverable:hover:opacity-70"
          data-cursor="Trở lại"
          to="/bai-viet"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Bài viết
        </Link>

        {post ? (
          <>
            <header className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.62fr)_minmax(320px,0.38fr)] lg:items-end">
              <div>
                <p className="font-vietnam text-[11px] tracking-[0.22em] text-[color:color-mix(in_srgb,var(--text-color)_60%,transparent)] uppercase">
                  {publishedAt ? formatDate(publishedAt) : siteConfig.name}
                </p>
                <div className="mt-5 h-px w-14 bg-[var(--accent)]" />
                <h1 className="mt-9 font-playfair text-[clamp(48px,7vw,104px)] font-normal leading-[0.9] tracking-normal text-[var(--text-color)]">
                  {post.title}
                </h1>
                {post.description ? (
                  <p className="mt-8 max-w-[720px] font-vietnam text-[17px] leading-8 text-[color:color-mix(in_srgb,var(--text-color)_70%,transparent)]">
                    {post.description}
                  </p>
                ) : null}
              </div>

              {coverImage ? (
                <div className="aspect-[4/5] overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.04]">
                  <img
                    alt={`Cover image for ${post.title}`}
                    className="size-full object-cover opacity-90"
                    src={coverImage}
                  />
                </div>
              ) : null}
            </header>

            <div className="mt-10 flex flex-wrap items-center gap-3 border-y border-white/12 py-5">
              {post.tags?.map((tag, index) => (
                <span
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-vietnam text-[10px] tracking-[0.08em] text-[color:color-mix(in_srgb,var(--text-color)_72%,transparent)] uppercase"
                  key={`${tag}-${index}`}
                >
                  {tag}
                </span>
              ))}
              {post.lastEditedTime ? (
                <span className="ml-auto font-vietnam text-[11px] tracking-[0.08em] text-[color:color-mix(in_srgb,var(--text-color)_50%,transparent)] uppercase max-[640px]:ml-0">
                  Cập nhật: {formatDate(post.lastEditedTime)}
                </span>
              ) : null}
            </div>

            <section className="mt-14">
              <div className="mx-auto max-w-[760px]">
                <PostContent content={post.content} />
              </div>
            </section>
          </>
        ) : (
          <div className="mt-14 flex min-h-80 flex-col items-center justify-center gap-4 rounded-[8px] border border-white/12 bg-white/[0.035] text-center backdrop-blur-[10px]">
            <FileText aria-hidden className="size-8 text-[var(--accent)]" />
            <div>
              <h1 className="font-vietnam text-sm font-medium tracking-[0.08em] uppercase">
                Không tìm thấy bài viết
              </h1>
              <p className="mt-2 font-vietnam text-xs text-[color:color-mix(in_srgb,var(--text-color)_58%,transparent)]">
                Bài viết này chưa được xuất bản.
              </p>
            </div>
          </div>
        )}
      </article>
    </main>
  );
}
