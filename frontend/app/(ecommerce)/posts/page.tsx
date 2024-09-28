import Image from "next/image"
import Link from "next/link"
import {Button, Card, CardBody, CardFooter, CardHeader} from "@nextui-org/react";

// Mock data for product posts
const productPosts = [
    {
        id: 1,
        title: "The Future of Smartphones",
        description: "Exploring upcoming trends in smartphone technology and design.",
        image: "/src/800x800.png",
    },
    {
        id: 2,
        title: "Best Laptops for Developers",
        description: "A comprehensive guide to choosing the perfect laptop for coding.",
        image: "/src/800x800.png",
    },
    {
        id: 3,
        title: "Smart Home Devices Review",
        description: "An in-depth look at the latest smart home gadgets and their features.",
        image: "/src/800x800.png",
    },
    {
        id: 4,
        title: "Gaming Consoles Comparison",
        description: "Comparing the latest gaming consoles to help you choose the best one.",
        image: "/src/800x800.png",
    },
    {
        id: 5,
        title: "Wireless Earbuds Roundup",
        description: "A review of the top wireless earbuds on the market today.",
        image: "/src/800x800.png",
    },
    {
        id: 6,
        title: "The Rise of Foldable Phones",
        description: "Examining the growing trend of foldable smartphones and their potential.",
        image: "/src/800x800.png",
    },
]

export default function PostsPage() {
    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-8 text-center">Product Posts</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productPosts.map((post) => (
                    <Card key={post.id} className="flex flex-col">
                        <CardHeader>
                            <Image
                                src={post.image}
                                alt={post.title}
                                width={300}
                                height={200}
                                className="rounded-t-lg object-cover w-full h-[200px]"
                            />
                        </CardHeader>
                        <CardBody className="flex-grow">
                            <h1 className="mb-2">{post.title}</h1>
                            <p className="text-muted-foreground">{post.description}</p>
                        </CardBody>
                        <CardFooter>
                            <Button className="w-full">
                                <Link href={`/posts/${post.id}`}>Read More</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
}