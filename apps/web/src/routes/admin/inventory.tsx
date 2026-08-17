import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryLayoutRoute,
});

function InventoryLayoutRoute() {
  return <Outlet />;
}
