import React from "react";

import PostsComponent from "@/components/posts/posts";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  //fetch data from backend
  const res = await fetch(`${process.env.BACKEND_URL}/api/posts`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    next: {
      revalidate: 60 * 60 * 24, // 24 hours
    },
  });

  if (!res.ok) {
    return <div>Failed to fetch</div>;
  }
  const posts = await res.json();

  // console.log(bai-viet);

  //filter san-pham bai-viet
  const productPosts = posts.filter((post: any) => post.status === "published");

  return <PostsComponent productPosts={productPosts} />;
}
