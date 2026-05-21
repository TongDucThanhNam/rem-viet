import {
  deleteCategory,
  updateCategory,
  updateCategoryInputSchema,
} from "@rem-viet/api/services/categories";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import { legacyHttpStatus } from "@/lib/legacy-api";

function unwrapBody(value: unknown) {
  if (value && typeof value === "object" && "body" in value) {
    return (value as { body: unknown }).body;
  }

  return value;
}

export const Route = createFileRoute("/api/categories/$categoryId")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const body = unwrapBody(await request.json()) as Record<
          string,
          unknown
        >;
        const result = await updateCategory(
          updateCategoryInputSchema.parse({
            ...body,
            categoryId: params.categoryId,
          }),
        );

        return Response.json(result, {
          status: legacyHttpStatus(result),
        });
      },
      DELETE: async ({ params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const result = await deleteCategory({
          categoryId: params.categoryId,
        });

        return Response.json(result, {
          status: legacyHttpStatus(result),
        });
      },
    },
  },
});
