import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/add-inventory")({
  validateSearch: (search: Record<string, unknown>) => ({
    productId:
      typeof search.productId === "string" ? search.productId : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/admin/inventory/new",
      search,
    });
  },
});
