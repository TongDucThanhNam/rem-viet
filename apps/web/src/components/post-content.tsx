"use client";

import { ExternalLink, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { cloudflareImageUrl } from "@/lib/site-config";

type RichText = {
  plain_text?: string;
  href?: string | null;
  text?: {
    content?: string;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

type NotionBlock = {
  id?: string;
  type: string;
  [key: string]: unknown;
};

type RichTextContainer = {
  rich_text?: RichText[];
  color?: string;
};

type PostContentProps = {
  content?: string | NotionBlock[];
};

type BookmarkMetadata = {
  title?: string;
  description?: string;
  images?: string[];
  favicon?: string;
  domain?: string;
  url?: string;
};

function richTextFrom(value: unknown) {
  return (value as RichTextContainer | undefined)?.rich_text ?? [];
}

function textContent(text: RichText) {
  return text.plain_text ?? text.text?.content ?? "";
}

function notionColorClass(color?: string) {
  switch (color) {
    case "gray":
      return "text-gray-500";
    case "brown":
      return "text-amber-900";
    case "orange":
      return "text-orange-500";
    case "yellow":
      return "text-yellow-500";
    case "green":
      return "text-green-600";
    case "blue":
      return "text-blue-600";
    case "purple":
      return "text-purple-600";
    case "pink":
      return "text-pink-600";
    case "red":
      return "text-red-600";
    default:
      return "";
  }
}

function renderRichText(text: RichText, index: number) {
  const className = [
    text.annotations?.bold ? "font-semibold" : "",
    text.annotations?.italic ? "italic" : "",
    text.annotations?.strikethrough ? "line-through" : "",
    text.annotations?.underline ? "underline" : "",
    notionColorClass(text.annotations?.color),
    text.annotations?.code
      ? "rounded bg-yellow-200 px-1 dark:bg-yellow-800"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = <span className={className}>{textContent(text)}</span>;

  if (!text.href) {
    return <span key={index}>{content}</span>;
  }

  return (
    <a
      className="font-medium text-primary underline-offset-4 hover:underline"
      href={text.href}
      key={index}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  );
}

function getImageUrl(block: NotionBlock) {
  const image = block.image as
    | {
        type?: "file" | "external";
        file?: { url?: string };
        external?: { url?: string };
        caption?: RichText[];
      }
    | undefined;

  if (image?.type === "file") {
    return image.file?.url ?? "";
  }

  const externalUrl = image?.external?.url ?? "";

  return externalUrl ? cloudflareImageUrl(externalUrl) : "";
}

function getCaption(block: NotionBlock) {
  const image = block.image as { caption?: RichText[] } | undefined;

  return image?.caption?.map(textContent).join("") ?? "";
}

function parseBlocks(content?: string | NotionBlock[]) {
  if (!content) {
    return { blocks: null, text: "" };
  }

  if (Array.isArray(content)) {
    return { blocks: content, text: "" };
  }

  try {
    const parsed = JSON.parse(content) as unknown;

    if (Array.isArray(parsed)) {
      return { blocks: parsed as NotionBlock[], text: "" };
    }
  } catch {
    return { blocks: null, text: content };
  }

  return { blocks: null, text: content };
}

function getYouTubeId(url?: string) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "");
    }

    return (
      parsed.searchParams.get("v") ??
      parsed.pathname.split("/").filter(Boolean).pop() ??
      ""
    );
  } catch {
    return "";
  }
}

function BookmarkCard({ url }: { url: string }) {
  const [metadata, setMetadata] = useState<BookmarkMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    setIsLoading(true);
    fetch(`/api/get-bookmark?url=${encodeURIComponent(url)}`)
      .then((response) =>
        response.ok ? (response.json() as Promise<BookmarkMetadata>) : null,
      )
      .then((data: BookmarkMetadata | null) => {
        if (ignore) {
          return;
        }

        setMetadata(data);
      })
      .catch(() => {
        if (!ignore) {
          setMetadata(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [url]);

  const imageUrl = cloudflareImageUrl(metadata?.images?.[0]);
  const title = metadata?.title || url;
  const description = metadata?.description || metadata?.domain || url;

  return (
    <div className="my-6 overflow-hidden rounded-lg border bg-background shadow-sm">
      <a
        className="grid transition-colors hover:bg-muted/40 sm:grid-cols-[12rem_1fr]"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        <div className="h-48 bg-muted sm:h-full">
          {isLoading ? (
            <div className="size-full animate-pulse bg-muted" />
          ) : imageUrl ? (
            <img
              alt={title}
              className="size-full object-cover"
              loading="lazy"
              src={imageUrl}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ExternalLink aria-hidden className="size-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 p-4">
          {isLoading ? (
            <div className="grid gap-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-start gap-2">
                {metadata?.favicon ? (
                  <img
                    alt=""
                    className="mt-1 size-4 shrink-0"
                    loading="lazy"
                    src={metadata.favicon}
                  />
                ) : (
                  <ExternalLink
                    aria-hidden
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                  />
                )}
                <h3 className="line-clamp-2 text-xl font-bold tracking-normal">
                  {title}
                </h3>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </>
          )}
        </div>
      </a>
    </div>
  );
}

function renderBlock(block: NotionBlock, index: number) {
  const key = block.id ?? `${block.type}-${index}`;

  switch (block.type) {
    case "paragraph": {
      const paragraph = block.paragraph as RichTextContainer | undefined;
      const richText = richTextFrom(paragraph);

      if (!richText.length) {
        return <div aria-hidden className="h-4" key={key} />;
      }

      return (
        <p
          className={["leading-relaxed", notionColorClass(paragraph?.color)]
            .filter(Boolean)
            .join(" ")}
          key={key}
        >
          {richText.map(renderRichText)}
        </p>
      );
    }
    case "heading_1":
    case "heading_2":
    case "heading_3": {
      const level = block.type.split("_")[1];
      const richText = richTextFrom(block[block.type]);
      const content = richText.map(renderRichText);

      if (level === "1") {
        return (
          <h1
            className="mb-6 mt-12 text-4xl font-bold tracking-normal text-primary md:text-5xl"
            key={key}
          >
            {content}
          </h1>
        );
      }

      if (level === "2") {
        return (
          <h2
            className="mb-5 mt-10 text-3xl font-semibold tracking-normal text-primary md:text-4xl"
            key={key}
          >
            {content}
          </h2>
        );
      }

      return (
        <h3
          className="mb-4 mt-8 text-2xl font-medium tracking-normal text-primary md:text-3xl"
          key={key}
        >
          {content}
        </h3>
      );
    }
    case "image": {
      const imageUrl = getImageUrl(block);
      const caption = getCaption(block);

      if (!imageUrl) {
        return null;
      }

      return (
        <figure className="my-8" key={key}>
          <div className="relative h-96 overflow-hidden bg-muted">
            <img
              alt={caption || "Blog post image"}
              className="size-full rounded-lg object-cover shadow-md"
              loading="lazy"
              src={imageUrl}
            />
          </div>
          {caption ? (
            <figcaption className="mt-2 text-center text-sm text-gray-500">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "numbered_list_item":
    case "bulleted_list_item": {
      const listType = block.type === "numbered_list_item" ? "ol" : "ul";
      const richText = richTextFrom(block[block.type]);
      const className =
        listType === "ol"
          ? "mb-6 list-inside list-decimal space-y-2 pl-4"
          : "mb-6 list-inside list-disc space-y-2 pl-4";

      if (listType === "ol") {
        return (
          <ol className={className} key={key}>
            <li>{richText.map(renderRichText)}</li>
          </ol>
        );
      }

      return (
        <ul className={className} key={key}>
          <li>{richText.map(renderRichText)}</li>
        </ul>
      );
    }
    case "quote": {
      const richText = richTextFrom(block.quote);

      return (
        <blockquote
          className="my-6 rounded-r-lg border-l-4 border-primary py-2 pl-4"
          key={key}
        >
          {richText.map(renderRichText)}
        </blockquote>
      );
    }
    case "divider":
      return <hr className="my-10 border-t-2 border-gray-200" key={key} />;
    case "code": {
      const code = richTextFrom(block.code).map(textContent).join("");

      return (
        <pre
          className="my-6 w-full overflow-x-auto rounded-lg border bg-muted p-4 text-sm leading-6 md:w-auto md:text-base"
          key={key}
        >
          <code>{code}</code>
        </pre>
      );
    }
    case "callout": {
      const richText = richTextFrom(block.callout);

      return (
        <div
          className="my-6 rounded-lg bg-primary p-6 leading-relaxed text-primary-foreground shadow-md"
          key={key}
        >
          {richText.map(renderRichText)}
        </div>
      );
    }
    case "video": {
      const video = block.video as
        | { external?: { url?: string }; file?: { url?: string } }
        | undefined;
      const url = video?.external?.url ?? video?.file?.url ?? "";
      const youtubeId = getYouTubeId(url);

      if (!youtubeId) {
        return null;
      }

      return (
        <div
          className="my-8 aspect-video overflow-hidden border bg-muted"
          key={key}
        >
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="size-full"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Video"
          />
        </div>
      );
    }
    case "bookmark": {
      const url = (block.bookmark as { url?: string } | undefined)?.url ?? "";

      if (!url) {
        return null;
      }

      return <BookmarkCard key={key} url={url} />;
    }
    case "link_preview": {
      const url =
        (block.link_preview as { url?: string } | undefined)?.url ?? "";

      if (!url) {
        return null;
      }

      return (
        <a
          className="my-6 flex items-center gap-2 border p-4 text-sm font-medium hover:bg-muted"
          href={url}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden className="size-4" />
          {url}
        </a>
      );
    }
    default:
      return null;
  }
}

export default function PostContent({ content }: PostContentProps) {
  const parsed = parseBlocks(content);

  if (parsed.blocks) {
    return (
      <div className="grid gap-5 text-sm leading-7">
        {parsed.blocks.map(renderBlock)}
      </div>
    );
  }

  if (parsed.text) {
    return (
      <div className="whitespace-pre-line text-sm leading-8">{parsed.text}</div>
    );
  }

  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 border bg-muted/30 text-center text-muted-foreground">
      <PlayCircle aria-hidden className="size-7" />
      <p className="text-sm">Nội dung bài viết đang được cập nhật.</p>
    </div>
  );
}
