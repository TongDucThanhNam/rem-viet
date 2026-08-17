import { createFileRoute } from "@tanstack/react-router";

import { handleSanityWebhook } from "@/lib/sanity-webhook.server";

export const Route = createFileRoute("/api/sanity/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleSanityWebhook(request),
    },
  },
});
