import { createFileRoute } from "@tanstack/react-router";

import {
  fetchSanityPreviewPage,
  sanityPreviewStatusCode,
} from "@/lib/sanity-preview.server";

export const Route = createFileRoute("/api/draft-mode/page/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const result = await fetchSanityPreviewPage(request, params.id.trim());
        const headers = {
          "Cache-Control": "private, no-store, max-age=0",
          Pragma: "no-cache",
          Vary: "Cookie",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        };
        return Response.json(result, {
          status:
            result.status === "ok"
              ? 200
              : sanityPreviewStatusCode(result.status),
          headers,
        });
      },
    },
  },
});
