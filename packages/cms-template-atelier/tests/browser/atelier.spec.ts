import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function reachWithKeyboard(
  page: import("@playwright/test").Page,
  target: import("@playwright/test").Locator,
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(
    "Keyboard focus did not reach the requested Field v2 control.",
  );
}

function seriousOrCritical(
  results: Awaited<ReturnType<AxeBuilder["analyze"]>>,
) {
  return results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
}

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

test("generated Field v2 controls are responsive and axe-clean", async ({
  page,
}) => {
  await page.goto("/?fixture=fields");
  await expect(
    page.getByRole("heading", { name: "Create Field v2 record" }),
  ).toBeVisible();
  expect(seriousOrCritical(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
  await page.getByRole("tab", { name: "Publishing" }).press("Enter");
  await page.getByText("Structured content", { exact: true }).press("Enter");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(seriousOrCritical(await new AxeBuilder({ page }).analyze())).toEqual(
    [],
  );
});

test("generated Field v2 authoring completes with keyboard only", async ({
  page,
}) => {
  await page.goto("/?fixture=fields");
  const identityTab = page.getByRole("tab", { name: "Identity" });
  await reachWithKeyboard(page, identityTab);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Publishing" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Publishing" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(identityTab).toBeFocused();

  const title = page.getByLabel("Title", { exact: true });
  await reachWithKeyboard(page, title);
  await page.keyboard.type("Atelier Field Proof");
  const email = page.getByLabel("Email", { exact: true });
  await reachWithKeyboard(page, email);
  await page.keyboard.type("editor@example.com");
  const slug = page.getByLabel("Slug", { exact: true });
  await reachWithKeyboard(page, slug);
  await page.keyboard.type("atelier-field-proof");

  const publishingTab = page.getByRole("tab", { name: "Publishing" });
  await reachWithKeyboard(page, identityTab);
  await page.keyboard.press("ArrowRight");
  await expect(publishingTab).toBeFocused();
  const author = page.getByLabel("Author", { exact: true });
  await reachWithKeyboard(page, author);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(author).toHaveValue("author-ada");

  const addContributor = page.getByRole("button", {
    name: "Add Contributors row",
  });
  await reachWithKeyboard(page, addContributor);
  await page.keyboard.press("Enter");
  const contributorName = page.getByLabel("Contributor name", { exact: true });
  await reachWithKeyboard(page, contributorName);
  await page.keyboard.type("Grace Hopper");

  const create = page.getByRole("button", { name: "Create", exact: true });
  await reachWithKeyboard(page, create);
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-field-v2-save-status]")).toHaveText(
    "Saved Atelier Field Proof",
  );
});
