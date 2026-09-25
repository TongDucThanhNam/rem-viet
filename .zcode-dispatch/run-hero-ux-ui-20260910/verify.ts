// Interaction verification: keyboard focus, CTA navigation, reduced-motion.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const outDir =
  "C:/Users/terasumi/Documents/source_code/rem-viet/.zcode-dispatch/run-hero-ux-ui-20260910/screenshots/verify";
mkdirSync(outDir, { recursive: true });
const results: string[] = [];
const log = (s: string) => {
  results.push(s);
  console.log(s);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });

// --- 1. Keyboard focus + CTA navigation (desktop) ---
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:4313/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loader", { state: "hidden", timeout: 90000 });
  await page.waitForTimeout(2800);

  // Tab from the top of the document until the primary CTA receives focus
  // (real keyboard path → :focus-visible applies).
  let primaryFocused = false;
  for (let i = 0; i < 30 && !primaryFocused; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
    primaryFocused = await page.evaluate(
      () =>
        document.activeElement ===
        document.querySelector(".hero-new-actions a:first-child"),
    );
  }
  log(`primary CTA keyboard-focusable: ${primaryFocused}`);
  await page.screenshot({ path: `${outDir}/focus-primary.png` });

  // Activate primary → Lenis smooth-scrolls to #order (curtain footer).
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3200);
  const nav = await page.evaluate(() => {
    const order = document.getElementById("order");
    const rect = order?.getBoundingClientRect();
    return {
      scrollY: Math.round(window.scrollY),
      docHeight: document.documentElement.scrollHeight,
      orderInCurtain: Boolean(order?.classList.contains("curtain-footer")),
      nearBottom:
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 40,
    };
  });
  log(`after Enter on primary: ${JSON.stringify(nav)}`);
  await page.screenshot({ path: `${outDir}/after-primary-click.png` });
  await ctx.close();
}

// --- 2. Reduced motion / static visibility (desktop, reduced) ---
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:4313/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loader", { state: "hidden", timeout: 90000 });
  await page.waitForTimeout(1200);
  const visible = await page.evaluate(() => {
    const check = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return "missing";
      const s = getComputedStyle(el);
      return s.opacity === "1" || s.opacity === "" ? "visible" : `opacity=${s.opacity}`;
    };
    return {
      kicker: check(".hero-new-kicker"),
      title: check(".hero-new-title"),
      desc: check(".hero-new-content > p:not(.hero-new-kicker)"),
      actions: check(".hero-new-actions"),
      features: check(".hero-features-bar"),
      kickerUnderline: getComputedStyle(
        document.querySelector(".hero-new-kicker"),
      ).getPropertyValue("--kicker-underline-w"),
    };
  });
  log(`reduced-motion visibility: ${JSON.stringify(visible)}`);
  await page.screenshot({ path: `${outDir}/reduced-motion.png` });
  await ctx.close();
}

// --- 3. Mobile tap targets ---
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:4313/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loader", { state: "hidden", timeout: 90000 });
  await page.waitForTimeout(2000);
  const sizes = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".hero-new-actions a"),
    ).map((a) => ({
      label: a.textContent?.trim().slice(0, 20),
      w: a.offsetWidth,
      h: a.offsetHeight,
    }));
  });
  log(`mobile CTA sizes: ${JSON.stringify(sizes)}`);
  await ctx.close();
}

await browser.close();
console.log("VERIFY DONE");
