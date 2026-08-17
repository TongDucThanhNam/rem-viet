import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const authenticationRoot = resolve(repositoryRoot, ".playwright/.auth");
const studioUrl = requiredEnvironment("SANITY_STUDIO_URL");
const parsedStudioUrl = new URL(studioUrl);
if (parsedStudioUrl.protocol !== "https:") {
  throw new Error("SANITY_STUDIO_URL must use HTTPS for auth capture.");
}
const requestedOutput =
  flagValue("--output") ?? ".playwright/.auth/sanity.json";
const outputPath = resolve(repositoryRoot, requestedOutput);
const relativeOutput = relative(authenticationRoot, outputPath);
if (
  relativeOutput === "" ||
  relativeOutput.startsWith("..") ||
  isAbsolute(relativeOutput)
) {
  throw new Error("Auth state output must stay below .playwright/.auth/.");
}
try {
  await stat(outputPath);
  throw new Error(
    "Auth state already exists; remove it explicitly to recapture.",
  );
} catch (error) {
  if (!isRecord(error) || error.code !== "ENOENT") throw error;
}
await mkdir(dirname(outputPath), { recursive: true });

console.log(
  "A visible Chrome window will open. Sign in to the exact Sanity Studio, confirm Presentation is accessible, then close the browser window.",
);
const exitCode = await new Promise<number>((resolvePromise, reject) => {
  const child = spawn(
    process.execPath,
    ["x", "playwright", "codegen", `--save-storage=${outputPath}`, studioUrl],
    {
      cwd: resolve(repositoryRoot, "apps/web"),
      env: process.env,
      stdio: "inherit",
      windowsHide: false,
    },
  );
  child.once("error", reject);
  child.once("close", (code) => resolvePromise(code ?? 1));
});
if (exitCode !== 0) {
  throw new Error("Sanity browser authentication capture failed.");
}
await stat(outputPath);
console.log(
  JSON.stringify(
    {
      status: "captured",
      storageState: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
      warning:
        "This file contains authenticated browser state and must remain Git-ignored.",
    },
    null,
    2,
  ),
);

function flagValue(name: string) {
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith(`${name}=`));
  return argument?.slice(name.length + 1).trim() || undefined;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
