import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { z } from "zod";

import {
  buildGithubReleaseGateAuditReport,
  githubReleaseWorkflowSchema,
} from "./github-release-gate-audit-lib";
import { flag, repoRoot } from "./site-lib";

const workflowPath = ".github/workflows/client-ready-release.yml";
const repoSchema = z
  .object({
    nameWithOwner: z.string().regex(/^[^/]+\/[^/]+$/),
    defaultBranchRef: z.object({ name: z.string().min(1) }).strict(),
  })
  .passthrough();
const remoteContentSchema = z
  .object({ content: z.string(), encoding: z.literal("base64") })
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

async function main() {
  const repoResult = await ghJson(
    ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"],
    "repository",
  );
  const repo = repoSchema.parse(repoResult.value);
  const remoteContentResult = await ghJson(
    [
      "api",
      `repos/${repo.nameWithOwner}/contents/${workflowPath}?ref=${encodeURIComponent(repo.defaultBranchRef.name)}`,
    ],
    "client-ready default-branch workflow",
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

  const workflowResult = await ghJson(
    [
      "api",
      `repos/${repo.nameWithOwner}/actions/workflows/${basename(workflowPath)}`,
    ],
    "client-ready workflow registration",
    { allowNotFound: true },
  );
  const workflow = workflowResult.found
    ? githubReleaseWorkflowSchema.parse(workflowResult.value)
    : null;
  const report = buildGithubReleaseGateAuditReport({
    checkedAt: new Date().toISOString(),
    repository: {
      nameWithOwner: repo.nameWithOwner,
      defaultBranch: repo.defaultBranchRef.name,
    },
    workflow: {
      path: workflowPath,
      availableOnDefaultBranch: remoteContentResult.found,
      matchesLocalContract,
      registered: workflow !== null,
      active: workflow?.state === "active",
    },
  });

  if (flag("json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `Client-ready GitHub gate: ${report.ready ? "READY" : "NOT READY"}.`,
    );
    console.log(
      `Workflow: ${report.workflow.availableOnDefaultBranch ? (report.workflow.matchesLocalContract ? "default-branch contract matches" : "default-branch contract drift") : "missing from default branch"}; registration ${report.workflow.registered ? (report.workflow.active ? "active" : "disabled") : "missing"}.`,
    );
    for (const gap of report.gaps)
      console.log(`GAP ${gap.gate}: ${gap.action}`);
  }
  if (!report.ready) process.exitCode = 2;
}

if (import.meta.main) await main();
