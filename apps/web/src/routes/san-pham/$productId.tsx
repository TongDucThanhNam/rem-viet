import { getProductWithVariantsById } from "@rem-viet/api/services/products";
import { useMutation } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  CreditCard,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import SwiperThumbnail from "@/components/product-thumbnail";
import ReviewSummary from "@/components/review-summary";
import { addCartItem, formatCurrency, parseProductPrice } from "@/lib/cart";
import { formatProductPrice } from "@/lib/price";
import { normalizeVariantValues } from "@/lib/variants";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/san-pham/$productId")({
  loader: ({ params }) =>
    getProductPageData({ data: { productId: params.productId } }),
  component: ProductRoute,
});

const getProductPageData = createServerFn({ method: "GET" })
  .inputValidator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    return getProductWithVariantsById({
      productId: data.productId,
    });
  });

function formatRating(rating?: number) {
  const value = Math.min(Math.max(Number(rating ?? 0), 0), 5);

  return value
    ? new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 1,
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      }).format(value)
    : "5";
}

function ratingStars(rating?: number) {
  const value = Math.round(Math.min(Math.max(Number(rating ?? 0), 0), 5));

  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

function productRatingLabel(rating?: number, reviewsCount?: number) {
  if (!reviewsCount) {
    return "5 lượt đánh giá";
  }

  return `${formatRating(rating)} / 5 · ${reviewsCount} lượt đánh giá`;
}

function ProductRoute() {
  const productResult = Route.useLoaderData();
  const trpc = useTRPC();
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {},
  );
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const createProductOrder = useMutation(
    trpc.orders.createProduct.mutationOptions({
      onSuccess: () => {
        setQuickOrderOpen(false);
        toast.success("Đã ghi nhận đơn hàng.");
      },
      onError: () => {
        toast.error("Không thể gửi đơn hàng. Vui lòng thử lại.");
      },
    }),
  );
  const product = productResult.data?.product;
  const variants = productResult.data?.variants ?? [];
  const variantOptions = useMemo(() => {
    const options: Record<string, string[]> = {};

    for (const variant of variants) {
      for (const [key, value] of Object.entries(
        normalizeVariantValues(variant.values),
      )) {
        options[key] ??= [];
        if (!options[key].includes(value)) {
          options[key].push(value);
        }
      }
    }

    return options;
  }, [variants]);
  const variantKeys = Object.keys(variantOptions);
  const hasVariants = variantKeys.length > 0;
  const isCompleteVariantSelection =
    hasVariants &&
    variantKeys.every((key) => Boolean(selectedValues[key])) &&
    Object.keys(selectedValues).length === variantKeys.length;
  const selectedVariant = isCompleteVariantSelection
    ? variants.find((variant) => {
        const entries = Object.entries(normalizeVariantValues(variant.values));

        return (
          entries.length > 0 &&
          entries.every(([key, value]) => selectedValues[key] === value)
        );
      })
    : undefined;
  const isValidVariantSelection = hasVariants ? Boolean(selectedVariant) : true;
  const selectedPrice =
    selectedVariant?.variantPrice ?? parseProductPrice(product?.price);

  function addCurrentProductToCart() {
    if (!product) {
      return;
    }
    if (!isValidVariantSelection) {
      toast.error("Vui lòng chọn đúng biến thể sản phẩm.");
      return;
    }

    addCartItem({
      productId: product._id,
      name: product.name,
      price: selectedPrice,
      imageUrl: product.imageUrls[0],
      variants: selectedValues,
    });
    toast.success("Đã thêm sản phẩm vào giỏ hàng.");
  }

  function openQuickOrder() {
    if (!isValidVariantSelection) {
      toast.error("Vui lòng chọn đúng biến thể sản phẩm.");
      return;
    }

    setQuickOrderOpen((value) => !value);
  }

  function submitQuickOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) {
      return;
    }
    if (!isValidVariantSelection) {
      toast.error("Vui lòng chọn đúng biến thể sản phẩm.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const formValues = Object.fromEntries(formData.entries());

    createProductOrder.mutate({
      product,
      productPrice: selectedPrice,
      variantChosen: selectedValues,
      info: {
        email: String(formValues.email ?? ""),
        firstName: String(formValues.firstName ?? ""),
        lastName: String(formValues.lastName ?? ""),
        phoneNumber: String(formValues.phoneNumber ?? ""),
        address: String(formValues.address ?? ""),
        specificAddress: String(formValues.specificAddress ?? ""),
        district: String(formValues.district ?? ""),
        city: String(formValues.city ?? ""),
        postcode: String(formValues.postcode ?? ""),
      },
    });
  }

  return (
    <main>
      <section className="flex min-h-[calc(100svh-4rem)] items-center justify-center p-4">
        <div className="h-full w-full max-w-[96rem] px-2 lg:px-24">
          {product ? (
            <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
              <div className="relative h-full w-full flex-none">
                <SwiperThumbnail
                  imageUrls={product.imageUrls}
                  isLoading={false}
                />
              </div>

              <aside className="flex flex-col">
                <div>
                  <h1 className="inline bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
                    {product.name}
                  </h1>
                  <p className="text-xl font-medium tracking-tight">
                    {selectedVariant
                      ? formatCurrency(selectedVariant.variantPrice)
                      : formatProductPrice(product.price)}
                  </p>
                  <div className="my-2 flex items-center gap-2">
                    <span aria-hidden>
                      {product.reviewsCount
                        ? ratingStars(product.rating)
                        : "⭐⭐⭐⭐⭐"}
                    </span>
                    <span>
                      {productRatingLabel(product.rating, product.reviewsCount)}
                    </span>
                  </div>
                </div>

                <div className="h-12" />

                <div className="grid gap-4">
                  {Object.entries(variantOptions).map(([key, values]) => (
                    <div className="flex flex-col gap-2" key={key}>
                      <p className="text-lg font-semibold">{key}</p>
                      <div className="flex flex-wrap gap-3">
                        {values.map((value) => {
                          const selected = selectedValues[key] === value;

                          return (
                            <button
                              className={`inline-flex h-8 min-w-min max-w-fit items-center justify-between whitespace-nowrap rounded-sm px-2 text-sm transition-colors active:scale-95 ${selected ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/60 text-foreground hover:bg-muted"}`}
                              key={value}
                              type="button"
                              onClick={() =>
                                setSelectedValues((current) => ({
                                  ...current,
                                  [key]: value,
                                }))
                              }
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-2 rounded-lg border bg-background p-2">
                  {[
                    {
                      title: "Mô tả sản phẩm",
                      icon: ChevronDown,
                      content: product.description || "Chưa có mô tả sản phẩm.",
                      preview: product.description || "Chưa có mô tả sản phẩm.",
                    },
                    {
                      title: "Thanh toán và trả hàng",
                      icon: ShieldCheck,
                      content:
                        "Bạn chỉ phải trả tiền khi sản phẩm đúng với mô tả\nBạn có thể trả hàng trong vòng 3 ngày",
                      preview: null,
                    },
                    {
                      title: "Hoá đơn và bảo hành",
                      icon: ReceiptText,
                      content: "Chúng tôi có thể gửi hoá đơn đến email cho bạn",
                      preview: null,
                    },
                  ].map(({ title, icon: Icon, content, preview }) => (
                    <details
                      className="group rounded-md border border-transparent px-3 py-2 transition-colors open:border-border open:bg-muted/30"
                      key={title}
                    >
                      <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="flex min-h-10 items-center gap-2 text-sm font-medium">
                          <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                            <Icon aria-hidden className="size-4" />
                          </span>
                          {title}
                          <ChevronDown
                            aria-hidden
                            className="ml-auto size-4 transition-transform group-open:rotate-180"
                          />
                        </span>
                        {preview ? (
                          <span className="ml-10 mt-1 block line-clamp-3 text-sm text-muted-foreground group-open:hidden">
                            {preview}
                          </span>
                        ) : null}
                      </summary>
                      {content.includes("\n") ? (
                        <ul className="ml-10 mt-3 list-inside list-disc text-sm leading-6 text-muted-foreground">
                          {content.split("\n").map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="ml-10 mt-3 text-sm leading-6 text-muted-foreground">
                          {content}
                        </p>
                      )}
                    </details>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <Button
                    className="rounded-lg"
                    size="lg"
                    onClick={openQuickOrder}
                  >
                    <CreditCard aria-hidden />
                    Mua ngay
                  </Button>
                  <Button
                    className="rounded-lg"
                    disabled={!isValidVariantSelection}
                    size="lg"
                    variant="secondary"
                    onClick={addCurrentProductToCart}
                  >
                    <ShoppingCart aria-hidden />
                    Thêm vào giỏ hàng
                  </Button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 border text-center">
              <PackageSearch
                aria-hidden
                className="size-8 text-muted-foreground"
              />
              <div>
                <h1 className="text-sm font-medium">Không tìm thấy sản phẩm</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sản phẩm này không còn khả dụng.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {product && quickOrderOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/50 p-0 backdrop-blur-sm sm:p-4">
          <Card className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border bg-background shadow-2xl sm:rounded-2xl">
            <CardContent>
              <form className="grid gap-4 py-2" onSubmit={submitQuickOrder}>
                <div className="flex items-center justify-between gap-3 border-b pb-4">
                  <h2 className="text-lg font-semibold tracking-normal">
                    Thanh toán
                  </h2>
                  <Button
                    aria-label="Đóng"
                    className="rounded-lg"
                    size="icon"
                    type="button"
                    variant="ghost"
                    onClick={() => setQuickOrderOpen(false)}
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">Họ của bạn</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="Nhập họ của bạn"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Tên của bạn</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Nhập tên của bạn"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email của bạn</Label>
                    <Input
                      id="email"
                      name="email"
                      placeholder="Nhập email của bạn"
                      type="email"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phoneNumber">Số điện thoại</Label>
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      placeholder="0901234567"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="address">Địa chỉ</Label>
                    <Input
                      id="address"
                      name="address"
                      placeholder="Lê Văn Lương, Quận 7, TP.HCM"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="specificAddress">Specific address</Label>
                    <Input
                      id="specificAddress"
                      name="specificAddress"
                      placeholder="Đại học RMIT"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="district">Quận, huyện</Label>
                    <Input
                      id="district"
                      name="district"
                      placeholder="Quận 7"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="city">Tỉnh/Thành phố</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="Hồ Chí Minh"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postcode">Mã bưu điện</Label>
                    <Input id="postcode" name="postcode" placeholder="700000" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    className="rounded-lg"
                    type="button"
                    variant="ghost"
                    onClick={() => setQuickOrderOpen(false)}
                  >
                    Huỷ
                  </Button>
                  <Button
                    className="rounded-lg"
                    disabled={createProductOrder.isPending}
                    type="submit"
                  >
                    {createProductOrder.isPending
                      ? "Đang gửi..."
                      : "Tiến hành thanh toán"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {product ? (
        <ReviewSummary
          rating={product.rating ?? 0}
          reviewsCount={product.reviewsCount ?? 0}
        />
      ) : null}
    </main>
  );
}
