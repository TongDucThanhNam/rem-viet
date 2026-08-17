import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  deploymentProvenanceSchema,
  isCleanDeploymentProvenance,
} from "../packages/cms/src/deployment";
import {
  formatReleaseEvidenceErrors,
  pilotEvidenceRecordSchema,
} from "./release-evidence";
import { argument, readSiteManifest, repoRoot } from "./site-lib";

const evidencePath = resolve(
  repoRoot,
  argument("evidence") ?? "docs/releases/pilot-evidence.json",
);
const expectedSite = argument("site");
const expectedOrigin = argument("origin");
const expectedCommit = argument("commit");

if (!expectedSite || !expectedOrigin || !expectedCommit)
  throw new Error(
    "Pilot verification requires --site, --origin and the exact deployed --commit.",
  );
if (!/^[0-9a-f]{40}$/i.test(expectedCommit))
  throw new Error("--commit must be a full Git SHA.");

const { manifest } = await readSiteManifest(expectedSite);
const knownCommit = Bun.spawnSync(
  ["git", "cat-file", "-e", `${expectedCommit}^{commit}`],
  { cwd: repoRoot, stderr: "pipe", stdout: "pipe" },
);
if (knownCommit.exitCode !== 0)
  throw new Error("The requested deployed commit does not exist locally.");

let rawEvidence: unknown;
try {
  rawEvidence = JSON.parse(await readFile(evidencePath, "utf8"));
} catch (error) {
  throw new Error(
    `Pilot evidence is missing or invalid JSON: ${evidencePath}\n` +
      "Copy docs/releases/pilot-evidence.template.json, record the real human result, and rerun.",
    { cause: error },
  );
}

const parsed = pilotEvidenceRecordSchema.safeParse(rawEvidence);
if (!parsed.success)
  throw new Error(
    `Pilot evidence is incomplete:\n${formatReleaseEvidenceErrors(parsed.error)}`,
  );

if (parsed.data.siteId !== manifest.id)
  throw new Error(
    `Pilot site ${parsed.data.siteId} does not match requested site ${manifest.id}.`,
  );
if (parsed.data.origin !== expectedOrigin)
  throw new Error(
    `Pilot origin ${parsed.data.origin} does not match requested origin ${expectedOrigin}.`,
  );
if (parsed.data.pilot.deployment.commit !== expectedCommit)
  throw new Error(
    `Pilot commit ${parsed.data.pilot.deployment.commit} does not match deployed commit ${expectedCommit}.`,
  );

let deploymentResponse: Response;
try {
  deploymentResponse = await fetch(`${expectedOrigin}/api/health`, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
} catch (error) {
  throw new Error("Could not read deployment provenance from staging health.", {
    cause: error,
  });
}
if (![200, 503].includes(deploymentResponse.status))
  throw new Error(
    `Staging health returned unexpected HTTP ${deploymentResponse.status}.`,
  );

let deploymentBody: unknown;
try {
  deploymentBody = await deploymentResponse.json();
} catch (error) {
  throw new Error("Staging health did not return valid JSON.", {
    cause: error,
  });
}
const deploymentResult = deploymentProvenanceSchema.safeParse(
  deploymentBody && typeof deploymentBody === "object"
    ? (deploymentBody as Record<string, unknown>).deployment
    : undefined,
);
if (!deploymentResult.success)
  throw new Error(
    "Staging health does not expose valid deployment provenance. Deploy the current Worker contract first.",
  );
const deployment = deploymentResult.data;
if (!isCleanDeploymentProvenance(deployment))
  throw new Error(
    `Pilot evidence requires a clean staging deployment; source state is ${deployment.sourceState}.`,
  );
if (
  deployment.siteId !== parsed.data.siteId ||
  deployment.stage !== parsed.data.stage
)
  throw new Error(
    "Staging deployment site/stage does not match pilot evidence.",
  );
if (deployment.commit !== parsed.data.pilot.deployment.commit)
  throw new Error(
    `Live staging commit ${deployment.commit} does not match pilot evidence commit ${parsed.data.pilot.deployment.commit}.`,
  );
if (deployment.inputSha256 !== parsed.data.pilot.deployment.inputSha256)
  throw new Error(
    "Live staging deploy-input hash does not match the pilot evidence record.",
  );

console.log(
  JSON.stringify(
    {
      ok: true,
      schemaVersion: parsed.data.schemaVersion,
      releaseCommit: parsed.data.pilot.deployment.commit,
      deploymentInputSha256: parsed.data.pilot.deployment.inputSha256,
      siteId: parsed.data.siteId,
      stage: parsed.data.stage,
      origin: parsed.data.origin,
      result: {
        testerName: parsed.data.pilot.testerName,
        durationMinutes: parsed.data.pilot.durationMinutes,
        trainingDurationMinutes: parsed.data.pilot.trainingDurationMinutes,
        revisionRestoreMinutes: parsed.data.pilot.revisionRestoreMinutes,
        editableRecurringContentPercent:
          parsed.data.pilot.editableRecurringContentPercent,
        issueIds: parsed.data.pilot.issueIds,
      },
      releaseEvidence: {
        pilot: parsed.data.pilot,
        approvals: { pilotTester: parsed.data.testerApproval },
      },
    },
    null,
    2,
  ),
);
