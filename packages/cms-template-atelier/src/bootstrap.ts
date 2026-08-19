import {
  createCmsAgencySiteArtifacts,
  defineCmsAgencySite,
} from "@agency/cms-template-factory";

import {
  atelierTemplateFactory,
  createAtelierDefaultDocument,
} from "./visual-authoring.js";

export type AtelierBootstrapInput = Readonly<{
  siteId: string;
  name: string;
  siteUrl: string;
  preset: string;
  provider: string;
  defaultLocale: string;
  features?: readonly string[];
}>;

function svg(title: string, colors: readonly [string, string]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-labelledby="title"><title id="title">${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</title><rect width="1200" height="800" fill="${colors[0]}"/><circle cx="860" cy="260" r="220" fill="${colors[1]}"/><path d="M80 680h1040" stroke="#151515" stroke-width="24"/></svg>\n`;
}

export function createAtelierBootstrapPlan(input: AtelierBootstrapInput) {
  if (input.provider !== "cloudflare") {
    throw new Error("Atelier stable bootstrap supports cloudflare only.");
  }
  const logo = `/assets/${input.siteId}-atelier-mark.svg`;
  const editorial = `/assets/${input.siteId}-editorial.svg`;
  const manifest = {
    schemaVersion: 1 as const,
    id: input.siteId,
    name: input.name,
    siteUrl: input.siteUrl,
    kit: {
      version: atelierTemplateFactory.version,
      template: atelierTemplateFactory.id,
      provider: input.provider,
      contentSchemaVersion: atelierTemplateFactory.schemaVersion,
    },
    defaultLocale: input.defaultLocale,
    locales: [input.defaultLocale],
    preset: input.preset,
    brand: {
      logo,
      colors: {
        cobalt: "#1F45FF",
        signal: "#FF4B36",
        mint: "#C7F6D4",
        paper: "#F4F0E7",
        ink: "#151515",
      },
      fonts: ["IBM Plex Sans", "Arial Narrow", "Georgia"],
    },
    features: { blog: true, media: true, events: true },
    infrastructure: {
      adapter: "alchemy-cloudflare",
      alchemyApp: input.siteId,
      workerName: `${input.siteId}-web`,
      d1Name: `${input.siteId}-db`,
      r2BucketName: `${input.siteId}-media`,
      backupBucketName: `${input.siteId}-backups`,
    },
  };
  const site = defineCmsAgencySite({
    manifest,
    template: atelierTemplateFactory,
    theme: {
      schemaVersion: 1,
      tokens: {
        "--color-cobalt": "#1F45FF",
        "--color-signal": "#FF4B36",
        "--color-mint": "#C7F6D4",
        "--color-paper": "#F4F0E7",
        "--color-ink": "#151515",
      },
    },
    assets: [
      { id: "brand-mark", kind: "image", src: logo, altRequired: true },
      {
        id: "editorial-image",
        kind: "image",
        src: editorial,
        altRequired: true,
      },
    ],
  });
  const document = createAtelierDefaultDocument(input.siteId, editorial);
  const artifacts = createCmsAgencySiteArtifacts({
    site,
    documents: [document],
  });
  const requiredSecrets = [
    "BETTER_AUTH_SECRET",
    "ADMIN_EMAILS",
    "CMS_BOOTSTRAP_PASSWORD",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_DATABASE_ID",
    "CLOUDFLARE_D1_TOKEN",
  ];
  return Object.freeze({
    schemaVersion: 2 as const,
    operation: "init" as const,
    siteId: input.siteId,
    manifest: site.manifest,
    requiredSecrets: Object.freeze(requiredSecrets),
    files: Object.freeze([
      ...Object.entries(artifacts).map(([path, content]) => ({
        path,
        content,
        mode:
          path === "site.manifest.json"
            ? ("json-exact" as const)
            : ("preserve" as const),
      })),
      {
        path: ".env.example",
        content: `BETTER_AUTH_URL=${input.siteUrl}\n${requiredSecrets.map((name) => `${name}=`).join("\n")}\n`,
        mode: "preserve" as const,
      },
      {
        path: "HANDOVER.md",
        content: `# ${input.name} handover\n\n- [ ] Review the issue index, events, asset alt text, roles, backup and restore.\n- [ ] Run the check, build and staging lifecycle before explicit deploy authorization.\n`,
        mode: "preserve" as const,
      },
      {
        path: `public${logo}`,
        content: svg(`${input.name} mark`, ["#F4F0E7", "#1F45FF"]),
        mode: "preserve" as const,
      },
      {
        path: `public${editorial}`,
        content: svg(`${input.name} editorial placeholder`, [
          "#1F45FF",
          "#FF4B36",
        ]),
        mode: "preserve" as const,
      },
    ]),
  });
}

export const cmsTemplateInitializer = Object.freeze({
  schemaVersion: 1 as const,
  id: atelierTemplateFactory.id,
  version: atelierTemplateFactory.version,
  createPlan: createAtelierBootstrapPlan,
});
