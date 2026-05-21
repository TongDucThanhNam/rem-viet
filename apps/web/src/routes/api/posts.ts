import { listPosts, listPostsInputSchema } from "@rem-viet/api/services/posts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const result = await listPosts(listPostsInputSchema.parse({ status }));

        return Response.json(result);
      },
    },
  },
});
