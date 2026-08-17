import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { parseSanityHostedConformanceReceipt } from "../src/hosted-conformance";
import { parseSanityPresentationReceipt } from "../src/presentation-conformance";
import {
  createSanityPromotionReceipt,
  requiredSanityPromotionConfirmation,
  type SanityPromotionEvidenceKind,
} from "../src/promotion-conformance";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const evidenceRoot = resolve(repositoryRoot, "docs/releases/evidence");
const args = process.argv.slice(2);
const knownFlags = new Set([
  "--allow-production",
  "--apply",
  "--confirmation",
  "--hosted-id",
  "--hosted-receipt",
  "--output",
  "--presentation-id",
  "--presentation-receipt",
]);
for (const argument of args) {
  const name = argument.split("=", 1)[0] ?? argument;
  if (!knownFlags.has(name)) fail(`Unknown argument: ${name}`);
}

const apply = args.includes("--apply");
const allowProduction = args.includes("--allow-production");
const projectId = requiredEnvironment("SANITY_PROJECT_ID");
const dataset = requiredEnvironment("SANITY_DATASET");
const hostedDocumentId = requiredFlag("--hosted-id");
const presentationDocumentId = requiredFlag("--presentation-id");
const hostedReceiptPath = evidencePath(requiredFlag("--hosted-receipt"));
const presentationReceiptPath = evidencePath(
  requiredFlag("--presentation-receipt"),
);
const requiredConfirmation = requiredSanityPromotionConfirmation({
  projectId,
  dataset,
  hostedDocumentId,
  presentationDocumentId,
  allowProduction,
});
const requestedOutput = flagValue("--output");
const outputPath = requestedOutput
  ? evidencePath(requestedOutput)
  : resolve(evidenceRoot, `sanity-promotion-${presentationDocumentId}.json`);

if (!apply) {
  console.log(
    JSON.stringify(
      {
        status: "dry-run",
        networkAccess: false,
        writesReceipt: false,
        scope: {
          projectId,
          dataset,
          hostedDocumentId,
          presentationDocumentId,
        },
        hostedReceipt: repositoryPath(hostedReceiptPath),
        presentationReceipt: repositoryPath(presentationReceiptPath),
        requiredConfirmation,
        applyCommand:
          'bun run cms:sanity:promotion --apply --hosted-id="<same-hosted-id>" --presentation-id="<same-presentation-id>" --hosted-receipt="<same-hosted-receipt>" --presentation-receipt="<same-presentation-receipt>" --confirmation="<required-confirmation>"',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (requiredFlag("--confirmation") !== requiredConfirmation) {
  fail(`Sanity promotion verification requires: ${requiredConfirmation}`);
}
await assertAbsent(outputPath, "Sanity promotion receipt");
const currentGitCommit = cleanGitCommit();
const hostedReceiptBytes = await readFile(hostedReceiptPath);
const presentationReceiptBytes = await readFile(presentationReceiptPath);
const hostedReceipt = parseSanityHostedConformanceReceipt(
  parseJson(hostedReceiptBytes, "Hosted receipt"),
);
const presentationReceipt = parseSanityPresentationReceipt(
  parseJson(presentationReceiptBytes, "Presentation receipt"),
);

if (
  hostedReceipt.projectId !== projectId ||
  hostedReceipt.dataset !== dataset ||
  hostedReceipt.documentId !== hostedDocumentId
) {
  fail("Hosted receipt does not match the requested promotion scope.");
}
if (
  presentationReceipt.projectId !== projectId ||
  presentationReceipt.dataset !== dataset ||
  presentationReceipt.documentId !== presentationDocumentId
) {
  fail("Presentation receipt does not match the requested promotion scope.");
}
if (
  presentationReceipt.hostedReceipt.path !==
    repositoryPath(hostedReceiptPath) ||
  presentationReceipt.hostedReceipt.sha256 !== sha256(hostedReceiptBytes) ||
  presentationReceipt.hostedReceipt.gitCommit !== hostedReceipt.gitCommit
) {
  fail("Presentation receipt does not bind the exact hosted receipt.");
}

assertTracked(hostedReceiptPath);
assertTracked(presentationReceiptPath);
assertStrictAncestor(hostedReceipt.gitCommit, presentationReceipt.gitCommit);
assertStrictAncestor(presentationReceipt.gitCommit, currentGitCommit);
assertEvidenceOnlyDiff(hostedReceipt.gitCommit, presentationReceipt.gitCommit);
assertEvidenceOnlyDiff(presentationReceipt.gitCommit, currentGitCommit);
assertPathExistsAtCommit(
  presentationReceipt.gitCommit,
  hostedReceiptPath,
  "Hosted receipt",
);
if (
  sha256(readGitBlob(presentationReceipt.gitCommit, hostedReceiptPath)) !==
  presentationReceipt.hostedReceipt.sha256
) {
  fail(
    "Hosted receipt blob at the Presentation commit does not match its digest.",
  );
}
assertPathAbsentAtCommit(
  presentationReceipt.gitCommit,
  presentationReceiptPath,
  "Presentation receipt",
);

const evidence: Array<{
  kind: SanityPromotionEvidenceKind;
  path: string;
  sha256: string;
}> = [
  {
    kind: "hosted-receipt",
    path: repositoryPath(hostedReceiptPath),
    sha256: sha256(hostedReceiptBytes),
  },
  {
    kind: "presentation-receipt",
    path: repositoryPath(presentationReceiptPath),
    sha256: sha256(presentationReceiptBytes),
  },
];

for (const artifact of presentationReceipt.artifacts) {
  const artifactPath = evidencePath(artifact.path);
  assertTracked(artifactPath);
  assertPathAbsentAtCommit(
    presentationReceipt.gitCommit,
    artifactPath,
    `Presentation ${artifact.kind}`,
  );
  const bytes = await readFile(artifactPath);
  if (sha256(bytes) !== artifact.sha256) {
    fail(`Presentation ${artifact.kind} digest does not match its receipt.`);
  }
  evidence.push({
    kind: artifact.kind,
    path: repositoryPath(artifactPath),
    sha256: artifact.sha256,
  });
}

const receipt = createSanityPromotionReceipt({
  hostedReceipt,
  presentationReceipt,
  generatedAt: new Date().toISOString(),
  gitCommit: currentGitCommit,
  provenance: {
    cleanCheckout: true,
    proofCommitsReachable: true,
    evidenceOnlySincePresentationProof: true,
  },
  evidence,
});
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      receipt: repositoryPath(outputPath),
      gitCommit: receipt.gitCommit,
      evidence: receipt.evidence.map(({ kind, path }) => ({ kind, path })),
    },
    null,
    2,
  ),
);

function cleanGitCommit() {
  if (runGit(["status", "--porcelain"]).trim()) {
    fail("Sanity promotion receipt requires a clean Git checkout.");
  }
  const commit = runGit(["rev-parse", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/.test(commit))
    fail("Unable to resolve a full Git commit.");
  return commit;
}

function assertStrictAncestor(ancestor: string, descendant: string) {
  if (ancestor === descendant) fail("Sanity proof commits must be distinct.");
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", ancestor, descendant],
    { cwd: repositoryRoot, stdio: "ignore" },
  );
  if (result.status !== 0) {
    fail("Sanity proof commits do not form the required ancestry chain.");
  }
}

function assertEvidenceOnlyDiff(from: string, to: string) {
  const changed = runGit([
    "diff",
    "--no-renames",
    "--name-only",
    `${from}..${to}`,
  ])
    .split(/\r?\n/)
    .filter(Boolean);
  if (
    changed.length === 0 ||
    changed.some((path) => !path.startsWith("docs/releases/evidence/"))
  ) {
    fail(
      "Sanity proof commits contain non-evidence source changes or no evidence.",
    );
  }
}

function assertTracked(path: string) {
  const result = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", repositoryPath(path)],
    { cwd: repositoryRoot, stdio: "ignore" },
  );
  if (result.status !== 0)
    fail("Sanity promotion evidence is not Git-tracked.");
}

function assertPathExistsAtCommit(commit: string, path: string, label: string) {
  const result = spawnSync(
    "git",
    ["cat-file", "-e", `${commit}:${repositoryPath(path)}`],
    { cwd: repositoryRoot, stdio: "ignore" },
  );
  if (result.status !== 0) fail(`${label} is absent from its proof commit.`);
}

function assertPathAbsentAtCommit(commit: string, path: string, label: string) {
  const result = spawnSync(
    "git",
    ["cat-file", "-e", `${commit}:${repositoryPath(path)}`],
    { cwd: repositoryRoot, stdio: "ignore" },
  );
  if (result.status === 0) fail(`${label} predates its claimed proof run.`);
  if (result.status !== 1 && result.status !== 128) {
    fail(`Unable to verify ${label} history.`);
  }
}

function readGitBlob(commit: string, path: string) {
  const result = spawnSync(
    "git",
    ["show", `${commit}:${repositoryPath(path)}`],
    { cwd: repositoryRoot, encoding: "buffer", maxBuffer: 5 * 1024 * 1024 },
  );
  if (result.status !== 0 || !(result.stdout instanceof Buffer)) {
    fail("Unable to read hosted receipt from the Presentation proof commit.");
  }
  return result.stdout;
}

function runGit(arguments_: string[]) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) fail("Git provenance check failed.");
  return result.stdout;
}

function parseJson(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(`${label} is not valid JSON.`);
  }
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function evidencePath(value: string) {
  const path = resolve(repositoryRoot, value);
  const child = relative(evidenceRoot, path);
  if (child === "" || child.startsWith("..") || isAbsolute(child)) {
    fail("Evidence path must stay below docs/releases/evidence/.");
  }
  return path;
}

function repositoryPath(path: string) {
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}

async function assertAbsent(path: string, label: string) {
  try {
    await stat(path);
    fail(`${label} already exists.`);
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
}

function flagValue(name: string) {
  const argument = args.find((value) => value.startsWith(`${name}=`));
  return argument?.slice(name.length + 1).trim() || undefined;
}

function requiredFlag(name: string) {
  const value = flagValue(name);
  if (!value) fail(`Missing ${name}=...`);
  return value;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing ${name}.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}
