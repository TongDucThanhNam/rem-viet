import { cmsSiteManifestSchema, type CmsSiteManifest } from "@agency/cms-core";
import {
  createCmsVisualComponentRegistry,
  createCmsVisualMigrationRegistry,
  createCmsVisualPatternRegistry,
  defineCmsVisualComponent,
  migrateCmsVisualDocument,
  parseCmsVisualDocument,
  type CmsVisualComponentConstraints,
  type CmsVisualComponentDefinition,
  type CmsVisualDocument,
  type CmsVisualDocumentMigration,
  type CmsVisualFieldDefinition,
  type CmsVisualNode,
  type CmsVisualPatternDefinition,
  type CmsVisualPatternRegistry,
} from "@agency/cms-visual-editor";

export type CmsTemplateBlockMigration<TData> = Readonly<{
  from: number;
  to: number;
  migrate: (value: unknown) => TData;
}>;

export type CmsTemplateBlockDefinition<TData = unknown> = Readonly<{
  type: string;
  schemaVersion: number;
  fields: readonly CmsVisualFieldDefinition[];
  defaults: () => TData;
  parse: (value: unknown) => TData;
  renderer: string;
  editor: string;
  constraints?: CmsVisualComponentConstraints;
  actionCapabilities?: CmsVisualComponentDefinition["actionCapabilities"];
  migrations?: readonly CmsTemplateBlockMigration<TData>[];
}>;

export type CmsTemplateBlock<TData = unknown> = Readonly<{
  definition: CmsTemplateBlockDefinition<TData>;
  component: CmsVisualComponentDefinition<TData>;
  createSeed(input: {
    id: string;
    data?: unknown;
    enabled?: boolean;
  }): CmsVisualNode<TData>;
  migrateNode(node: CmsVisualNode): CmsVisualNode<TData>;
}>;

function validateMigrationChain<TData>(
  definition: CmsTemplateBlockDefinition<TData>,
): readonly CmsTemplateBlockMigration<TData>[] {
  const migrations = [...(definition.migrations ?? [])].sort(
    (left, right) => left.from - right.from,
  );
  if (definition.schemaVersion === 1 && migrations.length > 0) {
    throw new Error(
      `${definition.type} has migrations but schemaVersion is 1.`,
    );
  }
  for (let from = 1; from < definition.schemaVersion; from += 1) {
    const matches = migrations.filter(
      (migration) => migration.from === from && migration.to === from + 1,
    );
    if (matches.length !== 1) {
      throw new Error(
        `${definition.type} requires exactly one ${from}->${from + 1} migration.`,
      );
    }
  }
  if (migrations.some((migration) => migration.to > definition.schemaVersion)) {
    throw new Error(`${definition.type} migration exceeds its schema version.`);
  }
  return Object.freeze(migrations);
}

export function defineCmsTemplateBlock<TData>(
  definition: CmsTemplateBlockDefinition<TData>,
): CmsTemplateBlock<TData> {
  const migrations = validateMigrationChain(definition);
  const component = defineCmsVisualComponent({
    type: definition.type,
    schemaVersion: definition.schemaVersion,
    fields: definition.fields,
    defaults: definition.defaults,
    validate: definition.parse,
    renderer: definition.renderer,
    editor: definition.editor,
    constraints: definition.constraints,
    actionCapabilities: definition.actionCapabilities,
  });

  const createSeed = (input: {
    id: string;
    data?: unknown;
    enabled?: boolean;
  }): CmsVisualNode<TData> =>
    Object.freeze({
      id: input.id,
      type: definition.type,
      schemaVersion: definition.schemaVersion,
      enabled: input.enabled ?? true,
      data: definition.parse(
        input.data ?? structuredClone(definition.defaults()),
      ),
    });

  const migrateNode = (node: CmsVisualNode): CmsVisualNode<TData> => {
    if (node.type !== definition.type) {
      throw new Error(`Cannot migrate ${node.type} with ${definition.type}.`);
    }
    if (
      !Number.isSafeInteger(node.schemaVersion) ||
      node.schemaVersion < 1 ||
      node.schemaVersion > definition.schemaVersion
    ) {
      throw new Error(`${definition.type} node schema version is unsupported.`);
    }
    let version = node.schemaVersion;
    let data = node.data;
    while (version < definition.schemaVersion) {
      const migration = migrations.find((entry) => entry.from === version);
      if (!migration) {
        throw new Error(
          `${definition.type} is missing migration from ${version}.`,
        );
      }
      data = migration.migrate(data);
      version = migration.to;
    }
    return Object.freeze({
      ...node,
      schemaVersion: definition.schemaVersion,
      data: definition.parse(data),
    });
  };

  return Object.freeze({
    definition: Object.freeze({ ...definition, migrations }),
    component,
    createSeed,
    migrateNode,
  });
}

export type CmsTemplateFactory = Readonly<{
  id: string;
  version: string;
  schemaVersion: number;
  blocks: readonly CmsTemplateBlock[];
  registry: ReturnType<typeof createCmsVisualComponentRegistry>;
  patterns: CmsVisualPatternRegistry;
  createDocument(input: {
    id: string;
    siteId: string;
    version?: number;
    nodes: readonly CmsVisualNode[];
  }): CmsVisualDocument;
  parseDocument(document: CmsVisualDocument): CmsVisualDocument;
  migrateDocument(document: CmsVisualDocument): CmsVisualDocument;
}>;

function migrateTree(
  nodes: readonly CmsVisualNode[],
  byType: ReadonlyMap<string, CmsTemplateBlock>,
): readonly CmsVisualNode[] {
  return nodes.map((node) => {
    const block = byType.get(node.type);
    if (!block)
      throw new Error(`Template has no registration for ${node.type}.`);
    const migrated = block.migrateNode(node);
    return migrated.slots
      ? {
          ...migrated,
          slots: Object.fromEntries(
            Object.entries(migrated.slots).map(([slot, children]) => [
              slot,
              migrateTree(children, byType),
            ]),
          ),
        }
      : migrated;
  });
}

export function createCmsTemplateFactory(input: {
  id: string;
  version: string;
  schemaVersion: number;
  blocks: readonly CmsTemplateBlock[];
  documentMigrations?: readonly CmsVisualDocumentMigration[];
  patterns?: readonly CmsVisualPatternDefinition[];
}): CmsTemplateFactory {
  if (!/^@agency\/cms-template-[a-z0-9-]+$/.test(input.id)) {
    throw new Error(
      "Template id must be an @agency/cms-template-* package id.",
    );
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.version)) {
    throw new Error("Template version must be semantic.");
  }
  const byType = new Map(
    input.blocks.map((block) => [block.definition.type, block]),
  );
  if (byType.size !== input.blocks.length || input.blocks.length === 0) {
    throw new Error(
      "Template block registrations must be non-empty and unique.",
    );
  }
  const registry = createCmsVisualComponentRegistry(
    input.blocks.map((block) => block.component),
  );
  const patterns = createCmsVisualPatternRegistry(input.patterns ?? []);
  const documentMigrations = createCmsVisualMigrationRegistry({
    currentVersion: input.schemaVersion,
    migrations: input.documentMigrations ?? [],
  });
  const parseDocument = (document: CmsVisualDocument) => {
    if (document.schemaVersion !== input.schemaVersion) {
      throw new Error(
        `Template ${input.id} requires document schema ${input.schemaVersion}.`,
      );
    }
    return parseCmsVisualDocument(document, registry);
  };
  const migrateDocument = (document: CmsVisualDocument) =>
    migrateCmsVisualDocument({
      document: { ...document, nodes: migrateTree(document.nodes, byType) },
      migrations: documentMigrations,
      components: registry,
    });
  return Object.freeze({
    id: input.id,
    version: input.version,
    schemaVersion: input.schemaVersion,
    blocks: Object.freeze([...input.blocks]),
    registry,
    patterns,
    createDocument: (value) =>
      parseDocument({
        id: value.id,
        siteId: value.siteId,
        schemaVersion: input.schemaVersion,
        version: value.version ?? 0,
        nodes: value.nodes,
      }),
    parseDocument,
    migrateDocument,
  });
}

export type CmsThemeContract = Readonly<{
  schemaVersion: 1;
  tokens: Readonly<Record<string, string>>;
}>;
export type CmsAssetContract = Readonly<{
  id: string;
  kind: "image" | "font" | "video" | "document";
  src: string;
  altRequired: boolean;
}>;
export type CmsAgencySiteDefinition = Readonly<{
  manifest: CmsSiteManifest;
  theme: CmsThemeContract;
  assets: readonly CmsAssetContract[];
  template: CmsTemplateFactory;
}>;

export function defineCmsAgencySite(
  input: CmsAgencySiteDefinition,
): CmsAgencySiteDefinition {
  const manifest = cmsSiteManifestSchema.parse(input.manifest);
  if (
    manifest.kit.template !== input.template.id ||
    manifest.kit.contentSchemaVersion !== input.template.schemaVersion
  ) {
    throw new Error("Site manifest and template identity/schema must match.");
  }
  if (
    input.theme.schemaVersion !== 1 ||
    Object.keys(input.theme.tokens).length === 0
  ) {
    throw new Error("Site theme requires versioned tokens.");
  }
  for (const [token, value] of Object.entries(input.theme.tokens)) {
    if (!/^--[a-z][a-z0-9-]{1,63}$/.test(token) || !value.trim()) {
      throw new Error(`Theme token is invalid: ${token}.`);
    }
  }
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const asset of input.assets) {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(asset.id) || ids.has(asset.id)) {
      throw new Error(`Asset id is invalid or duplicated: ${asset.id}.`);
    }
    if (
      !/^\/assets\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(asset.src) ||
      sources.has(asset.src)
    ) {
      throw new Error(`Asset source is invalid or duplicated: ${asset.src}.`);
    }
    ids.add(asset.id);
    sources.add(asset.src);
  }
  if (!sources.has(manifest.brand.logo)) {
    throw new Error(
      "Manifest brand logo must be declared in the asset contract.",
    );
  }
  return Object.freeze({
    manifest,
    theme: Object.freeze({
      schemaVersion: 1 as const,
      tokens: Object.freeze({ ...input.theme.tokens }),
    }),
    assets: Object.freeze(
      input.assets.map((asset) => Object.freeze({ ...asset })),
    ),
    template: input.template,
  });
}

export function createCmsAgencySiteArtifacts(input: {
  site: CmsAgencySiteDefinition;
  documents: readonly CmsVisualDocument[];
}): Readonly<Record<string, string>> {
  const site = defineCmsAgencySite(input.site);
  const documents = input.documents.map((document) => {
    if (document.siteId !== site.manifest.id) {
      throw new Error("Seed document site identity must match the manifest.");
    }
    return site.template.parseDocument(document);
  });
  return Object.freeze({
    "site.manifest.json": `${JSON.stringify(site.manifest, null, 2)}\n`,
    "theme.tokens.json": `${JSON.stringify(site.theme, null, 2)}\n`,
    "assets.contract.json": `${JSON.stringify(site.assets, null, 2)}\n`,
    "content.seed.json": `${JSON.stringify(
      {
        schemaVersion: 1,
        siteId: site.manifest.id,
        template: site.template.id,
        contentSchemaVersion: site.template.schemaVersion,
        documents,
      },
      null,
      2,
    )}\n`,
  });
}

export const cmsAgencyWorkflowNames = Object.freeze([
  "create",
  "add-block",
  "check",
  "migrate",
  "seed",
  "dev",
  "build",
  "deploy",
  "backup",
  "handover",
] as const);
export type CmsAgencyWorkflowName = (typeof cmsAgencyWorkflowNames)[number];

const workflowCommands: Readonly<
  Record<CmsAgencyWorkflowName, readonly string[]>
> = {
  create: ["agency-cms plan-init", "agency-cms init"],
  "add-block": ["agency-cms add-block"],
  check: ["agency-cms verify", "bun run quality"],
  migrate: ["agency-cms migrate"],
  seed: ["bun run site:seed"],
  dev: ["bun run dev"],
  build: ["bun run build"],
  deploy: ["bun run site:deploy"],
  backup: ["bun run site:backup"],
  handover: ["agency-cms verify", "review HANDOVER.md"],
};

export function createCmsAgencyWorkflowPlan(input: {
  siteId: string;
  workflow: CmsAgencyWorkflowName;
  stage?: "local" | "staging" | "production";
}) {
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(input.siteId)) {
    throw new Error("Workflow site id is invalid.");
  }
  if (!cmsAgencyWorkflowNames.includes(input.workflow)) {
    throw new Error("Unknown agency workflow.");
  }
  const remoteMutation = input.workflow === "deploy";
  return Object.freeze({
    schemaVersion: 1 as const,
    siteId: input.siteId,
    workflow: input.workflow,
    stage: input.stage ?? "local",
    commands: workflowCommands[input.workflow],
    remoteMutation,
    requiresExplicitAuthorization: remoteMutation,
  });
}
