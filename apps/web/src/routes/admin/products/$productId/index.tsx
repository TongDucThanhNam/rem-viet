import { buttonVariants } from "@rem-viet/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rem-viet/ui/components/card";
import { Skeleton } from "@rem-viet/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rem-viet/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Check, Copy, Edit } from "lucide-react";
import { useState, type ReactNode } from "react";

import AdminShell from "@/components/admin-shell";
import { AsyncState } from "@/components/admin-ui";
import { getAdminUser } from "@/functions/get-admin-user";
import { formatCurrency, formatProductPrice } from "@/lib/price";
import { normalizeVariantValues } from "@/lib/variants";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/products/$productId/")({
  component: ProductDetailRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
});

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  const trpc = useTRPC();
  const productQuery = useQuery(
    trpc.products.adminWithVariants.queryOptions({
      productId,
      includeInactive: true,
    }),
  );
  const data = productQuery.data?.data;
  const variantGroups = new Map<string, Set<string>>();

  for (const variant of data?.variants ?? []) {
    for (const [key, value] of Object.entries(
      normalizeVariantValues(variant.values),
    )) {
      if (!variantGroups.has(key)) {
        variantGroups.set(key, new Set());
      }
      variantGroups.get(key)?.add(value);
    }
  }

  const variantArray = Array.from(variantGroups.entries()).map(
    ([name, values]) => ({
      name,
      values: Array.from(values),
    }),
  );

  return (
    <AdminShell
      actions={
        data?.product ? (
          <Link
            className={buttonVariants({ className: "gap-1", size: "sm" })}
            params={{ productId }}
            to="/admin/products/$productId/edit"
          >
            <Edit aria-hidden className="size-3.5" />
            Sửa sản phẩm
          </Link>
        ) : null
      }
      titleOverride={data?.product?.name}
    >
      {productQuery.isLoading ? (
        <div
          aria-label="Đang tải chi tiết sản phẩm"
          className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-2"
        >
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="grid content-start gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      ) : productQuery.isError ? (
        <AsyncState
          action={
            <button
              className={buttonVariants({ size: "sm", variant: "outline" })}
              type="button"
              onClick={() => productQuery.refetch()}
            >
              Thử lại
            </button>
          }
          description={productQuery.error.message}
          title="Không thể tải chi tiết sản phẩm"
          tone="error"
        />
      ) : data?.product ? (
        <div className="mx-auto grid w-full max-w-6xl gap-5">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Hình ảnh</CardTitle>
                <CardDescription>
                  {data.product.imageUrls.length
                    ? `${data.product.imageUrls.length} ảnh sản phẩm`
                    : "Sản phẩm chưa có ảnh."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.product.imageUrls.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.product.imageUrls.map((url, index) => (
                      <figure className="grid gap-2" key={`${url}-${index}`}>
                        <img
                          alt={`${data.product.name} — ảnh ${index + 1}`}
                          className="aspect-square w-full rounded-md border object-cover"
                          loading="lazy"
                          src={url}
                        />
                        <SnippetLike
                          ariaLabel={`URL ảnh ${index + 1}`}
                          value={url}
                        />
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Thêm ảnh trong trình chỉnh sửa để sản phẩm dễ nhận biết hơn.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid content-start gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin sản phẩm</CardTitle>
                  <CardDescription>
                    Nội dung đang được lưu cho sản phẩm này.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <DetailItem label="Tên sản phẩm">
                    {data.product.name}
                  </DetailItem>
                  <DetailItem label="Giá">
                    {formatProductPrice(data.product.price)}
                  </DetailItem>
                  <DetailItem label="Mô tả">
                    {data.product.description || "Chưa có mô tả."}
                  </DetailItem>
                </CardContent>
              </Card>

              {variantArray.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Thuộc tính biến thể</CardTitle>
                    <CardDescription>
                      Các giá trị hiện có theo từng nhóm thuộc tính.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {variantArray.map((variant) => (
                      <DetailItem key={variant.name} label={variant.name}>
                        <div className="flex flex-wrap gap-2">
                          {variant.values.map((value) => (
                            <span
                              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                              key={`${variant.name}-${value}`}
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </DetailItem>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>

          {data.variants.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Danh sách biến thể</CardTitle>
                <CardDescription>
                  {data.variants.length} biến thể và mức giá tương ứng.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Giá trị</TableHead>
                        <TableHead className="w-52">Giá</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.variants.map((variant) => (
                        <TableRow key={variant._id}>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(
                                normalizeVariantValues(variant.values),
                              ).map(([key, value]) => (
                                <span
                                  className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                                  key={`${variant._id}-${key}`}
                                >
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(Number(variant.variantPrice))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <AsyncState
          description="Bản ghi này không còn tồn tại hoặc bạn không có quyền xem."
          title="Không tìm thấy sản phẩm"
        />
      )}
    </AdminShell>
  );
}

function DetailItem({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-1 border-b pb-3 last:border-b-0 last:pb-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function SnippetLike({
  ariaLabel,
  value,
}: {
  ariaLabel: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex w-full overflow-hidden rounded-md border bg-muted/40">
      <input
        aria-label={ariaLabel}
        className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-foreground outline-none selection:bg-primary/20"
        readOnly
        title={value}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
      />
      <button
        aria-label={
          copied ? `Đã sao chép ${ariaLabel}` : `Sao chép ${ariaLabel}`
        }
        className="grid h-10 w-10 shrink-0 place-items-center border-l text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        title={copied ? "Đã sao chép" : "Sao chép"}
        type="button"
        onClick={copyValue}
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-success-foreground" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
}
