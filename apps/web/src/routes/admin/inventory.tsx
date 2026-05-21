import { createFileRoute, redirect } from "@tanstack/react-router";

import { InventoryPage } from "@/components/admin-inventory";
import { getAdminUser } from "@/functions/get-admin-user";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryPage,
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
