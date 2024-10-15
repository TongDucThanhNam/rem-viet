"use client";

import { Chip, Image, Link, Snippet } from "@nextui-org/react";
import { AnchorIcon } from "@nextui-org/shared-icons";
import { YouTubeEmbed } from "@next/third-parties/google";
import { memo } from "react";

import EnhancedBookmark from "@/components/posts/bookmark";
import NextImage from "next/image";

const TextBlock = memo(({ text }: { text: any }) => (
  <span
    className={`
      ${text.annotations.strikethrough ? "line-through" : ""}
      ${text.annotations.underline ? "underline" : ""}
      ${text.annotations.bold ? "font-bold" : ""}
      ${text.annotations.italic ? "italic" : ""}
      ${text.annotations.code ? "bg-yellow-200 dark:bg-yellow-800 px-1 rounded" : ""}
      ${text.annotations.color !== "default" ? `text-${text.annotations.color}` : ""}
    `}
  >
    {text.href ? (
      <Link href={text.href} rel="noopener noreferrer" target="_blank">
        {text.text.content}
      </Link>
    ) : (
      text.plain_text
    )}
  </span>
));

TextBlock.displayName = "TextBlock";

const ImageBlock = memo(({ block }: { block: any }) => (
  <figure className="my-8">
    <div className="relative h-96">
      {block.image.type === "file" ? (
        <Image src={block.image.file.url} alt="User avatar" />
      ) : (
        <NextImage
          src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${block.image[block.image.type].url}`}
          alt={block.image.caption[0]?.plain_text || "Blog post image"}
          priority
          fill
          className="rounded-lg shadow-md object-cover"
        />
      )}
    </div>
    {block.image.caption[0]?.plain_text && (
      <figcaption className="mt-2 text-center text-sm text-gray-500">
        {block.image.caption[0].plain_text}
      </figcaption>
    )}
  </figure>
));

ImageBlock.displayName = "ImageBlock";

const HeadingBlock = memo(
  ({ block, level }: { block: any; level: 1 | 2 | 3 }) => {
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    const className = {
      1: "text-4xl md:text-5xl font-bold mt-12 mb-6",
      2: "text-3xl md:text-4xl font-semibold mt-10 mb-5",
      3: "text-2xl md:text-3xl font-medium mt-8 mb-4",
    }[level];

    return (
      <Tag className={`${className} text-primary`}>
        {block[`heading_${level}`].rich_text.map((text: any, index: number) => (
          <span key={index}>{text.plain_text}</span>
        ))}
      </Tag>
    );
  },
);

HeadingBlock.displayName = "HeadingBlock";

const ListBlock = memo(
  ({ block, type }: { block: any; type: "numbered" | "bulleted" }) => {
    const Tag = type === "numbered" ? "ol" : "ul";
    const className = `list-${type === "numbered" ? "decimal" : "disc"} list-inside mb-6 pl-4 space-y-2`;

    return (
      <Tag className={className}>
        {block[`${type}_list_item`].rich_text.map(
          (text: any, index: number) => (
            <li key={index}>
              <TextBlock text={text} />
            </li>
          ),
        )}
      </Tag>
    );
  },
);

ListBlock.displayName = "ListBlock";

const CodeBlock = memo(({ block }: { block: any }) => (
  <Snippet className="my-6 p-4 rounded-lg w-full md:w-auto text-sm md:text-base">
    <pre className="whitespace-pre-wrap break-words">
      {block.code.rich_text.map((text: any) =>
        text.plain_text.split("\n").map((line: string, index: number) => (
          <span key={index}>
            {line}
            <br />
          </span>
        )),
      )}
    </pre>
  </Snippet>
));

CodeBlock.displayName = "CodeBlock";

const PostDetail = ({ myPost }: { myPost: any }) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="relative h-96">
          <NextImage
            src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${myPost.coverImage}`}
            alt={`Cover image for ${myPost.title}`}
            priority
            fill
            className="object-cover"
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">{myPost.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
          <time dateTime={myPost.created_time} className="flex items-center">
            <AnchorIcon className="mr-2 h-4 w-4" />
            Xuất bản lúc:{" "}
            {new Date(myPost.publishDate).toLocaleDateString("vi-Vi", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span className="flex items-center">
            <AnchorIcon className="mr-2 h-4 w-4" />
            Cập nhật lúc: {new Date(myPost.lastEditedTime).toLocaleDateString()}
          </span>
        </div>
        <p className="text-xl mb-8">{myPost.description}</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {myPost.tags.map((tag: string, index: number) => (
            <Chip
              key={tag}
              color={
                ["primary", "success", "warning", "danger"][index % 4] as any
              }
            >
              {tag}
            </Chip>
          ))}
        </div>
        <div className="prose max-w-none">
          {myPost.content.map((block: any) => {
            switch (block.type) {
              case "paragraph":
                return block.paragraph.rich_text.length === 0 ? (
                  <div key={block.id} aria-hidden="true" className="h-4" />
                ) : (
                  <p
                    key={block.id}
                    className={`text-${block.paragraph.color} leading-relaxed`}
                  >
                    {block.paragraph.rich_text.map(
                      (text: any, index: number) => (
                        <TextBlock key={index} text={text} />
                      ),
                    )}
                  </p>
                );
              case "image":
                return <ImageBlock key={block.id} block={block} />;
              case "heading_1":
              case "heading_2":
              case "heading_3":
                return (
                  <HeadingBlock
                    key={block.id}
                    block={block}
                    level={parseInt(block.type.split("_")[1]) as 1 | 2 | 3}
                  />
                );
              case "numbered_list_item":
              case "bulleted_list_item":
                return (
                  <ListBlock
                    key={block.id}
                    block={block}
                    type={block.type.split("_")[0] as "numbered" | "bulleted"}
                  />
                );
              case "quote":
                return (
                  <blockquote
                    key={block.id}
                    className="border-l-4 border-primary pl-4 py-2 my-6 rounded-r-lg"
                  >
                    {block.quote.rich_text.map((text: any, index: number) => (
                      <p key={index} className="italic">
                        {text.plain_text}
                      </p>
                    ))}
                  </blockquote>
                );
              case "divider":
                return (
                  <hr
                    key={block.id}
                    className="border-t-2 border-gray-200 my-10"
                  />
                );
              case "code":
                return <CodeBlock key={block.id} block={block} />;
              case "callout":
                return (
                  <div
                    key={block.id}
                    className="bg-primary text-primary-foreground p-6 rounded-lg my-6 shadow-md"
                  >
                    {block.callout.rich_text.map((text: any, index: number) => (
                      <p key={index} className="leading-relaxed">
                        {text.plain_text}
                      </p>
                    ))}
                  </div>
                );
              case "video":
                return (
                  <YouTubeEmbed
                    key={block.id}
                    params="controls=1"
                    playlabel="Watch video"
                    videoid={
                      block.video.external.url.split("/").pop()?.split("?")[0]
                    }
                  />
                );
              case "bookmark":
                return <EnhancedBookmark key={block.id} block={block} />;
              case "link_preview":
                return (
                  <div key={block.id} className="my-6">
                    <Link
                      href={block.link_preview.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="text-primary underline"
                    >
                      {block.link_preview.url}
                    </Link>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(PostDetail);
