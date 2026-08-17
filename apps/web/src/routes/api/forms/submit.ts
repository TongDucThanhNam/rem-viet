import { publicFormSubmissionSchema } from "@rem-viet/cms";
import { submitForm } from "@rem-viet/api/services/operations";
import { createFileRoute } from "@tanstack/react-router";

import { apiErrorResponse } from "@/lib/api-response";

const maxBodyBytes = 32 * 1024;

export const Route = createFileRoute("/api/forms/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(
            request.headers.get("content-length") ?? 0,
          );
          if (contentLength > maxBodyBytes) {
            return Response.json(
              { message: "Payload quá lớn." },
              { status: 413 },
            );
          }
          const text = await request.text();
          if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
            return Response.json(
              { message: "Payload quá lớn." },
              { status: 413 },
            );
          }
          const input = publicFormSubmissionSchema.parse(JSON.parse(text));
          const result = await submitForm(input, {
            ip:
              request.headers.get("cf-connecting-ip") ??
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
              "unknown",
            userAgent: request.headers.get("user-agent") ?? "",
          });
          return Response.json(result, {
            status: 202,
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
