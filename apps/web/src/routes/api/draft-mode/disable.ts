import { createFileRoute } from "@tanstack/react-router";

import { expiredPreviewCookieHeaders } from "@/lib/sanity-preview-session";

export const Route = createFileRoute("/api/draft-mode/disable")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const headers = new Headers({
          "Cache-Control": "private, no-store, max-age=0",
          Location: internalRedirect(
            new URL(request.url).searchParams.get("redirect"),
            request.url,
          ),
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        });
        for (const cookie of expiredPreviewCookieHeaders()) {
          headers.append("Set-Cookie", cookie);
        }
        return new Response(null, { status: 307, headers });
      },
    },
  },
});

function internalRedirect(value: string | null, requestUrl: string) {
  const target = new URL(value || "/", requestUrl);
  return `${target.pathname}${target.search}${target.hash}`;
}
