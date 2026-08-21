import { describe, expect, test } from "bun:test";
import {
  defineCollection,
  parseCmsCollectionData,
  textField,
} from "@agency/cms-core";

import {
  cmsSeoFieldGroup,
  cmsSeoExtensionManifest,
  cmsSeoModule,
  createCmsSeoPreview,
  createCmsSeoSitemap,
  serializeCmsSeoJsonLd,
} from "../src";

describe("official SEO module", () => {
  test("owns a lifecycle-safe manifest and composable validated fields", () => {
    expect(cmsSeoModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-seo",
      uninstall: { dataPolicy: "retain" },
    });
    expect(cmsSeoExtensionManifest).toMatchObject({
      id: "official/seo",
      classification: "official",
      data: { uninstall: { policy: "retain" } },
    });
    const pages = defineCollection({
      slug: "seo-pages",
      labels: { singular: "Page", plural: "Pages" },
      schemaVersion: 1,
      lifecycle: { drafts: true, revisions: true, scheduling: true },
      access: { read: [], create: [], update: [], delete: [], publish: [] },
      fields: [
        textField({ name: "title", label: "Title" }),
        ...cmsSeoFieldGroup.fields,
      ],
    });
    expect(
      parseCmsCollectionData(pages, {
        title: "Home",
        seo: { title: "Home", canonicalUrl: "https://example.com/" },
      }),
    ).toMatchObject({
      seo: { robotsIndex: true, robotsFollow: true },
    });
  });

  test("generates bounded previews, deterministic safe sitemaps, and embeddable JSON-LD", () => {
    expect(
      createCmsSeoPreview({
        title: "A".repeat(80),
        description: "Launch description",
        canonicalUrl: "https://example.com/launch",
      }),
    ).toMatchObject({ serp: { displayUrl: "example.com/launch" } });
    const sitemap = createCmsSeoSitemap("https://example.com", [
      { path: "/launch?x=1&y=2", priority: 0.8 },
      { path: "/", lastModified: "2026-08-21T00:00:00.000Z" },
    ]);
    expect(sitemap).toContain("https://example.com/launch?x=1&amp;y=2");
    expect(sitemap).toContain("<priority>0.8</priority>");
    expect(
      serializeCmsSeoJsonLd({ name: "</script><script>bad" }),
    ).not.toContain("</script>");
  });
});
