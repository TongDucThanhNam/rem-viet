import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/edit-product/$productId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/products/$productId/edit",
      params: { productId: params.productId },
    });
  },
});
