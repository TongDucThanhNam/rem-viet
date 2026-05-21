import { createFileRoute, redirect } from "@tanstack/react-router";

import { AddInventoryPage } from "@/components/admin-inventory";
import { getAdminUser } from "@/functions/get-admin-user";

export const Route = createFileRoute("/admin/inventory/new")({
  component: AddInventoryRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    productId:
      typeof search.productId === "string" ? search.productId : undefined,
  }),
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

function AddInventoryRoute() {
  const { productId } = Route.useSearch();

  return <AddInventoryPage initialProductId={productId} />;
}
