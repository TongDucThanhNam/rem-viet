import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  documentationWalkthroughEvidenceSchema,
  type DocumentationWalkthroughEvidence,
} from "./documentation-walkthrough-evidence";
import { formatReleaseEvidenceErrors } from "./release-evidence";
import { argument, repoRoot } from "./site-lib";

const requiredDocumentation = [
  "docs/cms/platform-kit-operator-guide.md",
  "docs/cms/template-factory-guide.md",
  "docs/cms/extension-sdk-guide.md",
  "docs/client-manual-vi.md",
  "docs/agency-operations-runbook.md",
  "docs/client-handover-checklist.md",
  "docs/pilot-handover-script.md",
] as const;

const evidencePath = resolve(
  repoRoot,
  argument("evidence") ??
    "docs/releases/documentation-walkthrough-evidence.json",
);
const expectedCommit = argument("commit");
const expectedRepository = argument("repository");

if (!expectedCommit || !expectedRepository)
  throw new Error(
    "Documentation walkthrough verification requires --commit and --repository.",
  );
if (!/^[0-9a-f]{40}$/i.test(expectedCommit))
  throw new Error("--commit must be a full Git SHA.");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(expectedRepository))
  throw new Error("--repository must be an owner/repository identifier.");

function git(args: string[]) {
  return Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
}

if (git(["cat-file", "-e", `${expectedCommit}^{commit}`]).exitCode !== 0)
  throw new Error("The requested documentation commit does not exist locally.");

for (const path of requiredDocumentation) {
  if (git(["cat-file", "-e", `${expectedCommit}:${path}`]).exitCode !== 0)
    throw new Error(
      `The requested commit does not contain required documentation: ${path}.`,
    );
}

let rawEvidence: unknown;
try {
  rawEvidence = JSON.parse(await readFile(evidencePath, "utf8"));
} catch (error) {
  throw new Error(
    `Documentation walkthrough evidence is missing or invalid JSON: ${evidencePath}\n` +
      "Copy docs/releases/documentation-walkthrough-evidence.template.json, record the real independent result, and rerun.",
    { cause: error },
  );
}

const parsed = documentationWalkthroughEvidenceSchema.safeParse(rawEvidence);
if (!parsed.success)
  throw new Error(
    `Documentation walkthrough evidence is incomplete:\n${formatReleaseEvidenceErrors(parsed.error)}`,
  );

const evidence: DocumentationWalkthroughEvidence = parsed.data;
if (evidence.repository !== expectedRepository)
  throw new Error(
    `Evidence repository ${evidence.repository} does not match ${expectedRepository}.`,
  );
if (evidence.documentationCommit !== expectedCommit)
  throw new Error(
    `Evidence commit ${evidence.documentationCommit} does not match ${expectedCommit}.`,
  );

for (const finding of evidence.findings) {
  if (!finding.remediationCommit) continue;
  if (
    git(["cat-file", "-e", `${finding.remediationCommit}^{commit}`])
      .exitCode !== 0
  )
    throw new Error(
      `Finding ${finding.issueId} references an unknown remediation commit.`,
    );
  if (
    git([
      "merge-base",
      "--is-ancestor",
      finding.remediationCommit,
      expectedCommit,
    ]).exitCode !== 0
  )
    throw new Error(
      `Finding ${finding.issueId} remediation is not contained in the verified documentation commit.`,
    );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      schemaVersion: evidence.schemaVersion,
      repository: evidence.repository,
      documentationCommit: evidence.documentationCommit,
      result: {
        operatorName: evidence.operator.name,
        operatingSystem: evidence.operator.operatingSystem,
        completedAt: evidence.operator.completedAt,
        resolvedFindingIds: evidence.findings.map((finding) => finding.issueId),
      },
      documentationEvidence: evidence,
    },
    null,
    2,
  ),
);
