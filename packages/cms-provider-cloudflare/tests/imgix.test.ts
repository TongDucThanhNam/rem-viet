import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";

import type { CmsDamVariantJob } from "@agency/cms-runtime";

import { createImgixDamTransformAdapter } from "../src";

const job = {
  asset: {
    id: "asset-1",
    key: "campaigns/hero image.png",
    url: "/media/hero.png",
    altText: "Hero",
    size: 1,
    mimeType: "image/png",
    width: 1600,
    height: 900,
    folderId: null,
    tags: [],
    contentHash: "sha256:hero",
    visibility: "public",
    status: "active",
    focalPoint: { x: 0.25, y: 0.75 },
    metadata: {},
    localizedMetadata: {},
    copyright: "",
    license: "",
    expiresAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    usageReferences: [],
    variants: [],
  },
  variant: {
    id: "variant-1",
    assetId: "asset-1",
    name: "hero-card",
    width: 640,
    height: 360,
    format: "webp",
    fit: "cover",
    status: "pending",
    key: null,
    url: null,
    error: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  },
} satisfies CmsDamVariantJob;

describe("Imgix DAM transform adapter", () => {
  test("encodes focal transforms and signs the final path/query server-side", async () => {
    const bases: string[] = [];
    const adapter = createImgixDamTransformAdapter({
      domain: "assets.example.imgix.net",
      secureUrlToken: "FOO123bar",
      signMd5: (base) => {
        bases.push(base);
        return createHash("md5").update(base).digest("hex");
      },
    });
    const url = await adapter.buildVariantUrl(job);
    expect(bases).toEqual([
      "FOO123bar/campaigns/hero%20image.png?crop=focalpoint&fit=crop&fm=webp&fp-x=0.25&fp-y=0.75&h=360&w=640",
    ]);
    expect(url).toMatch(
      /^https:\/\/assets\.example\.imgix\.net\/campaigns\/hero%20image\.png\?crop=focalpoint&fit=crop&fm=webp&fp-x=0\.25&fp-y=0\.75&h=360&w=640&s=[a-f0-9]{32}$/,
    );
    expect(url).not.toContain("FOO123bar");
  });

  test("fails closed for accidental unsigned use, unsafe paths, and invalid signatures", async () => {
    expect(() =>
      createImgixDamTransformAdapter({ domain: "assets.example.imgix.net" }),
    ).toThrow("allowUnsigned");
    expect(() =>
      createImgixDamTransformAdapter({
        domain: "https://assets.example.imgix.net/path",
        allowUnsigned: true,
      }),
    ).toThrow("hostname");
    await expect(
      createImgixDamTransformAdapter({
        domain: "assets.example.imgix.net",
        secureUrlToken: "token",
        signMd5: () => "invalid",
      }).buildVariantUrl(job),
    ).rejects.toThrow("32-character");
    await expect(
      createImgixDamTransformAdapter({
        domain: "assets.example.imgix.net",
        allowUnsigned: true,
      }).buildVariantUrl({
        ...job,
        asset: { ...job.asset, key: "../secret.png" },
      }),
    ).rejects.toThrow("unsafe path");
  });
});
