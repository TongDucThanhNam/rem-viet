import { describe, expect, test } from "bun:test";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";

import { readSanityPreviewEnvironment } from "./sanity-preview-config";
import { materializeRemVietSanityImages } from "./sanity-preview-images";
import {
  remVietSanityContentProjection,
  remVietSanityPageQuery,
} from "./sanity-preview-query";
import {
  normalizeSanityPerspective,
  previewCookieHeaders,
  readSignedSanityPerspective,
  sanityPreviewSignatureCookieName,
  signSanityPerspective,
} from "./sanity-preview-session";

const cookieSecret = "preview-cookie-secret-with-at-least-32-characters";

describe("Sanity preview security boundary", () => {
  test("resolves native Studio assets into the portable content contract", () => {
    expect(remVietSanityContentProjection).toContain("ogImageAsset{...,asset}");
    expect(remVietSanityContentProjection).toContain("nativeAsset{...,asset}");
    expect(remVietSanityPageQuery).toContain(
      '_type == "agencyPage" && agencyId == $agencyId',
    );

    const materialized = materializeRemVietSanityImages(
      {
        seo: {
          ogImage: "/fallback-og.webp",
          ogImageAsset: {
            asset: { _ref: "image-oghash-1600x900-jpg" },
            crop: { top: 0, bottom: 0.1, left: 0.1, right: 0 },
            hotspot: { x: 0.35, y: 0.4, width: 0.25, height: 0.25 },
          },
        },
        blocks: [
          {
            data: {
              background: {
                src: "/fallback-hero.webp",
                nativeAsset: {
                  asset: { _ref: "image-herohash-2400x1600-webp" },
                  crop: { top: 0, bottom: 0, left: 0, right: 0.1 },
                  hotspot: { x: 0.4, y: 0.5, width: 0.3, height: 0.3 },
                },
              },
            },
          },
        ],
      },
      { projectId: "project-test", dataset: "staging" },
    ) as {
      seo: { ogImage: string };
      blocks: Array<{
        data: { background: { src: string; mediaId: string } };
      }>;
    };
    expect(materialized.seo.ogImage).toStartWith(
      "https://cdn.sanity.io/images/project-test/staging/oghash-1600x900.jpg?",
    );
    expect(materialized.seo.ogImage).toContain("rect=");
    expect(materialized.blocks[0]?.data.background.mediaId).toBe(
      "image-herohash-2400x1600-webp",
    );
    expect(materialized.blocks[0]?.data.background.src).toContain(
      "auto=format",
    );
  });

  test("keeps the optional integration all-or-nothing", () => {
    expect(readSanityPreviewEnvironment({})).toBeNull();
    expect(() =>
      readSanityPreviewEnvironment({ SANITY_PROJECT_ID: "project-test" }),
    ).toThrow(/incomplete Sanity preview configuration/i);
    expect(() =>
      readSanityPreviewEnvironment({
        SANITY_PROJECT_ID: "project-test",
        SANITY_DATASET: "staging",
        SANITY_STUDIO_URL: "https://studio.example.com",
        SANITY_API_READ_TOKEN: "viewer-token",
        SANITY_PREVIEW_COOKIE_SECRET: "too-short",
      }),
    ).toThrow(/at least 32 characters/i);
  });

  test("accepts a complete, normalized server-only configuration", () => {
    expect(
      readSanityPreviewEnvironment({
        SANITY_PROJECT_ID: "project-test",
        SANITY_DATASET: "staging",
        SANITY_STUDIO_URL: "https://studio.example.com/",
        SANITY_API_READ_TOKEN: "viewer-token",
        SANITY_PREVIEW_COOKIE_SECRET: cookieSecret,
      }),
    ).toEqual({
      projectId: "project-test",
      dataset: "staging",
      studioUrl: "https://studio.example.com",
      readToken: "viewer-token",
      cookieSecret,
    });
  });

  test("rejects forged perspective cookies and the raw perspective", async () => {
    const perspective = normalizeSanityPerspective([
      "summer-release",
      "drafts",
      "published",
    ]);
    const signature = await signSanityPerspective(perspective, cookieSecret);
    const cookie = `${perspectiveCookieName}=summer-release%2Cdrafts%2Cpublished; ${sanityPreviewSignatureCookieName}=${signature}`;
    expect(await readSignedSanityPerspective(cookie, cookieSecret)).toEqual([
      "summer-release",
      "drafts",
      "published",
    ]);
    expect(
      await readSignedSanityPerspective(
        cookie.replace("summer-release", "forged-release"),
        cookieSecret,
      ),
    ).toBeNull();
    expect(() => normalizeSanityPerspective("raw")).toThrow(/not allowed/i);
  });

  test("emits secure iframe cookies for both perspective and signature", async () => {
    const perspective = normalizeSanityPerspective("drafts");
    const signature = await signSanityPerspective(perspective, cookieSecret);
    const cookies = previewCookieHeaders({
      perspective,
      signature,
      partitioned: true,
    });
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("SameSite=None"))).toBe(
      true,
    );
    expect(cookies.every((cookie) => cookie.includes("Partitioned"))).toBe(
      true,
    );
  });
});
