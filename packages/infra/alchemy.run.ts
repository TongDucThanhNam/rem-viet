import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createOperationalIncidentEvent,
  deploymentProvenanceSchema,
  resolveDeploymentOrigin,
  siteManifestSchema,
} from "@rem-viet/cms";
import { createCmsAlchemyResourcePlan } from "@agency/cms-alchemy";
import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

config({ path: resolve(repoRoot, "packages/infra/.env") });
config({ path: resolve(repoRoot, ".env") });

const alchemyCommands = new Set([
  "deploy",
  "destroy",
  "dev",
  "logs",
  "login",
  "plan",
  "profile",
  "state",
  "sync",
  "tail",
  "unsafe",
]);
const alchemyExecOptions = (() => {
  const serialized = process.env.ALCHEMY_EXEC_OPTIONS?.trim();
  if (!serialized)
    return {} as { stage?: string; dev?: boolean; destroy?: boolean };

  try {
    return JSON.parse(serialized) as {
      stage?: string;
      dev?: boolean;
      destroy?: boolean;
    };
  } catch (error) {
    throw new Error("ALCHEMY_EXEC_OPTIONS contains invalid JSON.", {
      cause: error,
    });
  }
})();
const argvCommand = process.argv
  .map((argument) => argument.trim().toLowerCase())
  .find((argument) => alchemyCommands.has(argument));
const alchemyCommand = alchemyExecOptions.dev
  ? "dev"
  : alchemyExecOptions.destroy
    ? "destroy"
    : argvCommand;
const cliOption = (name: string) => {
  const inlinePrefix = `--${name}=`;
  const inline = process.argv.find((argument) =>
    argument.startsWith(inlinePrefix),
  );
  if (inline) return inline.slice(inlinePrefix.length).trim();

  const optionIndex = process.argv.indexOf(`--${name}`);
  return optionIndex >= 0 ? process.argv[optionIndex + 1]?.trim() : undefined;
};
const stage = (
  process.env.ALCHEMY_STAGE?.trim() ||
  alchemyExecOptions.stage?.trim() ||
  cliOption("stage") ||
  "dev"
).toLowerCase();
if (!/^[a-z][a-z0-9-]{0,31}$/.test(stage)) {
  throw new Error("Stage must be a safe deployment slug.");
}

// These commands import the stack only to discover providers or inspect state.
// They must work before application secrets and a staging URL have been set.
const providerDiscovery = new Set(["login", "profile", "unsafe"]).has(
  alchemyCommand ?? "",
);
// Read-only and teardown commands do not publish runtime configuration. A
// stable manifest origin is enough to construct the typed resource graph.
const runtimeOriginOptional = new Set([
  "destroy",
  "logs",
  "login",
  "profile",
  "state",
  "tail",
  "unsafe",
]).has(alchemyCommand ?? "");
const siteId = process.env.SITE_ID?.trim() ?? "";
if (siteId && !/^[a-z][a-z0-9-]{1,62}$/.test(siteId)) {
  throw new Error("SITE_ID must be a safe site slug.");
}

const manifestPath = siteId
  ? resolve(repoRoot, "sites", siteId, "site.manifest.json")
  : resolve(repoRoot, "site.manifest.json");
const siteEnvPath = siteId
  ? resolve(repoRoot, "sites", siteId, ".env")
  : resolve(repoRoot, "apps/web/.env");

if (!existsSync(siteEnvPath) && !providerDiscovery) {
  throw new Error(`Deployment env file not found: ${siteEnvPath}`);
}

if (existsSync(siteEnvPath)) {
  config({ path: siteEnvPath, override: Boolean(siteId) });
}

const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8"));
const manifest = siteManifestSchema.parse(manifestJson);
const runGit = (args: string[]) => {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0
    ? { ok: true as const, value: result.stdout.trim() }
    : { ok: false as const, value: "" };
};
const gitCommit = runGit(["rev-parse", "HEAD"]);
const gitStatus = runGit(["status", "--porcelain", "--untracked-files=normal"]);
const releaseGitSha =
  gitCommit.ok && /^[0-9a-f]{40}$/i.test(gitCommit.value)
    ? gitCommit.value
    : "unknown";
const releaseSourceState = !gitStatus.ok
  ? "unknown"
  : gitStatus.value
    ? "dirty"
    : "clean";
if (
  alchemyCommand === "deploy" &&
  stage === "production" &&
  releaseSourceState !== "clean"
) {
  throw new Error("Production deployment requires a clean Git checkout.");
}
const explicitOrigin = process.env.DEPLOY_ORIGIN?.trim();
const deploymentOrigin =
  alchemyCommand === "dev" && stage !== "production" && !explicitOrigin
    ? "http://localhost:3001"
    : runtimeOriginOptional && stage !== "production" && !explicitOrigin
      ? new URL(manifest.siteUrl).origin
      : resolveDeploymentOrigin({
          stage,
          siteUrl: manifest.siteUrl,
          explicitOrigin,
        });

process.env.CORS_ORIGIN = deploymentOrigin;
process.env.BETTER_AUTH_URL = deploymentOrigin;

const infrastructurePlan = createCmsAlchemyResourcePlan({
  manifest,
  stage,
  origin: deploymentOrigin,
  bindings: process.env,
  allowMissingBindings: true,
  mediaEnabled: process.env.DISABLE_R2_BINDING !== "1",
});

if (!providerDiscovery && infrastructurePlan.missingBindings.length > 0) {
  throw new Error(
    `Missing required deployment bindings in ${siteEnvPath}: ${infrastructurePlan.missingBindings.join(", ")}`,
  );
}

if (process.env.DEPLOY_PREFLIGHT_ONLY === "1") {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "preflight",
        site: manifest.id,
        stage,
        worker: infrastructurePlan.website.name,
        d1: infrastructurePlan.database.name,
        r2: infrastructurePlan.mediaBucket.name,
        backupArchive: infrastructurePlan.backupBucket.name,
        backupArchiveManagedByStack:
          infrastructurePlan.backupBucket.managedByStack,
        origin: infrastructurePlan.origin,
        bindingsReady: true,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const postsSeedFile = resolve(repoRoot, "packages/db/seeds/posts.sql");
const homeSeedFile = resolve(repoRoot, "packages/db/seeds/home.sql");
const selectedSiteSeedFile = siteId
  ? resolve(repoRoot, "sites", siteId, "seed.sql")
  : "";
const seedFiles = siteId
  ? [selectedSiteSeedFile]
  : [...(manifest.features.blog ? [postsSeedFile] : []), homeSeedFile];
const seedSql = seedFiles
  .map((file) => readFileSync(file, "utf8"))
  // D1's HTTP executor batches statements atomically and does not support
  // interactive BEGIN/COMMIT statements inside the submitted SQL.
  .map((sql) =>
    sql
      .replace(/^\s*BEGIN(?:\s+TRANSACTION)?;\s*$/gim, "")
      .replace(/^\s*COMMIT;\s*$/gim, ""),
  )
  .join("\n");
const seedHash = createHash("sha256").update(seedSql).digest("hex");

// Alchemy 2.0.0-beta.72 can produce different memo hashes for an unchanged
// multi-file tree on Windows. Collapse the complete build input tree into one
// deterministic sentinel so `alchemy plan` remains a real no-op when nothing
// changed, without losing source-change detection.
const deployMemoDirectory = resolve(repoRoot, "apps/web/.alchemy");
const deployMemoFile = resolve(deployMemoDirectory, "deploy-input.sha256");
const ignoredDeployDirectories = new Set([
  ".alchemy",
  ".turbo",
  ".wrangler",
  "coverage",
  "dev-dist",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const deploymentFiles: string[] = [];
const collectDeploymentFiles = (path: string) => {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return;
  if (stat.isFile()) {
    if (/^\.env(?:\.|$)/.test(path.split(/[\\/]/).at(-1) ?? "")) return;
    deploymentFiles.push(path);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (entry.isDirectory() && ignoredDeployDirectories.has(entry.name)) {
      continue;
    }
    collectDeploymentFiles(resolve(path, entry.name));
  }
};

for (const input of [
  resolve(repoRoot, "apps/web"),
  resolve(repoRoot, "packages"),
  resolve(repoRoot, "package.json"),
  resolve(repoRoot, "bun.lock"),
  manifestPath,
]) {
  collectDeploymentFiles(input);
}

const deployInputHash = createHash("sha256");
for (const path of deploymentFiles.sort((a, b) => a.localeCompare(b))) {
  deployInputHash.update(relative(repoRoot, path).replaceAll("\\", "/"));
  deployInputHash.update("\0");
  deployInputHash.update(readFileSync(path));
  deployInputHash.update("\0");
}
const deployInputSha256 = deployInputHash.digest("hex");
const deployMemo = `${deployInputSha256}\n`;
mkdirSync(deployMemoDirectory, { recursive: true });
if (
  !existsSync(deployMemoFile) ||
  readFileSync(deployMemoFile, "utf8") !== deployMemo
) {
  writeFileSync(deployMemoFile, deployMemo);
}
const deploymentProvenance = deploymentProvenanceSchema.parse({
  siteId: manifest.id,
  stage,
  commit: releaseGitSha,
  inputSha256: deployInputSha256,
  sourceState: releaseSourceState,
});

export const db = Cloudflare.D1.Database("database", {
  name: infrastructurePlan.database.name,
  migrationsDir: resolve(repoRoot, "packages/db/src/migrations"),
}).pipe(
  adopt(true),
  Effect.tapError((error) =>
    Effect.sync(() =>
      console.error(
        "[cms:incident]",
        createOperationalIncidentEvent({
          category: "migration",
          operation: "d1.migration.apply",
          source: "deployment",
          error,
          severity: "critical",
          recoverable: false,
          detail: { stage },
        }),
      ),
    ),
  ),
);

const SeedDatabase = Alchemy.Action(
  "SeedDatabase",
  Effect.gen(function* () {
    const database = yield* Cloudflare.D1.QueryDatabase(db);

    return Effect.fn(function* (input: { hash: string }) {
      yield* database.exec(seedSql);
      return input;
    });
  }).pipe(Effect.provide(Cloudflare.D1.QueryDatabaseLocal)),
);

export const productImages = !infrastructurePlan.mediaBucket.enabled
  ? undefined
  : Cloudflare.R2.Bucket("product-images", {
      name: infrastructurePlan.mediaBucket.name,
    }).pipe(adopt(true));

const optionalEnv = (name: string) => process.env[name]?.trim() ?? "";
const optionalSecret = (name: string) =>
  process.env[name]?.trim() ? Config.redacted(name) : "";
const productionDomain = infrastructurePlan.productionDomain ?? undefined;
export const web = Cloudflare.Website.Vite("web", {
  name: infrastructurePlan.website.name,
  rootDir: resolve(repoRoot, "apps/web"),
  ...(productionDomain ? { domain: productionDomain } : {}),
  compatibility: {
    flags: ["nodejs_compat"],
  },
  crons: [...infrastructurePlan.website.crons],
  memo: {
    include: [".alchemy/deploy-input.sha256"],
    exclude: [],
    lockfile: false,
    workspaces: [],
  },
  env: {
    DB: db,
    ...(productImages ? { PRODUCT_IMAGES: productImages } : {}),
    CORS_ORIGIN: Config.string("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL"),
    ADMIN_EMAILS: Config.string("ADMIN_EMAILS"),
    TELEGRAM_BOT_TOKEN: optionalSecret("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_CHAT_ID: optionalEnv("TELEGRAM_CHAT_ID"),
    RESEND_API_KEY: optionalSecret("RESEND_API_KEY"),
    LEAD_NOTIFICATION_EMAIL: optionalEnv("LEAD_NOTIFICATION_EMAIL"),
    EMAIL_FROM: optionalEnv("EMAIL_FROM"),
    JSONLINK_API_KEY: optionalSecret("JSONLINK_API_KEY"),
    CMS_WEBHOOK_ALLOWED_HOSTS: optionalEnv("CMS_WEBHOOK_ALLOWED_HOSTS"),
    SANITY_PROJECT_ID: optionalEnv("SANITY_PROJECT_ID"),
    SANITY_DATASET: optionalEnv("SANITY_DATASET"),
    SANITY_STUDIO_URL: optionalEnv("SANITY_STUDIO_URL"),
    SANITY_API_READ_TOKEN: optionalSecret("SANITY_API_READ_TOKEN"),
    SANITY_PREVIEW_COOKIE_SECRET: optionalSecret(
      "SANITY_PREVIEW_COOKIE_SECRET",
    ),
    SANITY_WEBHOOK_SECRET: optionalSecret("SANITY_WEBHOOK_SECRET"),
    RUM_SAMPLE_RATE: optionalEnv("RUM_SAMPLE_RATE") || "1",
    NOTIFICATIONS_REQUIRED:
      stage === "staging" || stage === "production" ? "1" : "0",
    RELEASE_SITE_ID: deploymentProvenance.siteId,
    RELEASE_STAGE: deploymentProvenance.stage,
    RELEASE_GIT_SHA: deploymentProvenance.commit,
    RELEASE_INPUT_SHA256: deploymentProvenance.inputSha256,
    RELEASE_SOURCE_STATE: deploymentProvenance.sourceState,
  },
  dev: {
    port: 3001,
  },
}).pipe(adopt(true));

export type WebEnv = Omit<Cloudflare.InferEnv<typeof web>, "PRODUCT_IMAGES"> & {
  PRODUCT_IMAGES?: R2Bucket;
};

export default Alchemy.Stack(
  infrastructurePlan.appName,
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const seed = yield* SeedDatabase({ hash: seedHash });
    const webWorker = yield* web;

    return {
      web: webWorker.url,
      seed: seed.hash,
      database: infrastructurePlan.database.name,
      mediaBucket: productImages
        ? infrastructurePlan.mediaBucket.name
        : "disabled",
    };
  }),
);
