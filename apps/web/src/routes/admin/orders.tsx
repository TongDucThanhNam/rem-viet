import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersLayoutRoute,
});

function OrdersLayoutRoute() {
  return <Outlet />;
}
