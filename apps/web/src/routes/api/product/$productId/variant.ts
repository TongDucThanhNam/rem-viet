import { getProductWithVariantsById } from "@rem-viet/api/services/products";
import { createFileRoute } from "@tanstack/react-router";

import {
  legacyHttpStatus,
  stringifyLegacyVariantValues,
} from "@/lib/legacy-api";

export const Route = createFileRoute("/api/product/$productId/variant")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const result = await getProductWithVariantsById({
          productId: params.productId,
        });

        return Response.json(stringifyLegacyVariantValues(result), {
          status: legacyHttpStatus(result),
        });
      },
    },
  },
});
