import { clientForbiddenEnvironmentKeys } from "./client-secret-audit-lib";
import { repoRoot } from "./site-lib";

async function run(command: string[], environment: Record<string, string>) {
  const child = Bun.spawn(command, {
    cwd: repoRoot,
    env: environment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${command.slice(0, 4).join(" ")} failed (${exitCode}).`);
  }
}

const canaryEnvironment = Object.fromEntries(
  clientForbiddenEnvironmentKeys.map((key) => [
    key,
    `client-boundary-canary/${key.toLowerCase()}/8f4d2c7a1b6e`,
  ]),
);
const environment = {
  ...process.env,
  ...canaryEnvironment,
} as Record<string, string>;

await run(["bun", "--cwd", "apps/web", "build"], environment);
await run(["bun", "scripts/audit-client-secrets.ts"], environment);
