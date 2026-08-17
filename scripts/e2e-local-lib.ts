import { basename, dirname, resolve } from "node:path";

import type { SiteManifest } from "../packages/cms/src/site-manifest";

export const e2eStateDirectoryPrefix = "rem-viet-e2e-state-";

const safeSiteSlug = /^[a-z][a-z0-9-]{1,62}$/;

export function parseLocalE2eInvocation(args: string[]) {
  const siteArguments = args.filter((value) => value.startsWith("--site="));
  if (siteArguments.length > 1) {
    throw new Error("Pass at most one --site=<client-slug> argument.");
  }

  const site = siteArguments[0]?.slice("--site=".length) || "rem-viet";
  if (!safeSiteSlug.test(site)) {
    throw new Error("E2E site must be a safe client slug.");
  }

  return {
    playwrightArguments: args.filter((value) => !value.startsWith("--site=")),
    site,
  };
}

export function localE2ePlaywrightRuns(playwrightArguments: string[]) {
  const hasExplicitProject = playwrightArguments.some(
    (value) => value === "--project" || value.startsWith("--project="),
  );
  if (hasExplicitProject) return [[...playwrightArguments]];
  return ["desktop-chrome", "mobile-chrome"].map((project) => [
    ...playwrightArguments,
    `--project=${project}`,
  ]);
}

export function localE2eResourceNames(manifest: SiteManifest) {
  const names = {
    bucket: `${manifest.infrastructure.r2BucketName}-e2e`,
    database: `${manifest.infrastructure.d1Name}-e2e`,
    worker: `${manifest.infrastructure.workerName}-e2e`,
  };
  for (const [kind, name] of Object.entries(names)) {
    if (!safeSiteSlug.test(name)) {
      throw new Error(`Derived E2E ${kind} name is unsafe: ${name}`);
    }
  }
  return names;
}

export function localE2eWranglerConfig(
  manifest: SiteManifest,
  paths: { assets: string; main: string; migrations: string },
) {
  const names = localE2eResourceNames(manifest);
  return {
    name: names.worker,
    main: paths.main,
    no_bundle: true,
    compatibility_date: "2026-03-10",
    compatibility_flags: [
      "nodejs_compat",
      "nodejs_compat_populate_process_env",
    ],
    assets: {
      directory: paths.assets,
      binding: "ASSETS",
      not_found_handling: "none",
      html_handling: "auto-trailing-slash",
      run_worker_first: false,
    },
    rules: [
      {
        type: "ESModule",
        globs: ["**/*.js", "**/*.mjs"],
      },
    ],
    vars: {
      CORS_ORIGIN: "http://127.0.0.1:3020",
      BETTER_AUTH_SECRET: "e2e-only-secret-never-use-in-production",
      BETTER_AUTH_URL: "http://127.0.0.1:3020",
      ADMIN_EMAILS: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_CHAT_ID: "",
      RESEND_API_KEY: "",
      LEAD_NOTIFICATION_EMAIL: "",
      EMAIL_FROM: "",
      JSONLINK_API_KEY: "",
      RUM_SAMPLE_RATE: "1",
      NOTIFICATIONS_REQUIRED: "0",
      RELEASE_SITE_ID: manifest.id,
      RELEASE_STAGE: "e2e",
      RELEASE_GIT_SHA: "1111111111111111111111111111111111111111",
      RELEASE_INPUT_SHA256:
        "2222222222222222222222222222222222222222222222222222222222222222",
      RELEASE_SOURCE_STATE: "clean",
    },
    d1_databases: [
      {
        binding: "DB",
        database_id: names.database,
        database_name: names.database,
        migrations_dir: paths.migrations,
        preview_database_id: names.database,
      },
    ],
    r2_buckets: [
      {
        binding: "PRODUCT_IMAGES",
        bucket_name: names.bucket,
        preview_bucket_name: names.bucket,
      },
    ],
  };
}

export function assertSafeE2eStateDirectory(
  directory: string,
  temporaryDirectory: string,
) {
  const resolvedDirectory = resolve(directory);
  const resolvedTemporaryDirectory = resolve(temporaryDirectory);
  const name = basename(resolvedDirectory);

  if (
    dirname(resolvedDirectory) !== resolvedTemporaryDirectory ||
    !name.startsWith(e2eStateDirectoryPrefix) ||
    name.length === e2eStateDirectoryPrefix.length
  ) {
    throw new Error("Refusing to use an unsafe E2E persistence directory.");
  }

  return resolvedDirectory;
}
