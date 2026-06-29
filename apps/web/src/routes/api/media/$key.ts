import { env } from "@rem-viet/env/server";
import { createFileRoute } from "@tanstack/react-router";

import { isMediaObjectKey } from "@/lib/media";

export const Route = createFileRoute("/api/media/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isMediaObjectKey(params.key)) {
          return new Response("Media not found", { status: 404 });
        }

        const bucket = (env as Env & { PRODUCT_IMAGES?: R2Bucket })
          .PRODUCT_IMAGES;

        if (!bucket) {
          return new Response("Media storage is not configured", {
            status: 500,
          });
        }

        const object = await bucket.get(params.key);

        if (!object) {
          return new Response("Media not found", { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("cache-control", "public, max-age=31536000, immutable");

        return new Response(object.body, { headers });
      },
    },
  },
});
