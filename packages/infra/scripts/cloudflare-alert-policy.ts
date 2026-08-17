import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveDeploymentOrigin,
  siteManifestSchema,
  type SiteManifest,
} from "@rem-viet/cms";
import { config } from "dotenv";

import {
  buildCloudflareOperationalAlertEvidence,
  buildCloudflareOperationalAlertPolicy,
  cloudflareOperationalAlertContractAvailable,
  planCloudflareOperationalAlert,
  resolveExactCloudflareOperationalAlertPolicy,
  WORKERS_OBSERVABILITY_ALERT,
} from "../src/cloudflare-alert-policy";
import { buildCloudflareAlertAuditReport } from "../src/cloudflare-alerts";
import {
  resolveCloudflareAuth,
  resolveEnvironmentCloudflareAuth,
} from "../src/cloudflare-auth";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, "packages/infra/.env"), quiet: true });
config({ path: resolve(repoRoot, ".env"), quiet: true });

const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const site = argument("site") ?? "";
const stage = (argument("stage") ?? "").trim().toLowerCase();
const explicitOrigin = argument("origin");
const profile = argument("profile");
const confirmOrigin = argument("confirm-origin");
const confirmPolicy = argument("confirm-policy");
const receiptConfirmedAt = argument("receipt-confirmed-at");
const json = flag("json");
const apply = flag("apply");
const verify = flag("verify");

if (!/^[a-z][a-z0-9-]{1,62}$/.test(site)) {
  throw new Error("Pass a safe manifest site ID with --site=<client-slug>.");
}
if (stage !== "staging") {
  throw new Error(
    "Operational alert release evidence must be exercised with --stage=staging.",
  );
}
if (apply && verify) throw new Error("Choose either --apply or --verify.");
if (receiptConfirmedAt && !verify) {
  throw new Error("--receipt-confirmed-at is valid only with --verify.");
}
if (profile) process.env.ALCHEMY_PROFILE = profile;

async function readManifest(): Promise<SiteManifest> {
  const candidates = [
    resolve(repoRoot, "sites", site, "site.manifest.json"),
    resolve(repoRoot, "site.manifest.json"),
  ];
  for (const path of candidates) {
    try {
      const manifest = siteManifestSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
      if (manifest.id === site) return manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
  throw new Error(`No checked-in site manifest exists for ${site}.`);
}

const manifest = await readManifest();
const origin = resolveDeploymentOrigin({
  stage,
  siteUrl: manifest.siteUrl,
  explicitOrigin,
});
const recipient = process.env.CLOUDFLARE_ALERT_EMAIL?.trim();
const alertApiToken = process.env.CLOUDFLARE_ALERT_API_TOKEN?.trim();
if (alertApiToken && !/^[A-Za-z0-9_-]{20,}$/.test(alertApiToken)) {
  throw new Error(
    "CLOUDFLARE_ALERT_API_TOKEN is malformed; its value was not logged.",
  );
}
const profileAuthentication = await resolveCloudflareAuth({
  source: "alchemy",
});
const { accountId, auth } = alertApiToken
  ? resolveEnvironmentCloudflareAuth({
      accountId: profileAuthentication.accountId,
      apiToken: alertApiToken,
    })
  : profileAuthentication;

type CloudflareEnvelope = {
  success?: boolean;
  result?: unknown;
  errors?: Array<{ code?: unknown }>;
};

async function cloudflareRequest(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const url = new URL(
    `/client/v4/accounts/${accountId}/alerting/v3/${path}`,
    "https://api.cloudflare.com",
  );
  let response: Response;
  let body: CloudflareEnvelope;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...auth.headers,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    body = (await response.json()) as CloudflareEnvelope;
  } catch {
    throw new Error(
      "Cloudflare Notifications request did not complete; credentials and provider details were suppressed.",
    );
  }
  if (!response.ok || body.success !== true) {
    const codes = (body.errors ?? [])
      .map((error) => error.code)
      .filter((code): code is string | number =>
        ["string", "number"].includes(typeof code),
      );
    const suffix = codes.length > 0 ? ` (codes: ${codes.join(", ")})` : "";
    const permission = init.method === "POST" ? "Write" : "Read";
    throw new Error(
      `Cloudflare Notifications ${permission} request failed (HTTP ${response.status})${suffix}. The credential needs Notifications: ${permission}; no recipient, policy ID or provider body was logged.`,
    );
  }
  return body.result;
}

async function readProviderState() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString();
  const historyPath = `history?per_page=100&page=1&since=${encodeURIComponent(since)}`;
  const [availableAlerts, destinationsEligible, policies, history] =
    await Promise.all([
      cloudflareRequest("available_alerts"),
      cloudflareRequest("destinations/eligible"),
      cloudflareRequest("policies"),
      cloudflareRequest(historyPath),
    ]);
  return { availableAlerts, destinationsEligible, policies, history };
}

function buildSafeState(
  snapshot: Awaited<ReturnType<typeof readProviderState>>,
) {
  const capability = buildCloudflareAlertAuditReport(snapshot);
  const contractAvailable = cloudflareOperationalAlertContractAvailable(
    snapshot.availableAlerts,
  );
  const plan = planCloudflareOperationalAlert({
    policies: snapshot.policies,
    site,
    stage,
    ...(recipient ? { recipient } : {}),
  });
  const writeAuthenticationReady =
    plan.action !== "create" || auth.source !== "alchemy-oauth";
  const readyToApply =
    contractAvailable &&
    capability.emailDeliveryReady &&
    Boolean(recipient) &&
    writeAuthenticationReady &&
    ["create", "noop"].includes(plan.action);
  const gaps = [
    ...(contractAvailable
      ? []
      : [
          "Cloudflare no longer exposes the Workers Observability FIRING_FAILED filter contract.",
        ]),
    ...(capability.emailDeliveryReady
      ? []
      : ["Cloudflare email delivery is not eligible and ready."]),
    ...(writeAuthenticationReady
      ? []
      : [
          "Cloudflare policy creation requires CLOUDFLARE_ALERT_API_TOKEN with account-level Notifications Read and Write in private environment; Alchemy OAuth remains read/verify only for this endpoint.",
        ]),
    ...plan.gaps,
  ];
  return {
    capability,
    contractAvailable,
    plan,
    readyToApply,
    writeAuthenticationReady,
    gaps,
  };
}

const before = await readProviderState();
const beforeState = buildSafeState(before);

if (!apply && !verify) {
  const dryRun = {
    schemaVersion: 1 as const,
    mode: "dry-run" as const,
    site,
    stage,
    origin,
    alertType: WORKERS_OBSERVABILITY_ALERT,
    policyName: beforeState.plan.policyName,
    readyToApply: beforeState.readyToApply,
    policyConfigured: beforeState.plan.policyConfigured,
    receiptRecorded: false,
    recipientConfigured: Boolean(recipient),
    prerequisites: {
      providerFailureStatusContract: beforeState.contractAvailable,
      emailDeliveryReady: beforeState.capability.emailDeliveryReady,
      writeAuthenticationReady: beforeState.writeAuthenticationReady,
      deterministicPolicyUnambiguous: ["create", "noop"].includes(
        beforeState.plan.action,
      ),
      underlyingAlertThresholdConfigured: false,
    },
    plan: {
      action: beforeState.plan.action,
      policiesToCreate: beforeState.plan.action === "create" ? 1 : 0,
      policiesToUpdate: 0 as const,
      policiesToDelete: 0 as const,
    },
    gaps: beforeState.gaps,
    releaseEvidence: null,
  };
  if (json) console.log(JSON.stringify(dryRun, null, 2));
  else {
    console.log(
      `Operational alert policy dry-run: ${dryRun.readyToApply ? "READY" : "NOT READY"}; action ${dryRun.plan.action}.`,
    );
    console.log(`Deterministic policy: ${dryRun.policyName}`);
    for (const gap of dryRun.gaps) console.log(`GAP: ${gap}`);
  }
  if (!dryRun.readyToApply) process.exitCode = 2;
} else {
  if (!beforeState.readyToApply) {
    throw new Error(
      "Operational alert prerequisites are incomplete; no Cloudflare policy was changed.",
    );
  }
  if (!recipient) {
    throw new Error(
      "CLOUDFLARE_ALERT_EMAIL is required in private env; no recipient is printed.",
    );
  }
  if (apply && confirmOrigin !== origin) {
    throw new Error(
      "Apply requires --confirm-origin=<exact resolved HTTPS origin>.",
    );
  }
  if (apply && confirmPolicy !== beforeState.plan.policyName) {
    throw new Error(
      "Apply requires --confirm-policy=<exact deterministic policy name>.",
    );
  }
  const target = buildCloudflareOperationalAlertPolicy({
    site,
    stage,
    recipient,
  });
  let policyCreated = false;
  if (apply && beforeState.plan.action === "create") {
    await cloudflareRequest("policies", {
      method: "POST",
      body: JSON.stringify(target),
    });
    policyCreated = true;
  }
  const after = policyCreated ? await readProviderState() : before;
  const afterState = buildSafeState(after);
  if (afterState.plan.action !== "noop" || !afterState.plan.policyConfigured) {
    throw new Error(
      "Cloudflare policy did not converge to exactly one fail-closed specification; provider identifiers were suppressed.",
    );
  }
  const policy = resolveExactCloudflareOperationalAlertPolicy({
    policies: after.policies,
    target,
  });
  const evidence = buildCloudflareOperationalAlertEvidence({
    policy,
    history: after.history,
    ...(verify && receiptConfirmedAt ? { receiptConfirmedAt } : {}),
  });
  const safeReport = {
    schemaVersion: 1 as const,
    mode: apply ? ("apply" as const) : ("verify" as const),
    site,
    stage,
    origin,
    alertType: WORKERS_OBSERVABILITY_ALERT,
    policyName: afterState.plan.policyName,
    policyCreated,
    policyConfigured: true as const,
    dispatchRecorded: evidence.dispatchRecorded,
    receiptConfirmed: evidence.receiptConfirmed,
    underlyingAlertThresholdConfigured: false as const,
    nextAction:
      "Create the Workers Observability threshold for event=cms.operational_incident, trigger one controlled notification failure, confirm the email, then rerun --verify with its receipt timestamp.",
    releaseEvidence: evidence.releaseEvidence,
  };
  if (json) console.log(JSON.stringify(safeReport, null, 2));
  else {
    console.log(
      `Operational alert policy ${safeReport.mode}: policy converged; dispatch ${safeReport.dispatchRecorded ? "recorded" : "not recorded"}.`,
    );
    console.log(
      safeReport.releaseEvidence
        ? "Human receipt confirmed; operational-alert release evidence is available in --json output."
        : safeReport.nextAction,
    );
  }
  if (verify && !safeReport.releaseEvidence) process.exitCode = 2;
}
