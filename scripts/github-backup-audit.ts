import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { z } from "zod";

import {
  buildGithubBackupAuditReport,
  githubBackupRunSchema,
  inspectGithubBackupConfiguration,
  inspectGithubBackupRun,
  type GithubBackupRun,
} from "./github-backup-audit-lib";
import { argument, flag, readSiteManifest, repoRoot } from "./site-lib";

const workflowPath = ".github/workflows/scheduled-cms-backup.yml";
const repoSchema = z
  .object({
    nameWithOwner: z.string().regex(/^[^/]+\/[^/]+$/),
    defaultBranchRef: z.object({ name: z.string().min(1) }).strict(),
  })
  .passthrough();
const remoteContentSchema = z
  .object({ content: z.string(), encoding: z.literal("base64") })
  .passthrough();
const workflowRunsSchema = z
  .object({ workflow_runs: z.array(z.unknown()) })
  .passthrough();
const artifactsSchema = z
  .object({
    artifacts: z.array(
      z
        .object({
          name: z.string(),
          expired: z.boolean(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

async function runGh(
  args: string[],
  label: string,
  options: { allowNotFound?: boolean } = {},
) {
  const child = Bun.spawn(["gh", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode === 0) return { found: true as const, stdout };
  if (options.allowNotFound && /HTTP 404|not found/i.test(stderr))
    return { found: false as const, stdout: "" };
  throw new Error(`GitHub ${label} audit failed.`);
}

async function ghJson(
  args: string[],
  label: string,
  options: { allowNotFound?: boolean } = {},
) {
  const result = await runGh(args, label, options);
  if (!result.found) return { found: false as const, value: null };
  try {
    return {
      found: true as const,
      value: JSON.parse(result.stdout) as unknown,
    };
  } catch {
    throw new Error(`GitHub ${label} audit returned invalid JSON.`);
  }
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readRunEvidence(input: {
  repo: string;
  run: GithubBackupRun | null;
}) {
  if (
    !input.run ||
    input.run.status !== "completed" ||
    input.run.conclusion !== "success"
  )
    return { backupEvidence: null, archiveEvidence: null };

  const artifactName = `cms-backup-evidence-${input.run.id}-${input.run.run_attempt}`;
  const artifactsResult = await ghJson(
    ["api", `repos/${input.repo}/actions/runs/${input.run.id}/artifacts`],
    "backup artifact",
  );
  const artifacts = artifactsSchema.parse(artifactsResult.value).artifacts;
  const artifact = artifacts.find((entry) => entry.name === artifactName);
  if (!artifact || artifact.expired)
    return { backupEvidence: null, archiveEvidence: null };

  const directory = await mkdtemp(join(tmpdir(), "cms-backup-github-audit-"));
  try {
    const download = await runGh(
      [
        "run",
        "download",
        String(input.run.id),
        "--repo",
        input.repo,
        "--name",
        artifactName,
        "--dir",
        directory,
      ],
      "backup evidence download",
    );
    if (!download.found) return { backupEvidence: null, archiveEvidence: null };
    const files = await readdir(directory, { recursive: true });
    const backupFiles = files.filter((file) => file.endsWith(".evidence.json"));
    const archiveFiles = files.filter((file) =>
      file.endsWith(".immutable.json"),
    );
    if (backupFiles.length !== 1 || archiveFiles.length !== 1)
      return { backupEvidence: null, archiveEvidence: null };
    return {
      backupEvidence: JSON.parse(
        await readFile(resolve(directory, backupFiles[0]!), "utf8"),
      ) as unknown,
      archiveEvidence: JSON.parse(
        await readFile(resolve(directory, archiveFiles[0]!), "utf8"),
      ) as unknown,
    };
  } catch {
    return { backupEvidence: null, archiveEvidence: null };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const site = argument("site") ?? "";
  const stage = (argument("stage") ?? "production").trim().toLowerCase();
  const retentionDays = Number.parseInt(
    argument("retention-days") ?? "365",
    10,
  );
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 90 ||
    retentionDays > 3650
  )
    throw new Error("Retention days must be an integer from 90 to 3650.");
  const { manifest } = await readSiteManifest(site);

  const repoResult = await ghJson(
    ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"],
    "repository",
  );
  const repo = repoSchema.parse(repoResult.value);
  const variablesResult = await ghJson(
    [
      "variable",
      "list",
      "--repo",
      repo.nameWithOwner,
      "--json",
      "name,value,updatedAt",
    ],
    "backup variables",
  );
  const secretsResult = await ghJson(
    [
      "secret",
      "list",
      "--repo",
      repo.nameWithOwner,
      "--json",
      "name,updatedAt",
    ],
    "backup secrets",
  );
  const configuration = inspectGithubBackupConfiguration({
    variables: variablesResult.value,
    secrets: secretsResult.value,
    expectedSite: manifest.id,
    expectedStage: stage,
  });

  const remoteContentResult = await ghJson(
    [
      "api",
      `repos/${repo.nameWithOwner}/contents/${workflowPath}?ref=${encodeURIComponent(repo.defaultBranchRef.name)}`,
    ],
    "default-branch workflow",
    { allowNotFound: true },
  );
  let matchesLocalContract = false;
  if (remoteContentResult.found) {
    const remote = remoteContentSchema.parse(remoteContentResult.value);
    const remoteBytes = Buffer.from(
      remote.content.replaceAll("\n", ""),
      "base64",
    );
    const localBytes = await readFile(resolve(repoRoot, workflowPath));
    matchesLocalContract = sha256(remoteBytes) === sha256(localBytes);
  }

  let runs: GithubBackupRun[] = [];
  if (remoteContentResult.found) {
    const runsResult = await ghJson(
      [
        "api",
        `repos/${repo.nameWithOwner}/actions/workflows/${basename(workflowPath)}/runs?per_page=100`,
      ],
      "backup workflow runs",
    );
    runs = workflowRunsSchema
      .parse(runsResult.value)
      .workflow_runs.flatMap((run) => {
        const parsed = githubBackupRunSchema.safeParse(run);
        return parsed.success ? [parsed.data] : [];
      })
      .sort(
        (left, right) =>
          Date.parse(right.created_at) - Date.parse(left.created_at),
      );
  }
  const manualRun =
    runs.find((run) => run.event === "workflow_dispatch") ?? null;
  const scheduledRun = runs.find((run) => run.event === "schedule") ?? null;
  const [manualEvidence, scheduledEvidence] = await Promise.all([
    readRunEvidence({ repo: repo.nameWithOwner, run: manualRun }),
    readRunEvidence({ repo: repo.nameWithOwner, run: scheduledRun }),
  ]);
  const sharedInspection = {
    expectedSite: manifest.id,
    expectedStage: stage,
    expectedBucket: manifest.infrastructure.backupBucketName,
    defaultBranch: repo.defaultBranchRef.name,
    configuredAt: configuration.configuredAt,
    retentionDays,
  };
  const manualDispatch = inspectGithubBackupRun({
    run: manualRun,
    ...manualEvidence,
    expectedEvent: "workflow_dispatch",
    ...sharedInspection,
  });
  const scheduled = inspectGithubBackupRun({
    run: scheduledRun,
    ...scheduledEvidence,
    expectedEvent: "schedule",
    ...sharedInspection,
  });
  const report = buildGithubBackupAuditReport({
    checkedAt: new Date().toISOString(),
    repository: {
      nameWithOwner: repo.nameWithOwner,
      defaultBranch: repo.defaultBranchRef.name,
    },
    workflow: {
      path: workflowPath,
      availableOnDefaultBranch: remoteContentResult.found,
      matchesLocalContract,
    },
    configuration,
    manualDispatch,
    scheduledRun: scheduled,
  });

  if (flag("json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `Scheduled backup evidence: ${report.ready ? "READY" : "NOT READY"}.`,
    );
    console.log(
      `Workflow: ${report.workflow.availableOnDefaultBranch ? (report.workflow.matchesLocalContract ? "default-branch contract matches" : "default-branch contract drift") : "missing from default branch"}.`,
    );
    console.log(
      `Configuration: ${report.configuration.ready ? "ready" : "missing or mismatched"}; values suppressed.`,
    );
    console.log(
      `Manual dispatch: ${report.manualDispatch.valid ? "valid immutable receipt" : "missing or invalid"}.`,
    );
    console.log(
      `Scheduled run: ${report.scheduledRun.valid ? "valid immutable receipt" : "missing or invalid"}.`,
    );
    for (const gap of report.gaps)
      console.log(`GAP ${gap.gate}: ${gap.action}`);
  }
  if (!report.ready) process.exitCode = 2;
}

if (import.meta.main) await main();
