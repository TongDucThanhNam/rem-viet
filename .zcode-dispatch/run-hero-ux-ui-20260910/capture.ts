// Capture hero screenshots at the required viewports (before/after edits).
// Usage: bun capture.ts <before|after>
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const label = process.argv[2] ?? "before";
const outDir = `C:/Users/terasumi/Documents/source_code/rem-viet/.zcode-dispatch/run-hero-ux-ui-20260910/screenshots/${label}`;
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-375x667", width: 375, height: 667 },
  { name: "landscape-844x390", width: 844, height: 390 },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4313/", { waitUntil: "domcontentloaded" });
  // Loader hides itself (display:none) when the GSAP reveal completes.
  // In vite dev the module graph is heavy, so allow a long timeout.
  await page.waitForSelector("#loader", { state: "hidden", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/${vp.name}.png` });

  // Overflow check.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement.scrollWidth,
    innerWidth: window.innerWidth,
    heroOverflows:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  console.log(vp.name, JSON.stringify(overflow));
  await context.close();
}

await browser.close();
console.log("done:", label);
