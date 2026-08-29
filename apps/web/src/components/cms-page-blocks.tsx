import type { PageBlock } from "@rem-viet/cms";
import { CmsBlockRenderer, type BlockRendererProps } from "@agency/cms-react";
import type { CmsVisualEditorInlineTextTarget } from "@agency/cms-visual-editor";
import {
  createRemVietStandardBlockRegistry,
  toRemVietStandardBlock,
  type ProductGridBlock,
  type RemVietStandardBlock,
  type ReusableContentBlock,
  type RichTextBlock,
  type StandardCtaBlock,
} from "@agency/cms-template-rem-viet";
import { buttonVariants } from "@rem-viet/ui/components/button";
import { cn } from "@rem-viet/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, PackageSearch } from "lucide-react";
import { useEffect, useRef } from "react";

import ProductCard from "@/components/product-card";
import PostContent from "@/components/post-content";
import { cloudflareImageUrl } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

type CmsPageBlocksProps = {
  blocks: Array<PageBlock | RemVietStandardBlock>;
  authoring?: CmsPageBlocksAuthoring;
};

type CmsPageBlocksAuthoring = {
  inlineTextTargets?: readonly CmsVisualEditorInlineTextTarget[];
  onInlineTextCommit?: (
    blockId: string,
    fieldPath: string,
    value: string,
  ) => void;
  onSelect: (blockId: string, fieldPath?: string) => void;
  selectedBlockId: string | null;
  selectedFieldPath: string | null;
};

function getInlineTextTarget(
  authoring: CmsPageBlocksAuthoring | undefined,
  blockId: string,
  fieldPath: string,
) {
  return authoring?.inlineTextTargets?.find(
    (target) => target.blockId === blockId && target.fieldPath === fieldPath,
  );
}

function StandardInlineText({
  authoring,
  blockId,
  className,
  fieldPath,
  value,
}: {
  authoring: CmsPageBlocksAuthoring | undefined;
  blockId: string;
  className: string;
  fieldPath: string;
  value: string;
}) {
  const elementRef = useRef<HTMLHeadingElement>(null);
  const target = getInlineTextTarget(authoring, blockId, fieldPath);
  const editable = Boolean(target && authoring?.onInlineTextCommit);

  useEffect(() => {
    const element = elementRef.current;
    if (element && document.activeElement !== element) {
      element.textContent = value;
    }
  }, [value]);

  const reset = () => {
    if (elementRef.current) elementRef.current.textContent = value;
  };

  return (
    <h2
      aria-label={editable ? `Chỉnh sửa trực tiếp ${target!.label}` : undefined}
      aria-multiline={editable ? target!.multiline : undefined}
      className={cn(
        className,
        editable &&
          "cursor-text rounded-sm outline-none focus-visible:ring-4 focus-visible:ring-amber-400",
      )}
      contentEditable={editable ? true : undefined}
      data-cms-inline-field={editable ? fieldPath : undefined}
      ref={elementRef}
      role={editable ? "textbox" : undefined}
      spellCheck={editable ? true : undefined}
      suppressContentEditableWarning={editable}
      tabIndex={editable ? 0 : undefined}
      onBlur={(event) => {
        if (!editable || !target || !authoring?.onInlineTextCommit) return;
        const next = (event.currentTarget.textContent ?? "")
          .normalize("NFC")
          .replace(/\r\n?/gu, "\n")
          .trim();
        if (
          !next ||
          [...next].length > target.maxLength ||
          (!target.multiline && next.includes("\n"))
        ) {
          reset();
          return;
        }
        if (next !== value) {
          authoring.onInlineTextCommit(blockId, fieldPath, next);
        }
      }}
      onFocus={() => authoring?.onSelect(blockId, `data.${fieldPath}`)}
      onKeyDown={(event) => {
        if (!editable || !target) return;
        if (event.key === "Escape") {
          event.preventDefault();
          reset();
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Enter" && !target.multiline) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    >
      {value}
    </h2>
  );
}

type StandardRenderContext = {
  authoring?: CmsPageBlocksAuthoring;
};

function StandardAuthoringTarget({
  authoring,
  blockId,
  className,
  fieldPath,
  label,
}: {
  authoring: CmsPageBlocksAuthoring | undefined;
  blockId: string;
  className?: string;
  fieldPath?: string;
  label: string;
}) {
  if (!authoring) return null;
  const selected =
    authoring.selectedBlockId === blockId &&
    (fieldPath === undefined || authoring.selectedFieldPath === fieldPath);
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "absolute z-10 cursor-pointer bg-transparent outline-none focus-visible:ring-4 focus-visible:ring-amber-400",
        selected && "ring-4 ring-inset ring-amber-400",
        className,
      )}
      type="button"
      onClick={() => authoring.onSelect(blockId, fieldPath)}
    />
  );
}

function CmsHeroBlock({
  background,
  description,
  kicker,
  title,
}: Extract<PageBlock, { type: "hero" }>) {
  const imageUrl = cloudflareImageUrl(background.src);

  return (
    <section className="relative isolate min-h-[62svh] overflow-hidden bg-zinc-950 text-white">
      {imageUrl ? (
        <img
          alt={background.alt}
          className="absolute inset-0 -z-20 size-full object-cover"
          src={imageUrl}
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
      <div className="mx-auto flex min-h-[62svh] w-full max-w-7xl items-center px-4 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            {kicker}
          </p>
          <h1 className="text-5xl font-bold tracking-normal md:text-7xl">
            {title.prefix} {title.accent}
          </h1>
          {description ? (
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/80 md:text-lg">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CmsRichTextBlock({
  block,
  context,
}: BlockRendererProps<RichTextBlock, StandardRenderContext>) {
  return (
    <section className="relative mx-auto w-full max-w-3xl px-4 py-12">
      <PostContent content={block.data.content} />
      <StandardAuthoringTarget
        authoring={context.authoring}
        blockId={block.id}
        className="inset-0"
        fieldPath="data.content"
        label="Chỉnh sửa nội dung văn bản"
      />
    </section>
  );
}

function CmsProductGridBlock({
  block,
  context,
}: BlockRendererProps<ProductGridBlock, StandardRenderContext>) {
  const { categoryId, limit = 8 } = block.data;
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
    <section className="relative mx-auto w-full max-w-7xl px-4 py-12">
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
      <StandardAuthoringTarget
        authoring={context.authoring}
        blockId={block.id}
        className="inset-0"
        label="Chỉnh sửa lưới sản phẩm"
      />
    </section>
  );
}

function CmsCtaBlock({
  block,
  context,
}: BlockRendererProps<StandardCtaBlock, StandardRenderContext>) {
  const { href, title } = block.data;
  const isExternal =
    /^(https?:)?\/\//.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:");

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="flex flex-col items-start justify-between gap-5 rounded-md border bg-primary p-6 text-primary-foreground md:flex-row md:items-center">
        <div className="relative max-w-3xl flex-1">
          <StandardInlineText
            authoring={context.authoring}
            blockId={block.id}
            className="text-2xl font-bold tracking-normal"
            fieldPath="title"
            value={title}
          />
          {getInlineTextTarget(context.authoring, block.id, "title") ? null : (
            <StandardAuthoringTarget
              authoring={context.authoring}
              blockId={block.id}
              className="-inset-2"
              fieldPath="data.title"
              label="Chỉnh sửa tiêu đề CTA"
            />
          )}
        </div>
        <div className="relative shrink-0">
          <a
            className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}
            href={href}
            rel={isExternal ? "noreferrer" : undefined}
            target={isExternal ? "_blank" : undefined}
          >
            Tiếp tục
            <ArrowRight aria-hidden />
          </a>
          <StandardAuthoringTarget
            authoring={context.authoring}
            blockId={block.id}
            className="-inset-2"
            fieldPath="data.href"
            label="Chỉnh sửa liên kết CTA"
          />
        </div>
      </div>
    </section>
  );
}

function CmsReusableContentBlock({
  block,
  context,
}: BlockRendererProps<ReusableContentBlock, StandardRenderContext>) {
  const trpc = useTRPC();
  const resolved = useQuery({
    ...trpc.content.reusableContent.resolve.queryOptions({
      reference: block.data.reference,
      mode: context.authoring ? "draft" : "published",
      blockId: block.id,
    }),
    enabled: Boolean(context.authoring),
  });
  if (resolved.data?.block) {
    return renderBlock(resolved.data.block, 0, context.authoring);
  }
  return (
    <section className="relative mx-auto w-full max-w-3xl px-4 py-12">
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        {context.authoring
          ? resolved.isError
            ? "Không thể tải nội dung tái sử dụng."
            : "Đang tải nội dung tái sử dụng…"
          : "Nội dung tái sử dụng chưa sẵn sàng."}
      </div>
      <StandardAuthoringTarget
        authoring={context.authoring}
        blockId={block.id}
        className="inset-0"
        label="Chỉnh sửa nội dung tái sử dụng"
      />
    </section>
  );
}

const standardBlockRegistry =
  createRemVietStandardBlockRegistry<StandardRenderContext>({
    richText: CmsRichTextBlock,
    productGrid: CmsProductGridBlock,
    cta: CmsCtaBlock,
    reusableContent: CmsReusableContentBlock,
  });

function renderBlock(
  block: PageBlock | RemVietStandardBlock,
  index: number,
  authoring?: CmsPageBlocksAuthoring,
) {
  const standard = toRemVietStandardBlock(block, index);
  if (standard.success) {
    return (
      <CmsBlockRenderer
        block={standard.data}
        context={{ authoring }}
        key={standard.data.id}
        registry={standardBlockRegistry}
      />
    );
  }
  return block.type === "hero" ? (
    <CmsHeroBlock key={`hero-${index}`} {...block} />
  ) : null;
}

export default function CmsPageBlocks({
  authoring,
  blocks,
}: CmsPageBlocksProps) {
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

  return (
    <>{blocks.map((block, index) => renderBlock(block, index, authoring))}</>
  );
}
