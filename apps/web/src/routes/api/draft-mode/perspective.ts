import { createFileRoute } from "@tanstack/react-router";

import { getSanityPreviewEnvironment } from "@/lib/sanity-preview.server";
import {
  normalizeSanityPerspective,
  previewCookieHeaders,
  readSignedSanityPerspective,
  serializeSanityPerspective,
  signSanityPerspective,
} from "@/lib/sanity-preview-session";

export const Route = createFileRoute("/api/draft-mode/perspective")({
  server: {
    handlers: {
      POST: handlePerspectiveChange,
    },
  },
});

async function handlePerspectiveChange({ request }: { request: Request }) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  const environment = getSanityPreviewEnvironment();
  if (!environment) {
    return new Response("Sanity preview is not configured.", {
      status: 503,
      headers,
    });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response("Cross-origin perspective change rejected.", {
      status: 403,
      headers,
    });
  }

  const current = await readSignedSanityPerspective(
    request.headers.get("cookie"),
    environment.cookieSecret,
  );
  if (!current) {
    return new Response("Preview session is invalid.", {
      status: 401,
      headers,
    });
  }

  let next;
  let partitioned = false;
  try {
    const body = (await request.json()) as {
      perspective?: unknown;
      partitioned?: unknown;
    };
    next = normalizeSanityPerspective(body.perspective);
    partitioned = body.partitioned === true;
  } catch {
    return new Response("Invalid preview perspective.", {
      status: 400,
      headers,
    });
  }
  if (
    serializeSanityPerspective(current) === serializeSanityPerspective(next)
  ) {
    return new Response(null, { status: 204, headers });
  }

  const signature = await signSanityPerspective(next, environment.cookieSecret);
  for (const cookie of previewCookieHeaders({
    perspective: next,
    signature,
    partitioned,
  })) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 200, headers });
}
