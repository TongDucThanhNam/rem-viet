import { buttonVariants } from "@rem-viet/ui/components/button";
import { Card, CardContent, CardFooter } from "@rem-viet/ui/components/card";
import { Link } from "@tanstack/react-router";

import { SolarStarLinear } from "@/components/legacy-icons";
import { formatProductPrice } from "@/lib/price";
import { productImageUrl } from "@/lib/site-config";

type ProductCardProps = {
  product: {
    _id: string;
    name: string;
    description?: string | null;
    price?: string | null;
    imageUrls: string[];
    rating?: number;
    reviewsCount?: number;
  };
};

function formatRating(rating?: number) {
  const value = Math.min(Math.max(Number(rating ?? 0), 0), 5);

  return value
    ? new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 1,
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      }).format(value)
    : "5";
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="overflow-hidden rounded-lg bg-background shadow-sm transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-background">
        <img
          alt={product.name}
          className="size-full object-contain"
          loading="lazy"
          src={productImageUrl(product.imageUrls[0])}
        />
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold tracking-normal">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="text-xl font-bold">
            {formatProductPrice(product.price)}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <SolarStarLinear
              aria-hidden
              className="size-4 text-yellow-500"
            />
            {formatRating(product.rating)}
          </span>
        </div>
      </CardContent>
      <CardFooter className="border-0 p-4 pt-0">
        <Link
          className={buttonVariants({
            className: "h-10 w-full rounded-lg",
            size: "lg",
          })}
          params={{ productId: product._id }}
          to="/san-pham/$productId"
        >
          Xem chi tiết
        </Link>
      </CardFooter>
    </Card>
  );
}
