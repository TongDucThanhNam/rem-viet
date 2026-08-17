import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const siteId = process.env.SITE_ID?.trim() ?? "";
if (siteId && !/^[a-z][a-z0-9-]{1,62}$/.test(siteId)) {
  throw new Error("SITE_ID must be a safe site slug.");
}
const manifestPath = fileURLToPath(
  siteId
    ? new URL(`../../sites/${siteId}/site.manifest.json`, import.meta.url)
    : new URL("../../site.manifest.json", import.meta.url),
);
if (!existsSync(manifestPath)) {
  throw new Error(`Site manifest not found: ${manifestPath}`);
}
const selectedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const asyncHooksShimPath = fileURLToPath(
  new URL("./src/shims/node-async-hooks.ts", import.meta.url),
);

export default defineConfig({
  define: {
    __SITE_MANIFEST__: JSON.stringify(selectedManifest),
  },
  server: {
    port: 3001,
  },
  build: {
    rollupOptions: {
      // Resolved by workerd at runtime; Node builds cannot bundle it.
      external: ["cloudflare:workers"],
    },
  },
  optimizeDeps: {
    exclude: ["@tanstack/start-client-core", "@tanstack/start-storage-context"],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    {
      name: "browser-node-async-hooks-shim",
      enforce: "pre",
      resolveId(id, _importer, options) {
        if (
          (id === "node:async_hooks" || id === "async_hooks") &&
          !options.ssr
        ) {
          return asyncHooksShimPath;
        }
        return null;
      },
    },
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
