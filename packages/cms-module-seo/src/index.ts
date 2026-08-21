import {
  booleanField,
  cmsSiteOriginSchema,
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineCmsFieldGroup,
  defineFeatureModule,
  groupField,
  jsonField,
  mediaField,
  textField,
  urlField,
} from "@agency/cms-core";

export const cmsSeoExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/seo",
  packageName: "@agency/cms-module-seo",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/seo/publish",
      capability: "content.publish",
      description: "Publish sitemap and SEO metadata changes.",
    },
  ],
  secrets: [],
  routes: [],
  admin: [
    {
      id: "official/seo/document",
      slot: "document",
      label: "SEO preview",
      requiredCapability: "content.write",
    },
  ],
  entrypoints: [
    {
      id: "official/seo/shared",
      export: ".",
      runtime: "shared",
      capabilities: [],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [{ id: "official/seo/v1", from: 0, to: 1, reversible: false }],
    uninstall: {
      policy: "retain",
      description:
        "SEO fields remain canonical content until an explicit purge migration.",
    },
  },
});

export const cmsSeoFieldGroup = defineCmsFieldGroup({
  id: "official-seo-fields",
  fields: [
    groupField({
      name: "seo",
      label: "SEO",
      fields: [
        textField({
          name: "title",
          label: "Search title",
          validation: { maxLength: 70 },
        }),
        textField({
          name: "description",
          label: "Search description",
          multiline: true,
          validation: { maxLength: 170 },
        }),
        urlField({ name: "canonicalUrl", label: "Canonical URL" }),
        mediaField({
          name: "socialImage",
          label: "Social image",
          multiple: false,
        }),
        booleanField({
          name: "robotsIndex",
          label: "Allow indexing",
          defaultValue: true,
        }),
        booleanField({
          name: "robotsFollow",
          label: "Allow following",
          defaultValue: true,
        }),
        jsonField({ name: "schemaOrg", label: "Schema.org JSON-LD" }),
      ],
    }),
  ],
});

export const cmsSeoModule = defineFeatureModule({
  id: "official-seo",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-seo",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "retain",
      description:
        "SEO fields remain canonical content until an explicit purge migration.",
    },
  }),
  permissions: [
    {
      id: "official-seo/publish",
      capability: "content.publish",
      operations: ["publish"],
      description: "Publish sitemap and SEO metadata changes.",
    },
  ],
  migrations: [
    { id: "official-seo/v1", from: 0, to: 1, migrate: (state) => state ?? {} },
  ],
  admin: [
    {
      id: "official-seo/document",
      placement: "document",
      label: "SEO preview",
    },
  ],
});

export type CmsSeoPreviewInput = Readonly<{
  title: string;
  description: string;
  canonicalUrl: string;
  socialImageUrl?: string;
}>;

function truncate(value: string, limit: number) {
  const characters = [...value.trim().replace(/\s+/g, " ")];
  return characters.length <= limit
    ? characters.join("")
    : `${characters.slice(0, limit - 1).join("")}…`;
}

export function createCmsSeoPreview(input: CmsSeoPreviewInput) {
  const canonicalUrl = new URL(input.canonicalUrl);
  if (!["http:", "https:"].includes(canonicalUrl.protocol)) {
    throw new Error("SEO preview canonical URL must use HTTP(S).");
  }
  return Object.freeze({
    serp: Object.freeze({
      title: truncate(input.title, 60),
      description: truncate(input.description, 160),
      displayUrl: `${canonicalUrl.hostname}${canonicalUrl.pathname}`,
    }),
    social: Object.freeze({
      title: truncate(input.title, 70),
      description: truncate(input.description, 200),
      imageUrl: input.socialImageUrl ?? null,
    }),
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export type CmsSitemapEntry = Readonly<{
  path: string;
  lastModified?: string;
  changeFrequency?:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}>;

export function createCmsSeoSitemap(
  siteOrigin: string,
  entries: readonly CmsSitemapEntry[],
) {
  const origin = cmsSiteOriginSchema.parse(siteOrigin);
  const seen = new Set<string>();
  const urls = entries
    .map((entry) => {
      if (!entry.path.startsWith("/") || entry.path.startsWith("//")) {
        throw new Error("Sitemap paths must be origin-relative.");
      }
      const location = new URL(entry.path, origin).toString();
      if (seen.has(location))
        throw new Error(`Duplicate sitemap URL: ${location}`);
      seen.add(location);
      if (
        entry.lastModified &&
        !Number.isFinite(Date.parse(entry.lastModified))
      ) {
        throw new Error("Sitemap lastModified must be an ISO-compatible date.");
      }
      if (
        entry.priority !== undefined &&
        (entry.priority < 0 || entry.priority > 1)
      ) {
        throw new Error("Sitemap priority must be between 0 and 1.");
      }
      return [
        "<url>",
        `<loc>${escapeXml(location)}</loc>`,
        ...(entry.lastModified
          ? [`<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`]
          : []),
        ...(entry.changeFrequency
          ? [`<changefreq>${entry.changeFrequency}</changefreq>`]
          : []),
        ...(entry.priority === undefined
          ? []
          : [`<priority>${entry.priority.toFixed(1)}</priority>`]),
        "</url>",
      ].join("");
    })
    .sort();
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

/** Escapes markup-significant characters before embedding JSON-LD in HTML. */
export function serializeCmsSeoJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
