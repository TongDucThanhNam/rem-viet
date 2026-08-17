import { expect, test } from "@playwright/test";

import { expectNoAutomatedAccessibilityViolations } from "./accessibility";

test("public shell has essential accessibility semantics and no overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  expect(
    await page.locator("img:not([alt])").evaluateAll((images) => images.length),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.waitForFunction(
    () => !document.body.classList.contains("is-loading"),
  );
  await expectNoAutomatedAccessibilityViolations(page, "Public homepage");
});

test("contact form remains keyboard reachable with explicit labels", async ({
  page,
}) => {
  await page.goto("/lien-he");
  for (const label of ["Họ và tên", "Email", "Số điện thoại", "Nội dung"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await expect(page.getByRole("button", { name: /Gửi/ })).toBeEnabled();
  await expectNoAutomatedAccessibilityViolations(page, "Public contact form");
});
