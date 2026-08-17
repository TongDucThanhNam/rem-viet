import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products/$productId")({
  component: ProductLayoutRoute,
});

function ProductLayoutRoute() {
  return <Outlet />;
}
