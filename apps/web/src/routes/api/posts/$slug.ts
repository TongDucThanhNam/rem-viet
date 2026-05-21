import { getPostBySlug } from "@rem-viet/api/services/posts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/posts/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const result = await getPostBySlug({ slug: params.slug });

        if (!result) {
          return Response.json({ error: "Post not found" }, { status: 404 });
        }

        return Response.json(result);
      },
    },
  },
});
