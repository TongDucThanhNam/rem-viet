import { notFound } from "next/navigation";
import PostDetail from "@/components/posts/post-detail";
import { Metadata } from "next"; // Mock data for posts

// Mock data for posts
type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  //remove .html end of params first
  const post = await getPost(params.slug);

  if (post == null) {
    console.log("Post not found");
    return {
      title: "Post not found",
      description: "Post not found",
    };
  }

  return {
    title: post.title,
    description: `This is a blog post about ${params.slug}`,
    openGraph: {
      title: post.title,
      description: `This is a blog post about ${params.slug}`,
      type: "article",
      publishedTime: new Date().toISOString(),
      authors: ["Rem Viet"],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  //fetch data from backend
  const post = await getPost(params.slug);

  if (post == null) {
    console.log("Post not found");
    notFound();
  }

  return <PostDetail myPost={post} />;
}

async function getPost(slug: string) {
  //remove .html end of slug
  const fix_slug = slug ? slug.replace(".html", "") : "";
  // Fetch data from external API
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/posts/${fix_slug}`);
    // Return the post
    const data = await res.json();
    if (res.ok) {
      return data;
    }
    return null;
  } catch (error) {
    console.log("Error fetching post: ", error);
    return null;
  }
}
