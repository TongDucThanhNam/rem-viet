import {
  createProductOrder,
  createProductOrderInputSchema,
} from "@rem-viet/api/services/orders";
import { createFileRoute } from "@tanstack/react-router";

import { apiErrorResponse } from "@/lib/api-response";

export const Route = createFileRoute("/api/send-product-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = (await request.json()) as { body?: unknown };
          const body = rawBody.body ?? rawBody;
          const result = await createProductOrder(
            createProductOrderInputSchema.parse(body),
          );

          if (result.statusCode >= 200 && result.statusCode < 300) {
            return Response.json({ statusCode: 200 }, { status: 200 });
          }

          return Response.json(result, { status: 500 });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
