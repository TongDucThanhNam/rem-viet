import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { parse } from "dotenv";

import {
  clientForbiddenEnvironmentKeys,
  findClientSecretExposures,
  privateEnvironmentCandidates,
  type ClientArtifact,
} from "./client-secret-audit-lib";
import { repoRoot } from "./site-lib";

const clientRoot = resolve(repoRoot, "apps/web/dist/client");
const privateEnvPaths = [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
  resolve(repoRoot, "packages/infra/.env"),
];

async function readEnvironment(path: string) {
  try {
    return parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function collectArtifacts(directory: string): Promise<ClientArtifact[]> {
  const artifacts: ClientArtifact[] = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...(await collectArtifacts(path)));
    } else if (entry.isFile()) {
      artifacts.push({
        path: relative(clientRoot, path).replaceAll("\\", "/"),
        contents: await readFile(path),
      });
    }
  }

  return artifacts;
}

const environments = await Promise.all(privateEnvPaths.map(readEnvironment));
const privateValues = privateEnvironmentCandidates([
  process.env,
  ...environments,
]);

let artifacts: ClientArtifact[];
try {
  artifacts = await collectArtifacts(clientRoot);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new Error(
      "Client build artifacts are missing; run apps/web build before the secret audit.",
    );
  }
  throw error;
}

if (artifacts.length === 0) {
  throw new Error("Client build artifact directory is empty.");
}

const exposures = findClientSecretExposures(artifacts, privateValues);
if (exposures.length > 0) {
  const safeDetails = exposures
    .map((exposure) => `${exposure.key} (${exposure.type}) in ${exposure.path}`)
    .join("\n");
  throw new Error(
    `Client build contains server-only configuration:\n${safeDetails}\nPrivate values were not printed.`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      filesScanned: artifacts.length,
      privateEnvironmentKeysCovered: clientForbiddenEnvironmentKeys.length,
      configuredPrivateValuesScanned: privateValues.length,
      exposures: 0,
    },
    null,
    2,
  ),
);
