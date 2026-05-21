import { getPostBySlug } from "@rem-viet/api/services/posts";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Anchor, FileText } from "lucide-react";

import PostContent from "@/components/post-content";
import { cloudflareImageUrl } from "@/lib/site-config";

export const Route = createFileRoute("/bai-viet/$slug")({
  loader: ({ params }) => getPostPageData({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Post not found - Rèm Việt" },
          { name: "description", content: "Post not found" },
        ],
      };
    }

    const title = `${loaderData.title} - Rèm Việt`;
    const description =
      loaderData.description || `This is a blog post about ${loaderData.slug}`;
    const image = loaderData.coverImage
      ? cloudflareImageUrl(loaderData.coverImage)
      : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        ...(loaderData.publishDate
          ? [
              {
                property: "article:published_time",
                content: loaderData.publishDate,
              },
            ]
          : []),
        { property: "article:author", content: "Rem Viet" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:width", content: "800" },
              { property: "og:image:height", content: "600" },
              { property: "og:image:alt", content: loaderData.title },
            ]
          : []),
      ],
    };
  },
  component: PostDetailRoute,
});

const getPostPageData = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    return getPostBySlug({ slug: data.slug, status: "published" });
  });

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

  return (
    <main>
      <section className="container mx-auto px-4 py-8">
        {post ? (
          <article className="mx-auto max-w-3xl">
            {post.coverImage ? (
              <div className="relative h-96 overflow-hidden bg-muted">
                <img
                  alt={`Cover image for ${post.title}`}
                  className="size-full object-cover"
                  src={cloudflareImageUrl(post.coverImage)}
                />
              </div>
            ) : null}

            <h1 className="mt-6 text-4xl font-bold tracking-normal md:text-5xl">
              {post.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <time
                className="inline-flex items-center gap-2"
                dateTime={post.publishDate || post.created_time}
              >
                <Anchor aria-hidden className="size-4" />
                Xuất bản lúc:{" "}
                {formatDate(post.publishDate || post.created_time)}
              </time>
              {post.lastEditedTime ? (
                <span className="inline-flex items-center gap-2">
                  <Anchor aria-hidden className="size-4" />
                  Cập nhật lúc: {formatDate(post.lastEditedTime)}
                </span>
              ) : null}
            </div>

            {post.description ? (
              <p className="mb-8 mt-6 text-xl leading-8">{post.description}</p>
            ) : null}

            {post.tags?.length ? (
              <div className="mb-8 flex flex-wrap gap-2">
                {post.tags.map((tag, index) => {
                  const tone =
                    index % 4 === 0
                      ? "bg-primary text-primary-foreground"
                      : index % 4 === 1
                        ? "bg-emerald-500 text-white"
                        : index % 4 === 2
                          ? "bg-yellow-400 text-yellow-950"
                          : "bg-red-500 text-white";

                  return (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}
                      key={`${tag}-${index}`}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            ) : null}

            <section className="prose max-w-none">
              <PostContent content={post.content} />
            </section>
          </article>
        ) : (
          <div className="mt-6 flex min-h-80 flex-col items-center justify-center gap-3 border text-center">
            <FileText aria-hidden className="size-8 text-muted-foreground" />
            <div>
              <h1 className="text-sm font-medium">Không tìm thấy bài viết</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Bài viết này chưa được xuất bản.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
