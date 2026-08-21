import {
  canonicalizeCmsExtensionValue,
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineFeatureModule,
} from "@agency/cms-core";

export const cmsImportExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/import",
  packageName: "@agency/cms-module-import",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/import/manage",
      capability: "content.write",
      description:
        "Plan, dry-run, resume, and execute reviewed content imports.",
    },
  ],
  secrets: [],
  routes: [
    {
      id: "official/import/route",
      path: "/api/cms/import",
      methods: ["POST"],
      authorization: "session",
      mutationProtection: "same-origin",
    },
  ],
  admin: [
    {
      id: "official/import/root",
      slot: "root",
      label: "Import and export",
      requiredCapability: "content.write",
    },
  ],
  entrypoints: [
    {
      id: "official/import/server",
      export: ".",
      runtime: "server",
      capabilities: ["content.write"],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      { id: "official/import/v1", from: 0, to: 1, reversible: false },
    ],
    uninstall: {
      policy: "retain",
      description:
        "Imported canonical content remains; export and purge import receipts explicitly.",
    },
  },
});

export const cmsImportModule = defineFeatureModule({
  id: "official-import",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-import",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "retain",
      description:
        "Imported canonical content remains; export and purge import receipts explicitly.",
    },
  }),
  permissions: [
    {
      id: "official-import/manage",
      capability: "content.write",
      operations: ["create", "update"],
      description: "Execute a reviewed import plan.",
    },
  ],
  migrations: [
    {
      id: "official-import/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? { receipts: [] },
    },
  ],
  admin: [
    {
      id: "official-import/root",
      placement: "root",
      label: "Import and export",
    },
  ],
});

export type CmsImportedDocument = Readonly<{
  sourceId: string;
  documentType: "page" | "post";
  slug: string;
  title: string;
  status: "draft" | "published";
  content: string;
  excerpt: string;
  author: string | null;
  publishedAt: string | null;
  categories: readonly string[];
  tags: readonly string[];
}>;

export type CmsWordPressImportSource = Readonly<{
  format: "wordpress-wxr";
  documents: readonly CmsImportedDocument[];
  warnings: readonly string[];
}>;

function decodeXml(value: string) {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|amp|lt|gt|quot|apos);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal)
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return (
        {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
        } as Record<string, string>
      )[entity.toLowerCase()]!;
    },
  );
}

function unwrapXml(value: string) {
  const trimmed = value.trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(trimmed);
  return cdata ? cdata[1]! : decodeXml(trimmed);
}

function readTag(input: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
    "i",
  ).exec(input);
  return match ? unwrapXml(match[1]!) : "";
}

function slugify(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

function wordpressDate(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.startsWith("0000-00-00")) return null;
  const timestamp = Date.parse(
    normalized.includes("T") ? normalized : `${normalized.replace(" ", "T")}Z`,
  );
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function wordpressTerms(item: string, domain: "category" | "post_tag") {
  const values: string[] = [];
  const pattern = /<category\b([^>]*)>([\s\S]*?)<\/category>/gi;
  for (const match of item.matchAll(pattern)) {
    const attributes = match[1] ?? "";
    if (!new RegExp(`\\bdomain=["']${domain}["']`, "i").test(attributes))
      continue;
    const nicename = /\bnicename=["']([^"']+)["']/i.exec(attributes)?.[1];
    const value = slugify(
      decodeXml(nicename ?? unwrapXml(match[2] ?? "")),
      "term",
    );
    if (!values.includes(value)) values.push(value);
  }
  return Object.freeze(values.sort());
}

export function parseCmsWordPressWxr(
  input: string,
  options: { maximumBytes?: number; maximumItems?: number } = {},
): CmsWordPressImportSource {
  const maximumBytes = options.maximumBytes ?? 20 * 1024 * 1024;
  const maximumItems = options.maximumItems ?? 50_000;
  if (new TextEncoder().encode(input).byteLength > maximumBytes)
    throw new Error(`WordPress WXR exceeds ${maximumBytes} bytes.`);
  if (/<!DOCTYPE|<!ENTITY/i.test(input))
    throw new Error("WordPress WXR DTD and entity declarations are forbidden.");
  const documents: CmsImportedDocument[] = [];
  const warnings: string[] = [];
  const sourceIds = new Set<string>();
  const items = input.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  let itemCount = 0;
  for (const match of items) {
    itemCount += 1;
    if (itemCount > maximumItems)
      throw new Error(`WordPress WXR exceeds ${maximumItems} items.`);
    const item = match[1]!;
    const postType = readTag(item, "wp:post_type");
    const postId = readTag(item, "wp:post_id");
    if (!postId) {
      warnings.push(
        `Skipped ${postType || "unknown"} item without wp:post_id.`,
      );
      continue;
    }
    if (postType !== "post" && postType !== "page") {
      warnings.push(
        `Skipped unsupported WordPress item ${postId} (${postType || "unknown"}).`,
      );
      continue;
    }
    const sourceId = `wordpress:${postId}`;
    if (sourceIds.has(sourceId))
      throw new Error(`Duplicate WordPress post id: ${postId}.`);
    sourceIds.add(sourceId);
    const title = readTag(item, "title").trim() || `Untitled ${postId}`;
    const status =
      readTag(item, "wp:status") === "publish" ? "published" : "draft";
    documents.push(
      Object.freeze({
        sourceId,
        documentType: postType,
        slug: slugify(
          readTag(item, "wp:post_name") || title,
          `wordpress-${postId}`,
        ),
        title,
        status,
        content: readTag(item, "content:encoded"),
        excerpt: readTag(item, "excerpt:encoded"),
        author: readTag(item, "dc:creator").trim() || null,
        publishedAt: wordpressDate(
          readTag(item, "wp:post_date_gmt") || readTag(item, "pubDate"),
        ),
        categories: wordpressTerms(item, "category"),
        tags: wordpressTerms(item, "post_tag"),
      }),
    );
  }
  documents.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  return Object.freeze({
    format: "wordpress-wxr",
    documents: Object.freeze(documents),
    warnings: Object.freeze(warnings),
  });
}

export type CmsImportConflictPolicy = "fail" | "skip" | "overwrite";
export type CmsImportPlanAction =
  | Readonly<{
      operation: "create" | "update";
      document: CmsImportedDocument;
    }>
  | Readonly<{
      operation: "skip";
      document: CmsImportedDocument;
    }>;
export type CmsImportPlan = Readonly<{
  schemaVersion: 1;
  planId: string;
  format: CmsWordPressImportSource["format"];
  sourceSha256: string;
  actions: readonly CmsImportPlanAction[];
  warnings: readonly string[];
}>;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCmsImportPlan(input: {
  planId: string;
  source: CmsWordPressImportSource;
  existingSourceIds?: readonly string[];
  conflictPolicy: CmsImportConflictPolicy;
}): Promise<CmsImportPlan> {
  const planId = input.planId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(planId))
    throw new Error("Import plan id is invalid.");
  const existing = new Set(input.existingSourceIds ?? []);
  const actions = input.source.documents.map((document) => {
    if (!existing.has(document.sourceId))
      return Object.freeze({ operation: "create" as const, document });
    if (input.conflictPolicy === "fail")
      throw new Error(`Import conflict for ${document.sourceId}.`);
    return Object.freeze({
      operation:
        input.conflictPolicy === "skip"
          ? ("skip" as const)
          : ("update" as const),
      document,
    });
  });
  const sourceSha256 = await sha256(
    canonicalizeCmsExtensionValue({
      format: input.source.format,
      documents: input.source.documents,
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    planId,
    format: input.source.format,
    sourceSha256,
    actions: Object.freeze(actions),
    warnings: input.source.warnings,
  });
}

export type CmsImportCheckpoint = Readonly<{
  schemaVersion: 1;
  planId: string;
  sourceSha256: string;
  nextActionIndex: number;
}>;

export async function executeCmsImportPlan(input: {
  plan: CmsImportPlan;
  dryRun: boolean;
  checkpoint?: CmsImportCheckpoint;
  batchSize?: number;
  applyBatch: (
    actions: readonly Exclude<CmsImportPlanAction, { operation: "skip" }>[],
    context: { idempotencyKey: string },
  ) => void | Promise<void>;
  onCheckpoint?: (checkpoint: CmsImportCheckpoint) => void | Promise<void>;
}) {
  const batchSize = input.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1_000)
    throw new Error("Import batch size must be between 1 and 1000.");
  const checkpoint = input.checkpoint ?? {
    schemaVersion: 1 as const,
    planId: input.plan.planId,
    sourceSha256: input.plan.sourceSha256,
    nextActionIndex: 0,
  };
  if (
    checkpoint.schemaVersion !== 1 ||
    checkpoint.planId !== input.plan.planId ||
    checkpoint.sourceSha256 !== input.plan.sourceSha256 ||
    !Number.isInteger(checkpoint.nextActionIndex) ||
    checkpoint.nextActionIndex < 0 ||
    checkpoint.nextActionIndex > input.plan.actions.length
  ) {
    throw new Error("Import checkpoint does not match the reviewed plan.");
  }
  let nextActionIndex = checkpoint.nextActionIndex;
  let applied = 0;
  let skipped = 0;
  while (nextActionIndex < input.plan.actions.length) {
    const end = Math.min(
      nextActionIndex + batchSize,
      input.plan.actions.length,
    );
    const slice = input.plan.actions.slice(nextActionIndex, end);
    const actionable = slice.filter(
      (action): action is Exclude<CmsImportPlanAction, { operation: "skip" }> =>
        action.operation !== "skip",
    );
    skipped += slice.length - actionable.length;
    if (!input.dryRun && actionable.length) {
      await input.applyBatch(actionable, {
        idempotencyKey: `${input.plan.sourceSha256}:${nextActionIndex}-${end}`,
      });
      applied += actionable.length;
    }
    nextActionIndex = end;
    await input.onCheckpoint?.(
      Object.freeze({
        schemaVersion: 1,
        planId: input.plan.planId,
        sourceSha256: input.plan.sourceSha256,
        nextActionIndex,
      }),
    );
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    planId: input.plan.planId,
    sourceSha256: input.plan.sourceSha256,
    dryRun: input.dryRun,
    planned: input.plan.actions.length - checkpoint.nextActionIndex,
    applied,
    skipped,
    checkpoint: Object.freeze({
      schemaVersion: 1 as const,
      planId: input.plan.planId,
      sourceSha256: input.plan.sourceSha256,
      nextActionIndex,
    }),
  });
}

export function exportCmsImportPlanJson(plan: CmsImportPlan) {
  return `${canonicalizeCmsExtensionValue(plan)}\n`;
}
