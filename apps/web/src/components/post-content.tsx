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

const bodyTextClass =
  "font-vietnam text-[15px] leading-8 text-[color:color-mix(in_srgb,var(--text-color)_76%,transparent)]";
const mutedTextClass =
  "text-[color:color-mix(in_srgb,var(--text-color)_56%,transparent)]";

function richTextFrom(value: unknown) {
  return (value as RichTextContainer | undefined)?.rich_text ?? [];
}

function textContent(text: RichText) {
  return text.plain_text ?? text.text?.content ?? "";
}

function notionColorClass(color?: string) {
  switch (color) {
    case "gray":
      return "text-[color:color-mix(in_srgb,var(--text-color)_52%,transparent)]";
    case "brown":
    case "orange":
    case "yellow":
      return "text-[var(--accent)]";
    case "green":
      return "text-emerald-300";
    case "blue":
      return "text-sky-300";
    case "purple":
      return "text-violet-300";
    case "pink":
      return "text-pink-300";
    case "red":
      return "text-red-300";
    default:
      return "";
  }
}

function renderRichText(text: RichText, index: number) {
  const className = [
    text.annotations?.bold ? "font-semibold text-[var(--text-color)]" : "",
    text.annotations?.italic ? "italic" : "",
    text.annotations?.strikethrough ? "line-through" : "",
    text.annotations?.underline ? "underline underline-offset-4" : "",
    notionColorClass(text.annotations?.color),
    text.annotations?.code
      ? "rounded border border-white/12 bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--accent)]"
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
      className="font-medium text-[var(--accent)] underline-offset-4 transition-opacity hover:underline hoverable:hover:opacity-75"
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
    <div className="my-8 overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.04]">
      <a
        className="grid text-[var(--text-color)] no-underline transition-colors hoverable:hover:bg-white/[0.04] sm:grid-cols-[12rem_1fr]"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        <div className="h-48 bg-white/[0.04] sm:h-full">
          {isLoading ? (
            <div className="size-full animate-pulse bg-white/[0.08]" />
          ) : imageUrl ? (
            <img
              alt={title}
              className="size-full object-cover"
              loading="lazy"
              src={imageUrl}
            />
          ) : (
            <div className={`flex size-full items-center justify-center ${mutedTextClass}`}>
              <ExternalLink aria-hidden className="size-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 p-5">
          {isLoading ? (
            <div className="grid gap-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.08]" />
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-start gap-3">
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
                    className={`mt-1 size-4 shrink-0 ${mutedTextClass}`}
                  />
                )}
                <h3 className="line-clamp-2 font-playfair text-2xl font-normal leading-tight tracking-normal">
                  {title}
                </h3>
              </div>
              <p className={`mt-3 line-clamp-2 font-vietnam text-sm leading-6 ${mutedTextClass}`}>
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
          className={[bodyTextClass, notionColorClass(paragraph?.color)]
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
            className="mb-6 mt-14 font-playfair text-[clamp(36px,5vw,64px)] font-normal leading-[1] tracking-normal text-[var(--text-color)]"
            key={key}
          >
            {content}
          </h1>
        );
      }

      if (level === "2") {
        return (
          <h2
            className="mb-5 mt-12 font-playfair text-[clamp(30px,3.8vw,48px)] font-normal leading-[1.05] tracking-normal text-[var(--accent)]"
            key={key}
          >
            {content}
          </h2>
        );
      }

      return (
        <h3
          className="mb-4 mt-10 font-playfair text-[clamp(24px,2.8vw,34px)] font-normal leading-[1.08] tracking-normal text-[var(--text-color)]"
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
        <figure className="my-10" key={key}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.04]">
            <img
              alt={caption || "Blog post image"}
              className="size-full object-cover"
              loading="lazy"
              src={imageUrl}
            />
          </div>
          {caption ? (
            <figcaption className={`mt-3 text-center font-vietnam text-xs ${mutedTextClass}`}>
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
      const className = [
        "mb-6 space-y-2 pl-5",
        bodyTextClass,
        listType === "ol" ? "list-decimal" : "list-disc",
      ].join(" ");

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
          className={`my-8 border-l border-[var(--accent)] bg-white/[0.035] py-4 pl-5 ${bodyTextClass}`}
          key={key}
        >
          {richText.map(renderRichText)}
        </blockquote>
      );
    }
    case "divider":
      return <hr className="my-12 border-t border-white/12" key={key} />;
    case "code": {
      const code = richTextFrom(block.code).map(textContent).join("");

      return (
        <pre
          className="my-8 w-full overflow-x-auto rounded-[8px] border border-white/12 bg-black/35 p-5 font-mono text-sm leading-6 text-[var(--text-color)]"
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
          className={`my-8 rounded-[8px] border border-[color:var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] p-6 ${bodyTextClass}`}
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
          className="my-10 aspect-video overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.04]"
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
          className="my-8 flex items-center gap-3 rounded-[8px] border border-white/12 bg-white/[0.04] p-5 font-vietnam text-sm font-medium text-[var(--text-color)] no-underline transition-colors hoverable:hover:bg-white/[0.07]"
          href={url}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden className="size-4 text-[var(--accent)]" />
          {url}
        </a>
      );
    }
    default:
      return null;
  }
}

function isPlainTextHeading(paragraph: string, index: number) {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);

  if (index === 0 || words.length > 10) {
    return false;
  }

  return !/[.!?…]$/.test(paragraph.trim());
}

function renderPlainTextContent(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-6">
      {paragraphs.map((paragraph, index) =>
        isPlainTextHeading(paragraph, index) ? (
          <h2
            className="mt-8 font-playfair text-[clamp(30px,3.8vw,48px)] font-normal leading-[1.05] tracking-normal text-[var(--accent)]"
            key={`${paragraph}-${index}`}
          >
            {paragraph}
          </h2>
        ) : (
          <p className={bodyTextClass} key={`${paragraph}-${index}`}>
            {paragraph}
          </p>
        ),
      )}
    </div>
  );
}

export default function PostContent({ content }: PostContentProps) {
  const parsed = parseBlocks(content);

  if (parsed.blocks) {
    return (
      <div className="grid gap-6 font-vietnam">
        {parsed.blocks.map(renderBlock)}
      </div>
    );
  }

  if (parsed.text) {
    return renderPlainTextContent(parsed.text);
  }

  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[8px] border border-white/12 bg-white/[0.035] text-center">
      <PlayCircle aria-hidden className="size-7 text-[var(--accent)]" />
      <p className={`font-vietnam text-sm ${mutedTextClass}`}>
        Nội dung bài viết đang được cập nhật.
      </p>
    </div>
  );
}
