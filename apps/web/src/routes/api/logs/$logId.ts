import {
  deleteLog,
  getLogById,
  logIdInputSchema,
  updateLog,
  updateLogInputSchema,
} from "@rem-viet/api/services/logs";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";
import { legacyHttpStatus } from "@/lib/legacy-api";

function unwrapBody(value: unknown) {
  if (value && typeof value === "object" && "body" in value) {
    return (value as { body: unknown }).body;
  }

  return value;
}

export const Route = createFileRoute("/api/logs/$logId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const input = logIdInputSchema.parse({ logId: params.logId });
        const result = await getLogById(input);

        return Response.json(result, { status: legacyHttpStatus(result) });
      },
      PUT: async ({ request, params }) => {
        const unauthorized = await requireApiSession(request);

        if (unauthorized) {
          return unauthorized;
        }

        const body = unwrapBody(await request.json()) as Record<
          string,
          unknown
        >;
        const result = await updateLog(
          updateLogInputSchema.parse({ ...body, logId: params.logId }),
        );

        return Response.json(result, { status: legacyHttpStatus(result) });
      },
      DELETE: async ({ params }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const input = logIdInputSchema.parse({ logId: params.logId });
        const result = await deleteLog(input);

        return Response.json(result, { status: legacyHttpStatus(result) });
      },
    },
  },
});
