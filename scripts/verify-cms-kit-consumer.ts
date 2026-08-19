import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const runRoot = join(repositoryRoot, ".tmp", `cms-kit-consumer-${Date.now()}`);
const artifactDirectory = join(runRoot, "artifacts");
const consumerDirectory = join(runRoot, "consumer");

mkdirSync(artifactDirectory, { recursive: true });
cpSync(
  join(repositoryRoot, "fixtures", "cms-kit-clean-consumer"),
  consumerDirectory,
  { recursive: true },
);

const packages = [
  ["cms-core", "agency-cms-core-0.1.0.tgz"],
  ["cms-runtime", "agency-cms-runtime-0.1.0.tgz"],
  ["cms-provider-cloudflare", "agency-cms-provider-cloudflare-0.1.0.tgz"],
  ["cms-react", "agency-cms-react-0.1.0.tgz"],
  ["cms-admin", "agency-cms-admin-0.1.0.tgz"],
  ["cms-alchemy", "agency-cms-alchemy-0.1.0.tgz"],
  ["cms-cli", "agency-cms-cli-0.1.0.tgz"],
  ["cms-template-factory", "agency-cms-template-factory-0.1.0.tgz"],
  ["cms-template-rem-viet", "agency-cms-template-rem-viet-0.1.0.tgz"],
  ["cms-visual-editor", "agency-cms-visual-editor-0.1.0.tgz"],
] as const;

function run(command: string[], cwd: string) {
  const result = Bun.spawnSync(command, {
    cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  if (!result.success) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
}

function runJson(
  command: string[],
  cwd: string,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: environment,
    stderr: "inherit",
    stdout: "pipe",
  });
  const output = result.stdout.toString();
  process.stdout.write(output);
  if (!result.success) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
  const value: unknown = JSON.parse(output);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `Command did not return a JSON object: ${command.join(" ")}`,
    );
  }
  return value as Record<string, unknown>;
}

for (const [directory] of packages) {
  run(
    ["bun", "pm", "pack", `--destination=${artifactDirectory}`],
    join(repositoryRoot, "packages", directory),
  );
}

const artifactPath = (filename: string) =>
  `file:${relative(consumerDirectory, join(artifactDirectory, filename)).replaceAll("\\", "/")}`;

writeFileSync(
  join(consumerDirectory, "package.json"),
  `${JSON.stringify(
    {
      name: "cms-kit-clean-consumer",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        build: "vite build",
        "check-types": "tsc --noEmit",
        "verify-provider": "bun src/provider-smoke.tsx",
      },
      dependencies: {
        "@agency/cms-core": artifactPath(packages[0][1]),
        "@agency/cms-runtime": artifactPath(packages[1][1]),
        "@agency/cms-provider-cloudflare": artifactPath(packages[2][1]),
        "@agency/cms-react": artifactPath(packages[3][1]),
        "@agency/cms-admin": artifactPath(packages[4][1]),
        "@agency/cms-alchemy": artifactPath(packages[5][1]),
        "@agency/cms-cli": artifactPath(packages[6][1]),
        "@agency/cms-template-factory": artifactPath(packages[7][1]),
        "@agency/cms-template-rem-viet": artifactPath(packages[8][1]),
        "@agency/cms-visual-editor": artifactPath(packages[9][1]),
        "@libsql/client": "0.15.15",
        react: "^19.2.3",
        "react-dom": "^19.2.3",
        zod: "^4.3.5",
      },
      devDependencies: {
        "@types/react": "^19.2.14",
        "@types/react-dom": "^19.2.3",
        typescript: "^6.0.0",
        vite: "^8.2.1",
      },
    },
    null,
    2,
  )}\n`,
);

run(["bun", "install"], consumerDirectory);
const cliVerification = {
  schemaVersion: 1,
  operation: "verify",
  siteId: "consumer-site",
  requiredFiles: [
    "site.manifest.json",
    ".env.example",
    "content.seed.json",
    "HANDOVER.md",
    "public/assets/consumer-site-logo.svg",
    "public/assets/consumer-site-placeholder.svg",
    "src/blocks/testimonialGrid/contract.ts",
    "src/blocks/testimonialGrid/defaults.ts",
    "src/blocks/testimonialGrid/migrations.ts",
    "src/blocks/testimonialGrid/seed.ts",
    "src/blocks/testimonialGrid/renderer.tsx",
    "src/blocks/testimonialGrid/editor.tsx",
    "src/blocks/testimonialGrid/registry.ts",
    "src/blocks/testimonialGrid/block.manifest.json",
  ],
  resources: {
    worker: "consumer-site-web-staging",
    database: "consumer-site-db-staging",
  },
  forbiddenLiterals: ["Rèm Việt"],
};
const cliMigration = {
  schemaVersion: 1,
  operation: "migrate",
  siteId: "consumer-site",
  stage: "staging",
  target: "consumer-site-db-staging",
  currentVersion: 1,
  targetVersion: 2,
  steps: [{ id: "0002-consumer", from: 1, to: 2 }],
  applyConfirmation:
    "APPLY CMS MIGRATION consumer-site staging consumer-site-db-staging 1->2",
  rollbackConfirmation:
    "ROLLBACK CMS MIGRATION consumer-site staging consumer-site-db-staging 1->2",
};
writeFileSync(
  join(consumerDirectory, "cms-cli-verify.spec.json"),
  `${JSON.stringify(cliVerification, null, 2)}\n`,
);
writeFileSync(
  join(consumerDirectory, "cms-cli-migration.plan.json"),
  `${JSON.stringify(cliMigration, null, 2)}\n`,
);
writeFileSync(
  join(consumerDirectory, "cms-cli-migration-driver.ts"),
  `let version = 1;

export const migrationDriver = {
  inspectVersion: async () => version,
  createBackup: async () => ({
    locator: "memory:consumer-db-v1",
    sha256: "${"c".repeat(64)}",
    bytes: 64,
  }),
  applyStep: async (step: { to: number }) => {
    version = step.to;
  },
  restoreBackup: async () => {
    version = 1;
  },
};
`,
);
run(["bunx", "--bun", "agency-cms", "--help"], consumerDirectory);
const planInitCommand = [
  "bunx",
  "--bun",
  "agency-cms",
  "plan-init",
  "--template=@agency/cms-template-rem-viet/bootstrap",
  "--site=consumer-site",
  "--name=Independent Consumer",
  "--site-url=https://consumer.example",
  "--preset=showcase",
  "--provider=cloudflare",
  "--features=blog,leads,media",
  "--output=cms-cli-init.plan.json",
];
const planDryRun = runJson(
  [...planInitCommand, "--dry-run"],
  consumerDirectory,
  process.env,
);
if (
  planDryRun.status !== "would-create" ||
  existsSync(join(consumerDirectory, "cms-cli-init.plan.json"))
) {
  throw new Error("Packaged CMS CLI plan-init dry-run wrote its plan.");
}
const planCreated = runJson(planInitCommand, consumerDirectory, process.env);
const planRepeated = runJson(planInitCommand, consumerDirectory, process.env);
if (planCreated.status !== "created" || planRepeated.status !== "unchanged") {
  throw new Error("Packaged CMS CLI plan generation is not idempotent.");
}
const cliPlan = JSON.parse(
  readFileSync(join(consumerDirectory, "cms-cli-init.plan.json"), "utf8"),
) as { requiredSecrets: string[] };
const initEnvironment = {
  ...process.env,
  ...Object.fromEntries(cliPlan.requiredSecrets.map((name) => [name, ""])),
};
const initDryRun = runJson(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "init",
    "--plan=cms-cli-init.plan.json",
    "--dry-run",
  ],
  consumerDirectory,
  initEnvironment,
);
if (
  JSON.stringify(initDryRun.missingSecrets) !==
  JSON.stringify(cliPlan.requiredSecrets)
) {
  throw new Error(
    "Packaged CMS CLI did not report the missing-secret checklist.",
  );
}
if (existsSync(join(consumerDirectory, "site.manifest.json"))) {
  throw new Error("Packaged CMS CLI init dry-run wrote files.");
}
runJson(
  ["bunx", "--bun", "agency-cms", "init", "--plan=cms-cli-init.plan.json"],
  consumerDirectory,
  initEnvironment,
);
writeFileSync(
  join(consumerDirectory, "src", "bootstrap-plan-smoke.ts"),
  `import { createCmsAlchemyResourcePlan } from "@agency/cms-alchemy";
import { cmsSiteManifestSchema } from "@agency/cms-core";
import { remVietTemplateBlockSchema } from "@agency/cms-template-rem-viet";

const manifest = cmsSiteManifestSchema.parse(${readFileSync(
    join(consumerDirectory, "site.manifest.json"),
    "utf8",
  ).trim()});
const seed = ${readFileSync(
    join(consumerDirectory, "content.seed.json"),
    "utf8",
  ).trim()};
const blocks = remVietTemplateBlockSchema.array().parse(seed.documents[0]?.blocks);
if (blocks.length !== 10) {
  throw new Error("Generated template seed did not contain all ten blocks.");
}
const resources = createCmsAlchemyResourcePlan({
  manifest,
  stage: "staging",
  origin: "https://consumer-staging.example",
  bindings: {},
  allowMissingBindings: true,
});
if (
  resources.siteId !== "consumer-site" ||
  resources.website.name !== "consumer-site-web-staging" ||
  resources.database.name !== "consumer-site-db-staging" ||
  resources.mediaBucket.name !== "consumer-site-media-staging"
) {
  throw new Error("Canonical bootstrap manifest did not drive resource names.");
}
console.log("Canonical bootstrap manifest and Alchemy resource plan verified.");
`,
);
run(["bun", "src/bootstrap-plan-smoke.ts"], consumerDirectory);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "add-block",
    "--site=consumer-site",
    "--type=testimonialGrid",
    "--directory=src/blocks",
    "--dry-run",
  ],
  consumerDirectory,
);
if (existsSync(join(consumerDirectory, "src", "blocks", "testimonialGrid"))) {
  throw new Error("Packaged CMS CLI add-block dry-run wrote files.");
}
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "add-block",
    "--site=consumer-site",
    "--type=testimonialGrid",
    "--directory=src/blocks",
  ],
  consumerDirectory,
);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "add-block",
    "--site=consumer-site",
    "--type=testimonialGrid",
    "--directory=src/blocks",
  ],
  consumerDirectory,
);
writeFileSync(
  join(consumerDirectory, "src", "block-scaffold-smoke.tsx"),
  `import { createBlockEditorRegistry } from "@agency/cms-admin";
import { CmsBlockRenderer, createBlockRegistry } from "@agency/cms-react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createTestimonialGridSeedBlock,
  migrateTestimonialGridBlockData,
  testimonialGridBlockDefinition,
  testimonialGridBlockEditorDefinition,
  testimonialGridBlockSchema,
  type TestimonialGridBlock,
} from "./blocks/testimonialGrid";

const block = createTestimonialGridSeedBlock({
  id: "testimonial-grid-consumer",
  title: "Independent testimonial proof",
});
testimonialGridBlockSchema.parse(block);
if (migrateTestimonialGridBlockData(block.data, 1).title !== block.data.title) {
  throw new Error("Generated block migration entry point changed v1 data.");
}
const renderers = createBlockRegistry<TestimonialGridBlock, unknown>({
  testimonialGrid: testimonialGridBlockDefinition,
});
createBlockEditorRegistry<TestimonialGridBlock, unknown>({
  testimonialGrid: testimonialGridBlockEditorDefinition,
});
const html = renderToStaticMarkup(
  <CmsBlockRenderer block={block} context={undefined} registry={renderers} />,
);
if (!html.includes("Independent testimonial proof")) {
  throw new Error("Generated block did not render through the neutral registry.");
}
console.log("Generated block contract/editor/renderer/seed/migration registry verified.");
`,
);
run(
  ["bunx", "--bun", "agency-cms", "verify", "--spec=cms-cli-verify.spec.json"],
  consumerDirectory,
);
run(["bun", "src/block-scaffold-smoke.tsx"], consumerDirectory);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "migrate",
    "--plan=cms-cli-migration.plan.json",
    "--driver=cms-cli-migration-driver.ts",
    "--receipt=cli-proof/migration.receipt.json",
    "--recovery=cli-proof/migration.recovery.json",
    `--confirm=${cliMigration.applyConfirmation}`,
  ],
  consumerDirectory,
);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "rollback",
    "--plan=cms-cli-migration.plan.json",
    "--driver=cms-cli-migration-driver.ts",
    "--recovery=cli-proof/migration.receipt.json",
    "--receipt=cli-proof/rollback.receipt.json",
    `--confirm=${cliMigration.rollbackConfirmation}`,
  ],
  consumerDirectory,
);
run(["bun", "run", "check-types"], consumerDirectory);
run(["bun", "run", "build"], consumerDirectory);
run(["bun", "run", "verify-provider"], consumerDirectory);

console.log(`Clean consumer verified at ${consumerDirectory}`);
