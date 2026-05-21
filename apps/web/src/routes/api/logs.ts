import {
  createLog,
  createLogInputSchema,
  listLogs,
  listLogsInputSchema,
} from "@rem-viet/api/services/logs";
import { createFileRoute } from "@tanstack/react-router";

import { requireApiSession } from "@/lib/api-auth";

function unwrapBody(value: unknown) {
  if (value && typeof value === "object" && "body" in value) {
    return (value as { body: unknown }).body;
  }

  return value;
}

function getSearchParams(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());

  return listLogsInputSchema.parse({
    ...raw,
    isActive:
      raw.isActive === undefined
        ? undefined
        : raw.isActive === "true" || raw.isActive === "1",
    isDeleted:
      raw.isDeleted === undefined
        ? undefined
        : raw.isDeleted === "true" || raw.isDeleted === "1",
  });
}

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const result = await listLogs(getSearchParams(request));

        return Response.json(result);
      },
      POST: async ({ request }) => {
        const unauthorized = await requireApiSession();

        if (unauthorized) {
          return unauthorized;
        }

        const body = unwrapBody(await request.json());
        const result = await createLog(createLogInputSchema.parse(body));

        return Response.json(result, { status: 201 });
      },
    },
  },
});
