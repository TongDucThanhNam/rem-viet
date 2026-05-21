import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import HeroSection from "@/components/hero-section";
import {
  FaqSection,
  FeatureSection,
  GuideSection,
  HomeNewsletterSection,
  MaterialSection,
  MosquitoGuardSection,
  OurStrengthSection,
  ReviewSection,
  SizeEstimatorSection,
  VideoSection,
} from "@/components/home-sections";
import ProductCard from "@/components/product-card";
import ProductPagination from "@/components/product-pagination";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const trpc = useTRPC();
  const [currentPage, setCurrentPage] = useState(1);
  const productsQuery = useQuery(
    trpc.products.list.queryOptions({
      sort: "updatedAt",
      order: "desc",
    }),
  );
  const productList = productsQuery.data?.data ?? [];
  const itemsPerPage = 8;
  const totalPages = Math.max(Math.ceil(productList.length / itemsPerPage), 1);
  const visibleProducts = useMemo(
    () =>
      productList.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    [currentPage, productList],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [productList.length]);

  return (
    <main className="max-w-screen bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]">
      <section
        className="flex w-full items-center justify-center px-4 py-6"
        id="hero"
      >
        <HeroSection />
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
        <div className="ml-0 mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:ml-40">
          <Link className="hover:text-foreground" to="/">
            Trang chủ
          </Link>
          <span>/</span>
          <span>Nhà cửa và đời sống</span>
          <span>/</span>
          <span className="text-foreground">Nhà bếp</span>
        </div>

        <div className="mx-auto w-fit rounded-lg border bg-background p-4 shadow-sm">
          <div className="grid w-full grid-cols-3 rounded-lg bg-muted p-1 sm:w-fit">
            {["Phổ biến", "Mới nhất", "Bán chạy"].map((label, index) => (
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium ${index === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                disabled
                key={label}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {productsQuery.isLoading ? (
          <div className="mx-auto w-full">
            <h2 className="px-0 text-2xl font-bold tracking-normal md:px-10">
              Danh sách sản phẩm
            </h2>
            <div className="mt-4 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  className="h-72 animate-pulse rounded-lg border bg-muted/30"
                  key={index}
                />
              ))}
            </div>
          </div>
        ) : productList.length ? (
          <div className="mx-auto w-full">
            <h2 className="px-0 text-2xl font-bold tracking-normal md:px-10">
              Danh sách sản phẩm
            </h2>
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
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 border text-center">
            <PackageSearch
              aria-hidden
              className="size-8 text-muted-foreground"
            />
            <div>
              <h2 className="text-sm font-medium">Chưa có sản phẩm</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Chưa có sản phẩm để hiển thị.
              </p>
            </div>
          </div>
        )}
      </section>

      <MosquitoGuardSection />
      <VideoSection />
      <FeatureSection />
      <OurStrengthSection />
      <ReviewSection />
      <GuideSection />
      <SizeEstimatorSection />
      <MaterialSection />
      <FaqSection />
      <HomeNewsletterSection />
    </main>
  );
}
