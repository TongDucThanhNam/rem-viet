import { describe, expect, test } from "bun:test";
import { cmsSiteManifestSchema } from "@agency/cms-core";

import {
  cmsTemplateInitializer,
  createRemVietTemplateBootstrapPlan,
} from "../src/bootstrap";

const input = {
  siteId: "acme-studio",
  name: "Acme Studio",
  siteUrl: "https://acme.example",
  preset: "showcase",
  provider: "cloudflare",
  defaultLocale: "vi-VN",
  features: ["blog", "leads", "media"],
} as const;

describe("Rèm Việt template bootstrap", () => {
  test("produces a canonical reviewable plan with portable seed assets", () => {
    const plan = createRemVietTemplateBootstrapPlan(input);
    expect(cmsTemplateInitializer).toMatchObject({
      schemaVersion: 1,
      id: "@agency/cms-template-rem-viet",
      version: "0.1.0",
    });
    expect(plan).toMatchObject({
      schemaVersion: 2,
      operation: "init",
      siteId: "acme-studio",
      manifest: {
        kit: {
          version: "0.1.0",
          template: "@agency/cms-template-rem-viet",
          provider: "cloudflare",
          contentSchemaVersion: 1,
        },
      },
    });
    const files = new Map(plan.files.map((file) => [file.path, file.content]));
    expect([...files.keys()]).toEqual([
      "site.manifest.json",
      ".env.example",
      "content.seed.json",
      "HANDOVER.md",
      "public/assets/acme-studio-logo.svg",
      "public/assets/acme-studio-placeholder.svg",
    ]);
    expect(
      cmsSiteManifestSchema.parse(
        JSON.parse(files.get("site.manifest.json") ?? ""),
      ),
    ).toEqual(plan.manifest);

    const seedText = files.get("content.seed.json") ?? "";
    const seed = JSON.parse(seedText) as {
      documents: Array<{ blocks: unknown[] }>;
    };
    expect(seed.documents[0]?.blocks).toHaveLength(10);
    expect(seedText).not.toMatch(/Rèm Việt|Rèm Vina|remvina/i);
    expect(seedText).not.toMatch(/https?:\/\/(?!acme\.example)/);
    expect(seedText).toContain("Acme Studio homepage media placeholder");
    const assetUrls = new Set(seedText.match(/\/assets\/[^"\\]+/g) ?? []);
    expect(assetUrls).toEqual(
      new Set([
        "/assets/acme-studio-logo.svg",
        "/assets/acme-studio-placeholder.svg",
      ]),
    );
    expect(files.get(".env.example")).not.toContain("BETTER_AUTH_SECRET=x");
    expect(plan.requiredSecrets).toContain("CMS_BOOTSTRAP_PASSWORD");
    expect(plan.requiredSecrets).toContain("RESEND_API_KEY");
  });

  test("rejects unsupported providers and unsafe feature combinations", () => {
    expect(() =>
      createRemVietTemplateBootstrapPlan({
        ...input,
        provider: "sanity",
      }),
    ).toThrow(/supports cloudflare only/i);
    expect(() =>
      createRemVietTemplateBootstrapPlan({
        ...input,
        features: ["orders"],
      }),
    ).toThrow(/orders feature requires catalog/i);
    expect(() =>
      createRemVietTemplateBootstrapPlan({
        ...input,
        features: ["unknown"],
      }),
    ).toThrow(/unsupported or duplicate/i);
  });
});
