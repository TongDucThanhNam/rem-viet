import {
  createCartOrder,
  createCartOrderInputSchema,
  listOrders,
} from "@rem-viet/api/services/orders";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/api-response";
import { legacyHttpStatus } from "@/lib/legacy-api";

function unwrapBody(value: unknown) {
  if (value && typeof value === "object" && "body" in value) {
    return (value as { body: unknown }).body;
  }

  return value;
}

export const Route = createFileRoute("/api/orders")({
  server: {
    handlers: {
      GET: async () => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        return Response.json(await listOrders());
      },
      POST: async ({ request }) => {
        try {
          const body = unwrapBody(await request.json());
          const result = await createCartOrder(
            createCartOrderInputSchema.parse(body),
          );

          return Response.json(result, { status: legacyHttpStatus(result) });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
