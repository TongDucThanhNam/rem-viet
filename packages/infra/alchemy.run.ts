import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input, init) => {
  if (!init || !("dispatcher" in init)) {
    return nativeFetch(input, init);
  }

  const initWithoutDispatcher = { ...init };
  delete (initWithoutDispatcher as { dispatcher?: unknown }).dispatcher;
  return nativeFetch(input, initWithoutDispatcher);
}) satisfies typeof fetch;

const { default: alchemy } = await import("alchemy");
const { TanStackStart, D1Database, R2Bucket } = await import("alchemy/cloudflare");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, "apps/web/.env") });

const app = await alchemy("rem-viet", { rootDir: repoRoot });
const migrationsDir = resolve(
  repoRoot,
  "packages/db/src/migrations",
);
const postsSeedFile = "packages/db/seeds/posts.sql";

const db = await D1Database("database", {
  migrationsDir,
  importFiles: [postsSeedFile],
  adopt: true,
});
const productImages =
  process.env.DISABLE_R2_BINDING === "1"
    ? undefined
    : await R2Bucket("product-images", {
        name: "rem-viet-product-images",
        adopt: true,
      });

const optionalEnv = (name: string) => process.env[name]?.trim() ?? "";
const optionalSecret = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? alchemy.secret(value, name) : "";
};

export const web = await TanStackStart("web", {
  cwd: resolve(repoRoot, "apps/web"),
  bindings: {
    DB: db,
    ...(productImages ? { PRODUCT_IMAGES: productImages } : {}),
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    ADMIN_EMAILS: alchemy.env.ADMIN_EMAILS!,
    TELEGRAM_BOT_TOKEN: optionalSecret("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_CHAT_ID: optionalEnv("TELEGRAM_CHAT_ID"),
    JSONLINK_API_KEY: optionalSecret("JSONLINK_API_KEY"),
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
