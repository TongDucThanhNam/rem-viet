import {
  booleanField,
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineCollection,
  defineFeatureModule,
  selectField,
  textField,
} from "@agency/cms-core";

export const cmsRedirectsExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/redirects",
  packageName: "@agency/cms-module-redirects",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/redirects/manage",
      capability: "redirects.manage",
      description: "Create, validate, import, and export redirect rules.",
    },
  ],
  secrets: [],
  routes: [],
  admin: [
    {
      id: "official/redirects/navigation",
      slot: "navigation",
      label: "Redirects",
      requiredCapability: "redirects.manage",
    },
  ],
  entrypoints: [
    {
      id: "official/redirects/shared",
      export: ".",
      runtime: "shared",
      capabilities: [],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      {
        id: "official/redirects/v1",
        from: 0,
        to: 1,
        reversible: false,
      },
    ],
    uninstall: {
      policy: "retain",
      description:
        "Retain redirects until an explicit export and purge to avoid route regressions.",
    },
  },
});

const access = {
  read: [] as const,
  create: ["content.write"] as const,
  update: ["content.write"] as const,
  delete: ["content.delete"] as const,
  publish: ["content.publish"] as const,
};

export const cmsRedirectsCollection = defineCollection({
  slug: "cms-redirects",
  labels: { singular: "Redirect", plural: "Redirects" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access,
  fields: [
    textField({
      name: "fromPath",
      label: "From path",
      required: true,
      unique: true,
      indexed: true,
      validation: { pattern: "^/[^\\\\]*$", maxLength: 2048 },
    }),
    textField({
      name: "to",
      label: "Destination",
      required: true,
      validation: { maxLength: 2048 },
    }),
    selectField({
      name: "statusCode",
      label: "Status code",
      required: true,
      multiple: false,
      defaultValue: "301",
      options: [
        { label: "301 Permanent", value: "301" },
        { label: "302 Temporary", value: "302" },
        { label: "307 Temporary", value: "307" },
        { label: "308 Permanent", value: "308" },
      ] as const,
    }),
    booleanField({ name: "enabled", label: "Enabled", defaultValue: true }),
  ],
  admin: {
    useAsTitle: "fromPath",
    defaultColumns: ["fromPath", "to", "statusCode", "enabled"],
  },
});

export const cmsRedirectsModule = defineFeatureModule({
  id: "official-redirects",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-redirects",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "retain",
      description:
        "Retain redirects until an explicit export and purge to avoid route regressions.",
    },
  }),
  collections: [cmsRedirectsCollection],
  permissions: [
    {
      id: "official-redirects/manage",
      capability: "content.write",
      collection: cmsRedirectsCollection.slug,
      operations: ["create", "update"],
    },
  ],
  migrations: [
    {
      id: "official-redirects/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? [],
    },
  ],
  admin: [
    {
      id: "official-redirects/navigation",
      collection: cmsRedirectsCollection.slug,
      placement: "navigation",
      label: "Redirects",
    },
  ],
});

export type CmsRedirectRule = Readonly<{
  fromPath: string;
  to: string;
  statusCode: 301 | 302 | 307 | 308;
  enabled: boolean;
}>;

function normalizePath(value: string) {
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new Error(`Unsafe redirect path: ${value}`);
  }
  const url = new URL(path, "https://redirect.invalid");
  return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeDestination(value: string) {
  const destination = value.trim();
  if (destination.startsWith("/") && !destination.startsWith("//")) {
    return normalizePath(destination);
  }
  const url = new URL(destination);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`Unsafe redirect destination: ${value}`);
  }
  return url.toString();
}

export function normalizeCmsRedirectRule(input: {
  fromPath: string;
  to: string;
  statusCode: number | string;
  enabled?: boolean;
}): CmsRedirectRule {
  const statusCode = Number(input.statusCode);
  if (![301, 302, 307, 308].includes(statusCode)) {
    throw new Error(`Unsupported redirect status: ${input.statusCode}`);
  }
  return Object.freeze({
    fromPath: normalizePath(input.fromPath),
    to: normalizeDestination(input.to),
    statusCode: statusCode as CmsRedirectRule["statusCode"],
    enabled: input.enabled ?? true,
  });
}

export function validateCmsRedirectGraph(input: readonly CmsRedirectRule[]) {
  const rules = input
    .filter(({ enabled }) => enabled)
    .map(normalizeCmsRedirectRule);
  const byPath = new Map<string, CmsRedirectRule>();
  for (const rule of rules) {
    if (byPath.has(rule.fromPath))
      throw new Error(`Duplicate redirect source: ${rule.fromPath}`);
    byPath.set(rule.fromPath, rule);
  }
  for (const rule of rules) {
    const chain: string[] = [];
    let current: CmsRedirectRule | undefined = rule;
    while (current && current.to.startsWith("/")) {
      if (chain.includes(current.fromPath)) {
        throw new Error(
          `Redirect loop: ${[...chain, current.fromPath].join(" -> ")}`,
        );
      }
      chain.push(current.fromPath);
      current = byPath.get(current.to);
    }
  }
  return Object.freeze(
    [...rules].sort((left, right) =>
      left.fromPath.localeCompare(right.fromPath),
    ),
  );
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function exportCmsRedirectsCsv(rules: readonly CmsRedirectRule[]) {
  return [
    "fromPath,to,statusCode,enabled",
    ...validateCmsRedirectGraph(rules).map((rule) =>
      [rule.fromPath, rule.to, String(rule.statusCode), String(rule.enabled)]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("Redirect CSV contains an unterminated quote.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function importCmsRedirectsCsv(input: string) {
  const rows = parseCsv(input);
  if (
    rows.length > 10_001 ||
    rows[0]?.join(",") !== "fromPath,to,statusCode,enabled"
  ) {
    throw new Error("Redirect CSV header or row count is invalid.");
  }
  return validateCmsRedirectGraph(
    rows
      .slice(1)
      .filter((row) => row.some(Boolean))
      .map((row) => {
        if (row.length !== 4)
          throw new Error("Redirect CSV row must contain four columns.");
        return normalizeCmsRedirectRule({
          fromPath: row[0]!,
          to: row[1]!,
          statusCode: row[2]!,
          enabled: row[3] === "true",
        });
      }),
  );
}

export function exportCmsRedirectsJson(rules: readonly CmsRedirectRule[]) {
  return JSON.stringify(validateCmsRedirectGraph(rules));
}

export function importCmsRedirectsJson(input: string) {
  const parsed: unknown = JSON.parse(input);
  if (!Array.isArray(parsed) || parsed.length > 10_000)
    throw new Error("Redirect JSON must be a bounded array.");
  return validateCmsRedirectGraph(
    parsed.map((rule) => normalizeCmsRedirectRule(rule as never)),
  );
}
