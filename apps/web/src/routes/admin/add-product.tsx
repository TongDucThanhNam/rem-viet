import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/add-product")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/products/new" });
  },
});
