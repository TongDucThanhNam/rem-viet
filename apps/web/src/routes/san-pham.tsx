import { createFileRoute } from "@tanstack/react-router";

import {
  ProductListPage,
  getProductListPageData,
} from "./danh-sach-san-pham";

export const Route = createFileRoute("/san-pham")({
  loader: () => getProductListPageData(),
  component: LegacyProductListRoute,
});

function LegacyProductListRoute() {
  const products = Route.useLoaderData();

  return <ProductListPage currentLabel="Sản phẩm" products={products} />;
}
