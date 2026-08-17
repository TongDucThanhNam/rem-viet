import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { argument, flag, repoRoot } from "./site-lib";
import {
  clientReleaseEvidenceSchema,
  formatReleaseEvidenceErrors,
} from "./release-evidence";

const evidencePath = resolve(
  repoRoot,
  argument("evidence") ?? "docs/releases/v1.0.0-client-ready.json",
);

let rawEvidence: unknown;
try {
  rawEvidence = JSON.parse(await readFile(evidencePath, "utf8"));
} catch (error) {
  throw new Error(
    `Release evidence is missing or invalid JSON: ${evidencePath}\n` +
      "Copy docs/releases/v1.0.0-client-ready.template.json, replace every placeholder, and rerun.",
    { cause: error },
  );
}

const parsed = clientReleaseEvidenceSchema.safeParse(rawEvidence);
if (!parsed.success)
  throw new Error(
    `Client-ready release evidence is incomplete:\n${formatReleaseEvidenceErrors(parsed.error)}`,
  );

const expectedCommit =
  argument("commit") ??
  Bun.spawnSync(["git", "rev-parse", "HEAD"], {
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  })
    .stdout.toString()
    .trim();
if (!/^[0-9a-f]{40}$/i.test(expectedCommit))
  throw new Error("Could not resolve the release commit.");
if (parsed.data.quality.commit !== expectedCommit)
  throw new Error(
    `Evidence commit ${parsed.data.quality.commit} does not match release commit ${expectedCommit}.`,
  );

if (!flag("allow-dirty")) {
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (status.exitCode !== 0)
    throw new Error("Could not verify Git working-tree state.");
  if (status.stdout.toString().trim())
    throw new Error(
      "Release verification requires a clean checkout. Commit the evidence and all release changes first.",
    );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      releaseTag: parsed.data.releaseTag,
      commit: parsed.data.quality.commit,
      flagship: parsed.data.flagship.siteId,
      secondSite: parsed.data.secondSite.siteId,
      pilot: parsed.data.pilot.testerName,
      performanceSamples: Object.fromEntries(
        Object.entries(parsed.data.performance.metrics).map(
          ([name, metric]) => [name, metric.samples],
        ),
      ),
      productionBackup: parsed.data.production.backup.artifactLocator,
      stagingRestore: parsed.data.stagingRestore.restore.targetDatabase,
      scheduledBackup: {
        workflow: parsed.data.scheduledBackup.workflow,
        manualRunId: parsed.data.scheduledBackup.manualDispatch.runId,
        scheduledRunId: parsed.data.scheduledBackup.scheduledRun.runId,
      },
    },
    null,
    2,
  ),
);
