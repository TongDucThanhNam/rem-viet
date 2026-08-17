import { webVitalReportSchema } from "@rem-viet/cms";
import { recordWebVital } from "@rem-viet/api/services/vitals";
import { createFileRoute } from "@tanstack/react-router";

import { apiErrorResponse } from "@/lib/api-response";

const maxBodyBytes = 2 * 1_024;

export const Route = createFileRoute("/api/vitals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(
            request.headers.get("content-length") ?? 0,
          );
          if (contentLength > maxBodyBytes) {
            return Response.json(
              { message: "Payload too large." },
              { status: 413 },
            );
          }
          const text = await request.text();
          if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
            return Response.json(
              { message: "Payload too large." },
              { status: 413 },
            );
          }
          const requestOrigin = request.headers.get("origin");
          if (requestOrigin !== new URL(request.url).origin) {
            return Response.json(
              { message: "Same-origin request required." },
              { status: 403 },
            );
          }
          if (
            !request.headers
              .get("content-type")
              ?.toLowerCase()
              .startsWith("application/json")
          ) {
            return Response.json(
              { message: "Expected application/json." },
              { status: 415 },
            );
          }
          const report = webVitalReportSchema.parse(JSON.parse(text));
          await recordWebVital(report);
          return Response.json(
            { accepted: true },
            {
              status: 202,
              headers: { "Cache-Control": "no-store" },
            },
          );
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
