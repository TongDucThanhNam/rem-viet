import { expect, test } from "@playwright/test";

test("selects, edits, and undoes canonical Atelier content", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("h1")).toHaveText("Atelier Index");
  await page.locator('[data-atelier-id="home-story"]').click();
  await expect(page.locator("output")).toContainText("home-story");

  await page.getByRole("button", { name: "Edit masthead" }).click();
  await expect(page.locator("h1")).toHaveText("Atelier Browser Edition");
  await expect(page.locator("[data-document-version]")).toHaveAttribute(
    "data-document-version",
    "1",
  );

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("h1")).toHaveText("Atelier Index");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
