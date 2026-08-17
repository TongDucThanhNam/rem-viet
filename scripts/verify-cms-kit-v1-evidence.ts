import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  parseCmsKitAdoptionReceipt,
  parseCmsKitPublicationReceipt,
  parseCmsKitV1Evidence,
  verifyCmsKitV1EvidenceGraph,
} from "./cms-kit-v1-evidence";
import { argument, flag, repoRoot } from "./site-lib";

const recordPath = resolve(
  repoRoot,
  argument("evidence") ?? "docs/releases/evidence/cms-kit-v1.0.0.json",
);
const record = parseCmsKitV1Evidence(await readJson(recordPath));

if (flag("validate-only")) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "validate-only",
        releaseTag: record.releaseTag,
        referencedReceipts: record.adoptions.length + 2,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const head = git(["rev-parse", "HEAD"]);
if (!/^[0-9a-f]{40}$/.test(head))
  fail("Could not resolve the current Git commit.");
if (git(["status", "--porcelain"])) {
  fail("CMS Kit v1 verification requires a clean checkout.");
}
if (!isStrictAncestor(record.releaseSourceCommit, head)) {
  fail(
    "The release source commit must be a strict ancestor of the evidence commit.",
  );
}

const initialReference = await loadReference(
  record.publications.initial.path,
  record.publications.initial.sha256,
);
const targetReference = await loadReference(
  record.publications.target.path,
  record.publications.target.sha256,
);
const initial = parseCmsKitPublicationReceipt(initialReference.value);
const target = parseCmsKitPublicationReceipt(targetReference.value);

if (!isStrictAncestor(initial.commit, target.commit)) {
  fail("The initial release commit must precede the target release commit.");
}

const adoptionReferences = [];
for (const reference of record.adoptions) {
  const loaded = await loadReference(reference.path, reference.sha256);
  adoptionReferences.push({
    receipt: parseCmsKitAdoptionReceipt(loaded.value),
    sha256: loaded.sha256,
  });
}

const changelogPath = resolve(repoRoot, "docs/releases/cms-kit-changelog.md");
const changelog = await readFile(changelogPath);
const changelogText = changelog.toString("utf8");
const graph = verifyCmsKitV1EvidenceGraph({
  record,
  initialPublication: {
    receipt: initial,
    sha256: initialReference.sha256,
  },
  targetPublication: {
    receipt: target,
    sha256: targetReference.sha256,
  },
  adoptions: adoptionReferences,
  changelog: { sha256: sha256(changelog), text: changelogText },
});

const changedPaths = git([
  "diff",
  "--no-renames",
  "--name-only",
  `${record.releaseSourceCommit}..${head}`,
])
  .split(/\r?\n/)
  .filter(Boolean);
if (!changedPaths.length)
  fail("The evidence commit contains no recorded evidence.");
const invalidPath = changedPaths.find(
  (path) => !path.startsWith("docs/releases/evidence/"),
);
if (invalidPath) {
  fail(
    `Source drift after registry publication is not allowed: ${invalidPath}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      releaseTag: record.releaseTag,
      sourceCommit: record.releaseSourceCommit,
      evidenceCommit: head,
      registry: graph.registry,
      version: graph.version,
      coreFix: graph.coreFix,
      paidSites: graph.paidSites,
      evidenceOnlyChanges: changedPaths.length,
      agencyApprovedAt: record.agencyApproval.approvedAt,
    },
    null,
    2,
  ),
);

async function loadReference(path: string, expectedSha256: string) {
  const absolutePath = resolve(repoRoot, path);
  const relativePath = relative(repoRoot, absolutePath).replaceAll("\\", "/");
  if (relativePath !== path)
    fail(`Evidence path escapes the repository: ${path}`);
  const bytes = await readFile(absolutePath);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256)
    fail(`Evidence digest mismatch: ${path}`);
  if (!gitExitZero(["ls-files", "--error-unmatch", "--", path])) {
    fail(`Evidence file is not tracked by Git: ${path}`);
  }
  return {
    value: JSON.parse(bytes.toString("utf8")) as unknown,
    sha256: actualSha256,
  };
}

async function readJson(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`CMS Kit v1 evidence is missing or invalid JSON: ${path}`, {
      cause: error,
    });
  }
}

function isStrictAncestor(ancestor: string, descendant: string) {
  return (
    ancestor !== descendant &&
    gitExitZero(["merge-base", "--is-ancestor", ancestor, descendant])
  );
}

function git(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    fail(`Git verification failed for: git ${args.join(" ")}`);
  }
  return result.stdout.toString().trim();
}

function gitExitZero(args: string[]) {
  return (
    Bun.spawnSync(["git", ...args], {
      cwd: repoRoot,
      stdout: "ignore",
      stderr: "ignore",
    }).exitCode === 0
  );
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message: string): never {
  throw new Error(message);
}
