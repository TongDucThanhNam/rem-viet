import { describe, expect, test } from "bun:test";
import { set } from "sanity";

import { appendPortableVersion } from "../src/VersionedDocumentInput";
import { readStudioEnvironment } from "../src/environment";
import { providerManagedDocumentTypes, schemaTypes } from "../src/schemaTypes";
import { hasPortableOrSanityImage } from "../src/schemaTypes/shared";

describe("Rèm Việt Sanity Studio", () => {
  test("fails closed for incomplete or unsafe visual-editing configuration", () => {
    expect(() => readStudioEnvironment({})).toThrow(/SANITY_STUDIO_PROJECT_ID/);
    expect(() =>
      readStudioEnvironment({
        SANITY_STUDIO_PROJECT_ID: "project-test",
        SANITY_STUDIO_DATASET: "staging",
        SANITY_STUDIO_PREVIEW_URL:
          "https://preview.example.com/sanity-preview/home",
        SANITY_STUDIO_ALLOW_ORIGINS: "https://attacker.example.com",
      }),
    ).toThrow(/must include the preview URL origin/i);
    expect(() =>
      readStudioEnvironment({
        SANITY_STUDIO_PROJECT_ID: "project-test",
        SANITY_STUDIO_DATASET: "staging",
        SANITY_STUDIO_PREVIEW_URL:
          "https://preview.example.com/sanity-preview/home",
        SANITY_STUDIO_ALLOW_ORIGINS:
          "https://preview.example.com,https://preview.example.com",
      }),
    ).toThrow(/unique origins/i);
  });

  test("normalizes the exact staging preview scope", () => {
    expect(
      readStudioEnvironment({
        SANITY_STUDIO_PROJECT_ID: "project-test",
        SANITY_STUDIO_DATASET: "staging",
        SANITY_STUDIO_PREVIEW_URL:
          "https://preview.example.com/sanity-preview/home/",
        SANITY_STUDIO_ALLOW_ORIGINS:
          "https://preview.example.com/path,http://localhost:3001",
      }),
    ).toEqual({
      projectId: "project-test",
      dataset: "staging",
      previewUrl: "https://preview.example.com/sanity-preview/home",
      allowOrigins: ["https://preview.example.com", "http://localhost:3001"],
    });
  });

  test("registers human-field Hero/FAQ schemas while provider owns document creation", () => {
    const names = schemaTypes.map((schema) => schema.name);
    expect(names).toContain("agencyPage");
    expect(names).toContain("agencyHeroBlock");
    expect(names).toContain("agencyFaqBlock");
    expect(providerManagedDocumentTypes).toEqual([
      "agencyPage",
      "agencyGlobal",
      "agencyGlobalRevision",
    ]);

    const page = schemaTypes.find((schema) => schema.name === "agencyPage");
    const pageContent = schemaTypes.find(
      (schema) => schema.name === "agencyPageContent",
    );
    expect(page).toMatchObject({ type: "document" });
    expect(JSON.stringify(page)).toContain("Portable version");
    expect(JSON.stringify(pageContent)).toContain("Sections");

    const schemas = JSON.stringify(schemaTypes);
    expect(schemas).toContain("nativeAsset");
    expect(schemas).toContain("ogImageAsset");
    expect(schemas).toContain("hotspot");
  });

  test("accepts native Sanity assets or portable fallback URLs", () => {
    expect(
      hasPortableOrSanityImage({
        nativeAsset: { asset: { _ref: "image-proof-1200x800-webp" } },
      }),
    ).toBe(true);
    expect(hasPortableOrSanityImage({ src: "/assets/hero.webp" })).toBe(true);
    expect(hasPortableOrSanityImage({ src: "javascript:alert(1)" })).toBe(
      false,
    );
    expect(hasPortableOrSanityImage({ src: "" })).toBe(false);
    expect(hasPortableOrSanityImage({})).toBe(false);
  });

  test("appends portable concurrency metadata to every Studio document edit", () => {
    const event = appendPortableVersion(
      set("Changed", ["content", "title"]),
      "editor",
    );
    expect(event.patches).toMatchObject([
      { type: "set", path: ["content", "title"], value: "Changed" },
      { type: "inc", path: ["version"], value: 1 },
      { type: "set", path: ["updatedBy"], value: "editor" },
    ]);
  });
});
