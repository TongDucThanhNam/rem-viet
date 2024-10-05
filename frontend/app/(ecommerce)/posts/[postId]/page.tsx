import { notFound } from "next/navigation";
import PostDetail from "@/components/posts/post-detail";
import { Metadata } from "next";

// Mock data for posts
type Props = {
  params: { postId: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.postId);

  console.log("Post: ", post);

  return {
    title: post.title,
    description: `This is a blog post about ${params.postId}`,
    openGraph: {
      title: post.title,
      description: `This is a blog post about ${params.postId}`,
      type: "article",
      publishedTime: new Date().toISOString(),
      authors: ["Rem Viet"],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: { postId: string };
}) {
  //fetch data from backend
    const post = await getPost(params.postId);

  if (!post) {
    notFound();
  }

  return <PostDetail myPost={post} />;
}

async function getPost(slug: string) {
  // Fetch data from external API
  const res = await fetch(`${process.env.BACKEND_URL}/api/posts/${slug}`);
  // Return the post
  return await res.json();
}