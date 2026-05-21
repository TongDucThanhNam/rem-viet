import {
  createProduct,
  createProductInputSchema,
} from "@rem-viet/api/services/products";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/api-response";

export const Route = createFileRoute("/api/product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const unauthorized = await requireApiSession();

          if (unauthorized) {
            return unauthorized;
          }

          const rawBody = (await request.json()) as { body?: unknown };
          const body = rawBody.body ?? rawBody;
          const result = await createProduct(
            createProductInputSchema.parse(body),
          );

          return Response.json(result, { status: 200 });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
