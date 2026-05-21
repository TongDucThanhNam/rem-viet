import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { D1Database } from "alchemy/cloudflare";
import { R2Bucket } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("rem-viet");
const migrationsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../packages/db/src/migrations",
);

const db = await D1Database("database", {
  migrationsDir,
});
const productImages = await R2Bucket("product-images", {
  name: "rem-viet-product-images",
});

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    DB: db,
    PRODUCT_IMAGES: productImages,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    ADMIN_EMAILS: alchemy.env.ADMIN_EMAILS!,
    TELEGRAM_BOT_TOKEN: alchemy.secret.env.TELEGRAM_BOT_TOKEN ?? "",
    TELEGRAM_CHAT_ID: alchemy.env.TELEGRAM_CHAT_ID ?? "",
    JSONLINK_API_KEY: alchemy.secret.env.JSONLINK_API_KEY ?? "",
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
