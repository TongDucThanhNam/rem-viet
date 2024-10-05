import React from "react";
import PostsComponent from "@/components/posts/posts";

export default async function PostsPage() {
  //fetch data from backend
  const res = await fetch(`${process.env.BACKEND_URL}/api/posts`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return <div>Failed to fetch</div>;
  }
  const posts = await res.json();

  //filter product posts
  const productPosts = posts.filter((post: any) => post.status === "published");

  return <PostsComponent productPosts={productPosts} />;
}
