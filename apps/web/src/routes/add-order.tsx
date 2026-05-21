import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/add-order")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/orders/new" });
  },
});
