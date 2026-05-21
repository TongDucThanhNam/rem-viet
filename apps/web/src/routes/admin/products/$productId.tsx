import { buttonVariants } from "@rem-viet/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Check, Copy, Edit, PackageSearch } from "lucide-react";
import { useState } from "react";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { normalizeVariantValues } from "@/lib/variants";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/products/$productId")({
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
      hideHeading
      legacyContentFrame
      title={data?.product?.name ?? "Chi tiết sản phẩm"}
    >
      {productQuery.isLoading ? (
        <div className="mx-auto my-14 min-h-80 w-full max-w-2xl animate-pulse rounded-md border bg-muted/30" />
      ) : data?.product ? (
        <div className="mx-auto my-14 flex w-full max-w-3xl flex-col items-center justify-center gap-2 px-4 lg:px-0">
          <div className="mb-4 flex w-full justify-end">
            <Link
              className={buttonVariants({ className: "gap-1", size: "sm" })}
              params={{ productId }}
              to="/admin/products/$productId/edit"
            >
              <Edit aria-hidden className="size-3.5" />
              Sửa sản phẩm
            </Link>
          </div>

          <div className="flex w-full flex-col items-center justify-center gap-2">
            {data.product.imageUrls.map((url, index) => (
              <SnippetLike
                ariaLabel={`Image URL ${index + 1}`}
                key={`${url}-${index}`}
                value={url}
              />
            ))}

            <div className="h-5" />

            <SnippetLike ariaLabel="Product Name" value={data.product.name} />

            <SnippetLike
              ariaLabel="Product Description"
              displayValue="Mô tả sản phẩm: ..."
              value={data.product.description ?? ""}
            />

            <div className="h-1" />

            {variantArray.map((variant) => (
              <div className="w-full" key={variant.name}>
                <p className="mb-2 text-sm">{variant.name}</p>
                <div className="grid gap-2">
                  {variant.values.map((value) => (
                    <SnippetLike
                      ariaLabel={`Variant Value ${value}`}
                      key={`${variant.name}-${value}`}
                      value={value}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="h-1" />

            {data.variants.length ? (
              <div className="w-full max-w-2xl overflow-hidden rounded-md border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="w-2/3 px-4 py-3 font-semibold">Values</th>
                      <th className="w-1/3 px-4 py-3 font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.variants.map((variant) => (
                      <tr
                        className="border-b last:border-b-0"
                        key={variant._id}
                      >
                        <td className="px-4 py-4">
                          <div className="flex max-w-xs flex-wrap gap-2">
                            {Object.entries(normalizeVariantValues(variant.values))
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <span
                                  aria-label={`Variant ${key}`}
                                  className="rounded-full bg-primary/10 px-2 py-1 text-sm transition-colors duration-200 hover:bg-primary/20"
                                  key={`${variant._id}-${key}`}
                                >
                                  {`${key}: ${value}`}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <SnippetLike
                            ariaLabel={`price-${variant.key}`}
                            value={String(variant.variantPrice)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <SnippetLike
                ariaLabel="Product Price"
                value={data.product.price ?? ""}
              />
            )}
          </div>

          <div className="h-10" />
        </div>
      ) : (
        <div className="mx-auto my-14 flex min-h-80 w-full max-w-2xl flex-col items-center justify-center gap-3 border text-center">
          <PackageSearch aria-hidden className="size-8 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-medium">Không tìm thấy sản phẩm</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bản ghi này không còn tồn tại.
            </p>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function SnippetLike({
  ariaLabel,
  value,
  displayValue,
}: {
  ariaLabel: string;
  value: string;
  displayValue?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex w-full overflow-hidden rounded-large border bg-default-100">
      <input
        aria-label={ariaLabel}
        className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-foreground outline-none selection:bg-primary/20"
        readOnly
        title={value}
        value={displayValue ?? value}
        onFocus={(event) => event.currentTarget.select()}
      />
      <button
        aria-label={`Copy ${ariaLabel}`}
        className="grid h-10 w-10 shrink-0 place-items-center border-l text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        type="button"
        onClick={copyValue}
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-emerald-600" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
}
