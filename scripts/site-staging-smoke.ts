import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "dotenv";
import { z } from "zod";

import {
  deploymentProvenanceSchema,
  isCleanDeploymentProvenance,
} from "../packages/cms/src/deployment";
import {
  resolveDeploymentOrigin,
  siteManifestSchema,
} from "../packages/cms/src/site-manifest";
import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";
import {
  buildSecondSiteReleaseEvidence,
  measuredMinutes,
  summarizePlaywrightSmoke,
} from "./site-staging-smoke-lib";

const site = argument("site") ?? "";
const stage = argument("stage") ?? "";
const explicitOrigin = argument("origin") ?? "";
const dryRun = flag("dry-run");
const apply = flag("apply");
if (!site) throw new Error("Missing --site=<client-slug>.");
if (stage !== "staging")
  throw new Error("Second-site release evidence must use --stage=staging.");
if (dryRun === apply)
  throw new Error("Pass exactly one of --dry-run or --apply.");

const { manifest } = await readSiteManifest(site);
const origin = resolveDeploymentOrigin({
  stage,
  siteUrl: manifest.siteUrl,
  explicitOrigin,
});
const flagship = siteManifestSchema.parse(
  JSON.parse(readFileSync(resolve(repoRoot, "site.manifest.json"), "utf8")),
);
if (manifest.id === flagship.id)
  throw new Error("Second-site evidence cannot use the flagship manifest.");

const relativeEnvPath = `sites/${manifest.id}/.env`;
const envPath = resolve(repoRoot, relativeEnvPath);
if (!existsSync(envPath))
  throw new Error(`Private site env does not exist: ${relativeEnvPath}`);
const ignored = Bun.spawnSync(
  ["git", "check-ignore", "--quiet", relativeEnvPath],
  { cwd: repoRoot, stdout: "ignore", stderr: "ignore" },
);
if (ignored.exitCode !== 0)
  throw new Error("Private site env must remain Git-ignored.");
const privateEnv = parse(readFileSync(envPath));
const email =
  Bun.env.CMS_E2E_EMAIL?.trim() ||
  privateEnv.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const password =
  Bun.env.CMS_E2E_PASSWORD?.trim() ||
  privateEnv.CMS_BOOTSTRAP_PASSWORD?.trim() ||
  "";
const credentialsReady =
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && password.length >= 12;

function gitOutput(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0)
    throw new Error("Unable to inspect the local Git checkout.");
  return result.stdout.toString().trim();
}

const localCommit = gitOutput(["rev-parse", "HEAD"]);
if (!/^[0-9a-f]{40}$/i.test(localCommit))
  throw new Error("Local Git HEAD is not a full commit SHA.");
const checkoutClean =
  gitOutput(["status", "--porcelain", "--untracked-files=all"]) === "";

const deploy = {
  startedAt: argument("deploy-started-at") ?? "",
  completedAt: argument("deploy-completed-at") ?? "",
};
const brandAndDemoContent = {
  startedAt: argument("brand-started-at") ?? "",
  completedAt: argument("brand-completed-at") ?? "",
};
const timingConfigured = [
  deploy.startedAt,
  deploy.completedAt,
  brandAndDemoContent.startedAt,
  brandAndDemoContent.completedAt,
].every(Boolean);
if (timingConfigured) {
  measuredMinutes(deploy, "Deploy");
  measuredMinutes(brandAndDemoContent, "Brand and demo content");
}

const safePreflight = {
  ok: true,
  mode: dryRun ? "dry-run" : "apply",
  site: manifest.id,
  stage,
  origin,
  privateEnvIgnored: true,
  credentialsReady,
  checkoutClean,
  timingConfigured,
  requiredAuthenticatedScenarios: {
    desktop: 4,
    mobile: 2,
    total: 6,
  },
  checks: [
    "clean-live-provenance",
    "provider-plan-noop",
    "admin-login",
    "draft-preview-publish-public-restore",
    "lead-submit-inbox-cleanup",
    "media-upload-alt-reference-cleanup",
    "cloudflare-page-provider-conformance",
    "mobile-responsive-admin-navigation",
    "mobile-home-visual-authoring",
    "sitemap-boundaries",
  ],
  valuesPrinted: false,
};
if (dryRun) {
  console.log(JSON.stringify(safePreflight, null, 2));
  process.exit(0);
}

if (argument("confirm-site") !== manifest.id)
  throw new Error("--confirm-site must exactly match --site before --apply.");
if (argument("confirm-origin") !== origin)
  throw new Error(
    "--confirm-origin must exactly match --origin before --apply.",
  );
if (!credentialsReady)
  throw new Error(
    "Inject CMS_E2E_PASSWORD from the password manager; credentials are never accepted as CLI arguments.",
  );
if (!timingConfigured)
  throw new Error(
    "Release evidence requires deploy and brand start/completion timestamps.",
  );
if (!checkoutClean)
  throw new Error("Second-site release evidence requires a clean checkout.");

async function readText(response: Response, label: string) {
  try {
    return await response.text();
  } catch (error) {
    throw new Error(`${label} did not return a readable body.`, {
      cause: error,
    });
  }
}

let healthResponse: Response;
try {
  healthResponse = await fetch(`${origin}/api/health`, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
} catch (error) {
  throw new Error("Could not read second-site staging health.", {
    cause: error,
  });
}
if (![200, 503].includes(healthResponse.status))
  throw new Error(`Staging health returned HTTP ${healthResponse.status}.`);
const healthBody = JSON.parse(await readText(healthResponse, "Staging health"));
const healthSchema = z
  .object({
    checks: z.object({ database: z.literal("ok") }).passthrough(),
    deployment: deploymentProvenanceSchema,
  })
  .passthrough();
const health = healthSchema.parse(healthBody);
if (!isCleanDeploymentProvenance(health.deployment))
  throw new Error(
    "Live second-site deployment does not report clean provenance.",
  );
if (
  health.deployment.siteId !== manifest.id ||
  health.deployment.stage !== stage ||
  health.deployment.commit !== localCommit
)
  throw new Error("Live second-site provenance does not match this checkout.");

async function runChild(
  args: string[],
  options: { cwd: string; env?: Record<string, string | undefined> },
) {
  const child = Bun.spawn(args, {
    cwd: options.cwd,
    env: options.env ?? Bun.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

const providerPlan = await runChild(
  [
    "bun",
    "run",
    "site:deploy",
    `--site=${manifest.id}`,
    `--stage=${stage}`,
    `--origin=${origin}`,
    "--plan",
  ],
  { cwd: repoRoot },
);
const providerPlanOutput = `${providerPlan.stdout}\n${providerPlan.stderr}`
  .replace(/\u001b\[[0-9;]*m/g, "")
  .replace(/\r/g, "");
if (
  providerPlan.exitCode !== 0 ||
  !/Plan: 3 to noop/.test(providerPlanOutput) ||
  !/\[database\] noop/.test(providerPlanOutput) ||
  !/\[product-images\] noop/.test(providerPlanOutput) ||
  !/\[web\] noop/.test(providerPlanOutput)
)
  throw new Error(
    "Second-site provider plan is not converged to three no-ops.",
  );

let sitemapResponse: Response;
try {
  sitemapResponse = await fetch(`${origin}/sitemap.xml`, {
    headers: { Accept: "application/xml", "Cache-Control": "no-cache" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
} catch (error) {
  throw new Error("Could not read the second-site sitemap.", { cause: error });
}
const sitemap = await readText(sitemapResponse, "Second-site sitemap");
if (
  sitemapResponse.status !== 200 ||
  !sitemap.includes("<urlset") ||
  sitemap.includes("/admin") ||
  sitemap.includes("preview")
)
  throw new Error("Second-site sitemap boundary smoke failed.");

async function runPlaywrightSmoke(input: {
  project: "desktop-chrome" | "mobile-chrome";
  grep: string;
  expectedTests: number;
}) {
  const playwright = await runChild(
    [
      "bun",
      "x",
      "playwright",
      "test",
      "e2e/authenticated-cms.spec.ts",
      `--project=${input.project}`,
      "--grep",
      input.grep,
      "--reporter=json",
    ],
    {
      cwd: resolve(repoRoot, "apps/web"),
      env: {
        ...Bun.env,
        FORCE_COLOR: "0",
        CMS_E2E_BASE_URL: origin,
        CMS_E2E_EMAIL: email,
        CMS_E2E_PASSWORD: password,
        CMS_E2E_ROLE: Bun.env.CMS_E2E_ROLE?.trim() || "owner",
      },
    },
  );
  if (playwright.exitCode !== 0)
    throw new Error(
      `Authenticated ${input.project} staging smoke failed; inspect apps/web/test-results locally. No browser output was copied into this receipt.`,
    );
  let playwrightReport: unknown;
  try {
    playwrightReport = JSON.parse(playwright.stdout);
  } catch (error) {
    throw new Error(
      `${input.project} Playwright smoke did not emit its expected JSON report.`,
      { cause: error },
    );
  }
  return summarizePlaywrightSmoke(playwrightReport, input.expectedTests);
}

// Keep the shared-state mutation lifecycles on desktop, then require a separate
// mobile project to prove the narrow navigation, no-overflow, accessibility and
// visual-authoring surfaces. A desktop-only receipt can no longer satisfy the
// documented desktop/mobile release gate.
const desktopBrowser = await runPlaywrightSmoke({
  project: "desktop-chrome",
  grep: "home draft stays private through publish and restore|lead moves from public submission through inbox status and cleanup|media upload, alt, picker usage and protected delete work end-to-end|deployed Cloudflare page API passes the neutral provider conformance suite",
  expectedTests: 4,
});
const mobileBrowser = await runPlaywrightSmoke({
  project: "mobile-chrome",
  grep: "admin shell and product list preserve responsive, accessible navigation state|mobile home visual authoring keeps canvas and inspector operable",
  expectedTests: 2,
});
const browser = {
  desktop: desktopBrowser,
  mobile: mobileBrowser,
  total: desktopBrowser.expected + mobileBrowser.expected,
};

const secondSite = buildSecondSiteReleaseEvidence({
  siteId: manifest.id,
  origin,
  resources: {
    worker: `${manifest.infrastructure.workerName}-${stage}`,
    d1: `${manifest.infrastructure.d1Name}-${stage}`,
    r2: `${manifest.infrastructure.r2BucketName}-${stage}`,
  },
  deploy,
  brandAndDemoContent,
  verifiedAt: new Date().toISOString(),
});

console.log(
  JSON.stringify(
    {
      ok: true,
      site: manifest.id,
      stage,
      origin,
      checkoutClean: true,
      liveCommitMatchesCheckout: true,
      liveDeployInputConfigured: true,
      databaseHealthy: true,
      providerPlan: "3-noop",
      sitemap: "pass",
      browser,
      cleanup: "scenario-verified",
      valuesPrinted: false,
      releaseEvidence: { secondSite },
    },
    null,
    2,
  ),
);
