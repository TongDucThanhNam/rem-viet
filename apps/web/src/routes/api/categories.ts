import {
  createCategory,
  createCategoryInputSchema,
  listCategories,
} from "@rem-viet/api/services/categories";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";

function unwrapBody(value: unknown) {
  if (value && typeof value === "object" && "body" in value) {
    return (value as { body: unknown }).body;
  }

  return value;
}

export const Route = createFileRoute("/api/categories")({
  server: {
    handlers: {
      GET: async () => {
        const result = await listCategories();

        return Response.json(result);
      },
      POST: async ({ request }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const body = unwrapBody(await request.json());
        const result = await createCategory(
          createCategoryInputSchema.parse(body),
        );

        return Response.json(result, { status: 201 });
      },
    },
  },
});
