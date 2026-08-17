import { cloudflare } from "@cloudflare/vite-plugin";
import { mergeConfig } from "vite";

import baseConfig from "./vite.config.ts";

// Wrangler-only local E2E build. Production and normal development load
// vite.config.ts through Alchemy, which injects its own Cloudflare plugin.
export default mergeConfig(
  {
    plugins: [cloudflare({ viteEnvironment: { name: "ssr" } })],
  },
  baseConfig,
);
