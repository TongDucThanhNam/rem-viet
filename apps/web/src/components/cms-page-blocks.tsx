import type { PageBlock } from "@rem-viet/cms";
import { buttonVariants } from "@rem-viet/ui/components/button";
import { cn } from "@rem-viet/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, PackageSearch } from "lucide-react";

import ProductCard from "@/components/product-card";
import { cloudflareImageUrl } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

type CmsPageBlocksProps = {
  blocks: PageBlock[];
};

type ProductGridBlockProps = Extract<PageBlock, { type: "productGrid" }>;

function CmsHeroBlock({
  image,
  subtitle,
  title,
}: Extract<PageBlock, { type: "hero" }>) {
  const imageUrl = cloudflareImageUrl(image);

  return (
    <section className="relative isolate min-h-[62svh] overflow-hidden bg-zinc-950 text-white">
      {imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover"
          src={imageUrl}
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
      <div className="mx-auto flex min-h-[62svh] w-full max-w-7xl items-center px-4 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Rèm Vina
          </p>
          <h1 className="text-5xl font-bold tracking-normal md:text-7xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/80 md:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CmsRichTextBlock({ content }: Extract<PageBlock, { type: "richText" }>) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="whitespace-pre-line text-base leading-8 text-foreground">
        {content}
      </div>
    </section>
  );
}

function CmsProductGridBlock({ categoryId, limit = 8 }: ProductGridBlockProps) {
  const trpc = useTRPC();
  const productsQuery = useQuery(
    trpc.products.list.queryOptions({
      limit,
      order: "desc",
      sort: "updatedAt",
      ...(categoryId ? { categoryId } : {}),
    }),
  );
  const products = productsQuery.data?.data ?? [];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Sản phẩm
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal">
            Gợi ý cho không gian của bạn
          </h2>
        </div>
        <Link
          className="hidden text-sm font-medium text-primary hover:underline md:inline-flex"
          to="/danh-sach-san-pham"
        >
          Xem tất cả
        </Link>
      </div>

      {products.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-60 flex-col items-center justify-center gap-3 border bg-background text-center">
          <PackageSearch aria-hidden className="size-8 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-medium">Chưa có sản phẩm</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sản phẩm đã bật public sẽ hiển thị tại đây.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function CmsCtaBlock({ href, title }: Extract<PageBlock, { type: "cta" }>) {
  const isExternal = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="flex flex-col items-start justify-between gap-5 rounded-md border bg-primary p-6 text-primary-foreground md:flex-row md:items-center">
        <h2 className="max-w-3xl text-2xl font-bold tracking-normal">
          {title}
        </h2>
        <a
          className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}
          href={href}
          rel={isExternal ? "noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          Tiếp tục
          <ArrowRight aria-hidden />
        </a>
      </div>
    </section>
  );
}

function renderBlock(block: PageBlock, index: number) {
  switch (block.type) {
    case "hero":
      return <CmsHeroBlock key={`hero-${index}`} {...block} />;
    case "richText":
      return <CmsRichTextBlock key={`richText-${index}`} {...block} />;
    case "productGrid":
      return <CmsProductGridBlock key={`productGrid-${index}`} {...block} />;
    case "cta":
      return <CmsCtaBlock key={`cta-${index}`} {...block} />;
    default:
      return null;
  }
}

export default function CmsPageBlocks({ blocks }: CmsPageBlocksProps) {
  if (!blocks.length) {
    return (
      <section className="mx-auto grid min-h-[50svh] w-full max-w-3xl place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">
            Trang đang được cập nhật
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nội dung page này chưa có block public.
          </p>
        </div>
      </section>
    );
  }

  return <>{blocks.map(renderBlock)}</>;
}
