import { listPosts } from "@rem-viet/api/services/posts";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";

import PostCard from "@/components/post-card";

export const Route = createFileRoute("/bai-viet")({
  loader: () => getPostsPageData(),
  head: () => ({
    meta: [
      { title: "Danh sách bài viết - Rèm Việt" },
      {
        name: "description",
        content:
          "Các bài viết tư vấn về rèm cửa, lưới chống muỗi và giải pháp cho nhà ở từ Rèm Việt.",
      },
    ],
  }),
  component: PostsRoute,
});

const getPostsPageData = createServerFn({ method: "GET" }).handler(async () => {
  return listPosts({ status: "published" });
});

function PostsRoute() {
  const posts = Route.useLoaderData();

  return (
    <main>
      <section className="flex min-h-[calc(100svh-4rem)] items-center justify-center p-4">
        <div className="h-full w-full max-w-[96rem] px-2 lg:px-24">
          <div className="container mx-auto py-10">
            <h1 className="mb-8 text-center text-3xl font-bold tracking-normal">
              Danh sách bài viết
            </h1>

            {posts.length ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 border text-center">
                <PackageSearch
                  aria-hidden
                  className="size-8 text-muted-foreground"
                />
                <div>
                  <h2 className="text-sm font-medium">Chưa có bài viết</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Các bài đã xuất bản sẽ hiển thị tại đây.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
