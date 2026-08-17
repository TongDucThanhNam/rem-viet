import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products")({
  component: ProductsLayoutRoute,
});

function ProductsLayoutRoute() {
  return <Outlet />;
}
