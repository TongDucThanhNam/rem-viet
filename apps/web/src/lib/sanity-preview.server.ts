import { stripSanityArrayKeys } from "@agency/cms-provider-sanity";
import { SANITY_RECOMMENDED_API_VERSION } from "@agency/cms-provider-sanity";
import { createClient, type ClientPerspective } from "@sanity/client";
import { stegaClean } from "@sanity/client/stega";
import { toLegacyRemVietTemplateBlock } from "@agency/cms-template-rem-viet";
import { parseRemVietHomeContent } from "@rem-viet/api/services/home-page-runtime";
import { homeBlockSchema } from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";
import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";

import { readSanityPreviewEnvironment } from "./sanity-preview-config";
import { materializeRemVietSanityImages } from "./sanity-preview-images";
import { remVietSanityPageQuery } from "./sanity-preview-query";
import { readSignedSanityPerspective } from "./sanity-preview-session";

export function getSanityPreviewEnvironment() {
  return readSanityPreviewEnvironment(
    env as unknown as Record<string, unknown>,
  );
}

export function createSanityPreviewClient(input: {
  perspective?: ClientPerspective;
  stega?: boolean;
}) {
  const environment = getSanityPreviewEnvironment();
  if (!environment) return null;
  const stega = input.stega ?? false;
  return createClient({
    projectId: environment.projectId,
    dataset: environment.dataset,
    apiVersion: SANITY_RECOMMENDED_API_VERSION,
    useCdn: false,
    token: environment.readToken,
    perspective: input.perspective ?? "raw",
    stega: {
      enabled: stega,
      studioUrl: environment.studioUrl,
    },
  });
}

export async function loadSanityPreviewPage(agencyId: string) {
  const request = getRequest();
  const environment = getSanityPreviewEnvironment();
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");
  setResponseHeader("Pragma", "no-cache");
  setResponseHeader("Vary", "Cookie");
  setResponseHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  if (environment) {
    setResponseHeader(
      "Content-Security-Policy",
      `frame-ancestors ${new URL(environment.studioUrl).origin}`,
    );
  }
  const result = await fetchSanityPreviewPage(request, agencyId);
  if (result.status !== "ok") {
    setResponseStatus(sanityPreviewStatusCode(result.status));
  }
  return result;
}

export async function fetchSanityPreviewPage(
  request: Request,
  agencyId: string,
) {
  const environment = getSanityPreviewEnvironment();
  if (!environment) return { status: "not-configured" as const };

  const perspective = await readSignedSanityPerspective(
    request.headers.get("cookie"),
    environment.cookieSecret,
  );
  if (!perspective) return { status: "unauthorized" as const };

  const client = createSanityPreviewClient({ perspective, stega: true });
  const record = await client!.fetch<{ content: unknown } | null>(
    remVietSanityPageQuery,
    { agencyId },
  );
  if (!record) return { status: "not-found" as const };

  try {
    const materialized = materializeRemVietSanityImages(record.content, {
      projectId: environment.projectId,
      dataset: environment.dataset,
    });
    const content = parseRemVietHomeContent(stripSanityArrayKeys(materialized));
    return {
      status: "ok" as const,
      title: stegaClean(content.title),
      blocks: homeBlockSchema
        .array()
        .parse(content.blocks.map(toLegacyRemVietTemplateBlock)),
    };
  } catch (error) {
    console.error("[sanity-preview] Invalid agencyPage content", error);
    return { status: "invalid-content" as const };
  }
}

export function sanityPreviewStatusCode(
  status: Exclude<
    Awaited<ReturnType<typeof fetchSanityPreviewPage>>["status"],
    "ok"
  >,
) {
  return {
    "not-configured": 503,
    unauthorized: 401,
    "not-found": 404,
    "invalid-content": 502,
  }[status];
}
