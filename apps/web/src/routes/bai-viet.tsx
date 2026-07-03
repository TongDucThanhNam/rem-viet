import { listPosts } from "@rem-viet/api/services/posts";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import type { CSSProperties } from "react";

import { Navigation } from "@/components/landing/navigation";
import PostCard from "@/components/post-card";

export const Route = createFileRoute("/bai-viet")({
  loader: () => getPostsPageData(),
  head: () => ({
    meta: [
      { title: "Danh sách bài viết - Rèm Vina" },
      {
        name: "description",
        content:
          "Các bài viết tư vấn về rèm cửa, lưới chống muỗi và giải pháp cho nhà ở từ Rèm Vina.",
      },
    ],
  }),
  component: PostsRoute,
});

const getPostsPageData = createServerFn({ method: "GET" }).handler(async () => {
  return listPosts({ status: "published" });
});

const blogThemeStyle = {
  "--bg-color": "#111111",
  "--text-color": "#F8F5EF",
  "--accent": "#D6BB82",
  "--accent-soft": "#E2C896",
} as CSSProperties;

function PostsRoute() {
  const posts = Route.useLoaderData();
  const postCount = posts.length.toString().padStart(2, "0");

  return (
    <main
      className="relative min-h-svh overflow-hidden bg-[#111] text-[#F8F5EF]"
      style={blogThemeStyle}
    >
      <Navigation sectionHrefPrefix="/" />
      <div className="noise-overlay" />
      <div className="vignette-overlay" />

      <section className="relative z-10 px-[4vw] pb-24 pt-[18vh]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.76fr)_minmax(240px,0.24fr)] lg:items-end">
          <div>
            <p className="font-vietnam text-[11px] tracking-[0.22em] text-[color:color-mix(in_srgb,var(--text-color)_64%,transparent)] uppercase">
              ({postCount}) Bài viết
            </p>
            <div className="mt-5 h-px w-14 bg-[var(--accent)]" />
            <h1 className="mt-10 max-w-[1120px] font-playfair text-[clamp(58px,10vw,150px)] font-normal leading-[0.84] tracking-normal text-[var(--text-color)]">
              Lưới chống muỗi
              <br />
              <span className="italic text-[var(--accent)]">
                nhìn từ thực tế.
              </span>
            </h1>
          </div>

          <p className="max-w-[420px] font-vietnam text-[15px] leading-7 text-[color:color-mix(in_srgb,var(--text-color)_68%,transparent)] lg:pb-4">
            Các ghi chú thực dụng về lựa chọn vật liệu, đo kích thước, bảo trì
            và thi công lưới chống muỗi may đo cho căn hộ, cửa sổ và cửa đi.
          </p>
        </div>

        {posts.length ? (
          <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="mt-16 flex min-h-80 flex-col items-center justify-center gap-4 rounded-[8px] border border-white/12 bg-white/[0.035] text-center backdrop-blur-[10px]">
            <PackageSearch
              aria-hidden
              className="size-8 text-[var(--accent)]"
            />
            <div>
              <h2 className="font-vietnam text-sm font-medium tracking-[0.08em] uppercase">
                Chưa có bài viết
              </h2>
              <p className="mt-2 font-vietnam text-xs text-[color:color-mix(in_srgb,var(--text-color)_58%,transparent)]">
                Các bài đã xuất bản sẽ hiển thị tại đây.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
