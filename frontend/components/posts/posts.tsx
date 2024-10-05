"use client";

import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Image,
} from "@nextui-org/react";
import Link from "next/link";
import { AnchorIcon } from "@nextui-org/shared-icons";
import React from "react";
import { useRouter } from "next/navigation";

export default function PostsComponent({
  productPosts,
}: {
  productPosts: any;
}) {
  const router = useRouter();

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">Danh sách bài viết</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {productPosts.map((post: any) => (
          <Card
            isFooterBlurred={true}
            key={post.id}
            className={"relative overflow-hidden group"}
            isPressable={true}
            onPress={() => {
              router.push(`/posts/${post.slug}`);
            }}
          >
            <div className="relative w-full h-48">
              <Image
                className="z-0 object-cover rounded-t-xl"
                src={post.cover}
                alt={`Cover image for ${post.title}`}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />
            <CardHeader className="text-center">
              <div className="absolute inset-0 flex flex-col p-4">
                <h2 className="text-2xl font-bold mb-2 text-white drop-shadow-md">
                  <Link
                    href={`/posts/${post.slug}`}
                    className="outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded"
                  >
                    {post.title}
                  </Link>
                </h2>
              </div>
            </CardHeader>
            <CardBody className="p-4">
              <p className=" font-bold text-white drop-shadow-md mb-4">
                {post.description}
              </p>
              <div className="flex items-center text-sm text-white mb-2">
                <AnchorIcon className="mr-2 h-4 w-4" />
                <time dateTime={post.created_time}>
                  {new Date(post.created_time).toLocaleDateString("vi-Vi", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
              <div className="flex flex-wrap gap-2">
                <AnchorIcon className="h-4 w-4 text-white" />
                {post.tags.map((tag: any) => (
                  <p key={tag} className={"text-white"}>
                    {tag}
                  </p>
                ))}
              </div>
            </CardBody>
            <CardFooter className="p-4">
              <span className="ml-auto text-sm text-white">
                Last edited:{" "}
                {new Date(post.last_edited_time).toLocaleDateString()}
              </span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
