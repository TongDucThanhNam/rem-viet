import { listProducts, listProductsInputSchema } from "@rem-viet/api/services/products";
import { createFileRoute } from "@tanstack/react-router";

function getSearchParams(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());

  return listProductsInputSchema.parse({
    ...raw,
    isActive:
      raw.isActive === undefined
        ? undefined
        : raw.isActive === "true" || raw.isActive === "1",
    isDeleted:
      raw.isDeleted === undefined
        ? undefined
        : raw.isDeleted === "true" || raw.isDeleted === "1",
  });
}

export const Route = createFileRoute("/api/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await listProducts(getSearchParams(request));

        return Response.json(result);
      },
    },
  },
});
