import { Link } from "@tanstack/react-router";

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
    publishDate?: string;
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
    return "/assets/7c9323bc-888a-4cba-b876-f0aa79b35158.png";
  }

  return (
    cloudflareImageUrl(cover) ||
    "/assets/7c9323bc-888a-4cba-b876-f0aa79b35158.png"
  );
}

function postSlug(slug: string) {
  return slug.endsWith(".html") ? slug : `${slug}.html`;
}

export default function PostCard({ post }: PostCardProps) {
  const tags = post.tags ?? [];
  const date = post.publishDate || post.created_time;

  return (
    <article className="group h-full">
      <Link
        className="hover-target block h-full overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.045] text-[var(--text-color)] no-underline outline-none backdrop-blur-[10px] transition-[border-color,background-color,transform] duration-500 hoverable:hover:-translate-y-1 hoverable:hover:border-[color:var(--accent)] hoverable:hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111]"
        data-cursor="Đọc"
        params={{ slug: postSlug(post.slug) }}
        to="/bai-viet/$slug"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
          <img
            alt={`Cover image for ${post.title}`}
            className="size-full object-cover opacity-[0.82] transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100"
            loading="lazy"
            src={coverUrl(post)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/26 to-transparent" />
        </div>

        <div className="flex min-h-[330px] flex-col p-6 max-[640px]:min-h-0">
          <time
            className="font-vietnam text-[11px] tracking-[0.16em] text-[color:color-mix(in_srgb,var(--text-color)_55%,transparent)] uppercase"
            dateTime={date}
          >
            {formatDate(date)}
          </time>

          <h2 className="mt-4 font-playfair text-[clamp(28px,2.8vw,44px)] font-normal leading-[0.98] tracking-normal">
            {post.title}
          </h2>

          {post.description ? (
            <p className="mt-5 line-clamp-4 font-vietnam text-[14px] leading-7 text-[color:color-mix(in_srgb,var(--text-color)_68%,transparent)]">
              {post.description}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 pt-8">
            {tags.slice(0, 4).map((tag, index) => (
              <span
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-vietnam text-[10px] tracking-[0.08em] text-[color:color-mix(in_srgb,var(--text-color)_72%,transparent)] uppercase"
                key={`${tag}-${index}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
