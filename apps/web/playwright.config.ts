import { defineConfig, devices } from "@playwright/test";

const usesExternalCredentials = Boolean(process.env.CMS_E2E_PASSWORD);

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  // CMS scenarios intentionally share one seeded site and exercise publish,
  // restore, scheduling and cleanup. Serial workers prevent cross-test writes
  // from racing against the same D1 page state (locally and on staging).
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.CMS_E2E_BASE_URL || "http://127.0.0.1:3020",
    storageState: process.env.SANITY_PRESENTATION_STORAGE_STATE || undefined,
    // Hosted credentials must never be retained in trace/screenshot artifacts.
    // Local isolated fixtures keep rich debugging output.
    trace: usesExternalCredentials ? "off" : "retain-on-failure",
    screenshot: usesExternalCredentials ? "off" : "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: process.env.CMS_E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CMS_E2E_PRODUCTION_SERVER
          ? "bun run --cwd ../.. serve:e2e"
          : "bun run dev:bare --host 127.0.0.1 --port 3020",
        url: "http://127.0.0.1:3020/api/health",
        timeout: 120_000,
        reuseExistingServer: false,
      },
});
