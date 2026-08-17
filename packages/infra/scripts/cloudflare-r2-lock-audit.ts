import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

import { resolveCloudflareAuth } from "../src/cloudflare-auth";
import { assertR2ObjectLock } from "../src/cloudflare-r2-lock";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, "packages/infra/.env"), quiet: true });
config({ path: resolve(repoRoot, ".env"), quiet: true });

const argument = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};

const bucket = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,62}$/)
  .parse(argument("bucket"));
const objectKey = z.string().min(3).max(512).parse(argument("object-key"));
const minimumRetentionDays = Number.parseInt(
  argument("minimum-days") ?? "90",
  10,
);
const profile = argument("profile");
if (profile) process.env.ALCHEMY_PROFILE = profile;
const authSource = z
  .enum(["auto", "environment", "alchemy"])
  .parse(
    argument("auth-source") ??
      (process.argv.includes("--prefer-alchemy") ? "alchemy" : "auto"),
  );

const { accountId, auth } = await resolveCloudflareAuth({
  accountId: argument("account-id"),
  source: authSource,
});
const url = new URL(
  `/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/lock`,
  "https://api.cloudflare.com",
);
const response = await fetch(url, {
  headers: auth.headers,
  signal: AbortSignal.timeout(15_000),
});
const body = (await response.json()) as {
  success?: unknown;
  result?: unknown;
  errors?: Array<{ code?: unknown }>;
};
if (!response.ok || body.success !== true) {
  const codes = (body.errors ?? [])
    .map((error) => error.code)
    .filter((code): code is string | number =>
      ["string", "number"].includes(typeof code),
    );
  const suffix = codes.length > 0 ? ` (codes: ${codes.join(", ")})` : "";
  throw new Error(
    `Cloudflare R2 lock audit failed (HTTP ${response.status})${suffix}. The credential needs R2 bucket configuration read permission.`,
  );
}

const protection = assertR2ObjectLock({
  result: body.result,
  objectKey,
  minimumRetentionDays,
});
console.log(
  JSON.stringify({
    ok: true,
    bucket,
    objectKey,
    minimumRetentionDays,
    ...protection,
  }),
);
