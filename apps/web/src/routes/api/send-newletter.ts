import {
  createNewsletterInputSchema,
  createNewsletterSubscription,
} from "@rem-viet/api/services/orders";
import { createFileRoute } from "@tanstack/react-router";

import { apiErrorResponse } from "@/lib/api-response";

export const Route = createFileRoute("/api/send-newletter")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = (await request.json()) as { body?: unknown };
          const body = rawBody.body ?? rawBody;
          const result = await createNewsletterSubscription(
            createNewsletterInputSchema.parse(body),
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
