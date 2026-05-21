import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/view-product/$productId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/products/$productId",
      params: { productId: params.productId },
    });
  },
});
