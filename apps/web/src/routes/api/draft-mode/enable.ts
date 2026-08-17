import { validatePreviewUrl } from "@sanity/preview-url-secret";
import { withoutSecretSearchParams } from "@sanity/preview-url-secret/without-secret-search-params";
import { createFileRoute } from "@tanstack/react-router";

import {
  createSanityPreviewClient,
  getSanityPreviewEnvironment,
} from "@/lib/sanity-preview.server";
import {
  normalizeSanityPerspective,
  previewCookieHeaders,
  signSanityPerspective,
} from "@/lib/sanity-preview-session";

export const Route = createFileRoute("/api/draft-mode/enable")({
  server: {
    handlers: {
      GET: handleEnableDraftMode,
    },
  },
});

async function handleEnableDraftMode({ request }: { request: Request }) {
  const environment = getSanityPreviewEnvironment();
  const client = createSanityPreviewClient({});
  if (!environment || !client) {
    return textResponse("Sanity preview is not configured.", 503);
  }

  let validation: Awaited<ReturnType<typeof validatePreviewUrl>>;
  try {
    validation = await validatePreviewUrl(client, request.url);
  } catch (error) {
    console.error("[sanity-preview] Secret validation failed", error);
    return textResponse("Preview validation is unavailable.", 503);
  }
  if (!validation.isValid) {
    return textResponse("Invalid or expired preview secret.", 401);
  }

  let perspective;
  try {
    perspective = normalizeSanityPerspective(
      validation.studioPreviewPerspective ?? "drafts",
    );
  } catch {
    return textResponse("Invalid preview perspective.", 400);
  }
  const signature = await signSanityPerspective(
    perspective,
    environment.cookieSecret,
  );
  const headers = noStoreHeaders();
  const crossSiteIframe =
    request.headers.get("sec-fetch-dest") === "iframe" &&
    request.headers.get("sec-fetch-site") === "cross-site";
  for (const cookie of previewCookieHeaders({
    perspective,
    signature,
    partitioned: crossSiteIframe,
  })) {
    headers.append("Set-Cookie", cookie);
  }

  const target = withoutSecretSearchParams(
    new URL(validation.redirectTo ?? "/", request.url),
  );
  headers.set("Location", `${target.pathname}${target.search}${target.hash}`);
  return new Response(null, { status: 307, headers });
}

function noStoreHeaders() {
  return new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
}

function textResponse(message: string, status: number) {
  return new Response(message, { status, headers: noStoreHeaders() });
}
