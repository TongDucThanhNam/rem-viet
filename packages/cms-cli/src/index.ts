import { cmsSiteManifestSchema, type CmsSiteManifest } from "@agency/cms-core";

export * from "./integration.js";

const siteIdPattern = /^[a-z][a-z0-9-]{1,62}$/;
const blockTypePattern = /^[a-z][a-zA-Z0-9]{1,63}$/;
const resourceNamePattern = /^[a-z][a-z0-9-]{1,127}$/;
const migrationIdPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

export type CmsCliFileMode = "exact" | "json-exact" | "preserve";
export type CmsCliFilePlanEntry = Readonly<{
  path: string;
  content: string;
  mode: CmsCliFileMode;
}>;
export type CmsCliLegacySiteInitPlan = Readonly<{
  schemaVersion: 1;
  operation: "init";
  siteId: string;
  files: readonly CmsCliFilePlanEntry[];
}>;
export type CmsCliBlockScaffoldPlan = Readonly<{
  schemaVersion: 1;
  operation: "add-block";
  siteId: string;
  files: readonly CmsCliFilePlanEntry[];
}>;
export type CmsCliSiteBootstrapPlan = Readonly<{
  schemaVersion: 2;
  operation: "init";
  siteId: string;
  manifest: CmsSiteManifest;
  requiredSecrets: readonly string[];
  files: readonly CmsCliFilePlanEntry[];
}>;
export type CmsCliSiteInitPlan =
  CmsCliLegacySiteInitPlan | CmsCliSiteBootstrapPlan;
export type CmsCliFilePlan = CmsCliSiteInitPlan | CmsCliBlockScaffoldPlan;

export function normalizeCmsCliRelativePath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error(`CMS CLI file path must be safe and relative: ${path}`);
  }
  return normalized;
}

function validateFileEntries(files: readonly CmsCliFilePlanEntry[]) {
  const paths = new Set<string>();
  return files.map((file) => {
    const path = normalizeCmsCliRelativePath(file.path);
    if (paths.has(path))
      throw new Error(`Duplicate CMS CLI file path: ${path}`);
    paths.add(path);
    return Object.freeze({ ...file, path });
  });
}

export function createCmsSiteInitPlan(input: {
  siteId: string;
  files: readonly CmsCliFilePlanEntry[];
}): CmsCliLegacySiteInitPlan {
  if (!siteIdPattern.test(input.siteId)) {
    throw new Error("Site id must be a safe client slug.");
  }
  const files = validateFileEntries(input.files);
  if (
    !files.some(
      (file) =>
        file.path === "site.manifest.json" ||
        file.path.endsWith("/site.manifest.json"),
    )
  ) {
    throw new Error("A site init plan requires site.manifest.json.");
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    operation: "init" as const,
    siteId: input.siteId,
    files: Object.freeze(files),
  });
}

function parseInitFiles(value: unknown): CmsCliFilePlanEntry[] {
  if (!Array.isArray(value)) {
    throw new Error("CMS site init files must be an array.");
  }
  return value.map((value) => {
    const file = objectRecord(value, "CMS site init file");
    exactKeys(file, ["path", "content", "mode"]);
    const mode = file.mode;
    if (
      typeof file.path !== "string" ||
      typeof file.content !== "string" ||
      (mode !== "exact" && mode !== "json-exact" && mode !== "preserve")
    ) {
      throw new Error("CMS site init file shape is invalid.");
    }
    return { path: file.path, content: file.content, mode };
  });
}

function parseBootstrapManifest(
  siteId: string,
  files: readonly CmsCliFilePlanEntry[],
) {
  const manifests = files.filter(
    (file) =>
      file.path === "site.manifest.json" ||
      file.path.endsWith("/site.manifest.json"),
  );
  if (manifests.length !== 1 || manifests[0]?.mode !== "json-exact") {
    throw new Error(
      "A CMS bootstrap plan requires exactly one json-exact site.manifest.json.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(manifests[0].content);
  } catch {
    throw new Error("CMS bootstrap manifest must contain valid JSON.");
  }
  const manifest = cmsSiteManifestSchema.parse(value);
  if (manifest.id !== siteId) {
    throw new Error("CMS bootstrap manifest id must match the plan site id.");
  }
  return manifest;
}

export function createCmsSiteBootstrapPlan(input: {
  siteId: string;
  requiredSecrets: readonly string[];
  files: readonly CmsCliFilePlanEntry[];
}): CmsCliSiteBootstrapPlan {
  if (!siteIdPattern.test(input.siteId)) {
    throw new Error("Site id must be a safe client slug.");
  }
  const files = validateFileEntries(input.files);
  const manifest = parseBootstrapManifest(input.siteId, files);
  const requiredSecrets = input.requiredSecrets.map((value) => {
    if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(value)) {
      throw new Error(`Required secret name is invalid: ${value}`);
    }
    return value;
  });
  if (new Set(requiredSecrets).size !== requiredSecrets.length) {
    throw new Error("Required secret names must be unique.");
  }
  return Object.freeze({
    schemaVersion: 2 as const,
    operation: "init" as const,
    siteId: input.siteId,
    manifest,
    requiredSecrets: Object.freeze(requiredSecrets),
    files: Object.freeze(files),
  });
}

export function parseCmsSiteInitPlan(value: unknown): CmsCliSiteInitPlan {
  const input = objectRecord(value, "CMS site init plan");
  if (input.schemaVersion === 2) {
    exactKeys(input, [
      "schemaVersion",
      "operation",
      "siteId",
      "manifest",
      "requiredSecrets",
      "files",
    ]);
    if (
      input.operation !== "init" ||
      typeof input.siteId !== "string" ||
      !Array.isArray(input.requiredSecrets)
    ) {
      throw new Error("CMS site bootstrap plan shape is invalid.");
    }
    const plan = createCmsSiteBootstrapPlan({
      siteId: input.siteId,
      requiredSecrets: input.requiredSecrets.map((value) => {
        if (typeof value !== "string") {
          throw new Error("CMS bootstrap required secrets must be strings.");
        }
        return value;
      }),
      files: parseInitFiles(input.files),
    });
    if (
      JSON.stringify(plan.manifest) !==
      JSON.stringify(cmsSiteManifestSchema.parse(input.manifest))
    ) {
      throw new Error(
        "CMS bootstrap plan manifest must match site.manifest.json.",
      );
    }
    return plan;
  }
  exactKeys(input, ["schemaVersion", "operation", "siteId", "files"]);
  if (
    input.schemaVersion !== 1 ||
    input.operation !== "init" ||
    typeof input.siteId !== "string" ||
    !Array.isArray(input.files)
  ) {
    throw new Error("CMS site init plan shape is invalid.");
  }
  return createCmsSiteInitPlan({
    siteId: input.siteId,
    files: parseInitFiles(input.files),
  });
}

function pascalCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function kebabCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function constantCase(value: string) {
  return kebabCase(value).replaceAll("-", "_").toUpperCase();
}

function humanize(value: string) {
  const words = kebabCase(value).replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Creates non-destructive template block stubs without editing a registry. */
export function createCmsBlockScaffoldPlan(input: {
  siteId: string;
  directory: string;
  type: string;
}): CmsCliFilePlan {
  if (!siteIdPattern.test(input.siteId)) {
    throw new Error("Site id must be a safe client slug.");
  }
  if (!blockTypePattern.test(input.type)) {
    throw new Error("Block type must be lower camel case.");
  }
  const directory = normalizeCmsCliRelativePath(input.directory).replace(
    /\/$/,
    "",
  );
  const symbol = pascalCase(input.type);
  const constant = constantCase(input.type);
  const label = humanize(input.type);
  const slug = kebabCase(input.type);
  const base = `${directory}/${input.type}`;
  const files = validateFileEntries([
    {
      path: `${base}/contract.ts`,
      mode: "exact",
      content: `import { createCmsBlockSchema } from "@agency/cms-core";\nimport { z } from "zod";\n\nexport const ${constant}_BLOCK_TYPE = "${input.type}" as const;\nexport const ${constant}_BLOCK_SCHEMA_VERSION = 1 as const;\n\nexport const ${input.type}DataSchema = z.object({\n  title: z.string().trim().min(1),\n});\n\nexport const ${input.type}BlockSchema = createCmsBlockSchema(\n  ${constant}_BLOCK_TYPE,\n  ${input.type}DataSchema,\n).extend({\n  schemaVersion: z.literal(${constant}_BLOCK_SCHEMA_VERSION),\n});\n\nexport type ${symbol}Data = z.infer<typeof ${input.type}DataSchema>;\nexport type ${symbol}Block = z.infer<typeof ${input.type}BlockSchema>;\n`,
    },
    {
      path: `${base}/defaults.ts`,
      mode: "exact",
      content: `import {\n  ${constant}_BLOCK_SCHEMA_VERSION,\n  ${constant}_BLOCK_TYPE,\n  ${input.type}BlockSchema,\n  type ${symbol}Block,\n} from "./contract";\n\nexport const default${symbol}Block: ${symbol}Block = ${input.type}BlockSchema.parse({\n  id: "${slug}-default",\n  type: ${constant}_BLOCK_TYPE,\n  schemaVersion: ${constant}_BLOCK_SCHEMA_VERSION,\n  enabled: true,\n  data: { title: "${label}" },\n});\n`,
    },
    {
      path: `${base}/migrations.ts`,
      mode: "exact",
      content: `import { migrateBlockData, type CmsBlockMigration } from "@agency/cms-core";\n\nimport {\n  ${constant}_BLOCK_SCHEMA_VERSION,\n  ${input.type}DataSchema,\n  type ${symbol}Data,\n} from "./contract";\n\n/** Add one contiguous migration for every schema-version increment. */\nexport const ${input.type}BlockMigrations =\n  [] as const satisfies readonly CmsBlockMigration<${symbol}Data>[];\n\nexport function migrate${symbol}BlockData(\n  data: unknown,\n  fromVersion: number,\n): ${symbol}Data {\n  if (\n    !Number.isInteger(fromVersion) ||\n    fromVersion < 1 ||\n    fromVersion > ${constant}_BLOCK_SCHEMA_VERSION\n  ) {\n    throw new Error("${label} block schema version is unsupported.");\n  }\n  return ${input.type}DataSchema.parse(\n    migrateBlockData(\n      data,\n      fromVersion,\n      ${constant}_BLOCK_SCHEMA_VERSION,\n      ${input.type}BlockMigrations,\n    ),\n  );\n}\n`,
    },
    {
      path: `${base}/seed.ts`,
      mode: "exact",
      content: `import { ${input.type}BlockSchema, type ${symbol}Block } from "./contract";\nimport { default${symbol}Block } from "./defaults";\n\nexport function create${symbol}SeedBlock(input: {\n  id: string;\n  title?: string;\n}): ${symbol}Block {\n  return ${input.type}BlockSchema.parse({\n    ...default${symbol}Block,\n    id: input.id,\n    data: {\n      ...default${symbol}Block.data,\n      title: input.title ?? default${symbol}Block.data.title,\n    },\n  });\n}\n`,
    },
    {
      path: `${base}/renderer.tsx`,
      mode: "exact",
      content: `import type { BlockRendererProps } from "@agency/cms-react";\n\nimport type { ${symbol}Block } from "./contract";\n\nexport function ${symbol}Renderer({\n  block,\n}: BlockRendererProps<${symbol}Block, unknown>) {\n  return (\n    <section data-cms-block={block.type} data-cms-block-id={block.id}>\n      <h2>{block.data.title}</h2>\n    </section>\n  );\n}\n`,
    },
    {
      path: `${base}/editor.tsx`,
      mode: "exact",
      content: `import type { CmsBlockEditorProps } from "@agency/cms-admin";\n\nimport type { ${symbol}Block } from "./contract";\n\ntype ${symbol}EditorProps = CmsBlockEditorProps<${symbol}Block> & {\n  context: unknown;\n};\n\nexport function ${symbol}Editor({\n  block,\n  onChange,\n}: ${symbol}EditorProps) {\n  const titleId = \`${"${block.id}"}-title\`;\n  return (\n    <label htmlFor={titleId}>\n      Title\n      <input\n        id={titleId}\n        value={block.data.title}\n        onChange={(event) =>\n          onChange({\n            ...block,\n            data: { ...block.data, title: event.currentTarget.value },\n          })\n        }\n      />\n    </label>\n  );\n}\n`,
    },
    {
      path: `${base}/registry.ts`,
      mode: "exact",
      content: `import type { CmsBlockEditorDefinition } from "@agency/cms-admin";\nimport type { CmsBlockDefinition } from "@agency/cms-react";\n\nimport type { ${symbol}Block } from "./contract";\nimport { default${symbol}Block } from "./defaults";\nimport { ${symbol}Editor } from "./editor";\nimport { ${symbol}Renderer } from "./renderer";\nimport { ${input.type}BlockSchema } from "./contract";\n\nexport const ${input.type}BlockDefinition = {\n  schema: ${input.type}BlockSchema,\n  defaults: default${symbol}Block,\n  Renderer: ${symbol}Renderer,\n} satisfies CmsBlockDefinition<${symbol}Block, unknown>;\n\nexport const ${input.type}BlockEditorDefinition = {\n  label: "${label}",\n  Editor: ${symbol}Editor,\n} satisfies CmsBlockEditorDefinition<${symbol}Block, unknown>;\n`,
    },
    {
      path: `${base}/index.ts`,
      mode: "exact",
      content: `export * from "./contract";\nexport * from "./defaults";\nexport * from "./migrations";\nexport * from "./seed";\nexport * from "./renderer";\nexport * from "./editor";\nexport * from "./registry";\n`,
    },
    {
      path: `${base}/block.manifest.json`,
      mode: "json-exact",
      content: `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: "agency-cms-block",
          type: input.type,
          contract: "./contract.ts",
          defaults: "./defaults.ts",
          migrations: "./migrations.ts",
          seed: "./seed.ts",
          renderer: "./renderer.tsx",
          editor: "./editor.tsx",
          registry: "./registry.ts",
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${base}/REGISTER.md`,
      mode: "preserve",
      content: `# Register ${input.type}\n\n1. Add \`${symbol}Block\` to the client template block union.\n2. Add \`${input.type}: ${input.type}BlockDefinition\` to the renderer registry.\n3. Add \`${input.type}: ${input.type}BlockEditorDefinition\` to the editor registry.\n4. Add \`create${symbol}SeedBlock(...)\` to the template seed.\n5. Before increasing \`${constant}_BLOCK_SCHEMA_VERSION\`, add a contiguous entry to \`${input.type}BlockMigrations\`, a fixture for the previous version, and an upgrade/rollback test.\n\nDo not edit a core-package switch. The template owns this block and its registry composition.\n`,
    },
  ]);
  return Object.freeze({
    schemaVersion: 1 as const,
    operation: "add-block" as const,
    siteId: input.siteId,
    files: Object.freeze(files),
  });
}

export type CmsCliFileSystem = {
  read: (path: string) => Promise<string | null>;
  write: (path: string, content: string) => Promise<void>;
};

export type CmsCliFileResult = Readonly<{
  path: string;
  status: "created" | "unchanged" | "preserved" | "would-create";
}>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Applies a plan through an injected filesystem, preserving customized files. */
export async function applyCmsFilePlan(
  plan: CmsCliFilePlan,
  filesystem: CmsCliFileSystem,
  options: { dryRun?: boolean } = {},
): Promise<readonly CmsCliFileResult[]> {
  const results: CmsCliFileResult[] = [];
  for (const file of plan.files) {
    const existing = await filesystem.read(file.path);
    if (existing !== null) {
      const equal =
        file.mode === "json-exact"
          ? canonicalJson(JSON.parse(existing)) ===
            canonicalJson(JSON.parse(file.content))
          : existing === file.content;
      if (equal) {
        results.push({ path: file.path, status: "unchanged" });
        continue;
      }
      if (file.mode === "preserve") {
        results.push({ path: file.path, status: "preserved" });
        continue;
      }
      throw new Error(`Refusing to overwrite divergent file: ${file.path}`);
    }
    if (!options.dryRun) await filesystem.write(file.path, file.content);
    results.push({
      path: file.path,
      status: options.dryRun ? "would-create" : "created",
    });
  }
  return Object.freeze(results);
}

export type CmsCliMigration<T> = Readonly<{
  from: number;
  to: number;
  migrate: (value: T) => T;
}>;

/** Applies a contiguous, explicit migration chain without mutating its input. */
export function migrateCmsValue<T>(input: {
  value: T;
  currentVersion: number;
  targetVersion: number;
  migrations: readonly CmsCliMigration<T>[];
}) {
  if (input.targetVersion < input.currentVersion) {
    throw new Error("CMS CLI migrations do not perform implicit downgrades.");
  }
  let value = structuredClone(input.value);
  let version = input.currentVersion;
  const applied: number[] = [];
  while (version < input.targetVersion) {
    const migration = input.migrations.find((entry) => entry.from === version);
    if (!migration || migration.to !== version + 1) {
      throw new Error(
        `Missing contiguous CMS migration from version ${version}.`,
      );
    }
    value = migration.migrate(value);
    version = migration.to;
    applied.push(version);
  }
  return Object.freeze({ value, version, applied: Object.freeze(applied) });
}

export type CmsCliMigrationStage = "staging" | "production";
export type CmsCliReleaseMigrationStep = Readonly<{
  id: string;
  from: number;
  to: number;
}>;
export type CmsCliMigrationPlan = Readonly<{
  schemaVersion: 1;
  operation: "migrate";
  siteId: string;
  stage: CmsCliMigrationStage;
  target: string;
  currentVersion: number;
  targetVersion: number;
  steps: readonly CmsCliReleaseMigrationStep[];
  applyConfirmation: string;
  rollbackConfirmation: string;
}>;

/** Builds a serializable, exact-confirmation plan for an additive release migration. */
export function createCmsMigrationPlan(input: {
  siteId: string;
  stage: CmsCliMigrationStage;
  target: string;
  currentVersion: number;
  targetVersion: number;
  steps: readonly CmsCliReleaseMigrationStep[];
}): CmsCliMigrationPlan {
  if (!siteIdPattern.test(input.siteId)) {
    throw new Error("Site id must be a safe client slug.");
  }
  if (!resourceNamePattern.test(input.target)) {
    throw new Error("Migration target must be a safe resource name.");
  }
  if (
    !Number.isSafeInteger(input.currentVersion) ||
    input.currentVersion < 0 ||
    !Number.isSafeInteger(input.targetVersion) ||
    input.targetVersion <= input.currentVersion
  ) {
    throw new Error(
      "CMS release migrations must move to a newer integer version.",
    );
  }
  const ids = new Set<string>();
  let expectedVersion = input.currentVersion;
  const steps = input.steps.map((step) => {
    if (!migrationIdPattern.test(step.id) || ids.has(step.id)) {
      throw new Error(`Invalid or duplicate CMS migration id: ${step.id}.`);
    }
    ids.add(step.id);
    if (step.from !== expectedVersion || step.to !== step.from + 1) {
      throw new Error(
        `CMS release migration ${step.id} is not contiguous from version ${expectedVersion}.`,
      );
    }
    expectedVersion = step.to;
    return Object.freeze({ ...step });
  });
  if (!steps.length || expectedVersion !== input.targetVersion) {
    throw new Error(
      `CMS release migration steps do not reach version ${input.targetVersion}.`,
    );
  }
  const identity = `${input.siteId} ${input.stage} ${input.target} ${input.currentVersion}->${input.targetVersion}`;
  return Object.freeze({
    schemaVersion: 1 as const,
    operation: "migrate" as const,
    siteId: input.siteId,
    stage: input.stage,
    target: input.target,
    currentVersion: input.currentVersion,
    targetVersion: input.targetVersion,
    steps: Object.freeze(steps),
    applyConfirmation: `APPLY CMS MIGRATION ${identity}`,
    rollbackConfirmation: `ROLLBACK CMS MIGRATION ${identity}`,
  });
}

export function parseCmsMigrationPlan(value: unknown): CmsCliMigrationPlan {
  const input = objectRecord(value, "CMS migration plan");
  exactKeys(input, [
    "schemaVersion",
    "operation",
    "siteId",
    "stage",
    "target",
    "currentVersion",
    "targetVersion",
    "steps",
    "applyConfirmation",
    "rollbackConfirmation",
  ]);
  if (
    input.schemaVersion !== 1 ||
    input.operation !== "migrate" ||
    (input.stage !== "staging" && input.stage !== "production") ||
    typeof input.siteId !== "string" ||
    typeof input.target !== "string" ||
    typeof input.currentVersion !== "number" ||
    typeof input.targetVersion !== "number" ||
    !Array.isArray(input.steps) ||
    typeof input.applyConfirmation !== "string" ||
    typeof input.rollbackConfirmation !== "string"
  ) {
    throw new Error("CMS migration plan shape is invalid.");
  }
  const plan = createCmsMigrationPlan({
    siteId: input.siteId,
    stage: input.stage,
    target: input.target,
    currentVersion: input.currentVersion,
    targetVersion: input.targetVersion,
    steps: input.steps.map((value) => {
      const step = objectRecord(value, "CMS migration step");
      exactKeys(step, ["id", "from", "to"]);
      if (
        typeof step.id !== "string" ||
        typeof step.from !== "number" ||
        typeof step.to !== "number"
      ) {
        throw new Error("CMS migration step shape is invalid.");
      }
      return { id: step.id, from: step.from, to: step.to };
    }),
  });
  if (
    input.applyConfirmation !== plan.applyConfirmation ||
    input.rollbackConfirmation !== plan.rollbackConfirmation
  ) {
    throw new Error("CMS migration plan confirmations are invalid.");
  }
  return plan;
}

export type CmsCliMigrationBackup = Readonly<{
  locator: string;
  sha256: string;
  bytes: number;
}>;
export type CmsCliMigrationDriver = {
  inspectVersion: () => Promise<number>;
  createBackup: (plan: CmsCliMigrationPlan) => Promise<CmsCliMigrationBackup>;
  applyStep: (
    step: CmsCliReleaseMigrationStep,
    plan: CmsCliMigrationPlan,
  ) => Promise<void>;
  restoreBackup: (
    backup: CmsCliMigrationBackup,
    plan: CmsCliMigrationPlan,
  ) => Promise<void>;
};
export type CmsCliMigrationRecoveryPoint = Readonly<{
  siteId: string;
  stage: CmsCliMigrationStage;
  target: string;
  currentVersion: number;
  targetVersion: number;
  backup: CmsCliMigrationBackup;
  appliedStepIds: readonly string[];
}>;
export type CmsCliMigrationReceipt = CmsCliMigrationRecoveryPoint &
  Readonly<{
    schemaVersion: 1;
    operation: "migrate";
    status: "applied";
    startedAt: string;
    backupCompletedAt: string;
    migrationStartedAt: string;
    completedAt: string;
  }>;
export type CmsCliRollbackReceipt = Readonly<{
  schemaVersion: 1;
  operation: "rollback";
  status: "restored";
  siteId: string;
  stage: CmsCliMigrationStage;
  target: string;
  restoredVersion: number;
  backup: CmsCliMigrationBackup;
  startedAt: string;
  completedAt: string;
}>;

export class CmsCliMigrationExecutionError extends Error {
  readonly rollbackRequired = true;

  constructor(
    message: string,
    readonly recovery: CmsCliMigrationRecoveryPoint,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CmsCliMigrationExecutionError";
  }
}

function timestamp(clock: () => Date) {
  const value = clock();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("CMS migration clock returned an invalid date.");
  }
  return value.toISOString();
}

function validateBackup(backup: CmsCliMigrationBackup) {
  if (
    !backup.locator.trim() ||
    !sha256Pattern.test(backup.sha256) ||
    !Number.isSafeInteger(backup.bytes) ||
    backup.bytes <= 0
  ) {
    throw new Error("CMS migration backup proof is incomplete.");
  }
  return Object.freeze({ ...backup });
}

function recoveryPoint(
  plan: CmsCliMigrationPlan,
  backup: CmsCliMigrationBackup,
  appliedStepIds: readonly string[],
): CmsCliMigrationRecoveryPoint {
  return Object.freeze({
    siteId: plan.siteId,
    stage: plan.stage,
    target: plan.target,
    currentVersion: plan.currentVersion,
    targetVersion: plan.targetVersion,
    backup,
    appliedStepIds: Object.freeze([...appliedStepIds]),
  });
}

/** Executes backup-before-migrate and verifies every schema transition. */
export async function executeCmsMigrationPlan(
  plan: CmsCliMigrationPlan,
  driver: CmsCliMigrationDriver,
  options: { confirmation: string; clock?: () => Date },
): Promise<CmsCliMigrationReceipt> {
  if (options.confirmation !== plan.applyConfirmation) {
    throw new Error("CMS migration requires the exact apply confirmation.");
  }
  const clock = options.clock ?? (() => new Date());
  const startedAt = timestamp(clock);
  const observedVersion = await driver.inspectVersion();
  if (observedVersion !== plan.currentVersion) {
    throw new Error(
      `CMS migration expected version ${plan.currentVersion}, received ${observedVersion}.`,
    );
  }
  const backup = validateBackup(await driver.createBackup(plan));
  const backupCompletedAt = timestamp(clock);
  const migrationStartedAt = timestamp(clock);
  const appliedStepIds: string[] = [];
  try {
    for (const step of plan.steps) {
      await driver.applyStep(step, plan);
      appliedStepIds.push(step.id);
      const version = await driver.inspectVersion();
      if (version !== step.to) {
        throw new Error(
          `CMS migration ${step.id} expected version ${step.to}, received ${version}.`,
        );
      }
    }
  } catch (cause) {
    throw new CmsCliMigrationExecutionError(
      "CMS migration failed after a restorable backup was created.",
      recoveryPoint(plan, backup, appliedStepIds),
      { cause },
    );
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    operation: "migrate" as const,
    status: "applied" as const,
    ...recoveryPoint(plan, backup, appliedStepIds),
    startedAt,
    backupCompletedAt,
    migrationStartedAt,
    completedAt: timestamp(clock),
  });
}

function assertRecoveryMatchesPlan(
  plan: CmsCliMigrationPlan,
  recovery: CmsCliMigrationRecoveryPoint,
) {
  for (const key of [
    "siteId",
    "stage",
    "target",
    "currentVersion",
    "targetVersion",
  ] as const) {
    if (recovery[key] !== plan[key]) {
      throw new Error(`CMS rollback recovery point does not match ${key}.`);
    }
  }
  validateBackup(recovery.backup);
  const knownSteps = new Set(plan.steps.map((step) => step.id));
  if (recovery.appliedStepIds.some((id) => !knownSteps.has(id))) {
    throw new Error("CMS rollback recovery point contains an unknown step.");
  }
}

/** Restores a successful or partially applied migration from its verified backup. */
export async function rollbackCmsMigration(
  plan: CmsCliMigrationPlan,
  recovery: CmsCliMigrationRecoveryPoint,
  driver: CmsCliMigrationDriver,
  options: { confirmation: string; clock?: () => Date },
): Promise<CmsCliRollbackReceipt> {
  if (options.confirmation !== plan.rollbackConfirmation) {
    throw new Error("CMS migration rollback requires the exact confirmation.");
  }
  assertRecoveryMatchesPlan(plan, recovery);
  const clock = options.clock ?? (() => new Date());
  const startedAt = timestamp(clock);
  const observedVersion = await driver.inspectVersion();
  if (
    !Number.isSafeInteger(observedVersion) ||
    observedVersion < plan.currentVersion ||
    observedVersion > plan.targetVersion
  ) {
    throw new Error(
      `CMS rollback cannot restore unexpected version ${observedVersion}.`,
    );
  }
  await driver.restoreBackup(recovery.backup, plan);
  const restoredVersion = await driver.inspectVersion();
  if (restoredVersion !== plan.currentVersion) {
    throw new Error(
      `CMS rollback expected version ${plan.currentVersion}, received ${restoredVersion}.`,
    );
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    operation: "rollback" as const,
    status: "restored" as const,
    siteId: plan.siteId,
    stage: plan.stage,
    target: plan.target,
    restoredVersion,
    backup: recovery.backup,
    startedAt,
    completedAt: timestamp(clock),
  });
}

export function verifyCmsSiteArtifacts(input: {
  siteId: string;
  files: readonly string[];
  requiredFiles: readonly string[];
  resources: Readonly<Record<string, string>>;
  forbiddenContent?: readonly RegExp[];
  content?: string;
}) {
  if (!siteIdPattern.test(input.siteId)) {
    throw new Error("Site id must be a safe client slug.");
  }
  const files = new Set(input.files.map(normalizeCmsCliRelativePath));
  const missingFiles = input.requiredFiles
    .map(normalizeCmsCliRelativePath)
    .filter((path) => !files.has(path));
  const resourceValues = Object.values(input.resources);
  if (
    new Set(resourceValues).size !== resourceValues.length ||
    resourceValues.some((value) => !resourceNamePattern.test(value))
  ) {
    throw new Error("Infrastructure resource names must be safe and unique.");
  }
  const forbiddenMatches = (input.forbiddenContent ?? [])
    .filter((pattern) => pattern.test(input.content ?? ""))
    .map((pattern) => pattern.source);
  if (missingFiles.length || forbiddenMatches.length) {
    throw new Error(
      `CMS site verification failed: missing=${missingFiles.join(",") || "none"}; forbidden=${forbiddenMatches.join(",") || "none"}.`,
    );
  }
  return Object.freeze({
    ok: true as const,
    siteId: input.siteId,
    fileCount: files.size,
    resourceCount: resourceValues.length,
  });
}

export type CmsCliVerificationSpec = Readonly<{
  schemaVersion: 1;
  operation: "verify";
  siteId: string;
  requiredFiles: readonly string[];
  resources: Readonly<Record<string, string>>;
  forbiddenLiterals: readonly string[];
}>;

export function parseCmsVerificationSpec(
  value: unknown,
): CmsCliVerificationSpec {
  const input = objectRecord(value, "CMS verification spec");
  exactKeys(input, [
    "schemaVersion",
    "operation",
    "siteId",
    "requiredFiles",
    "resources",
    "forbiddenLiterals",
  ]);
  const resources = objectRecord(input.resources, "CMS verification resources");
  if (
    input.schemaVersion !== 1 ||
    input.operation !== "verify" ||
    typeof input.siteId !== "string" ||
    !siteIdPattern.test(input.siteId) ||
    !Array.isArray(input.requiredFiles) ||
    input.requiredFiles.length === 0 ||
    input.requiredFiles.some((path) => typeof path !== "string") ||
    new Set(input.requiredFiles).size !== input.requiredFiles.length ||
    !Array.isArray(input.forbiddenLiterals) ||
    input.forbiddenLiterals.some(
      (literal) =>
        typeof literal !== "string" || !literal.trim() || literal.length > 128,
    ) ||
    Object.keys(resources).length === 0 ||
    Object.values(resources).some((name) => typeof name !== "string")
  ) {
    throw new Error("CMS verification spec shape is invalid.");
  }
  const requiredFiles = input.requiredFiles.map((path) =>
    normalizeCmsCliRelativePath(path as string),
  );
  if (new Set(requiredFiles).size !== requiredFiles.length) {
    throw new Error("CMS verification file paths must be unique.");
  }
  const normalizedResources = Object.fromEntries(
    Object.entries(resources).map(([key, name]) => {
      if (!/^[a-z][a-zA-Z0-9]{0,63}$/.test(key)) {
        throw new Error(`CMS verification resource key is invalid: ${key}.`);
      }
      return [key, name as string];
    }),
  );
  verifyCmsSiteArtifacts({
    siteId: input.siteId,
    files: requiredFiles,
    requiredFiles,
    resources: normalizedResources,
  });
  return Object.freeze({
    schemaVersion: 1 as const,
    operation: "verify" as const,
    siteId: input.siteId,
    requiredFiles: Object.freeze(requiredFiles),
    resources: Object.freeze(normalizedResources),
    forbiddenLiterals: Object.freeze(
      (input.forbiddenLiterals as string[]).map((literal) => literal.trim()),
    ),
  });
}

function objectRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("CMS CLI document contains unknown or missing fields.");
  }
}
