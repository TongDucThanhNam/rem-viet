import { listProducts } from "@rem-viet/api/services/products";
import { createServerFn } from "@tanstack/react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";

import ProductCard from "@/components/product-card";
import ProductPagination from "@/components/product-pagination";

export const Route = createFileRoute("/danh-sach-san-pham")({
  loader: () => getProductListPageData(),
  component: ProductListRoute,
});

type SortMode = "popular" | "latest" | "sold";

const pageSize = 8;

const sortLabels: Array<{ label: string; value: SortMode }> = [
  { label: "Phổ biến", value: "popular" },
  { label: "Mới nhất", value: "latest" },
  { label: "Bán chạy", value: "sold" },
];

export const getProductListPageData = createServerFn({ method: "GET" }).handler(
  async () => {
    const productResult = await listProducts({
      sort: "updatedAt",
      order: "desc",
    });

    return productResult.data;
  },
);

function ProductListRoute() {
  const products = Route.useLoaderData();

  return <ProductListPage products={products} />;
}

export function ProductListPage({
  products,
  currentLabel = "Danh sách sản phẩm",
}: {
  currentLabel?: string;
  products: Awaited<ReturnType<typeof getProductListPageData>>;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const sortedProducts = useMemo(() => {
    const nextProducts = [...products];

    if (sortMode === "latest") {
      return nextProducts.sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
    }

    if (sortMode === "sold") {
      return nextProducts.sort(
        (left, right) =>
          Number(right.soldQuantity ?? 0) - Number(left.soldQuantity ?? 0),
      );
    }

    return nextProducts;
  }, [products, sortMode]);
  const totalPages = Math.max(Math.ceil(sortedProducts.length / pageSize), 1);
  const visibleProducts = sortedProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function selectSortMode(value: SortMode) {
    setSortMode(value);
    setCurrentPage(1);
  }

  return (
    <main className="bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
        <div className="ml-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:ml-40">
          <Link className="hover:text-foreground" to="/">
            Trang chủ
          </Link>
          <span>/</span>
          <span>Nhà cửa và đời sống</span>
          <span>/</span>
          <span className="text-foreground">{currentLabel}</span>
        </div>

        <div className="mx-auto w-fit rounded-lg border bg-background p-4 shadow-sm">
          <div className="grid w-full grid-cols-3 rounded-lg bg-muted p-1 sm:w-fit">
            {sortLabels.map((item) => {
              const selected = sortMode === item.value;

              return (
                <button
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  key={item.value}
                  type="button"
                  onClick={() => selectSortMode(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleProducts.length ? (
          <div className="mx-auto w-full">
            <h1 className="px-0 text-2xl font-bold tracking-normal md:px-10">
              Danh sách sản phẩm
            </h1>
            <div className="mt-4 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
            <ProductPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 border bg-background text-center">
            <PackageSearch
              aria-hidden
              className="size-8 text-muted-foreground"
            />
            <div>
              <h1 className="text-sm font-medium">Chưa có sản phẩm</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Chưa có sản phẩm để hiển thị.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
