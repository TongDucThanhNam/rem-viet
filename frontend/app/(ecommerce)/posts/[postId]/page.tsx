import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {Button, Card, CardBody, CardFooter, CardHeader} from "@nextui-org/react";

// Mock data for posts
const posts = [
    {
        id: "1",
        title: "The Future of Web Development",
        author: "Jane Doe",
        date: "2023-09-15",
        content: "Web development is rapidly evolving with new technologies emerging every day. From serverless architectures to AI-powered development tools, the landscape is changing faster than ever. In this post, we'll explore some of the most exciting trends that are shaping the future of web development.",
        image: "/src/800x800.png",
    },
    {
        id: "2",
        title: "Mastering React Hooks",
        author: "John Smith",
        date: "2023-09-10",
        content: "React Hooks have revolutionized the way we write React components. They allow us to use state and other React features without writing a class. In this comprehensive guide, we'll dive deep into the world of React Hooks, exploring everything from useState and useEffect to creating your own custom hooks.",
        image: "/src/800x800.png",
    },
]

export default function PostPage({ params }: { params: { postId: string } }) {
    const post = posts.find(p => p.id === params.postId)

    if (!post) {
        notFound()
    }

    return (
        <div className="container mx-auto py-10 px-4">
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <Image
                        src={post.image}
                        alt={post.title}
                        width={800}
                        height={400}
                        className="rounded-lg object-cover w-full h-[400px]"
                    />
                </CardHeader>
                <CardBody className="space-y-4">
                    <h1 className="text-3xl">{post.title}</h1>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>By {post.author}</span>
                        <time dateTime={post.date}>{new Date(post.date).toLocaleDateString()}</time>
                    </div>
                    <div className="prose max-w-none dark:prose-invert">
                        <p>{post.content}</p>
                    </div>
                </CardBody>
                <CardFooter>
                    <Button>
                        <Link href={"/posts"} >Back to Posts</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}