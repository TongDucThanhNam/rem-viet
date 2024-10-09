"use client";

import { Chip, cn, Image, Link, Snippet } from "@nextui-org/react";
import { AnchorIcon } from "@nextui-org/shared-icons";
import React from "react";
import { YouTubeEmbed } from "@next/third-parties/google";
import EnhancedBookmark from "@/components/posts/bookmark";

export default function PostDetail({ myPost }: { myPost: any }) {
  return (
    <div className={"container mx-auto px-4 py-8"}>
      <div className={"max-w-3xl mx-auto"}>
        <Image
          // src={myPost.coverImage}
          src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${myPost.coverImage}`}
          alt={`Cover image for ${myPost.title}`}
        />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{myPost.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center">
            <AnchorIcon className="mr-2 h-4 w-4" />
            <time dateTime={myPost.created_time}>
              Xuất bản lúc:
              {new Date(myPost.publishDate).toLocaleDateString("vi-Vi", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
          <div className="flex items-center">
            <AnchorIcon className="mr-2 h-4 w-4" />
            <span>
              Cập nhật lúc:{" "}
              {new Date(myPost.lastEditedTime).toLocaleDateString()}
            </span>
          </div>
        </div>
        <p className="text-xl mb-8">{myPost.description}</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {myPost.tags.map((tag: any, index: any) => (
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
        <div className="prose max-w-none">
          {myPost.content.map((block: any) => {
            switch (block.type) {
              case "paragraph":
                if (block.paragraph.rich_text.length === 0) {
                  return (
                    <div key={block.id} className="h-4" aria-hidden="true" />
                  );
                }
                return (
                  <p
                    key={block.id}
                    className={`text-${block.paragraph.color} leading-relaxed`}
                  >
                    {block.paragraph.rich_text.map(
                      (text: any, index: number) => (
                        <span
                          key={index}
                          className={cn(
                            text.annotations.strikethrough
                              ? "line-through"
                              : "",
                            text.annotations.underline ? "underline" : "",
                            text.annotations.bold ? "font-bold" : "",
                            text.annotations.italic ? "italic" : "",
                            text.annotations.code
                              ? "bg-yellow-200 dark:bg-yellow-800 px-1 rounded"
                              : "",
                            text.annotations.color === "default"
                              ? ""
                              : `text-${text.annotations.color}`,
                          )}
                        >
                          {text.plain_text}
                        </span>
                      ),
                    )}
                  </p>
                );

              case "image":
                if (block.image.type === "external") {
                  return (
                    <figure key={block.id} className="my-8">
                      <Image
                        // src={block.image.external.url}
                        src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${block.image.external.url}`}
                        alt={
                          block.image.caption[0]?.plain_text ||
                          "Blog post image"
                        }
                        className="rounded-lg shadow-md"
                      />
                      {block.image.caption[0]?.plain_text && (
                        <figcaption className="mt-2 text-center text-sm text-gray-500">
                          {block.image.caption[0].plain_text}
                        </figcaption>
                      )}
                    </figure>
                  );
                } else if (block.image.type === "file") {
                  return (
                    <figure key={block.id} className="my-8">
                      <Image
                        // src={block.image.file.url}
                        src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${block.image.file.url}`}
                        alt={
                          block.image.caption[0]?.plain_text ||
                          "Blog post image"
                        }
                        className="rounded-lg shadow-md"
                      />
                      {block.image.caption[0]?.plain_text && (
                        <figcaption className="mt-2 text-center text-sm text-gray-500">
                          {block.image.caption[0].plain_text}
                        </figcaption>
                      )}
                    </figure>
                  );
                }

                return null;

              case "heading_1":
                return (
                  <h1
                    key={block.id}
                    className="text-4xl md:text-5xl font-bold mt-12 mb-6 text-primary"
                  >
                    {block.heading_1.rich_text.map(
                      (text: any, index: number) => (
                        <span key={index}>{text.plain_text}</span>
                      ),
                    )}
                  </h1>
                );

              case "heading_2":
                return (
                  <h2
                    key={block.id}
                    className="text-3xl md:text-4xl font-semibold mt-10 mb-5 text-primary"
                  >
                    {block.heading_2.rich_text.map(
                      (text: any, index: number) => (
                        <span key={index}>{text.plain_text}</span>
                      ),
                    )}
                  </h2>
                );

              case "heading_3":
                return (
                  <h3
                    key={block.id}
                    className="text-2xl md:text-3xl font-medium mt-8 mb-4 text-primary"
                  >
                    {block.heading_3.rich_text.map(
                      (text: any, index: number) => (
                        <span key={index}>{text.plain_text}</span>
                      ),
                    )}
                  </h3>
                );

              case "numbered_list_item":
                return (
                  <ol
                    key={block.id}
                    className="list-decimal list-inside mb-6 pl-4 space-y-2"
                  >
                    {block.numbered_list_item.rich_text.map(
                      (text: any, index: number) => (
                        <span
                          key={index}
                          className={cn(
                            text.annotations.strikethrough
                              ? "line-through"
                              : "",
                            text.annotations.underline ? "underline" : "",
                            text.annotations.bold ? "font-bold" : "",
                            text.annotations.italic ? "italic" : "",
                            text.annotations.code
                              ? "bg-yellow-200 dark:bg-yellow-800 px-1 rounded"
                              : "",
                            text.annotations.color === "default"
                              ? ""
                              : `text-${text.annotations.color}`,
                          )}
                        >
                          {text.href ? (
                            <Link
                              href={text.href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {text.text.content}
                            </Link>
                          ) : (
                            text.plain_text
                          )}
                        </span>
                      ),
                    )}
                  </ol>
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

              case "bulleted_list_item":
                return (
                  <ul
                    key={block.id}
                    className="list-disc list-inside mb-6 pl-4 space-y-2"
                  >
                    {block.bulleted_list_item.rich_text.map(
                      (text: any, index: number) => (
                        <li key={index} className="">
                          <span>{text.plain_text}</span>
                        </li>
                      ),
                    )}
                  </ul>
                );

              case "code":
                return (
                  <Snippet
                    key={block.id}
                    className="my-6 p-4 rounded-lg w-full md:w-auto text-sm md:text-base"
                  >
                    <pre className="whitespace-pre-wrap break-words">
                      {block.code.rich_text.map((text: any) =>
                        text.plain_text
                          .split("\n")
                          .map((line: string, index: number) => (
                            <React.Fragment key={index}>
                              {line}
                              <br />
                            </React.Fragment>
                          )),
                      )}
                    </pre>
                  </Snippet>
                );

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
                    videoid={
                      block.video.external.url.split("/").pop()?.split("?")[0]
                    }
                    params="controls=1"
                    playlabel="Watch video"
                  />
                );

              case "bookmark":
                return <EnhancedBookmark block={block} />;

              //   Link preview
              case "link_preview":
                return (
                  <div key={block.id} className="my-6">
                    <a
                      href={block.link_preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {block.link_preview.url}
                    </a>
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
}
