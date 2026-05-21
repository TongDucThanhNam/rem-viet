import { env } from "@rem-viet/env/server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/get-bookmark")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const targetUrl = requestUrl.searchParams.get("url");

        if (!targetUrl) {
          return Response.json(
            { error: "URL parameter is missing" },
            { status: 400 },
          );
        }

        const apiKey = env.JSONLINK_API_KEY;
        const apiUrl = new URL("https://jsonlink.io/api/extract");

        apiUrl.searchParams.set("url", targetUrl);
        if (apiKey) {
          apiUrl.searchParams.set("api_key", apiKey);
        }

        try {
          const response = await fetch(apiUrl);

          if (!response.ok) {
            return Response.json(
              { error: response.statusText },
              { status: response.status },
            );
          }

          return Response.json(await response.json());
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
