import { env } from "@rem-viet/env/server";
import {
  getMediaDeliveryPolicy,
  verifyPrivateMediaDelivery,
} from "@rem-viet/api/services/media-delivery";
import { createFileRoute } from "@tanstack/react-router";

import { isMediaObjectKey } from "@/lib/media";

export const Route = createFileRoute("/api/media/$key")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!isMediaObjectKey(params.key)) {
          return new Response("Media not found", { status: 404 });
        }

        const policy = await getMediaDeliveryPolicy(params.key, env.DB);
        const now = Date.now();
        if (
          !policy ||
          policy.status !== "active" ||
          (policy.expiresAt !== null && policy.expiresAt <= now)
        ) {
          return new Response("Media not found", { status: 404 });
        }

        if (policy.visibility === "private") {
          const url = new URL(request.url);
          const allowed = await verifyPrivateMediaDelivery({
            key: params.key,
            expires: url.searchParams.get("expires"),
            signature: url.searchParams.get("signature"),
            secret: env.BETTER_AUTH_SECRET,
          });
          if (!allowed) {
            return new Response("Media not found", { status: 404 });
          }
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
        headers.set(
          "cache-control",
          policy.visibility === "private"
            ? "private, no-store"
            : "public, max-age=31536000, immutable",
        );

        return new Response(object.body, { headers });
      },
    },
  },
});
