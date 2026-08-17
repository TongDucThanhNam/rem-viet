import { argument, readSiteManifest } from "./site-lib";

const site = argument("site") ?? "";
if (!site) throw new Error("Thiếu --site=<client-slug>.");
const { source } = await readSiteManifest(site);

const child = Bun.spawn(["bun", "run", "--cwd", "apps/web", "build"], {
  env: { ...Bun.env, SITE_ID: source === "root" ? "" : site },
  stderr: "inherit",
  stdout: "inherit",
});
const exitCode = await child.exited;
if (exitCode !== 0) process.exitCode = exitCode;
