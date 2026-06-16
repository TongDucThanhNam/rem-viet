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
const asyncHooksShimPath = fileURLToPath(
  new URL("./src/shims/node-async-hooks.ts", import.meta.url),
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
  optimizeDeps: {
    exclude: ["@tanstack/start-client-core", "@tanstack/start-storage-context"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: cloudflareWorkersAlias,
  },
  plugins: [
    {
      name: "browser-node-async-hooks-shim",
      enforce: "pre",
      resolveId(id, _importer, options) {
        if ((id === "node:async_hooks" || id === "async_hooks") && !options.ssr) {
          return asyncHooksShimPath;
        }
        return null;
      },
    },
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    ...(cloudflareConfigPath ? [alchemy({ configPath: cloudflareConfigPath })] : []),
  ],
});
