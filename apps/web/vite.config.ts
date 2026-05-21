import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite";
const alchemyConfigPath = fileURLToPath(
  new URL("./.alchemy/local/wrangler.jsonc", import.meta.url),
);
const localWranglerConfigPath = fileURLToPath(new URL("./wrangler.jsonc", import.meta.url));
const cloudflareConfigPath = existsSync(localWranglerConfigPath)
  ? localWranglerConfigPath
  : existsSync(alchemyConfigPath)
    ? alchemyConfigPath
    : undefined;
const cloudflareWorkersShimPath = fileURLToPath(
  new URL("../../packages/env/src/cloudflare-local.ts", import.meta.url),
);
const cloudflareWorkersAlias: Record<string, string> = cloudflareConfigPath
  ? {}
  : {
      "cloudflare:workers": cloudflareWorkersShimPath,
    };

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
    alias: cloudflareWorkersAlias,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    ...(cloudflareConfigPath ? [alchemy({ configPath: cloudflareConfigPath })] : []),
  ],
});
