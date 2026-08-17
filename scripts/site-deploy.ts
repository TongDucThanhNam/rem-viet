import { resolveDeploymentOrigin } from "../packages/cms/src/site-manifest";

import {
  alchemySiteCommand,
  argument,
  flag,
  readSiteManifest,
  validateSiteDeployModeFlags,
} from "./site-lib";

const site = argument("site") ?? "";
const stage = argument("stage") ?? "staging";
if (!site) throw new Error("Thiếu --site=<client-slug>.");
if (!/^[a-z][a-z0-9-]{0,31}$/.test(stage))
  throw new Error("Stage không hợp lệ.");
const { manifest, source } = await readSiteManifest(site);
const explicitOrigin = argument("origin");
const dryRun = flag("dry-run");
const plan = flag("plan");
const preflight = flag("preflight");
validateSiteDeployModeFlags({ dryRun, plan, preflight });
const deploymentOrigin =
  dryRun && !explicitOrigin
    ? null
    : resolveDeploymentOrigin({
        stage,
        siteUrl: manifest.siteUrl,
        explicitOrigin,
      });
const seed =
  source === "root"
    ? [
        ...(manifest.features.blog ? ["packages/db/seeds/posts.sql"] : []),
        "packages/db/seeds/home.sql",
      ]
    : [`sites/${site}/seed.sql`];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        site,
        stage,
        worker: `${manifest.infrastructure.workerName}-${stage}`,
        d1: `${manifest.infrastructure.d1Name}-${stage}`,
        r2: `${manifest.infrastructure.r2BucketName}-${stage}`,
        backupArchive: manifest.infrastructure.backupBucketName,
        seed,
        envFile: source === "root" ? "apps/web/.env" : `sites/${site}/.env`,
        origin:
          deploymentOrigin ??
          "required: pass --origin=<https-staging-origin> before preflight/deploy",
      },
      null,
      2,
    ),
  );
} else {
  const alchemyArgs = alchemySiteCommand({
    stage,
    plan,
    yes: flag("yes"),
  });
  const child = Bun.spawn(alchemyArgs, {
    env: {
      ...Bun.env,
      SITE_ID: source === "root" ? "" : site,
      ALCHEMY_STAGE: stage,
      DEPLOY_PREFLIGHT_ONLY: preflight ? "1" : "",
      DEPLOY_ORIGIN: deploymentOrigin ?? "",
    },
    stdin: "inherit",
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exitCode = exitCode;
}
