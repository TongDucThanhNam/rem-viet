import { createClient } from "@sanity/client";
import type { CmsBlock } from "@agency/cms-core";
import type { CmsPageContent } from "@agency/cms-runtime";
import { spawnSync } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SANITY_RECOMMENDED_API_VERSION, type SanityClientPort } from "../src";
import {
  requiredSanityHostedConfirmation,
  runSanityHostedConformance,
} from "../src/hosted-conformance";

type ProofContent = CmsPageContent<CmsBlock>;

const args = process.argv.slice(2);
const knownFlags = new Set([
  "--allow-production",
  "--apply",
  "--confirmation",
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
const confirmation = requiredSanityHostedConfirmation({
  projectId,
  dataset,
  documentId,
  allowProduction,
});

if (!apply) {
  console.log(
    JSON.stringify(
      {
        status: "dry-run",
        mutatesDataset: false,
        writesReceipt: false,
        scope: { projectId, dataset, documentId },
        requiredConfirmation: confirmation,
        applyCommand:
          'bun run cms:sanity:hosted --apply --id="<same-id>" --confirmation="<required-confirmation>"',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const suppliedConfirmation = requiredFlag("--confirmation");
if (suppliedConfirmation !== confirmation) {
  fail(`Hosted Sanity verification requires: ${confirmation}`);
}
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const evidenceRoot = resolve(repositoryRoot, "docs/releases/evidence");
const requestedOutput = flagValue("--output");
const outputPath = requestedOutput
  ? resolve(repositoryRoot, requestedOutput)
  : resolve(evidenceRoot, `sanity-hosted-${documentId}.json`);
const evidenceRelativePath = relative(evidenceRoot, outputPath);
if (
  evidenceRelativePath === "" ||
  evidenceRelativePath.startsWith("..") ||
  isAbsolute(evidenceRelativePath)
) {
  fail("Receipt output must be a file below docs/releases/evidence/.");
}
try {
  await stat(outputPath);
  fail("Receipt output already exists; choose a fresh document id or output.");
} catch (error) {
  if (!isRecord(error) || error.code !== "ENOENT") throw error;
}
const gitCommit = cleanGitCommit(repositoryRoot);
const token = requiredEnvironment("SANITY_API_TOKEN");
const sdk = createClient({
  projectId,
  dataset,
  token,
  apiVersion: SANITY_RECOMMENDED_API_VERSION,
  perspective: "raw",
  useCdn: false,
});
const sdkFetch: SanityClientPort["fetch"] = (query, params, options) =>
  sdk.fetch(query, params, options as never) as never;
const client: SanityClientPort = {
  config: () => {
    const configured = sdk.config();
    return {
      dataset: configured.dataset,
      projectId: configured.projectId,
    };
  },
  fetch: sdkFetch,
  request: (input) => sdk.request(input),
};
const allowOrigins = (
  process.env.SANITY_PRESENTATION_ALLOW_ORIGINS ?? previewUrl
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const receipt = await runSanityHostedConformance({
  client,
  projectId,
  dataset,
  documentId,
  actorId: "hosted-conformance",
  confirmation: suppliedConfirmation,
  content: proofContent(),
  parseContent: parseProofContent,
  studioUrl,
  previewUrl,
  allowOrigins,
  gitCommit,
  allowProduction,
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      receipt: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
    },
    null,
    2,
  ),
);

function proofContent(): ProofContent {
  return {
    title: "Hosted Sanity conformance proof",
    slug: `sanity-proof-${documentId}`,
    template: "landing",
    seo: {
      title: "Hosted Sanity conformance proof",
      description: "Disposable two-block provider proof.",
      canonicalUrl: previewUrl,
      ogImage: `${new URL(previewUrl).origin}/sanity-proof.jpg`,
      robotsIndex: false,
      robotsFollow: false,
    },
    blocks: [
      {
        id: "hero-proof",
        type: "hero",
        schemaVersion: 1,
        enabled: true,
        data: { title: "Sanity hosted proof" },
      },
      {
        id: "faq-proof",
        type: "faq",
        schemaVersion: 1,
        enabled: true,
        data: {
          items: [
            {
              id: "proof-question",
              question: "Does the hosted lifecycle pass?",
              answer: "This content is deleted before a receipt is written.",
            },
          ],
        },
      },
    ],
  };
}

function parseProofContent(value: unknown): ProofContent {
  if (!isRecord(value) || !Array.isArray(value.blocks)) {
    fail("Sanity returned malformed proof content.");
  }
  if (value.blocks.length !== 2) {
    fail("Sanity did not preserve the two-block proof model.");
  }
  return value as ProofContent;
}

function flagValue(name: string) {
  const matches = args
    .filter((argument) => argument.startsWith(`${name}=`))
    .map((argument) => argument.slice(name.length + 1));
  if (matches.length > 1) fail(`${name} may be provided only once.`);
  return matches[0]?.trim();
}

function requiredFlag(name: string) {
  const value = flagValue(name);
  if (!value) fail(`Missing required ${name}=... argument.`);
  return value;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required ${name} environment variable.`);
  return value;
}

function cleanGitCommit(repositoryRoot: string) {
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (status.status !== 0) fail("Git provenance check failed.");
  if (status.stdout.trim()) {
    fail("Hosted Sanity receipt requires a clean Git checkout.");
  }
  const commit = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (commit.status !== 0 || !/^[a-f0-9]{40}$/.test(commit.stdout.trim())) {
    fail("Unable to resolve a full Git commit.");
  }
  return commit.stdout.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}
