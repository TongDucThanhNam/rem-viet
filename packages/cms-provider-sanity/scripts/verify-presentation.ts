import { createClient } from "@sanity/client";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseSanityHostedConformanceReceipt } from "../src/hosted-conformance";
import {
  createSanityPresentationReceipt,
  parseSanityPresentationObservation,
  requiredSanityPresentationConfirmation,
} from "../src/presentation-conformance";

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
  "--hosted-receipt",
  "--id",
  "--output",
]);
for (const argument of args) {
  const name = argument.split("=", 1)[0] ?? argument;
  if (!knownFlags.has(name)) fail(`Unknown argument: ${name}`);
}

const apply = args.includes("--apply");
const allowProduction = args.includes("--allow-production");
const projectId = requiredEnvironment("SANITY_PROJECT_ID");
const dataset = requiredEnvironment("SANITY_DATASET");
const studioUrl = requiredEnvironment("SANITY_STUDIO_URL");
const previewUrl = requiredEnvironment("SANITY_PREVIEW_URL");
const documentId = requiredFlag("--id");
const hostedReceiptPath = evidencePath(requiredFlag("--hosted-receipt"));
const requiredConfirmation = requiredSanityPresentationConfirmation({
  projectId,
  dataset,
  documentId,
  allowProduction,
});
const requestedOutput = flagValue("--output");
const outputPath = requestedOutput
  ? evidencePath(requestedOutput)
  : resolve(evidenceRoot, `sanity-presentation-${documentId}.json`);

if (!apply) {
  console.log(
    JSON.stringify(
      {
        status: "dry-run",
        mutatesDataset: false,
        launchesAuthenticatedBrowser: false,
        writesReceipt: false,
        scope: {
          projectId,
          dataset,
          documentId,
          studioOrigin: httpsOrigin(studioUrl, "SANITY_STUDIO_URL"),
          previewOrigin: httpsOrigin(previewUrl, "SANITY_PREVIEW_URL"),
        },
        hostedReceipt: repositoryPath(hostedReceiptPath),
        requiredConfirmation,
        applyCommand:
          'bun run cms:sanity:presentation --apply --id="<same-id>" --hosted-receipt="<same-receipt>" --confirmation="<required-confirmation>"',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (requiredFlag("--confirmation") !== requiredConfirmation) {
  fail(`Sanity Presentation verification requires: ${requiredConfirmation}`);
}
await assertAbsent(outputPath, "Presentation receipt");
const gitCommit = cleanGitCommit();
const hostedReceiptBytes = await readFile(hostedReceiptPath);
const hostedReceipt = parseSanityHostedConformanceReceipt(
  parseJson(
    new TextDecoder().decode(hostedReceiptBytes),
    "Hosted conformance receipt",
  ),
);
if (
  hostedReceipt.projectId !== projectId ||
  hostedReceipt.dataset !== dataset
) {
  fail("Hosted receipt project/dataset does not match Presentation scope.");
}
const studioOrigin = httpsOrigin(studioUrl, "SANITY_STUDIO_URL");
const previewOrigin = httpsOrigin(previewUrl, "SANITY_PREVIEW_URL");
if (
  hostedReceipt.visualEditing.studioOrigin !== studioOrigin ||
  hostedReceipt.visualEditing.previewOrigin !== previewOrigin
) {
  fail(
    "Hosted receipt visual-editing origins do not match Presentation scope.",
  );
}

const token = requiredEnvironment("SANITY_API_TOKEN");
const presentationUrlTemplate = requiredEnvironment(
  "SANITY_PRESENTATION_URL_TEMPLATE",
);
if (!presentationUrlTemplate.includes("{id}")) {
  fail("SANITY_PRESENTATION_URL_TEMPLATE must include {id}.");
}
if (new URL(presentationUrlTemplate).origin !== studioOrigin) {
  fail("Presentation URL template must use the configured Studio origin.");
}
const presentationUrl = presentationUrlTemplate.replaceAll(
  "{id}",
  encodeURIComponent(documentId),
);
const storageStatePath = resolve(
  repositoryRoot,
  requiredEnvironment("SANITY_PRESENTATION_STORAGE_STATE"),
);
await stat(storageStatePath);
if (isBelow(evidenceRoot, storageStatePath)) {
  fail(
    "Authenticated browser storage must not be stored with release evidence.",
  );
}
if (!isGitIgnored(storageStatePath)) {
  fail("Authenticated browser storage state must be Git-ignored.");
}
assertStorageStateScope(await readFile(storageStatePath, "utf8"), studioOrigin);

const sdk = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2026-07-01",
  perspective: "raw",
  useCdn: false,
});
const publishedId = `agency-presentation-${documentId}`;
const draftId = `drafts.${publishedId}`;
const existing = await sdk.fetch<number>(`count(*[_id in $ids])`, {
  ids: [publishedId, draftId],
});
if (existing !== 0) fail("Presentation proof document IDs are not clean.");
const previewSecretIdsBefore = new Set(
  await presentationPreviewSecretIds(sdk, presentationUrl, documentId),
);

const temporaryRoot = await mkdtemp(join(tmpdir(), "sanity-presentation-"));
const observationPath = join(temporaryRoot, "observation.json");
const screenshotPath = join(temporaryRoot, "studio.png");
const reportPath = join(temporaryRoot, "playwright-report.json");
let artifactDirectory: string | undefined;
let receiptWritten = false;
try {
  const child = runChild(
    process.execPath,
    [
      "x",
      "playwright",
      "test",
      "e2e/sanity-presentation.spec.ts",
      "--project=desktop-chrome",
      "--reporter=json",
    ],
    {
      cwd: resolve(repositoryRoot, "apps/web"),
      env: {
        ...process.env,
        CMS_E2E_BASE_URL: previewOrigin,
        SANITY_PROJECT_ID: projectId,
        SANITY_DATASET: dataset,
        SANITY_STUDIO_URL: studioUrl,
        SANITY_PREVIEW_URL: previewUrl,
        SANITY_API_TOKEN: token,
        SANITY_PRESENTATION_PROOF_ID: documentId,
        SANITY_PRESENTATION_URL_TEMPLATE: presentationUrlTemplate,
        SANITY_PRESENTATION_STORAGE_STATE: storageStatePath,
        SANITY_PRESENTATION_OBSERVATION_PATH: observationPath,
        SANITY_PRESENTATION_SCREENSHOT_PATH: screenshotPath,
      },
    },
  );
  const { exitCode, stdout, stderr } = await child;
  if (exitCode !== 0) {
    const safeFailure = redactBrowserFailure(stderr, token);
    if (safeFailure) process.stderr.write(`${safeFailure}\n`);
    fail("Sanity Presentation browser proof failed; no receipt was written.");
  }
  const report = parsePlaywrightReport(stdout);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const observation = parseSanityPresentationObservation(
    parseJson(
      await readFile(observationPath, "utf8"),
      "Presentation observation",
    ),
    {
      projectId,
      dataset,
      documentId,
      studioUrl,
      previewUrl,
      allowProduction,
    },
  );

  const remainingDocuments = await sdk.fetch<number>(`count(*[_id in $ids])`, {
    ids: [publishedId, draftId],
  });
  if (remainingDocuments !== 0) {
    fail("Presentation source-document cleanup was not proven.");
  }
  const previewSecretIdsAfter = await presentationPreviewSecretIds(
    sdk,
    presentationUrl,
    documentId,
  );
  if (previewSecretIdsAfter.some((id) => !previewSecretIdsBefore.has(id))) {
    fail("Presentation preview-secret cleanup was not proven.");
  }

  artifactDirectory = resolve(
    evidenceRoot,
    `sanity-presentation-${documentId}`,
  );
  await mkdir(artifactDirectory);
  const finalReportPath = join(artifactDirectory, "playwright-report.json");
  const finalScreenshotPath = join(artifactDirectory, "studio.png");
  await copyFile(reportPath, finalReportPath);
  await copyFile(screenshotPath, finalScreenshotPath);
  const receipt = createSanityPresentationReceipt({
    observation,
    gitCommit,
    hostedReceiptPath: repositoryPath(hostedReceiptPath),
    hostedReceiptSha256: sha256(hostedReceiptBytes),
    hostedReceiptGitCommit: hostedReceipt.gitCommit,
    artifacts: [
      {
        kind: "playwright-report",
        path: repositoryPath(finalReportPath),
        sha256: sha256(await readFile(finalReportPath)),
      },
      {
        kind: "screenshot",
        path: repositoryPath(finalScreenshotPath),
        sha256: sha256(await readFile(finalScreenshotPath)),
      },
    ],
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  receiptWritten = true;
  console.log(
    JSON.stringify(
      {
        status: receipt.status,
        receipt: repositoryPath(outputPath),
        artifacts: receipt.artifacts.map(({ kind, path }) => ({ kind, path })),
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
  if (artifactDirectory && !receiptWritten) {
    await rm(artifactDirectory, { recursive: true, force: true });
  }
}

function parsePlaywrightReport(stdout: string) {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    fail("Playwright did not emit a valid JSON report.");
  }
  if (!isRecord(value) || !Array.isArray(value.suites)) {
    fail("Playwright report is malformed.");
  }
  const specs = collectSpecs(value.suites);
  if (specs.length !== 1)
    fail("Presentation proof must contain exactly one spec.");
  const spec = specs[0];
  if (
    !isRecord(spec) ||
    spec.title !== "proves the authenticated visual-editing contract" ||
    !Array.isArray(spec.tests) ||
    spec.tests.length !== 1
  ) {
    fail("Playwright report does not contain the exact Presentation spec.");
  }
  const result = spec.tests[0];
  if (
    !isRecord(result) ||
    result.projectName !== "desktop-chrome" ||
    result.expectedStatus !== "passed" ||
    !Array.isArray(result.results) ||
    !result.results.some(
      (entry) => isRecord(entry) && entry.status === "passed",
    )
  ) {
    fail("Playwright Presentation spec did not pass exactly as expected.");
  }
  return value;
}

function collectSpecs(suites: unknown[]): unknown[] {
  const specs: unknown[] = [];
  for (const suite of suites) {
    if (!isRecord(suite)) continue;
    if (Array.isArray(suite.specs)) specs.push(...suite.specs);
    if (Array.isArray(suite.suites)) specs.push(...collectSpecs(suite.suites));
  }
  return specs;
}

function cleanGitCommit() {
  const status = runGit(["status", "--porcelain"]);
  if (status.trim())
    fail("Presentation receipt requires a clean Git checkout.");
  const commit = runGit(["rev-parse", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/.test(commit))
    fail("Unable to resolve a full Git commit.");
  return commit;
}

function isGitIgnored(path: string) {
  const result = spawnSync("git", ["check-ignore", "--quiet", path], {
    cwd: repositoryRoot,
    stdio: "ignore",
  });
  return result.status === 0;
}

function runGit(arguments_: string[]) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) fail("Git provenance check failed.");
  return result.stdout;
}

function runChild(
  command: string,
  arguments_: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>(
    (resolvePromise, reject) => {
      const child = spawn(command, arguments_, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (code) =>
        resolvePromise({ exitCode: code ?? 1, stdout, stderr }),
      );
    },
  );
}

function assertStorageStateScope(serialized: string, studioOrigin: string) {
  const value = parseJson(serialized, "Sanity browser storage state");
  if (!isRecord(value)) fail("Sanity browser storage state is malformed.");
  const hostname = new URL(studioOrigin).hostname;
  const cookies = Array.isArray(value.cookies) ? value.cookies : [];
  const origins = Array.isArray(value.origins) ? value.origins : [];
  const scoped =
    cookies.some(
      (cookie) =>
        isRecord(cookie) &&
        typeof cookie.domain === "string" &&
        hostname.endsWith(cookie.domain.replace(/^\./, "")),
    ) ||
    origins.some(
      (origin) => isRecord(origin) && origin.origin === studioOrigin,
    );
  if (!scoped)
    fail("Browser storage state is not scoped to the Studio origin.");
}

function parseJson(serialized: string, label: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    fail(`${label} is not valid JSON.`);
  }
}

function redactBrowserFailure(stderr: string, token: string) {
  return stderr
    .replaceAll(token, "[REDACTED_TOKEN]")
    .replace(/https?:\/\/[^\s"']+/g, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}${url.search ? "?[REDACTED_QUERY]" : ""}`;
      } catch {
        return "[REDACTED_URL]";
      }
    })
    .slice(0, 4_000)
    .trim();
}

async function presentationPreviewSecretIds(
  client: ReturnType<typeof createClient>,
  presentationUrl: string,
  proofId: string,
) {
  const expectedOrigin = new URL(presentationUrl).origin;
  const records = await client.fetch<
    Array<{ _id: string; source?: string; studioUrl?: string }>
  >(
    `*[_type == "sanity.previewUrlSecret" && source == "sanity/presentation"]{_id, source, studioUrl}`,
  );
  return records
    .filter((record) =>
      isProofPresentationUrl(record.studioUrl, expectedOrigin, proofId),
    )
    .map((record) => record._id);
}

function isProofPresentationUrl(
  value: string | undefined,
  expectedOrigin: string,
  proofId: string,
) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const route = decodeURIComponent(`${url.pathname}${url.search}${url.hash}`);
    return url.origin === expectedOrigin && route.includes(proofId);
  } catch {
    return false;
  }
}

function evidencePath(value: string) {
  const path = resolve(repositoryRoot, value);
  if (!isBelow(evidenceRoot, path)) {
    fail("Evidence path must stay below docs/releases/evidence/.");
  }
  return path;
}

function isBelow(root: string, path: string) {
  const child = relative(root, path);
  return child !== "" && !child.startsWith("..") && !isAbsolute(child);
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

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function httpsOrigin(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be an absolute HTTPS URL.`);
  }
  if (url.protocol !== "https:") fail(`${name} must use HTTPS.`);
  return url.origin;
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
