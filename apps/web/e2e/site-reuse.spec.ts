import { expect, test } from "@playwright/test";

const expectedSiteId = process.env.CMS_E2E_EXPECTED_SITE_ID;
const expectedSiteName = process.env.CMS_E2E_EXPECTED_SITE_NAME;

test("site reuse selects the manifest, seed and deployment identity", async ({
  page,
  request,
}) => {
  test.skip(
    !expectedSiteId || !expectedSiteName,
    "The manifest-driven local harness supplies expected site identity.",
  );

  const health = await request.get("/api/health", { maxRetries: 2 });
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    checks: { database: "ok" },
    deployment: {
      siteId: expectedSiteId,
      stage: "e2e",
      sourceState: "clean",
    },
  });

  const webManifest = await request.get("/manifest.webmanifest", {
    maxRetries: 2,
  });
  expect(webManifest.status()).toBe(200);
  expect(await webManifest.json()).toMatchObject({
    name: expectedSiteName,
    short_name: expectedSiteName,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page).toHaveTitle(new RegExp(expectedSiteName!));
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    expectedSiteName!,
  );
  await expect(
    page.getByRole("link", { name: expectedSiteName! }),
  ).toBeVisible();
});
