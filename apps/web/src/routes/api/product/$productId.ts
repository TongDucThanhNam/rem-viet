import {
  deleteProduct,
  getProductById,
  updateProduct,
  updateProductInputSchema,
} from "@rem-viet/api/services/products";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/api-response";
import { legacyHttpStatus } from "@/lib/legacy-api";

export const Route = createFileRoute("/api/product/$productId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const result = await getProductById({
          productId: params.productId,
        });

        return Response.json(result, { status: legacyHttpStatus(result) });
      },
      PUT: async ({ request, params }) => {
        try {
          const unauthorized = await requireApiSession();

          if (unauthorized) {
            return unauthorized;
          }

          const rawBody = (await request.json()) as { body?: unknown };
          const body = rawBody.body ?? rawBody;
          const result = await updateProduct(
            updateProductInputSchema.parse({
              ...(body as Record<string, unknown>),
              productId: params.productId,
            }),
          );

          return Response.json(result, { status: legacyHttpStatus(result) });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
      DELETE: async ({ params }) => {
        try {
          const unauthorized = await requireApiSession();

          if (unauthorized) {
            return unauthorized;
          }

          const result = await deleteProduct({
            productId: params.productId,
          });

          return Response.json(result, { status: legacyHttpStatus(result) });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
