import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  siteManifestSchema,
  type SiteManifest,
} from "../packages/cms/src/site-manifest";
import { defaultHomeBlocks } from "../packages/cms/src/landing";

export const repoRoot = resolve(import.meta.dir, "..");

export const siteEnvExampleKeys = [
  "CORS_ORIGIN",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAILS",
  "CMS_BOOTSTRAP_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "RESEND_API_KEY",
  "LEAD_NOTIFICATION_EMAIL",
  "EMAIL_FROM",
  "JSONLINK_API_KEY",
  "SANITY_PROJECT_ID",
  "SANITY_DATASET",
  "SANITY_STUDIO_URL",
  "SANITY_API_READ_TOKEN",
  "SANITY_PREVIEW_COOKIE_SECRET",
  "RUM_SAMPLE_RATE",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_DATABASE_ID",
  "CLOUDFLARE_D1_TOKEN",
] as const;

const emptySiteEnvExampleKeys = [
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAILS",
  "CMS_BOOTSTRAP_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "RESEND_API_KEY",
  "LEAD_NOTIFICATION_EMAIL",
  "JSONLINK_API_KEY",
  "SANITY_PROJECT_ID",
  "SANITY_DATASET",
  "SANITY_STUDIO_URL",
  "SANITY_API_READ_TOKEN",
  "SANITY_PREVIEW_COOKIE_SECRET",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_DATABASE_ID",
  "CLOUDFLARE_D1_TOKEN",
] as const;

export function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

export function flag(name: string) {
  return process.argv.includes(`--${name}`);
}

export type SiteDeployModeFlags = {
  dryRun: boolean;
  plan: boolean;
  preflight: boolean;
};

export function validateSiteDeployModeFlags(flags: SiteDeployModeFlags) {
  const selected = Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  if (selected.length > 1)
    throw new Error(
      "Chỉ dùng một trong --dry-run, --plan hoặc --preflight cho mỗi lần chạy.",
    );
}

export function alchemySiteCommand(input: {
  stage: string;
  plan: boolean;
  yes: boolean;
}) {
  return [
    "bun",
    "run",
    "--cwd",
    "packages/infra",
    input.plan ? "plan" : "deploy",
    "--stage",
    input.stage,
    ...(!input.plan && input.yes ? ["--yes"] : []),
  ];
}

export function manifestFor(
  id: string,
  preset: SiteManifest["preset"],
): SiteManifest {
  const title = id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return siteManifestSchema.parse({
    id,
    name: title,
    siteUrl: `https://${id}.example.com`,
    description: `${title} — website chính thức.`,
    locale: "vi-VN",
    preset,
    brand: {
      logo: `/assets/${id}-logo.svg`,
      colors: { accent: "#B58A43", ink: "#111111", canvas: "#F8F5EF" },
      fonts: ["Be Vietnam Pro", "Playfair Display"],
    },
    contact: { phone: "", email: "", address: "", socials: {} },
    features: {
      blog: preset !== "portfolio",
      catalog: preset === "catalog",
      orders: preset === "catalog",
      leads: true,
    },
    infrastructure: {
      alchemyApp: id,
      workerName: `${id}-web`,
      d1Name: `${id}-db`,
      r2BucketName: `${id}-media`,
      backupBucketName: `${id}-backups`,
    },
  });
}

function sqlEscape(value: string) {
  return value.replaceAll("'", "''");
}

function brandDemoContent(value: unknown, manifest: SiteManifest): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll("Rèm Vina", manifest.name)
      .replaceAll("Rèm Việt", manifest.name)
      .replaceAll("REM VINA", manifest.name.toUpperCase())
      .replaceAll("Rem Vina", manifest.name)
      .replaceAll("remvina", manifest.id);
  }
  if (Array.isArray(value))
    return value.map((entry) => brandDemoContent(entry, manifest));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        brandDemoContent(entry, manifest),
      ]),
    );
  return value;
}

export function seedSql(manifest: SiteManifest) {
  const homeBlocks = brandDemoContent(
    structuredClone(defaultHomeBlocks),
    manifest,
  ) as typeof defaultHomeBlocks;
  const hero = homeBlocks.find((block) => block.type === "hero");
  if (hero?.type === "hero") {
    const [prefix, ...accent] = manifest.name.split(/\s+/);
    hero.title = {
      prefix: prefix || manifest.name,
      accent: accent.join(" ") || "Studio",
    };
    hero.secondaryCta = {
      label: "Liên hệ",
      href: "#order",
      cursorLabel: "Mở",
    };
  }
  const footer = homeBlocks.find((block) => block.type === "footerCta");
  if (footer?.type === "footerCta") {
    const email =
      manifest.contact.email || `hello@${new URL(manifest.siteUrl).hostname}`;
    footer.email = email;
    footer.emailLabel = email;
  }
  const blocks = sqlEscape(JSON.stringify(homeBlocks));
  const snapshot = sqlEscape(
    JSON.stringify({
      title: "Trang chủ",
      slug: "home",
      template: "landing",
      blocks: homeBlocks,
      seoTitle: manifest.name,
      seoDescription: manifest.description,
      canonicalUrl: manifest.siteUrl,
      ogImage: manifest.brand.logo,
      robotsIndex: true,
      robotsFollow: true,
    }),
  );
  return `-- Idempotent demo seed for ${manifest.id}\nBEGIN TRANSACTION;\nINSERT OR IGNORE INTO pages (id,slug,title,template,blocks,status,seo_title,seo_description,canonical_url,og_image,version,updated_by) VALUES ('${manifest.id}-home','home','Trang chủ','landing','${blocks}','published','${sqlEscape(manifest.name)}','${sqlEscape(manifest.description)}','${sqlEscape(manifest.siteUrl)}','${sqlEscape(manifest.brand.logo)}',1,'site-seed');\nINSERT OR IGNORE INTO page_revisions (id,page_id,version,snapshot,note,created_by) VALUES ('${manifest.id}-home-v1','${manifest.id}-home',1,'${snapshot}','Initial site seed','site-seed');\nUPDATE pages SET published_revision_id='${manifest.id}-home-v1',published_at=COALESCE(published_at,cast(unixepoch('subsecond') * 1000 as integer)) WHERE id='${manifest.id}-home' AND published_revision_id IS NULL;\nINSERT OR IGNORE INTO form_definitions (id,key,name,fields,notification_settings,active,retention_days) VALUES ('${manifest.id}-contact','contact','Liên hệ','[{"key":"name","label":"Họ và tên","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"message","label":"Nội dung","type":"textarea","required":true}]','{"email":true,"telegram":false}',1,365);\nCOMMIT;\n`;
}

export function envExample(manifest: SiteManifest) {
  return `# ${manifest.name}\nCORS_ORIGIN=${manifest.siteUrl}\nBETTER_AUTH_URL=${manifest.siteUrl}\nBETTER_AUTH_SECRET=\nADMIN_EMAILS=\nCMS_BOOTSTRAP_PASSWORD=\nTELEGRAM_BOT_TOKEN=\nTELEGRAM_CHAT_ID=\nRESEND_API_KEY=\nLEAD_NOTIFICATION_EMAIL=\nEMAIL_FROM=${manifest.name} <noreply@${new URL(manifest.siteUrl).hostname}>\nJSONLINK_API_KEY=\nSANITY_PROJECT_ID=\nSANITY_DATASET=\nSANITY_STUDIO_URL=\nSANITY_API_READ_TOKEN=\nSANITY_PREVIEW_COOKIE_SECRET=\nRUM_SAMPLE_RATE=1\nCLOUDFLARE_API_TOKEN=\nCLOUDFLARE_ACCOUNT_ID=\nCLOUDFLARE_DATABASE_ID=\nCLOUDFLARE_D1_TOKEN=\n`;
}

export function parseEnvExample(contents: string) {
  const values = new Map<string, string>();
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) throw new Error(`Invalid .env.example line ${index + 1}.`);
    const [, key, value] = match;
    if (values.has(key)) throw new Error(`Duplicate ${key} in .env.example.`);
    values.set(key, value.trim());
  }
  return values;
}

export function validateClientEnvExample(
  manifest: SiteManifest,
  contents: string,
) {
  const values = parseEnvExample(contents);
  const missing = siteEnvExampleKeys.filter((key) => !values.has(key));
  if (missing.length)
    throw new Error(`Missing .env.example keys: ${missing.join(", ")}.`);
  const known = new Set<string>(siteEnvExampleKeys);
  const unknown = [...values.keys()].filter((key) => !known.has(key));
  if (unknown.length)
    throw new Error(`Unexpected .env.example keys: ${unknown.join(", ")}.`);

  const expectedOrigin = new URL(manifest.siteUrl).origin;
  for (const key of ["CORS_ORIGIN", "BETTER_AUTH_URL"] as const) {
    if (values.get(key) !== expectedOrigin)
      throw new Error(`${key} must match manifest siteUrl origin.`);
  }
  for (const key of emptySiteEnvExampleKeys) {
    if (values.get(key))
      throw new Error(`${key} must remain empty in the committed template.`);
  }
  if (values.get("RUM_SAMPLE_RATE") !== "1")
    throw new Error(
      "RUM_SAMPLE_RATE must default to 1 in the client template.",
    );

  const expectedFrom = `${manifest.name} <noreply@${new URL(manifest.siteUrl).hostname}>`;
  if (values.get("EMAIL_FROM") !== expectedFrom)
    throw new Error("EMAIL_FROM must be the manifest-derived placeholder.");

  return values;
}

export function handoverChecklist(manifest: SiteManifest) {
  return `# ${manifest.name} handover\n\n- [ ] Cập nhật brand, logo, domain và nội dung demo.\n- [ ] Copy \`.env.example\` thành \`.env\`, điền secrets/recipient thật và không commit.\n- [ ] Chạy preflight, migrations, deploy và seed trên staging.\n- [ ] Chạy \`bun run site:admin:create --site=${manifest.id} --stage=staging\`, rồi xóa CMS_BOOTSTRAP_PASSWORD khỏi .env.\n- [ ] Smoke login, media, preview, publish, lead, notification và sitemap.\n- [ ] Xác nhận health + operational alert receipt, không chỉ provider capability.\n- [ ] Chạy \`site:backup\`, \`site:backup:archive:prepare\` + \`site:backup:archive\` với bucket khóa \`${manifest.infrastructure.backupBucketName}\`, rồi \`site:restore:remote\` dry-run/apply vào \`${manifest.id}-restore-drill-<date>\` và smoke target.\n- [ ] Cấu hình GitHub variables/secret cho \`scheduled-cms-backup.yml\`, giữ receipt manual dispatch đầu tiên và xác nhận schedule tuần kế tiếp.\n- [ ] Kết nối domain/HTTPS, kiểm tra RUM và đào tạo editor.\n`;
}

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export function logoPlaceholderSvg(manifest: SiteManifest) {
  const title = xmlEscape(manifest.name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" role="img" aria-labelledby="title"><title id="title">${title}</title><rect width="640" height="160" rx="16" fill="#f8f5ef"/><path d="M36 120h568" stroke="#b58a43" stroke-width="6"/><text x="320" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#111111">${title}</text></svg>\n`;
}

export async function writeIfAbsent(
  path: string,
  content: string,
  dryRun: boolean,
) {
  try {
    const existing = await readFile(path, "utf8");
    if (existing === content) return "unchanged" as const;
    throw new Error(
      `Refusing to overwrite existing file with different content: ${path}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, content);
  }
  return "created" as const;
}

/** Creates a generated artifact once and preserves later client customization. */
export async function writePreservingExisting(
  path: string,
  content: string,
  dryRun: boolean,
) {
  try {
    const existing = await readFile(path, "utf8");
    return existing === content
      ? ("unchanged" as const)
      : ("preserved" as const);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, content);
  }
  return "created" as const;
}

export async function writeJsonIfAbsent(
  path: string,
  content: string,
  dryRun: boolean,
) {
  try {
    const existing = await readFile(path, "utf8");
    if (isDeepStrictEqual(JSON.parse(existing), JSON.parse(content)))
      return "unchanged" as const;
    throw new Error(
      `Refusing to overwrite existing JSON with different content: ${path}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, content);
  }
  return "created" as const;
}

export function removePrivateEnvBinding(contents: string, key: string) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new Error("Private env binding key must be uppercase snake case.");
  }
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/);
  const matches = lines.filter((line) => line.startsWith(`${key}=`));
  if (matches.length > 1) {
    throw new Error(`Refusing to remove duplicate private env binding: ${key}`);
  }
  if (matches.length === 0) {
    return { contents, removed: false } as const;
  }
  return {
    contents: lines.filter((line) => !line.startsWith(`${key}=`)).join(newline),
    removed: true,
  } as const;
}

export async function readSiteManifest(site: string) {
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(site)) {
    throw new Error("Site must be a safe client slug.");
  }
  const clientPath = resolve(repoRoot, "sites", site, "site.manifest.json");
  try {
    const value = JSON.parse(await readFile(clientPath, "utf8"));
    return {
      manifest: siteManifestSchema.parse(value),
      path: clientPath,
      source: "client" as const,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const rootPath = resolve(repoRoot, "site.manifest.json");
  const rootValue = JSON.parse(await readFile(rootPath, "utf8"));
  const rootManifest = siteManifestSchema.parse(rootValue);
  if (rootManifest.id !== site) {
    throw new Error(`Site manifest not found for \"${site}\": ${clientPath}`);
  }
  return { manifest: rootManifest, path: rootPath, source: "root" as const };
}
