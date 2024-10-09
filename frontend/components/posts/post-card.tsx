import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Image,
} from "@nextui-org/react";
import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";

// eslint-disable-next-line react/display-name
const PostCard = React.memo(({ post }: { post: any }) => {
  const router = useRouter();

  return (
    <Card
      isFooterBlurred={true}
      key={post.id}
      className={"relative overflow-hidden group"}
      isPressable={true}
      onPress={() => {
        router.push(`/bai-viet/${post.slug}.html`);
      }}
    >
      <div className="relative w-full h-48">
        <Image
          className="z-0 object-cover rounded-t-xl"
          src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${post.cover}`}
          alt={`Cover image for ${post.title}`}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />
      <CardHeader className="text-center">
        <div className="absolute inset-0 flex flex-col p-4">
          <h2 className="text-2xl font-bold mb-2 text-white drop-shadow-md">
            <Link
              href={`/bai-viet/${post.slug}.html`}
              className="outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded"
            >
              {post.title}
            </Link>
          </h2>
        </div>
      </CardHeader>
      <CardBody className="p-4">
        <p className="font-bold text-white drop-shadow-md mb-4">
          {post.description}
        </p>
        <div className="flex items-center text-sm text-white mb-2">
          <time dateTime={post.created_time}>
            {new Date(post.created_time).toLocaleDateString("vi-Vi", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag: any, index: number) => (
            <Chip
              color={
                index === 0
                  ? "primary"
                  : index === 1
                    ? "success"
                    : index === 2
                      ? "warning"
                      : "danger"
              }
              key={tag}
            >
              {tag}
            </Chip>
          ))}
        </div>
      </CardBody>
      <CardFooter className="p-4">
        <span className="ml-auto text-sm text-white">
          Cập nhật lúc : {new Date(post.last_edited_time).toLocaleDateString()}
        </span>
      </CardFooter>
    </Card>
  );
});

export default PostCard;
