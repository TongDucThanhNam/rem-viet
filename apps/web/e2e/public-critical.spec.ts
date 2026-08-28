import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const siteManifest = JSON.parse(
  readFileSync(new URL("../../../site.manifest.json", import.meta.url), "utf8"),
) as { siteUrl: string };

test("health, sitemap and private preview boundaries", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    checks: { database: "ok" },
    deployment: {
      siteId: "rem-viet",
      stage: "e2e",
      commit: "1111111111111111111111111111111111111111",
      inputSha256:
        "2222222222222222222222222222222222222222222222222222222222222222",
      sourceState: "clean",
    },
  });

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("<urlset");
  expect(xml).not.toContain("/admin");
  expect(xml).not.toContain("home-preview");

  await page.goto("/admin/home-preview");
  await expect(page).toHaveURL(/dang-nhap/);
});

test("homepage exposes validated theme structured data", async ({ page }) => {
  await page.goto("/");
  const json = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  const structuredData = JSON.parse(json ?? "null") as {
    "@context"?: string;
    "@type"?: string;
    name?: string;
    url?: string;
  };

  expect(structuredData).toMatchObject({
    "@context": "https://schema.org",
    "@type": "Store",
    name: "Rèm Vina",
    url: siteManifest.siteUrl,
  });
});

test("public admin registration stays closed at the UI and API", async ({
  page,
  request,
}) => {
  await page.goto("/dang-nhap");
  await expect(page.getByText("Không hỗ trợ đăng ký công khai.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng ký ngay" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /Đăng nhập bằng/u }),
  ).toHaveCount(0);

  const email = `closed-signup-${crypto.randomUUID()}@example.com`;
  const signup = await request.post("/api/auth/sign-up/email", {
    data: {
      email,
      name: "Closed signup probe",
      password: "blocked-signup-password",
    },
  });
  expect(signup.ok()).toBe(false);
  expect([400, 401, 403, 404, 422]).toContain(signup.status());

  const login = await request.post("/api/auth/sign-in/email", {
    data: { email, password: "blocked-signup-password" },
  });
  expect(login.ok()).toBe(false);
});

test("lead endpoint is durable and idempotent", async ({ request }) => {
  const idempotencyKey = `e2e-${crypto.randomUUID()}`;
  const headers = { "x-forwarded-for": `e2e-${crypto.randomUUID()}` };
  const payload = {
    formKey: "contact",
    payload: {
      name: "E2E QA",
      email: "e2e@example.com",
      phone: "",
      message: "Automated critical path",
    },
    sourcePage: "/lien-he",
    website: "",
    idempotencyKey,
  };
  const first = await request.post("/api/forms/submit", {
    data: payload,
    headers,
  });
  expect(first.status()).toBe(202);
  expect(await first.json()).toMatchObject({
    accepted: true,
    duplicate: false,
  });
  const second = await request.post("/api/forms/submit", {
    data: payload,
    headers,
  });
  expect(second.status()).toBe(202);
  expect(await second.json()).toMatchObject({
    accepted: true,
    duplicate: true,
  });
});

test("anonymous Web Vitals ingestion is bounded and idempotent", async ({
  request,
}) => {
  const origin = new URL(
    process.env.CMS_E2E_BASE_URL || "http://127.0.0.1:3020",
  ).origin;
  const payload = {
    schemaVersion: 1,
    id: `v5-${Date.now()}-${Math.floor(Math.random() * 8_999_999_999_999 + 1_000_000_000_000)}`,
    name: "LCP",
    value: 2_100,
    rating: "good",
    navigationType: "navigate",
    path: "/__synthetic__/e2e",
    deviceClass: "desktop",
  };
  const headers = { origin };
  const first = await request.post("/api/vitals", { data: payload, headers });
  const duplicate = await request.post("/api/vitals", {
    data: payload,
    headers,
  });
  expect(first.status()).toBe(202);
  expect(duplicate.status()).toBe(202);
  expect(await duplicate.json()).toEqual({ accepted: true });

  const invalid = await request.post("/api/vitals", {
    data: { ...payload, path: "/page?customer=secret" },
    headers,
  });
  expect(invalid.status()).toBe(400);

  const privatePath = await request.post("/api/vitals", {
    data: { ...payload, path: "/admin/performance" },
    headers,
  });
  expect(privatePath.status()).toBe(400);

  const crossOrigin = await request.post("/api/vitals", {
    data: { ...payload, id: payload.id.replace(/\d$/u, "8") },
    headers: { origin: "https://attacker.invalid" },
  });
  expect(crossOrigin.status()).toBe(403);
});
