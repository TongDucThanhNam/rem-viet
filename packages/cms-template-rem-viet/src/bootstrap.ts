import { cmsSiteManifestSchema } from "@agency/cms-core";

import {
  defaultRemVietTemplateBlocks,
  remVietTemplateBlockSchema,
} from "./index";
import { REM_VIET_BLOCK_SCHEMA_VERSION } from "./version";

export const REM_VIET_TEMPLATE_ID = "@agency/cms-template-rem-viet" as const;

const presets = ["showcase", "catalog", "portfolio"] as const;
const supportedFeatures = [
  "blog",
  "catalog",
  "orders",
  "leads",
  "media",
] as const;
type SupportedFeature = (typeof supportedFeatures)[number];

export type RemVietTemplateBootstrapInput = Readonly<{
  siteId: string;
  name: string;
  siteUrl: string;
  preset: string;
  provider: string;
  defaultLocale: string;
  features: readonly string[] | undefined;
}>;

function selectedFeatures(input: RemVietTemplateBootstrapInput) {
  const defaults: Record<
    (typeof presets)[number],
    readonly SupportedFeature[]
  > = {
    showcase: ["blog", "leads", "media"],
    catalog: ["blog", "catalog", "orders", "leads", "media"],
    portfolio: ["leads", "media"],
  };
  if (!presets.includes(input.preset as (typeof presets)[number])) {
    throw new Error(
      `Unsupported template preset: ${input.preset}. Expected ${presets.join(", ")}.`,
    );
  }
  const values =
    input.features ?? defaults[input.preset as keyof typeof defaults];
  if (
    new Set(values).size !== values.length ||
    values.some(
      (feature) => !supportedFeatures.includes(feature as SupportedFeature),
    )
  ) {
    throw new Error(
      `Unsupported or duplicate template feature. Expected ${supportedFeatures.join(", ")}.`,
    );
  }
  if (values.includes("orders") && !values.includes("catalog")) {
    throw new Error("The orders feature requires catalog.");
  }
  const selected = new Set(values);
  return Object.fromEntries(
    supportedFeatures.map((feature) => [feature, selected.has(feature)]),
  ) as Record<SupportedFeature, boolean>;
}

function rebrandSeed(
  value: unknown,
  input: RemVietTemplateBootstrapInput,
  placeholder: string,
): unknown {
  if (typeof value === "string") {
    if (value.startsWith("/assets/")) return placeholder;
    return value
      .replaceAll("Rèm Vina", input.name)
      .replaceAll("Rèm Việt", input.name)
      .replaceAll("REM VINA", input.name.toUpperCase())
      .replaceAll("Rem Vina", input.name)
      .replaceAll("remvina", input.siteId);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rebrandSeed(entry, input, placeholder));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        rebrandSeed(entry, input, placeholder),
      ]),
    );
  }
  return value;
}

function seededBlocks(
  input: RemVietTemplateBootstrapInput,
  placeholder: string,
) {
  const candidate = rebrandSeed(
    structuredClone(defaultRemVietTemplateBlocks),
    input,
    placeholder,
  );
  if (!Array.isArray(candidate)) throw new Error("Template seed is invalid.");
  const hero = candidate.find(
    (block) =>
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "hero",
  ) as { data?: Record<string, unknown> } | undefined;
  if (hero?.data) {
    const [prefix, ...accent] = input.name.split(/\s+/);
    hero.data.title = {
      prefix: prefix || input.name,
      accent: accent.join(" ") || "Studio",
    };
    hero.data.background = {
      ...(hero.data.background as Record<string, unknown>),
      src: placeholder,
      alt: `${input.name} homepage media placeholder`,
    };
    hero.data.secondaryCta = {
      label: "Liên hệ",
      href: "#order",
      cursorLabel: "Mở",
    };
  }
  const footer = candidate.find(
    (block) =>
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "footerCta",
  ) as { data?: Record<string, unknown> } | undefined;
  if (footer?.data) {
    const email = `hello@${new URL(input.siteUrl).hostname}`;
    footer.data.email = email;
    footer.data.emailLabel = email;
  }
  return remVietTemplateBlockSchema.array().parse(candidate);
}

function envExample(
  input: RemVietTemplateBootstrapInput,
  requiredSecrets: readonly string[],
) {
  const fixed = [
    `# ${input.name}`,
    `CORS_ORIGIN=${input.siteUrl}`,
    `BETTER_AUTH_URL=${input.siteUrl}`,
  ];
  return `${[
    ...fixed,
    ...requiredSecrets.map((name) => `${name}=`),
    "RUM_SAMPLE_RATE=1",
  ].join("\n")}\n`;
}

function handover(
  input: RemVietTemplateBootstrapInput,
  requiredSecrets: readonly string[],
) {
  return `# ${input.name} handover\n\n- [ ] Review \`site.manifest.json\`, \`content.seed.json\`, brand assets, and feature scope.\n- [ ] Populate these required environment names without committing values: ${requiredSecrets.join(", ")}.\n- [ ] Apply provider migrations on an empty local database and load the reviewed seed.\n- [ ] Plan isolated staging resources and confirm every name starts from \`${input.siteId}\`.\n- [ ] Deploy staging, bootstrap the owner, then remove \`CMS_BOOTSTRAP_PASSWORD\`.\n- [ ] Smoke login, media, preview, publish, revision restore, leads, sitemap, backup, and isolated restore.\n- [ ] Complete the unassisted client handover and retain external release receipts.\n`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function logoSvg(name: string) {
  const title = escapeXml(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" role="img" aria-labelledby="title"><title id="title">${title}</title><rect width="640" height="160" rx="16" fill="#f8f5ef"/><path d="M36 120h568" stroke="#b58a43" stroke-width="6"/><text x="320" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#111111">${title}</text></svg>\n`;
}

function placeholderSvg(name: string) {
  const title = escapeXml(`${name} media placeholder`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" role="img" aria-labelledby="title"><title id="title">${title}</title><rect width="1600" height="1000" fill="#111111"/><path d="M0 760 480 360l300 260 260-210 560 420v170H0Z" fill="#b58a43"/><circle cx="1240" cy="250" r="110" fill="#f8f5ef"/></svg>\n`;
}

export function createRemVietTemplateBootstrapPlan(
  input: RemVietTemplateBootstrapInput,
) {
  if (input.provider !== "cloudflare") {
    throw new Error("The stable Rèm Việt bootstrap supports cloudflare only.");
  }
  const features = selectedFeatures(input);
  const logo = `/assets/${input.siteId}-logo.svg`;
  const placeholder = `/assets/${input.siteId}-placeholder.svg`;
  const manifest = cmsSiteManifestSchema.parse({
    schemaVersion: 1,
    id: input.siteId,
    name: input.name,
    siteUrl: input.siteUrl,
    kit: {
      version: "0.1.0",
      template: REM_VIET_TEMPLATE_ID,
      provider: input.provider,
      contentSchemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
    },
    defaultLocale: input.defaultLocale,
    locales: [input.defaultLocale],
    preset: input.preset,
    brand: {
      logo,
      colors: { accent: "#B58A43", ink: "#111111", canvas: "#F8F5EF" },
      fonts: ["Be Vietnam Pro", "Playfair Display"],
    },
    features,
    infrastructure: {
      adapter: "alchemy-cloudflare",
      alchemyApp: input.siteId,
      workerName: `${input.siteId}-web`,
      d1Name: `${input.siteId}-db`,
      r2BucketName: `${input.siteId}-media`,
      backupBucketName: `${input.siteId}-backups`,
    },
  });
  const requiredSecrets = [
    "BETTER_AUTH_SECRET",
    "ADMIN_EMAILS",
    "CMS_BOOTSTRAP_PASSWORD",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_DATABASE_ID",
    "CLOUDFLARE_D1_TOKEN",
    ...(features.leads ? ["RESEND_API_KEY", "LEAD_NOTIFICATION_EMAIL"] : []),
  ];
  const seed = {
    schemaVersion: 1,
    siteId: input.siteId,
    template: REM_VIET_TEMPLATE_ID,
    contentSchemaVersion: REM_VIET_BLOCK_SCHEMA_VERSION,
    documents: [
      {
        id: `${input.siteId}-home`,
        documentType: "page",
        schemaVersion: 1,
        status: "draft",
        slug: "home",
        title: "Trang chủ",
        blocks: seededBlocks(input, placeholder),
        seo: {
          title: input.name,
          description: `${input.name} — website chính thức.`,
          canonicalUrl: input.siteUrl,
          ogImage: logo,
          robotsIndex: true,
          robotsFollow: true,
        },
      },
    ],
  };
  return Object.freeze({
    schemaVersion: 2 as const,
    operation: "init" as const,
    siteId: input.siteId,
    manifest,
    requiredSecrets: Object.freeze(requiredSecrets),
    files: Object.freeze([
      {
        path: "site.manifest.json",
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        mode: "json-exact" as const,
      },
      {
        path: ".env.example",
        content: envExample(input, requiredSecrets),
        mode: "preserve" as const,
      },
      {
        path: "content.seed.json",
        content: `${JSON.stringify(seed, null, 2)}\n`,
        mode: "preserve" as const,
      },
      {
        path: "HANDOVER.md",
        content: handover(input, requiredSecrets),
        mode: "preserve" as const,
      },
      {
        path: `public/assets/${input.siteId}-logo.svg`,
        content: logoSvg(input.name),
        mode: "preserve" as const,
      },
      {
        path: `public/assets/${input.siteId}-placeholder.svg`,
        content: placeholderSvg(input.name),
        mode: "preserve" as const,
      },
    ]),
  });
}

export const cmsTemplateInitializer = Object.freeze({
  schemaVersion: 1 as const,
  id: REM_VIET_TEMPLATE_ID,
  version: "0.1.0" as const,
  createPlan: createRemVietTemplateBootstrapPlan,
});
