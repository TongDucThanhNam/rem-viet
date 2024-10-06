"use client";

import { Skeleton } from "@nextui-org/react";
import React from "react";
import PostCard from "@/components/posts/post-card";

export default function PostsComponent({
  productPosts,
}: {
  productPosts: any;
}) {
  //isLoading
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(false);
  }, [productPosts]);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Danh sách bài viết
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {productPosts.map((post: any) =>
          isLoading ? (
            <Skeleton key={post.id} />
          ) : (
            <PostCard post={post} key={post.id} />
          ),
        )}
      </div>
    </div>
  );
}
