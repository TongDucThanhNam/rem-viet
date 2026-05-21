import { Link } from "@tanstack/react-router";
import { useState, type MouseEvent, type ReactNode } from "react";

import { cloudflareImageUrl } from "@/lib/site-config";

type PostCardProps = {
  post: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    cover?: string;
    coverImage?: string;
    tags?: string[];
    created_time?: string;
    last_edited_time?: string;
  };
};

function formatDate(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function coverUrl(post: PostCardProps["post"]) {
  const cover = post.coverImage || post.cover;

  if (!cover) {
    return "/src/heroimage.webp";
  }

  return cloudflareImageUrl(cover) || "/src/heroimage.webp";
}

function postSlug(slug: string) {
  return slug.endsWith(".html") ? slug : `${slug}.html`;
}

export default function PostCard({ post }: PostCardProps) {
  const tags = post.tags ?? [];

  return (
    <WobbleFrame>
      <Link
        className="group relative block min-h-full overflow-hidden rounded-xl bg-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        params={{ slug: postSlug(post.slug) }}
        to="/bai-viet/$slug"
      >
        <div className="relative h-48 w-full overflow-hidden">
          <img
            alt={`Cover image for ${post.title}`}
            className="size-full rounded-t-xl object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            src={coverUrl(post)}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />

        <div className="absolute inset-x-0 top-0 p-4 text-center">
          <h2 className="text-2xl font-bold tracking-normal text-white drop-shadow-md">
            <span>{post.title}</span>
          </h2>
        </div>

        <div className="relative p-4 text-white">
          {post.description ? (
            <p className="mb-4 font-bold drop-shadow-md">
              {post.description}
            </p>
          ) : null}

          <div className="mb-2 flex items-center text-sm">
            <time dateTime={post.created_time}>
              {formatDate(post.created_time)}
            </time>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => {
              const tone =
                index === 0
                  ? "bg-primary text-primary-foreground"
                  : index === 1
                    ? "bg-emerald-500 text-white"
                    : index === 2
                      ? "bg-yellow-400 text-yellow-950"
                      : "bg-red-500 text-white";

              return (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
                  key={`${tag}-${index}`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        </div>

        {post.last_edited_time ? (
          <div className="relative p-4 pt-0 text-right text-sm text-white">
            <span>Cập nhật lúc : {formatDate(post.last_edited_time)}</span>
          </div>
        ) : null}
      </Link>
    </WobbleFrame>
  );
}

function WobbleFrame({ children }: { children: ReactNode }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  function handleMouseMove(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - (rect.left + rect.width / 2)) / 20;
    const y = (event.clientY - (rect.top + rect.height / 2)) / 20;

    setMousePosition({ x, y });
  }

  function resetMousePosition() {
    setIsHovering(false);
    setMousePosition({ x: 0, y: 0 });
  }

  return (
    <section
      className="relative mx-auto h-full w-full overflow-hidden rounded-2xl bg-muted/70 motion-reduce:transform-none"
      style={{
        transform: isHovering
          ? `translate3d(${mousePosition.x}px, ${mousePosition.y}px, 0)`
          : "translate3d(0, 0, 0)",
        transition: "transform 100ms ease-out",
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={resetMousePosition}
      onMouseMove={handleMouseMove}
    >
      <div
        className="relative h-full overflow-hidden rounded-2xl [background-image:radial-gradient(88%_100%_at_top,rgba(255,255,255,0.5),rgba(255,255,255,0))]"
        style={{
          boxShadow:
            "0 10px 32px rgba(34, 42, 53, 0.12), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.05), 0 4px 6px rgba(34, 42, 53, 0.08), 0 24px 108px rgba(47, 48, 55, 0.10)",
        }}
      >
        <div
          className="relative h-full p-0"
          style={{
            transform: isHovering
              ? `translate3d(${-mousePosition.x}px, ${-mousePosition.y}px, 0) scale3d(1.03, 1.03, 1)`
              : "translate3d(0, 0, 0) scale3d(1, 1, 1)",
            transition: "transform 100ms ease-out",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 z-10 scale-[1.2] opacity-10 [mask-image:radial-gradient(#fff,transparent,75%)]"
            style={{
              backgroundImage: "url(/src/noise.webp)",
              backgroundSize: "30%",
            }}
          />
          {children}
        </div>
      </div>
    </section>
  );
}
