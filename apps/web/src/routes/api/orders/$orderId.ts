import {
  getOrderById,
  updateOrderStatus,
  updateOrderStatusInputSchema,
} from "@rem-viet/api/services/orders";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";

function unwrapBody(value: unknown) {
  if (value && typeof value === "object" && "body" in value) {
    return (value as { body: unknown }).body;
  }

  return value;
}

export const Route = createFileRoute("/api/orders/$orderId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const result = await getOrderById({ orderId: params.orderId });

        return Response.json(result, {
          status: result.statusCode === 404 ? 404 : 200,
        });
      },
      PATCH: async ({ request, params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const body = unwrapBody(await request.json()) as Record<
          string,
          unknown
        >;
        const result = await updateOrderStatus(
          updateOrderStatusInputSchema.parse({
            ...body,
            orderId: params.orderId,
          }),
        );

        return Response.json(result, {
          status: result.statusCode === 404 ? 404 : 200,
        });
      },
      PUT: async ({ request, params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const body = unwrapBody(await request.json()) as Record<
          string,
          unknown
        >;
        const result = await updateOrderStatus(
          updateOrderStatusInputSchema.parse({
            ...body,
            orderId: params.orderId,
          }),
        );

        return Response.json(result, {
          status: result.statusCode === 404 ? 404 : 200,
        });
      },
    },
  },
});
