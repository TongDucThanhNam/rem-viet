import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runPageProviderConformance } from "@agency/cms-runtime";
import { defaultRichTextBlock } from "@agency/cms-template-rem-viet";
import { defaultHomeBlocks, homeBlockSchema } from "@rem-viet/cms";

import { getHomeVisualFieldTargets } from "../src/lib/home-visual-editing";
import { expectNoAutomatedAccessibilityViolations } from "./accessibility";
import {
  createStagingPageProvider,
  type StagingStandardPageContent,
} from "./staging-page-provider";

const expectedVisualPathsByBlockType = new Map<string, string[]>(
  homeBlockSchema
    .array()
    .parse(defaultHomeBlocks)
    .map((block) => [
      block.type,
      getHomeVisualFieldTargets(block)
        .map((target) => target.path)
        .sort(),
    ]),
);
const expectedVisualControlIdsByBlockType = new Map<string, string[]>(
  homeBlockSchema
    .array()
    .parse(defaultHomeBlocks)
    .map((block) => [
      block.type,
      getHomeVisualFieldTargets(block)
        .map((target) => target.controlId)
        .sort(),
    ]),
);

const email = process.env.CMS_E2E_EMAIL;
const password = process.env.CMS_E2E_PASSWORD;
const totpSecret = process.env.CMS_E2E_TOTP_SECRET;
const editorEmail = process.env.CMS_E2E_EDITOR_EMAIL;
const editorPassword = process.env.CMS_E2E_EDITOR_PASSWORD;
const ownerEmail = process.env.CMS_E2E_OWNER_EMAIL;
const ownerPassword = process.env.CMS_E2E_OWNER_PASSWORD;
const ownerTotpSecret = process.env.CMS_E2E_OWNER_TOTP_SECRET;
const managedEmail = process.env.CMS_E2E_MANAGED_EMAIL;
const authStateDirectory = process.env.CMS_E2E_AUTH_STATE_DIR;
const authenticatedRole = process.env.CMS_E2E_ROLE ?? "admin";
type AuthCookie = Awaited<
  ReturnType<ReturnType<Page["context"]>["cookies"]>
>[number];
const authCookiesByEmail = new Map<string, AuthCookie[]>();

function authCookieStatePath(loginEmail: string) {
  if (!authStateDirectory) return undefined;
  const identity =
    loginEmail === email
      ? "admin"
      : loginEmail === editorEmail
        ? "editor"
        : loginEmail === ownerEmail
          ? "owner"
          : undefined;
  if (!identity) return undefined;
  return join(authStateDirectory, `playwright-${identity}-cookies.json`);
}

async function loadAuthCookies(loginEmail: string) {
  const cached = authCookiesByEmail.get(loginEmail);
  if (cached) return cached;
  const statePath = authCookieStatePath(loginEmail);
  if (!statePath) return undefined;
  try {
    const cookies = JSON.parse(await readFile(statePath, "utf8")) as unknown;
    if (!Array.isArray(cookies)) {
      throw new Error(`Invalid Playwright cookie state at ${statePath}.`);
    }
    const parsed = cookies as AuthCookie[];
    authCookiesByEmail.set(loginEmail, parsed);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function storeAuthCookies(page: Page, loginEmail: string) {
  const cookies = await page.context().cookies();
  authCookiesByEmail.set(loginEmail, cookies);
  const statePath = authCookieStatePath(loginEmail);
  if (statePath) {
    await writeFile(statePath, JSON.stringify(cookies), "utf8");
  }
}

function generateTotp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", Buffer.from(secret, "utf8"))
    .update(message)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (value % 1_000_000).toString().padStart(6, "0");
}

function totpSecretFor(loginEmail: string) {
  if (loginEmail === email) return totpSecret;
  if (loginEmail === ownerEmail) return ownerTotpSecret;
  return undefined;
}

async function waitForControlledInput(page: Page, selector: string) {
  await page.waitForFunction(
    (inputSelector) =>
      Boolean(
        (
          document.querySelector(inputSelector) as HTMLInputElement & {
            _valueTracker?: unknown;
          }
        )?._valueTracker,
      ),
    selector,
  );
}

async function login(page: Page, loginEmail: string, loginPassword: string) {
  const cachedCookies = await loadAuthCookies(loginEmail);
  if (cachedCookies) {
    await page.context().addCookies(cachedCookies);
    await page.goto("/admin/dashboard");
    await waitForAdminHydration(page);
    return;
  }

  await page.goto("/dang-nhap");
  await page.locator('form[data-auth-ready="true"]').waitFor();
  await page.getByLabel("Tên đăng nhập").fill(loginEmail);
  const passwordInput = page.getByRole("textbox", {
    name: "Mật khẩu",
    exact: true,
  });
  await passwordInput.fill(loginPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const loginError = page.locator('[data-sonner-toast][data-type="error"]');
  const outcome = await Promise.race([
    page
      .waitForURL(/(?:admin\/dashboard|xac-thuc-hai-lop)/, {
        timeout: 15_000,
      })
      .then(() => "navigated" as const),
    loginError
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => "rejected" as const),
    page.waitForTimeout(15_000).then(() => "timeout" as const),
  ]);
  if (outcome !== "navigated") {
    const message =
      outcome === "rejected"
        ? (await loginError.textContent())?.trim() || "provider rejected login"
        : "login did not return a result within 15 seconds";
    await passwordInput.fill("");
    throw new Error(`CMS sign-in failed: ${message}.`);
  }
  if (page.url().includes("/xac-thuc-hai-lop")) {
    const secret = totpSecretFor(loginEmail);
    if (!secret) {
      throw new Error(`Missing TOTP fixture for ${loginEmail}.`);
    }
    await waitForControlledInput(page, "#two-factor-code");
    await page.getByLabel("Mã xác thực").fill(generateTotp(secret));
    const trustDevice = page.getByRole("checkbox", {
      name: "Tin cậy thiết bị này trong 30 ngày",
    });
    await trustDevice.click();
    await expect(trustDevice).toBeChecked();
    await page.getByRole("button", { name: "Xác minh" }).click();
  }
  await expect(page).toHaveURL(/admin\/dashboard/);
  await waitForAdminHydration(page);
  await storeAuthCookies(page, loginEmail);
}

async function waitForAdminHydration(page: Page) {
  await page.locator('[data-admin-ready="true"]').waitFor();
}

async function revealAdminNavigation(page: Page) {
  const desktopExpand = page.getByRole("button", {
    name: "Mở rộng sidebar",
  });
  if (await desktopExpand.isVisible()) {
    await desktopExpand.click();
    return;
  }

  const mobileMenu = page.getByRole("button", { name: "Mở điều hướng" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
}

async function confirmAlertDialog(page: Page, confirmLabel: string) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
}

async function reachWithKeyboard(
  page: Page,
  target: Locator,
  direction: "forward" | "backward" = "forward",
  maxSteps = 240,
) {
  await target.waitFor({ state: "visible" });
  const key = direction === "forward" ? "Tab" : "Shift+Tab";

  for (let step = 0; step < maxSteps; step += 1) {
    await page.keyboard.press(key);
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }

  throw new Error(
    `Keyboard tab order did not reach target after ${maxSteps} ${direction} steps.`,
  );
}

async function cleanupInterruptedMediaFixtures(page: Page) {
  await page.goto("/admin/pages");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("tbody tr").length > 0 ||
      document.body.textContent?.includes("Chưa có trang nội dung"),
  );
  let stalePageRows = page
    .getByRole("row")
    .filter({ hasText: /Trang media E2E / });
  while ((await stalePageRows.count()) > 0) {
    const stalePageCount = await stalePageRows.count();
    const stalePageRow = stalePageRows.first();
    await stalePageRow
      .getByRole("button", { name: /^Xóa Trang media E2E / })
      .click();
    await confirmAlertDialog(page, "Xóa");
    await expect(
      page.getByText("Đã xóa trang.", { exact: true }),
    ).toBeVisible();
    await expect(stalePageRows).toHaveCount(stalePageCount - 1);
    stalePageRows = page
      .getByRole("row")
      .filter({ hasText: /Trang media E2E / });
  }

  await page.goto("/admin/media");
  await page.waitForFunction(
    () =>
      document.querySelector("[data-media-item]") !== null ||
      document.body.textContent?.includes("Chưa có media"),
  );
  async function findStaleMediaItem() {
    const mediaItems = page.locator("[data-media-item]");
    for (let index = 0; index < (await mediaItems.count()); index += 1) {
      const mediaItem = mediaItems.nth(index);
      const altInput = mediaItem.getByLabel(/Văn bản thay thế cho/);
      if ((await altInput.inputValue()).startsWith("Ảnh kiểm thử ")) {
        return mediaItem;
      }
    }
    return null;
  }

  let staleMediaItem = await findStaleMediaItem();
  while (staleMediaItem) {
    const staleAltLabel = await staleMediaItem
      .getByLabel(/Văn bản thay thế cho/)
      .getAttribute("aria-label");
    expect(staleAltLabel).not.toBeNull();
    await staleMediaItem.getByRole("button", { name: /Xóa media/ }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(
      page.getByText("Đã xóa media.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(staleAltLabel!)).toHaveCount(0);
    staleMediaItem = await findStaleMediaItem();
  }
}

async function cleanupInterruptedStandardPageFixtures(page: Page) {
  await page.goto("/admin/pages");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("tbody tr").length > 0 ||
      document.body.textContent?.includes("Chưa có trang nội dung"),
  );
  let staleRows = page
    .getByRole("row")
    .filter({ hasText: /Standard provider [0-9a-f]{8}/ });
  while ((await staleRows.count()) > 0) {
    const staleCount = await staleRows.count();
    const staleRow = staleRows.first();
    const title = (await staleRow.getByRole("cell").first().innerText()).trim();
    await staleRow.getByRole("button", { name: `Xóa ${title}` }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(staleRows).toHaveCount(staleCount - 1);
    staleRows = page
      .getByRole("row")
      .filter({ hasText: /Standard provider [0-9a-f]{8}/ });
  }
}

test.describe("authenticated CMS workflow", () => {
  test.skip(
    !email || !password,
    "Set dedicated staging CMS_E2E_EMAIL/PASSWORD",
  );

  test.beforeEach(async ({ page }) => {
    await login(page, email!, password!);
  });

  test("admin shell and product list preserve responsive, accessible navigation state", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/dashboard");
    await waitForAdminHydration(page);
    await expect(page.getByRole("heading", { name: "Báo cáo" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText("Báo cáo");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);

    const mobileMenu = page.getByRole("button", { name: "Mở điều hướng" });
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await expect(page.locator("aside")).toBeHidden();
      await mobileMenu.click();
      await expect(
        page.getByRole("dialog", { name: "Điều hướng quản trị" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Báo cáo" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Điều hướng quản trị" }),
      ).toHaveCount(0);
      await expect(mobileMenu).toBeFocused();
    } else {
      await expect(page.locator("aside")).toBeVisible();
      await page.getByRole("button", { name: "Thu gọn sidebar" }).click();
      await expect(
        page.getByRole("button", { name: "Mở rộng sidebar" }),
      ).toBeVisible();
    }

    await expectNoAutomatedAccessibilityViolations(page, "Admin dashboard");

    await page.goto("/admin/products");
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("heading", { name: "Sản phẩm", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Tìm kiếm sản phẩm" })
      .fill("rèm dài");
    await expect(page).toHaveURL(/\/admin\/products\?q=r%C3%A8m\+d%C3%A0i$/);
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy sản phẩm" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);
    const isNarrow = (page.viewportSize()?.width ?? 1440) < 768;
    const hasProducts = (await page.locator("[data-product-card]").count()) > 0;
    if (hasProducts && isNarrow) {
      await expect(page.locator("[data-product-mobile-list]")).toBeVisible();
      await expect(page.locator("[data-product-table]")).toBeHidden();
      const firstCard = page.locator("[data-product-card]").first();
      await expect(firstCard).toBeVisible();
      const cardBox = await firstCard.boundingBox();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.x).toBeGreaterThanOrEqual(0);
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      await expect(firstCard.locator("[data-product-actions]")).toBeVisible();
    } else if (hasProducts) {
      await expect(page.locator("[data-product-mobile-list]")).toBeHidden();
      await expect(page.locator("[data-product-table]")).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Chưa có sản phẩm" }),
      ).toBeVisible();
    }
    await expectNoAutomatedAccessibilityViolations(page, "Admin products list");
  });

  test("security workspace is responsive, keyboard operable, and accessible", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/security");
    await waitForAdminHydration(page);

    await expect(
      page.getByRole("heading", { name: "Bảo mật tài khoản", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Thiết bị và phiên đăng nhập", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);

    const refreshButton = page.getByRole("button", { name: "Làm mới" });
    await reachWithKeyboard(page, refreshButton);
    await expect(refreshButton).toBeFocused();
    await refreshButton.press("Enter");
    await expect(refreshButton).toBeEnabled();

    const sessionStatus = page
      .getByRole("status")
      .filter({ hasText: "phiên đăng nhập" });
    await expect(sessionStatus).toContainText(/Hiển thị \d+ trong \d+ phiên/);

    const revokeNames = await page
      .getByRole("button", { name: /^Thu hồi phiên / })
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      );
    expect(revokeNames.every(Boolean)).toBe(true);
    expect(new Set(revokeNames).size).toBe(revokeNames.length);

    await expectNoAutomatedAccessibilityViolations(
      page,
      "Admin security workspace",
    );
  });

  test("admin create routes and post validation remain reachable without data loss", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/admin/products/new");
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("heading", { name: "Thêm sản phẩm" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lưu sản phẩm" }),
    ).toBeDisabled();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Admin product create",
    );

    const isNarrow = (page.viewportSize()?.width ?? 1440) < 768;
    const productName = `Sản phẩm UX ${page.viewportSize()?.width ?? "unknown"}-${crypto.randomUUID().slice(0, 6)}`;
    const updatedProductName = `${productName} đã sửa`;
    const productRecord = (name: string) =>
      isNarrow
        ? page.locator("[data-product-card]").filter({ hasText: name })
        : page.getByRole("row", { name: `Sản phẩm ${name}` });
    await page.getByLabel("Tên sản phẩm").fill(productName);
    await page.getByLabel("Giá sản phẩm").fill("125000");
    await page.getByRole("button", { name: "Lưu sản phẩm" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await waitForAdminHydration(page);
    await expect(productRecord(productName)).toBeVisible();
    if (isNarrow) {
      const cardBox = await productRecord(productName).boundingBox();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.x).toBeGreaterThanOrEqual(0);
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      await expect(
        productRecord(productName).locator("[data-product-actions]"),
      ).toBeVisible();
    } else {
      await expect(page.locator("[data-product-table]")).toBeVisible();
    }

    await page.getByRole("link", { name: `Sửa ${productName}` }).click();
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("heading", { name: "Sửa sản phẩm" }),
    ).toBeVisible();
    await page.getByLabel("Tên sản phẩm").fill(updatedProductName);
    await page.getByRole("button", { name: "Lưu sản phẩm" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await waitForAdminHydration(page);
    await expect(productRecord(updatedProductName)).toBeVisible();

    await page
      .getByRole("button", { name: `Xóa ${updatedProductName}` })
      .click();
    await expect(
      page.getByRole("alertdialog", { name: `Xóa “${updatedProductName}”?` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(productRecord(updatedProductName)).toContainText("Đã xóa");

    await page.goto("/admin/orders/new");
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("heading", { name: "Thêm đơn hàng" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tạo đơn hàng" }),
    ).toBeVisible();

    await page.goto("/admin/posts/new");
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("heading", { name: "Thêm bài viết" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Tạo bài viết" }).click();
    const validationSummary = page.getByRole("alert");
    await expect(validationSummary).toContainText("Tiêu đề là bắt buộc");
    await expect(validationSummary).toBeFocused();
    await expectNoAutomatedAccessibilityViolations(page, "Admin post create");

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);
  });

  test("admin shell covers the supported light and dark viewport matrix", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const widths = [360, 768, 1024, 1440, 1920];
    const evidenceDir = process.env.ADMIN_UX_EVIDENCE_DIR;

    async function verifyTheme(theme: "light" | "dark") {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
            ),
          )
          .toBe(0);
        await expect(page.locator("aside")).toBeVisible({
          visible: width >= 768,
        });
        await expect(page.locator("html")).toHaveClass(
          theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/,
        );

        if (width === 360 || width === 1440) {
          await expectNoAutomatedAccessibilityViolations(
            page,
            `Admin dashboard ${theme} ${width}`,
          );
        }

        if (evidenceDir) {
          await page.screenshot({
            animations: "disabled",
            path: `${evidenceDir}/${theme}-${width}.png`,
          });
        }
      }
    }

    await page.goto("/admin/dashboard");
    await waitForAdminHydration(page);
    const switchToLight = page.getByRole("button", {
      name: "Switch to light mode",
    });
    if (await switchToLight.isVisible()) await switchToLight.click();
    await verifyTheme("light");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await verifyTheme("dark");
  });

  test("home editor exposes human forms, preview and publish workflow", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The exhaustive shared-content mutation and drag workflow runs once on desktop.",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/home");
    await expect(
      page.getByRole("heading", { name: "Trang chủ CMS" }),
    ).toBeVisible();
    // Raw JSON is intentionally limited to dev/owner advanced mode. Admins
    // should get the human editor, not the implementation escape hatch.
    await expect(page.getByLabel("Nhãn nhỏ")).toBeVisible();
    await expect(page.getByText("JSON debug (chỉ đọc)")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Xem bản nháp/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Xuất bản/ })).toBeVisible();
    await expect(page.getByText(/Tự động lưu sau 1,6 giây/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Canvas trực tiếp" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-cms-preview-connection="connected"]').first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Tải lại canvas" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Xem trước Mobile" }),
    ).toBeVisible();
    const homeWorkspace = page.locator("[data-cms-home-workspace-mode]");
    const homeStructure = page.locator('[data-cms-home-structure="true"]');
    const openFocusMode = page.getByRole("button", {
      name: "Mở chế độ tập trung",
    });
    await openFocusMode.click();
    await expect(homeWorkspace).toHaveAttribute(
      "data-cms-home-workspace-mode",
      "focused",
    );
    await expect(homeStructure).toBeHidden();
    await expect(
      page.locator('[data-cms-home-supporting-panel="status"]'),
    ).toBeHidden();
    await expect(
      page.locator('[data-cms-home-supporting-panel="revisions"]'),
    ).toBeHidden();
    await expect
      .poll(
        async () =>
          Math.round(
            (
              await page
                .locator('[data-cms-preview-shell="true"]')
                .boundingBox()
            )?.height ?? 0,
          ),
        {
          message:
            "focused authoring should give the live preview most of the viewport height",
        },
      )
      .toBeGreaterThanOrEqual(640);
    await expect
      .poll(
        async () =>
          Math.round(
            (
              await page
                .locator('[data-cms-preview-canvas="true"]')
                .boundingBox()
            )?.height ?? 0,
          ),
        {
          message:
            "the focused canvas itself should remain large enough to author visually",
        },
      )
      .toBeGreaterThanOrEqual(520);
    await expect(
      page.getByRole("button", { name: "Thoát chế độ tập trung" }),
    ).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Homepage focused visual workspace",
    );
    await page.keyboard.press("Escape");
    await expect(homeWorkspace).toHaveAttribute(
      "data-cms-home-workspace-mode",
      "standard",
    );
    await expect(homeStructure).toBeVisible();
    await expect(
      page.locator('[data-cms-home-supporting-panel="status"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-cms-home-supporting-panel="revisions"]'),
    ).toBeVisible();
    await expect(openFocusMode).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe("hidden");
    const undoCanvas = page.getByRole("button", {
      name: "Hoàn tác thay đổi canvas",
    });
    const redoCanvas = page.getByRole("button", {
      name: "Làm lại thay đổi canvas",
    });
    await expect(undoCanvas).toBeDisabled();
    await expect(redoCanvas).toBeDisabled();

    await page
      .getByRole("button", { name: "Thêm section vào cuối trang" })
      .click();
    const sidebarCatalog = page.getByRole("dialog", {
      name: "Danh mục section cho trang chủ",
    });
    await expect(sidebarCatalog).toBeVisible();
    await sidebarCatalog
      .getByRole("searchbox", { name: "Tìm section" })
      .fill("chuyen dong");
    await expect(
      sidebarCatalog.getByRole("button", {
        name: /Dòng chữ chuyển động.*Dải thông điệp ngắn/,
      }),
    ).toBeVisible();
    await sidebarCatalog
      .getByRole("searchbox", { name: "Tìm section" })
      .press("Escape");
    await expect(sidebarCatalog).toBeHidden();

    const visualPreview = page.frameLocator(
      'iframe[title^="Xem trước Trang chủ"]',
    );
    await expect(visualPreview.getByLabel("Trạng thái preview")).toContainText(
      "Studio trực quan · cập nhật trực tiếp",
    );
    const previewScrollPosition = () =>
      visualPreview.locator("html").evaluate(() => ({
        fromBottom: Math.round(
          document.documentElement.scrollHeight -
            window.innerHeight -
            window.scrollY,
        ),
        top: Math.round(window.scrollY),
      }));
    await page.getByRole("button", { name: "10. CTA cuối trang" }).click();
    await expect
      .poll(async () => (await previewScrollPosition()).fromBottom, {
        message:
          "sidebar selection should navigate the live canvas to the fixed footer",
      })
      .toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "1. Hero mở đầu" }).click();
    await expect
      .poll(async () => (await previewScrollPosition()).top)
      .toBeLessThanOrEqual(1);
    await visualPreview
      .locator("[data-cms-footer-scroll-target]")
      .evaluate((element) =>
        element.scrollIntoView({ behavior: "auto", block: "end" }),
      );
    await page.getByRole("button", { name: "1. Hero mở đầu" }).click();
    await expect
      .poll(async () => (await previewScrollPosition()).top, {
        message:
          "reselecting the current sidebar section should navigate the canvas again",
      })
      .toBeLessThanOrEqual(1);
    for (const blockType of [
      "hero",
      "threatNarrative",
      "marquee",
      "benefits",
      "craftProcess",
      "bentoDetails",
      "horizontalGallery",
      "measurementGuide",
      "faq",
      "footerCta",
    ]) {
      const actualPaths = await visualPreview
        .locator(`[data-cms-block-type="${blockType}"]`)
        .evaluate((block) =>
          Array.from(
            block.querySelectorAll<HTMLElement>("[data-cms-field-path]"),
          )
            .map((field) => field.dataset.cmsFieldPath)
            .filter((path): path is string => Boolean(path))
            .filter((path, index, paths) => paths.indexOf(path) === index)
            .sort(),
        );
      expect(
        actualPaths,
        `${blockType} should render every registered exact-field target`,
      ).toEqual(expectedVisualPathsByBlockType.get(blockType));
    }

    const heroKicker = page.locator("#hero-kicker");
    const originalKicker = await heroKicker.inputValue();
    const liveMarker = `Visual studio ${crypto.randomUUID().slice(0, 8)}`;
    await heroKicker.fill(liveMarker);
    await expect(
      visualPreview.getByText(liveMarker, { exact: true }),
    ).toBeVisible({ timeout: 1_000 });
    await heroKicker.fill(originalKicker);
    await expect(
      visualPreview.getByText(originalKicker, { exact: true }),
    ).toBeVisible({ timeout: 1_000 });

    const heroTitlePrefix = visualPreview
      .locator('[data-cms-field-path="title.prefix"]')
      .first();
    await heroTitlePrefix.hover();
    await expect(
      visualPreview.locator('[data-cms-field-hint="true"]'),
    ).toHaveAttribute("data-cms-field-label", "Tiêu đề chính");
    await heroTitlePrefix.dispatchEvent("click");
    await expect(page.locator("#hero-title-prefix")).toBeFocused();
    await expect(page.getByText("Từ canvas: Tiêu đề chính")).toBeVisible();

    const renderedFaqQuestion = visualPreview
      .locator('[data-cms-block-type="faq"] [data-cms-field-path$=".question"]')
      .first();
    const renderedFaqControlId = await renderedFaqQuestion.getAttribute(
      "data-cms-control-id",
    );
    if (!renderedFaqControlId)
      throw new Error("Rendered FAQ question control ID is missing.");
    await renderedFaqQuestion.dispatchEvent("click");
    await expect(
      page.getByRole("heading", { name: "Câu hỏi thường gặp" }),
    ).toBeVisible();
    await expect(page.locator('[data-cms-inspector="true"]')).toHaveAttribute(
      "data-cms-selected-field-path",
      /\.question$/,
    );
    await expect(page.locator(`[id="${renderedFaqControlId}"]`)).toBeFocused();
    for (const [
      blockType,
      expectedControlIds,
    ] of expectedVisualControlIdsByBlockType) {
      const firstField = visualPreview
        .locator(
          `[data-cms-block-type="${blockType}"] [data-cms-preview-field="true"]`,
        )
        .first();
      await firstField.dispatchEvent("click");
      await expect
        .poll(
          () =>
            page.evaluate(
              (controlIds) =>
                controlIds.filter(
                  (controlId) => !document.getElementById(controlId),
                ),
              expectedControlIds,
            ),
          {
            message: `${blockType} should mount every registered inspector control`,
          },
        )
        .toEqual([]);
    }

    const previewBlockOrder = () =>
      visualPreview
        .locator('[data-cms-preview-block="true"]')
        .evaluateAll((elements) =>
          elements
            .map((element) =>
              (element as HTMLElement).dataset.cmsBlockId?.trim(),
            )
            .filter((id): id is string => Boolean(id)),
        );
    const originalCanvasOrder = await previewBlockOrder();
    const benefitsBlock = visualPreview.locator(
      '[data-cms-block-type="benefits"]',
    );
    const benefitsBlockId =
      await benefitsBlock.getAttribute("data-cms-block-id");
    if (!benefitsBlockId)
      throw new Error("Benefits preview block ID is missing.");
    const originalBenefitsIndex = originalCanvasOrder.indexOf(benefitsBlockId);
    if (originalBenefitsIndex < 0)
      throw new Error("Benefits preview block is missing from canvas order.");
    const expectedMovedOrder = [...originalCanvasOrder];
    expectedMovedOrder.splice(originalBenefitsIndex, 1);
    expectedMovedOrder.splice(originalBenefitsIndex + 1, 0, benefitsBlockId);
    await benefitsBlock.dispatchEvent("click");
    const sectionToolbar = visualPreview.locator(
      '[data-cms-section-toolbar="true"]',
    );
    await expect(sectionToolbar).toHaveAttribute(
      "data-cms-toolbar-block-id",
      benefitsBlockId,
    );
    const moveDownButton = sectionToolbar.getByRole("button", {
      name: "Đưa section xuống dưới canvas",
    });
    await moveDownButton.focus();
    await moveDownButton.press("Enter");
    await expect
      .poll(previewBlockOrder, {
        message: "on-canvas controls should move the selected structured block",
      })
      .toEqual(expectedMovedOrder);
    await expect(undoCanvas).toBeEnabled();
    await undoCanvas.click();
    await expect.poll(previewBlockOrder).toEqual(originalCanvasOrder);
    await expect(redoCanvas).toBeEnabled();
    await redoCanvas.click();
    await expect.poll(previewBlockOrder).toEqual(expectedMovedOrder);
    await sectionToolbar
      .getByRole("button", { name: "Đưa section lên trên canvas" })
      .dispatchEvent("click");
    await expect.poll(previewBlockOrder).toEqual(originalCanvasOrder);

    const duplicateSection = sectionToolbar.getByRole("button", {
      name: "Nhân bản section trên canvas",
    });
    await duplicateSection.focus();
    await duplicateSection.press("Enter");
    await expect
      .poll(previewBlockOrder, {
        message: "duplicating on canvas should add one bounded section",
      })
      .toHaveLength(originalCanvasOrder.length + 1);
    const duplicatedOrder = await previewBlockOrder();
    const duplicateBenefitsId = duplicatedOrder.find(
      (id) => !originalCanvasOrder.includes(id),
    );
    if (!duplicateBenefitsId)
      throw new Error("Duplicated Benefits block ID is missing.");
    await expect(sectionToolbar).toHaveAttribute(
      "data-cms-toolbar-block-id",
      duplicateBenefitsId,
    );
    await expect(
      visualPreview.locator('[data-cms-block-type="benefits"]'),
    ).toHaveCount(2);
    await sectionToolbar
      .getByRole("button", { name: "Xóa section trên canvas" })
      .dispatchEvent("click");
    await expect.poll(previewBlockOrder).toEqual(originalCanvasOrder);

    await visualPreview
      .locator(`[data-cms-block-id="${benefitsBlockId}"]`)
      .dispatchEvent("click");
    await expect(sectionToolbar).toHaveAttribute(
      "data-cms-toolbar-block-id",
      benefitsBlockId,
    );
    const addSectionButton = sectionToolbar.getByRole("button", {
      name: "Thêm section trên canvas",
    });
    await expect(addSectionButton).toBeEnabled();
    await expect(addSectionButton).toHaveAttribute("aria-expanded", "false");
    await addSectionButton.dispatchEvent("click");
    await expect(addSectionButton).toHaveAttribute("aria-expanded", "true");
    const sectionComposer = visualPreview.locator(
      '[data-cms-section-composer="true"]',
    );
    await expect(sectionComposer).toBeVisible();
    await sectionComposer
      .getByRole("searchbox", { name: "Tìm section" })
      .fill("ticker");
    await expect(sectionComposer).toContainText(
      "Dải thông điệp ngắn tạo nhịp chuyển giữa các section.",
    );
    await sectionComposer
      .getByRole("button", { name: /Dòng chữ chuyển động/ })
      .dispatchEvent("click");
    await expect
      .poll(previewBlockOrder)
      .toHaveLength(originalCanvasOrder.length + 1);
    const insertedOrder = await previewBlockOrder();
    const insertedMarqueeId = insertedOrder.find(
      (id) => !originalCanvasOrder.includes(id),
    );
    if (!insertedMarqueeId)
      throw new Error("Inserted Marquee block ID is missing.");
    await expect(sectionToolbar).toHaveAttribute(
      "data-cms-toolbar-block-id",
      insertedMarqueeId,
    );
    await expect(
      visualPreview.locator('[data-cms-block-type="marquee"]'),
    ).toHaveCount(2);
    const canvasViewport = page.getByLabel("Khung cuộn xem trước Trang chủ");
    await canvasViewport.focus();
    await canvasViewport.press("Control+z");
    await expect.poll(previewBlockOrder).toEqual(originalCanvasOrder);
    await canvasViewport.press("Control+Shift+z");
    await expect.poll(previewBlockOrder).toEqual(insertedOrder);
    await visualPreview
      .locator(`[data-cms-block-id="${insertedMarqueeId}"]`)
      .dispatchEvent("click");
    await expect(sectionToolbar).toHaveAttribute(
      "data-cms-toolbar-block-id",
      insertedMarqueeId,
    );
    await sectionToolbar
      .getByRole("button", { name: "Xóa section trên canvas" })
      .dispatchEvent("click");
    await expect.poll(previewBlockOrder).toEqual(originalCanvasOrder);

    await visualPreview
      .locator('[data-cms-block-type="hero"]')
      .dispatchEvent("click");
    await expect(sectionToolbar).toContainText("Vùng cố định");
    await expect(
      sectionToolbar.getByRole("button", {
        name: "Kéo section để sắp xếp trên canvas",
      }),
    ).toHaveCount(0);
    await expect(
      sectionToolbar.getByRole("button", {
        name: "Nhân bản section trên canvas",
      }),
    ).toBeDisabled();
    await expect(
      sectionToolbar.getByRole("button", {
        name: "Xóa section trên canvas",
      }),
    ).toBeDisabled();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Authenticated homepage editor",
      { exclude: ["iframe"] },
    );
    await page.goto("/admin/home-preview");
    await expect(page.locator("h1")).toBeVisible();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Authenticated homepage draft preview",
    );
  });

  test("mobile home visual authoring keeps canvas and inspector operable", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "This receipt is intentionally produced by the mobile browser project.",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/home");
    await expect(
      page.getByRole("heading", { name: "Trang chủ CMS" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Thảo luận biên tập" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);

    await page.getByRole("button", { name: "Xem trước Mobile" }).click();
    await expect(page.getByText(/390 × 844/)).toBeVisible();
    const visualPreview = page.frameLocator(
      'iframe[title^="Xem trước Trang chủ"]',
    );
    await expect(visualPreview.getByLabel("Trạng thái preview")).toContainText(
      "Studio trực quan · cập nhật trực tiếp",
    );
    await visualPreview
      .locator('[data-cms-field-path="title.prefix"]')
      .first()
      .click();
    await expect(page.locator('[data-cms-inspector="true"]')).toHaveAttribute(
      "data-cms-selected-field-path",
      "title.prefix",
    );
    await expect(page.locator("#hero-title-prefix")).toBeFocused();
    await expect(page.getByText("Từ canvas: Tiêu đề chính")).toBeVisible();

    await page
      .getByRole("button", { name: "Thêm section vào cuối trang" })
      .click();
    const catalog = page.getByRole("dialog", {
      name: "Danh mục section cho trang chủ",
    });
    await expect(catalog).toBeVisible();
    await catalog
      .getByRole("searchbox", { name: "Tìm section" })
      .fill("chuyen dong");
    await expect(
      catalog.getByRole("button", {
        name: /Dòng chữ chuyển động.*Dải thông điệp ngắn/,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(catalog).toBeHidden();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Mobile homepage visual authoring",
      { exclude: ["iframe"] },
    );
  });

  test("home editor critical path works with keyboard only", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The shared-content keyboard mutation runs once on desktop.",
    );

    await page.goto("/admin/home");
    const kicker = page.locator("#hero-kicker");
    const saveButton = page.getByRole("button", {
      name: "Lưu bản nháp",
      exact: true,
    });
    const previewLink = page.getByRole("link", {
      name: "Xem bản nháp",
      exact: true,
    });
    await expect(kicker).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Đã đồng bộ với máy chủ" }),
    ).toBeVisible();
    const original = await kicker.inputValue();
    const marker = `E2E keyboard ${crypto.randomUUID().slice(0, 8)}`;

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await reachWithKeyboard(page, kicker);
    await expect(kicker).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(marker);

    await reachWithKeyboard(page, saveButton);
    await expect(saveButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();

    await reachWithKeyboard(page, previewLink, "backward");
    await expect(previewLink).toBeFocused();
    const previewPromise = context.waitForEvent("page");
    await page.keyboard.press("Enter");
    const preview = await previewPromise;
    await preview.waitForURL(
      (url) =>
        url.pathname === "/admin/home-preview" &&
        Boolean(url.searchParams.get("cmsBinding")) &&
        Boolean(url.searchParams.get("cmsConflict")) &&
        Boolean(url.searchParams.get("cmsSession")),
    );
    await expect(preview.getByText(marker, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await preview.close();

    await reachWithKeyboard(page, kicker);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(original);
    await reachWithKeyboard(page, saveButton);
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }).last(),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("#hero-kicker")).toHaveValue(original);
  });

  test("home autosave survives refresh and stale tabs cannot overwrite newer work", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The shared-draft concurrency mutation runs once on desktop.",
    );

    await page.goto("/admin/home");
    const primaryKicker = page.locator("#hero-kicker");
    await expect(primaryKicker).toBeVisible();
    const original = await primaryKicker.inputValue();
    const autosaveMarker = `E2E autosave ${crypto.randomUUID().slice(0, 8)}`;

    await primaryKicker.fill(autosaveMarker);
    await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
    await expect(page.getByText(/Đã lưu lúc/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator("#hero-kicker")).toHaveValue(autosaveMarker);

    const navigationMarker = `E2E navigation flush ${crypto.randomUUID().slice(0, 8)}`;
    await page.locator("#hero-kicker").fill(navigationMarker);
    await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
    await revealAdminNavigation(page);
    await page.getByRole("link", { name: "Bài viết", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    await page.goto("/admin/home");
    await expect(page.locator("#hero-kicker")).toHaveValue(navigationMarker);

    const previewMarker = `E2E preview flush ${crypto.randomUUID().slice(0, 8)}`;
    await page.locator("#hero-kicker").fill(previewMarker);
    await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
    const previewPromise = context.waitForEvent("page");
    await page.getByRole("link", { name: "Xem bản nháp", exact: true }).click();
    const preview = await previewPromise;
    await preview.waitForURL(
      (url) =>
        url.pathname === "/admin/home-preview" &&
        Boolean(url.searchParams.get("cmsBinding")) &&
        Boolean(url.searchParams.get("cmsConflict")) &&
        Boolean(url.searchParams.get("cmsSession")),
    );
    await expect(preview.getByText(previewMarker, { exact: true })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await preview.close();

    const stalePage = await context.newPage();
    await stalePage.goto("/admin/home");
    const staleKicker = stalePage.locator("#hero-kicker");
    await expect(staleKicker).toHaveValue(previewMarker);

    const winner = `E2E winner ${crypto.randomUUID().slice(0, 8)}`;
    await primaryKicker.fill(winner);
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();

    const staleValue = `E2E stale ${crypto.randomUUID().slice(0, 8)}`;
    await staleKicker.fill(staleValue);
    await stalePage.getByRole("button", { name: "Lưu bản nháp" }).click();
    await expect(
      stalePage.getByText("Xung đột phiên bản", { exact: true }),
    ).toBeVisible();
    await expect(stalePage.getByText("Có xung đột phiên bản")).toBeVisible();
    await stalePage
      .getByRole("button", { name: "Tải bản trên máy chủ" })
      .click();
    await expect(staleKicker).toHaveValue(winner);

    await staleKicker.fill(original);
    await stalePage
      .getByRole("button", { name: "Lưu bản nháp" })
      .press("Enter");
    await expect(
      stalePage.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();
    await stalePage.close();
  });

  test("structured home controls add, duplicate, reorder, delete, hide and move safely", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The structured-editor mutation loop runs once; mobile has the UI smoke.",
    );

    await page.goto("/admin/home");
    const faqToggle = page.getByLabel("Bật Câu hỏi thường gặp");
    await expect(faqToggle).toBeVisible();
    const faqRow = faqToggle.locator("..");
    const originalEnabled = await faqToggle.isChecked();
    const originalPosition = Number.parseInt(
      ((await faqRow.locator("button").first().textContent()) ?? "").trim(),
      10,
    );
    expect(originalPosition).toBeGreaterThan(1);

    await faqToggle.setChecked(!originalEnabled);
    await expect(faqToggle).toBeChecked({ checked: !originalEnabled });
    await faqToggle.setChecked(originalEnabled);
    await expect(faqToggle).toBeChecked({ checked: originalEnabled });

    await faqRow.getByRole("button", { name: "Đưa block lên" }).click();
    await expect(faqRow.locator("button").first()).toContainText(
      `${originalPosition - 1}.`,
    );
    await faqRow.getByRole("button", { name: "Đưa block xuống" }).click();
    await expect(faqRow.locator("button").first()).toContainText(
      `${originalPosition}.`,
    );

    await faqRow.locator("button").first().click();
    const groups = page.getByRole("group", { name: /^FAQ \d+$/ });
    const originalCount = await groups.count();
    await page.getByRole("button", { name: "Thêm FAQ" }).click();
    await expect(groups).toHaveCount(originalCount + 1);

    const addedMarker = `FAQ added ${crypto.randomUUID().slice(0, 8)}`;
    const addedGroup = groups.nth(originalCount);
    await addedGroup.getByLabel("Câu hỏi").fill(addedMarker);
    await addedGroup.getByRole("button", { name: "Nhân bản" }).click();
    await expect(groups).toHaveCount(originalCount + 2);

    const duplicateMarker = `FAQ duplicate ${crypto.randomUUID().slice(0, 8)}`;
    const duplicateGroup = groups.nth(originalCount + 1);
    await duplicateGroup.getByLabel("Câu hỏi").fill(duplicateMarker);
    await duplicateGroup.getByRole("button", { name: "Di chuyển lên" }).click();
    await expect(groups.nth(originalCount).getByLabel("Câu hỏi")).toHaveValue(
      duplicateMarker,
    );
    await expect(
      groups.nth(originalCount + 1).getByLabel("Câu hỏi"),
    ).toHaveValue(addedMarker);

    await groups
      .nth(originalCount + 1)
      .getByRole("button", { name: "Xóa" })
      .click();
    await groups
      .nth(originalCount)
      .getByRole("button", { name: "Xóa" })
      .click();
    await expect(groups).toHaveCount(originalCount);

    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();
  });

  test("home draft stays private through publish and restore", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The full mutation loop runs once on desktop; mobile has the UI smoke.",
    );
    await page.goto("/admin/home");
    await expect(
      page.getByRole("button", { name: "Khôi phục vào bản nháp" }).first(),
    ).toBeVisible();
    const originalPublishedVersion = (
      (await page.getByTestId("published-version").textContent()) ?? ""
    ).trim();
    expect(originalPublishedVersion).toMatch(/^v\d+$/);
    const kicker = page.locator("#hero-kicker");
    await expect(kicker).toBeVisible();
    const publicPage = await context.newPage();
    await publicPage.goto("/");
    const original = (
      (await publicPage.locator(".hero-new-kicker").textContent()) ?? ""
    ).trim();
    expect(original).not.toBe("");
    const marker = `E2E draft ${crypto.randomUUID().slice(0, 8)}`;

    await kicker.fill(marker);
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();

    const preview = await context.newPage();
    const previewResponse = await preview.goto("/admin/home-preview");
    expect(previewResponse?.headers()["cache-control"]).toContain(
      "private, no-store",
    );
    expect(previewResponse?.headers()["x-robots-tag"]).toContain(
      "noindex, nofollow",
    );
    await expect(preview.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex, nofollow/,
    );
    await expect(preview.getByText(marker, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await preview.close();

    await expect(publicPage.getByText(marker, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(
      page.getByText("Đã xuất bản Trang chủ.", { exact: true }),
    ).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByText(marker, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const originalRevision = page.getByTestId(
      `revision-${originalPublishedVersion}`,
    );
    await expect(originalRevision).toBeVisible();
    await originalRevision
      .getByRole("button", { name: "So sánh với bản nháp" })
      .click();
    const revisionComparison = originalRevision.getByRole("region", {
      name: `Thay đổi từ phiên bản ${originalPublishedVersion} đến bản nháp hiện tại`,
    });
    await expect(revisionComparison).toBeVisible();
    await expect(revisionComparison).toContainText("Hero mở đầu");
    await expect(revisionComparison).toContainText("Đã sửa nội dung");
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Expanded homepage revision comparison",
      { exclude: ["iframe", "[data-sonner-toast]"] },
    );
    await originalRevision
      .getByRole("button", { name: "Khôi phục vào bản nháp" })
      .click();
    await confirmAlertDialog(page, "Khôi phục bản nháp");
    await expect(
      page.getByText(
        "Đã khôi phục phiên bản vào bản nháp. Nội dung công khai chưa thay đổi.",
        { exact: true },
      ),
    ).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByText(marker, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(
      page.getByText("Đã xuất bản Trang chủ.", { exact: true }),
    ).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByText(original, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(publicPage.getByText(marker, { exact: true })).toHaveCount(0);
    await publicPage.close();
  });

  test("operations modules are available to admin", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await waitForAdminHydration(page);
    const editorialWorkspace = page.getByRole("region", {
      name: "Nội dung đang chuyển động",
    });
    await expect(editorialWorkspace).toBeVisible();
    await expect(editorialWorkspace).toContainText("Không gian biên tập");
    const editorialMetrics = editorialWorkspace.getByRole("list", {
      name: "Tổng quan nội dung",
    });
    await expect(
      editorialMetrics.getByText("Tổng nội dung", { exact: true }),
    ).toBeVisible();
    await expect(
      editorialMetrics.getByText("Bản nháp", { exact: true }),
    ).toBeVisible();
    await expect(
      editorialMetrics.getByText("Đang chờ lịch", { exact: true }),
    ).toBeVisible();
    await expect(
      editorialMetrics.getByText("Chờ duyệt", { exact: true }),
    ).toBeVisible();
    await expect(
      editorialWorkspace.getByRole("link", { name: "Mở canvas trang chủ" }),
    ).toBeVisible();
    await expect(
      editorialWorkspace.getByRole("link", { name: "Viết bài mới" }),
    ).toBeVisible();
    await expect(
      editorialWorkspace.getByRole("link", { name: "Chọn media" }),
    ).toBeVisible();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Editorial dashboard workspace",
    );
    await page.keyboard.press("Control+K");
    const commandCenter = page.getByRole("dialog", {
      name: "Đi đến bất kỳ đâu",
    });
    await expect(commandCenter).toBeVisible();
    const commandSearch = commandCenter.getByRole("searchbox", {
      name: "Tìm trong CMS",
    });
    await expect(commandSearch).toBeFocused();
    await commandSearch.fill("bao tri luoi");
    const contentResult = commandCenter.getByRole("link", {
      name: /Bảo trì lưới chống muỗi trong căn hộ/,
    });
    await expect(contentResult).toBeVisible();
    await expect(contentResult).toHaveAttribute(
      "href",
      "/admin/posts/seed-post-bao-tri-luoi-chong-muoi/edit",
    );
    await expect(
      contentResult.getByText("Công khai", { exact: true }),
    ).toBeVisible();
    await commandSearch.fill("hieu nang");
    await expect(
      commandCenter.getByRole("link", { name: /Hiệu năng thực tế/ }),
    ).toBeVisible();
    await expect(commandCenter.getByText(/1 kết quả/)).toBeVisible();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Admin command center",
    );
    await commandSearch.press("Enter");
    await expect(commandCenter).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/performance$/);
    await expect(
      page.getByRole("heading", { name: "Hiệu năng thực tế" }),
    ).toBeVisible();

    await page.goto("/admin/redirects");
    await expect(
      page.getByRole("heading", { name: "Chuyển hướng" }),
    ).toBeVisible();
    await page.goto("/admin/leads");
    await expect(
      page.getByRole("heading", { name: "Khách hàng tiềm năng" }),
    ).toBeVisible();
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", { name: "Nhật ký kiểm toán" }),
    ).toBeVisible();
    await expect(page.getByText("auth.sign_in_success").first()).toBeVisible();
    await page.goto("/admin/operations");
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("heading", { name: "Tự động hóa và release" }),
    ).toBeVisible();
    const operationsCalendar = page.getByRole("region", {
      name: "Lịch nội dung và release",
    });
    await expect(operationsCalendar).toBeVisible();
    await expect(operationsCalendar).toContainText(
      "Một lịch chung cho hạn duyệt, nội dung đã lên lịch và release nhiều tài liệu.",
    );
    await expect(
      operationsCalendar.getByRole("button", { name: "Tháng trước" }),
    ).toBeVisible();
    await expect(
      operationsCalendar.getByRole("button", { name: "Tháng sau" }),
    ).toBeVisible();
    await expect(
      page.getByText(/collection,collection-slug,document-id,vi-VN,3/),
    ).toBeVisible();
    await expect(page.getByText(/global,key,3/)).toBeVisible();
    const workflowLabel = `Phê duyệt E2E ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByLabel("Collection").fill("rem-viet-localized-campaigns");
    await page.getByLabel("Thư mục").fill("Campaigns\\Summer/");
    await page.getByLabel("Locale").fill("vi-VN");
    await page.getByLabel("Tên bước").fill(workflowLabel);
    await page.getByRole("button", { name: "Lưu workflow" }).click();
    await expect(
      page.getByText("Đã lưu workflow xuất bản.", { exact: true }),
    ).toBeVisible();
    const folderPolicy = page.getByText(new RegExp(workflowLabel));
    await expect(folderPolicy).toBeVisible();
    const folderPolicyCard = folderPolicy.locator("..").locator("..");
    await folderPolicyCard.getByRole("button", { name: "Tắt" }).click();
    const deactivatedToast = page.getByText("Đã tắt workflow.", {
      exact: true,
    });
    await expect(deactivatedToast).toBeVisible();
    await expect(
      folderPolicyCard.getByText("inactive", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);
    await expectNoAutomatedAccessibilityViolations(page, "Operations calendar");
    await page.goto("/admin/performance");
    await expect(
      page.getByRole("heading", { name: "Hiệu năng thực tế" }),
    ).toBeVisible();
    const performanceOverview = page.getByRole("region", {
      name: "Biết chính xác trải nghiệm khách hàng đang tốt đến đâu.",
    });
    await expect(performanceOverview).toBeVisible();
    await expect(performanceOverview).toContainText("Dữ liệu người dùng thực");
    await expect(performanceOverview).toContainText("Đang tích lũy bằng chứng");
    const releaseConfidence = page.getByRole("region", {
      name: "Chỉ bàn giao khi bằng chứng nói rằng website đã sẵn sàng.",
    });
    await expect(releaseConfidence).toBeVisible();
    await expect(releaseConfidence).toContainText(
      "Đây là ảnh chụp runtime hiện tại, không phải chứng nhận phát hành.",
    );
    await expect(releaseConfidence).toContainText("Danh tính deployment");
    await expect(releaseConfidence).toContainText("source clean");
    await expect(releaseConfidence).toContainText("Notification runtime");
    await expect(releaseConfidence).toContainText("Receipt ngoài runtime");
    await expect(releaseConfidence).toContainText("Operational alert");
    await expect(releaseConfidence).toContainText("Scheduled backup");
    await expect(releaseConfidence).toContainText("Client pilot");
    await expect(
      page.getByRole("article", { name: "LCP: Tốc độ tải" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "INP: Độ phản hồi" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "CLS: Độ ổn định" }),
    ).toBeVisible();
    await expect(page.getByText("Độ tin cậy dữ liệu")).toHaveCount(3);
    await expect(page.getByText("So với kỳ trước")).toHaveCount(3);
    await expect(page.getByText(/^Kỳ trước:/)).toHaveCount(3);
    await expect(
      page.getByText("Hành trình có dữ liệu", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^\/admin(?:\/|$)/ }),
    ).toHaveCount(0);
    await expect(page.getByText("Chưa đủ mẫu").first()).toBeVisible();
    await expect(page.getByLabel("Cửa sổ đo")).toHaveValue("28");
    await expect(page.getByLabel("Thiết bị")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Tải bằng chứng JSON" }),
    ).toBeEnabled();

    const pathFilter = page.getByLabel("Đường dẫn chính xác (tùy chọn)");
    await pathFilter.fill("https://example.invalid");
    await expect(pathFilter).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText(
        "Chỉ nhập đường dẫn nội bộ, không có tham số truy vấn hoặc mảnh neo.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Làm mới" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Tải bằng chứng JSON" }),
    ).toBeDisabled();
    await pathFilter.fill("");
    await expect(pathFilter).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByRole("button", { name: "Làm mới" })).toBeEnabled();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Performance command center",
    );

    await page.keyboard.press("Control+K");
    const handoverCommandCenter = page.getByRole("dialog", {
      name: "Đi đến bất kỳ đâu",
    });
    const handoverSearch = handoverCommandCenter.getByRole("searchbox", {
      name: "Tìm trong CMS",
    });
    await handoverSearch.fill("pilot ban giao");
    await handoverCommandCenter
      .getByRole("link", { name: /Pilot bàn giao/ })
      .click();
    await expect(page).toHaveURL(/\/admin\/handover$/);
    await expect(
      page.getByRole("heading", { name: "Pilot bàn giao" }),
    ).toBeVisible();
    const handoverWorkspace = page.getByRole("region", {
      name: "Pilot bàn giao có giám sát",
    });
    await expect(handoverWorkspace).toBeVisible();
    await expect(handoverWorkspace).toContainText(
      "Để khách tự hoàn thành; hệ thống chỉ giữ thời gian và bằng chứng quan sát.",
    );
    await expect(handoverWorkspace).toContainText("Đang chặn pilot");
    await expect(handoverWorkspace).toContainText(
      "pilot chỉ được chạy trên staging",
    );
    await expect(
      handoverWorkspace.getByRole("button", { name: "Bắt đầu quan sát" }),
    ).toBeDisabled();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBe(0);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Handover pilot workspace",
    );
  });

  test("redirect lifecycle changes public routing and rejects loops", async ({
    page,
    request,
  }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const oldPath = `/e2e-redirect-${marker}`;
    const targetPath = `/e2e-target-${marker}`;

    await page.goto("/admin/redirects");
    await page.getByLabel("Đường dẫn cũ").fill(oldPath);
    await page.getByLabel("Đường dẫn mới").fill(targetPath);
    await page.getByLabel("Mã").selectOption("307");
    await page.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(
      page.getByText("Đã tạo chuyển hướng.", { exact: true }),
    ).toBeVisible();

    const redirectRow = page.getByRole("row").filter({ hasText: oldPath });
    await expect(redirectRow).toBeVisible();
    await expect(redirectRow).toContainText(targetPath);
    await expect(redirectRow).toContainText("307");

    await expect
      .poll(async () => {
        const response = await request.get(oldPath, { maxRedirects: 0 });
        return response.status();
      })
      .toBe(307);
    const redirectResponse = await request.get(oldPath, { maxRedirects: 0 });
    const location = redirectResponse.headers().location;
    expect(location).toBeTruthy();
    expect(new URL(location!, page.url()).pathname).toBe(targetPath);

    await page.getByLabel("Đường dẫn cũ").fill(targetPath);
    await page.getByLabel("Đường dẫn mới").fill(oldPath);
    await page.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(
      page.getByText("Redirect tạo thành vòng lặp.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("tbody tr > td:first-child").filter({ hasText: targetPath }),
    ).toHaveCount(0);
    await expect(
      page.locator("tbody tr > td:first-child").filter({ hasText: oldPath }),
    ).toHaveCount(1);

    const activeToggle = redirectRow.getByRole("checkbox", {
      name: `Bật chuyển hướng ${oldPath}`,
    });
    await activeToggle.uncheck();
    await expect
      .poll(async () => {
        const response = await request.get(oldPath, { maxRedirects: 0 });
        return response.status();
      })
      .toBe(200);

    await activeToggle.check();
    await expect
      .poll(async () => {
        const response = await request.get(oldPath, { maxRedirects: 0 });
        return response.status();
      })
      .toBe(307);

    await redirectRow.getByRole("button", { name: `Xóa ${oldPath}` }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(redirectRow).toHaveCount(0);
    await expect
      .poll(async () => {
        const response = await request.get(oldPath, { maxRedirects: 0 });
        return response.status();
      })
      .toBe(200);
  });

  test("site settings and navigation never require client JSON", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The versioned global-content mutation runs once on desktop.",
    );
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Cài đặt website" }),
    ).toBeVisible();
    await expect(page.getByLabel("Điện thoại")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Menu đầu trang" }).first(),
    ).toBeVisible();
    await expect(page.getByText(/JSON/)).toHaveCount(0);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Admin global settings recovery",
    );

    const phone = page.getByLabel("Điện thoại");
    const headerLabel = page.locator("#header-menu-label-0");
    const previewStatus = page.getByTestId("global-settings-preview-status");
    const preview = page.frameLocator(
      '[data-testid="global-settings-preview-frame"]',
    );
    const originalPhone = await phone.inputValue();
    const originalHeaderLabel = await headerLabel.inputValue();
    const suffix = crypto.randomUUID().slice(0, 8);
    const phoneMarker = `${originalPhone || "+84 28 0000 0000"} ${suffix}`;
    const menuMarker = `${originalHeaderLabel} ${suffix}`;
    try {
      // Fresh installs render safe navigation defaults before the first save.
      // Persist that baseline so the subsequent edit has a recoverable revision.
      await page
        .getByRole("button", { name: "Lưu bản nháp điều hướng" })
        .click();
      await expect(
        page.getByText("Đã lưu bản nháp điều hướng.", { exact: true }),
      ).toBeVisible();

      const draftStatus = page.getByTestId("global-settings-draft-status");
      const undoSettings = page.getByRole("button", {
        name: "Hoàn tác thay đổi cấu hình",
      });
      const redoSettings = page.getByRole("button", {
        name: "Làm lại thay đổi cấu hình",
      });
      await expect(draftStatus).toHaveText("Đã đồng bộ với máy chủ.");
      await expect(undoSettings).toBeDisabled();
      await expect(redoSettings).toBeDisabled();
      await expect(previewStatus).toHaveText("Canvas đã kết nối");
      await expect(
        preview.getByTestId("global-settings-rendered-preview"),
      ).toBeVisible();
      await expect(
        preview.getByRole("link", { name: originalHeaderLabel }).first(),
      ).toBeVisible();
      const mobilePreview = page.getByRole("button", {
        name: "Xem trước mobile",
      });
      await mobilePreview.click();
      await expect(mobilePreview).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Xem trước desktop" }).click();

      const recoveryPhone = `${originalPhone || "+84 28 0000 0000"} recovery`;
      const recoveryMenu = `${originalHeaderLabel} recovery`;
      await phone.fill(recoveryPhone);
      await headerLabel.fill(recoveryMenu);
      await expect(draftStatus).toContainText("thông tin website");
      await expect(draftStatus).toContainText("điều hướng");
      await expect(
        preview.getByRole("link", { name: recoveryMenu }).first(),
      ).toBeVisible();
      await expect(
        preview.getByText(recoveryPhone, { exact: true }).first(),
      ).toBeVisible();
      await undoSettings.click();
      await expect(headerLabel).toHaveValue(originalHeaderLabel);
      await expect(phone).toHaveValue(recoveryPhone);
      await expect(
        preview.getByRole("link", { name: originalHeaderLabel }).first(),
      ).toBeVisible();
      await undoSettings.click();
      await expect(phone).toHaveValue(originalPhone);
      if (originalPhone) {
        await expect(
          preview.getByText(originalPhone, { exact: true }).first(),
        ).toBeVisible();
      }
      await expect(draftStatus).toHaveText("Đã đồng bộ với máy chủ.");
      await expect(undoSettings).toBeDisabled();
      await expect(redoSettings).toBeEnabled();
      await redoSettings.click();
      await expect(phone).toHaveValue(recoveryPhone);
      await redoSettings.click();
      await expect(headerLabel).toHaveValue(recoveryMenu);
      await undoSettings.click();
      await undoSettings.click();
      await expect(phone).toHaveValue(originalPhone);
      await expect(headerLabel).toHaveValue(originalHeaderLabel);
      await expect(draftStatus).toHaveText("Đã đồng bộ với máy chủ.");

      await phone.fill(phoneMarker);
      await expect(draftStatus).toContainText("thông tin website");
      await expect(redoSettings).toBeDisabled();
      await revealAdminNavigation(page);
      await page.getByRole("link", { name: "Bài viết", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/posts$/);
      await page.goto("/admin/settings");
      await expect(page.getByLabel("Điện thoại")).toHaveValue(phoneMarker);
      await expect(page.getByTestId("global-settings-draft-status")).toHaveText(
        "Đã đồng bộ với máy chủ.",
      );
      const settingsHistory = page.getByTestId(
        "site-settings-revision-history",
      );
      await expect(
        settingsHistory.getByText("Hiện tại", { exact: true }),
      ).toBeVisible();
      await settingsHistory
        .locator("article")
        .nth(1)
        .getByRole("button", { name: "Khôi phục" })
        .click();
      await confirmAlertDialog(page, "Khôi phục phiên bản");
      await expect(
        page.getByText("Đã khôi phục cài đặt và tạo một phiên bản mới.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByLabel("Điện thoại")).toHaveValue(originalPhone);

      await page.locator("#header-menu-label-0").fill(menuMarker);
      await page
        .getByRole("button", { name: "Lưu bản nháp điều hướng" })
        .click();
      await expect(
        page.getByText("Đã lưu bản nháp điều hướng.", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(page.locator("#header-menu-label-0")).toHaveValue(
        menuMarker,
      );
      await page.goto("/danh-sach-san-pham");
      await expect(
        page.getByRole("link", { name: originalHeaderLabel }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: menuMarker }).first(),
      ).toHaveCount(0);
      await page.goto("/admin/settings");
      const headerHistory = page.getByTestId("header-menu-revision-history");
      await headerHistory
        .locator("article")
        .nth(1)
        .getByRole("button", { name: "Khôi phục" })
        .click();
      await confirmAlertDialog(page, "Khôi phục phiên bản");
      await expect(
        page.getByText("Đã khôi phục điều hướng và tạo một phiên bản mới.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("#header-menu-label-0")).toHaveValue(
        originalHeaderLabel,
      );
    } finally {
      await page.goto("/admin/settings");
      const cleanupPhone = page.getByLabel("Điện thoại");
      if ((await cleanupPhone.inputValue()) !== originalPhone) {
        await cleanupPhone.fill(originalPhone);
        await page
          .getByRole("button", { name: "Lưu bản nháp cài đặt" })
          .click();
        await expect(
          page.getByText("Đã lưu bản nháp cài đặt website.", { exact: true }),
        ).toBeVisible();
      }
      const cleanupHeaderLabel = page.locator("#header-menu-label-0");
      if ((await cleanupHeaderLabel.inputValue()) !== originalHeaderLabel) {
        await cleanupHeaderLabel.fill(originalHeaderLabel);
        await page
          .getByRole("button", { name: "Lưu bản nháp điều hướng" })
          .click();
        await expect(
          page.getByText("Đã lưu bản nháp điều hướng.", { exact: true }),
        ).toBeVisible();
      }
    }
  });

  test("lead moves from public submission through inbox status and cleanup", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The durable lead mutation runs once; mobile has the operations smoke.",
    );
    const marker = crypto.randomUUID();
    const leadEmail = `e2e-inbox-${marker}@example.com`;
    const response = await request.post("/api/forms/submit", {
      headers: { "x-forwarded-for": `inbox-${marker}` },
      data: {
        formKey: "contact",
        payload: {
          name: "E2E Inbox",
          email: leadEmail,
          phone: "",
          message: "Inbox lifecycle",
        },
        sourcePage: "/lien-he",
        website: "",
        idempotencyKey: `inbox-${marker}`,
      },
    });
    expect(response.status()).toBe(202);
    const result = (await response.json()) as { id: string };

    await page.goto("/admin/leads");
    const card = page.getByTestId(`lead-${result.id}`);
    await expect(card.getByText(leadEmail, { exact: true })).toBeVisible();
    await card.getByLabel("Trạng thái lead").selectOption("contacted");
    await expect(card.getByLabel("Trạng thái lead")).toHaveValue("contacted");
    await card.getByLabel("Ghi chú nội bộ").fill("Đã gọi lại từ E2E");
    await card.getByLabel("Ghi chú nội bộ").blur();
    await expect
      .poll(async () => card.getByLabel("Ghi chú nội bộ").inputValue())
      .toBe("Đã gọi lại từ E2E");

    await card.getByRole("button", { name: "Xóa dữ liệu" }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(card).toHaveCount(0);
  });

  test("home can be scheduled and unscheduled without early publication", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The schedule mutation runs once; mobile has the workflow smoke.",
    );
    await page.goto("/admin/home");
    await expect(
      page.getByRole("button", { name: "Khôi phục vào bản nháp" }).first(),
    ).toBeVisible();
    const scheduled = new Date(Date.now() + 60 * 60_000);
    scheduled.setMinutes(
      scheduled.getMinutes() - scheduled.getTimezoneOffset(),
    );
    await page
      .getByLabel("Thời gian xuất bản")
      .fill(scheduled.toISOString().slice(0, 16));
    await page.getByRole("button", { name: "Lên lịch" }).click();
    await expect(
      page.getByText("Đã lên lịch xuất bản.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Đã lên lịch", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hủy lịch" }).click();
    await expect(
      page.getByText("Đã hủy lịch xuất bản.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Đã lên lịch", { exact: true })).toHaveCount(0);
  });

  test("post draft, rich text, preview, publish, slug redirect and restore work end-to-end", async ({
    context,
    page,
    request,
  }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The post mutation lifecycle runs once on desktop; mobile keeps non-mutating admin coverage.",
    );

    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `Bài viết E2E ${suffix}`;
    const bodyMarker = `Nội dung structured ${suffix}`;
    const headingMarker = `Tiêu đề nội dung ${suffix}`;
    const oldSlug = `post-e2e-${suffix}`;
    const newSlug = `${oldSlug}-moi`;
    const oldPublicPath = `/bai-viet/${oldSlug}.html`;
    const newPublicPath = `/bai-viet/${newSlug}`;

    await page.goto("/admin/posts/new");
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector("#post-title") as
            (HTMLInputElement & { _valueTracker?: unknown }) | null
        )?._valueTracker,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Thêm bài viết" }),
    ).toBeVisible();
    await page.locator("#post-title").fill(title);
    await page.locator("#post-slug").fill(oldSlug);
    await page.locator("#post-description").fill(`Mô tả kiểm thử ${suffix}`);
    await page.locator("#post-tags").fill("e2e, structured");
    await page.locator("#post-publish-date").fill(new Date().toISOString());
    await page.locator("#post-seo-title").fill(`SEO ${title}`);
    await page
      .locator("#post-seo-description")
      .fill(`SEO description ${suffix}`);

    const paragraph = page.getByRole("group", {
      name: "Block 1: Đoạn văn",
      exact: true,
    });
    await expect(
      page.getByText(
        "Có thể dán trực tiếp từ Google Docs. Trình soạn thảo chỉ nhận văn bản thuần, chuẩn hóa khoảng trắng và loại bỏ style hoặc metadata ẩn.",
        { exact: true },
      ),
    ).toBeVisible();
    const paragraphText = paragraph.getByLabel("Nội dung Đoạn văn 1, đoạn 1", {
      exact: true,
    });
    await paragraphText.evaluate(
      (control, payload) => {
        const textarea = control as HTMLTextAreaElement;
        textarea.focus();
        textarea.setSelectionRange(0, textarea.value.length);
        const clipboard = new DataTransfer();
        clipboard.setData("text/plain", payload.plainText);
        clipboard.setData("text/html", payload.styledHtml);
        textarea.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: clipboard,
          }),
        );
      },
      {
        plainText: `${bodyMarker.replace(" ", "\u00a0")}\u200b\u0000`,
        styledHtml: `<p class="docs-internal-guid" style="font-family:Arial;color:red"><span style="font-weight:700">${bodyMarker}</span><script>alert(1)</script></p>`,
      },
    );
    await expect(paragraphText).toHaveValue(bodyMarker);
    await expect(
      paragraph.getByText(
        "Đã dán văn bản thuần; style và metadata đã được loại bỏ.",
        { exact: true },
      ),
    ).toBeVisible();
    await paragraph
      .getByLabel("Liên kết Đoạn văn 1, đoạn 1", { exact: true })
      .fill("/lien-he");
    await paragraph
      .getByLabel("Đậm Đoạn văn 1, đoạn 1", { exact: true })
      .check();

    await page.getByText("Thêm block nội dung", { exact: true }).click();
    const richTextCatalogSearch = page.getByRole("searchbox", {
      name: "Tìm block nội dung",
      exact: true,
    });
    await richTextCatalogSearch.fill("tieu de");
    await expect(
      page.getByRole("button", { name: "Thêm tiêu đề", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Thêm đoạn văn", exact: true }),
    ).toHaveCount(0);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Post rich-text block catalog",
      { exclude: ["[data-sonner-toast]"] },
    );
    await page
      .getByRole("button", { name: "Thêm tiêu đề", exact: true })
      .click();
    const heading = page.getByRole("group", {
      name: "Block 2: Tiêu đề",
      exact: true,
    });
    await heading
      .getByLabel("Nội dung Tiêu đề 2, đoạn 1", { exact: true })
      .fill(headingMarker);

    await page
      .getByRole("button", { name: "Tạo bài viết", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    await expect(
      page.getByText("Đã tạo bài viết.", { exact: true }),
    ).toBeVisible();

    let postRow = page.getByRole("row").filter({ hasText: title });
    await expect(postRow).toContainText("Bản nháp");
    await postRow.getByTitle("Sửa bài viết").click();
    await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
    const postId = new URL(page.url()).pathname.split("/").at(-2);
    expect(postId).toBeTruthy();

    await expect(
      page.getByLabel("Liên kết Đoạn văn 1, đoạn 1", { exact: true }),
    ).toHaveValue("/lien-he");
    await expect(
      page.getByLabel("Đậm Đoạn văn 1, đoạn 1", { exact: true }),
    ).toBeChecked();
    const pristineDraftStatus = page.getByText(
      "Bản làm việc v1 · Đã đồng bộ với máy chủ",
      { exact: true },
    );
    await expect(pristineDraftStatus).toBeVisible();
    await page.waitForTimeout(1_800);
    await expect(pristineDraftStatus).toBeVisible();
    await expect(page.getByText(/Đã lưu v2 lúc/)).toHaveCount(0);
    const undoPostContent = page.getByRole("button", {
      name: "Hoàn tác thay đổi bài viết",
      exact: true,
    });
    const redoPostContent = page.getByRole("button", {
      name: "Làm lại thay đổi bài viết",
      exact: true,
    });
    await expect(undoPostContent).toBeDisabled();
    await expect(redoPostContent).toBeDisabled();

    const originalPostSeoTitle = await page
      .locator("#post-seo-title")
      .inputValue();
    const recoveryPostTitle = `${title} recovery`;
    const recoveryPostSeoTitle = `SEO recovery ${suffix}`;
    await page.locator("#post-title").fill(recoveryPostTitle);
    await page.locator("#post-seo-title").fill(recoveryPostSeoTitle);
    await undoPostContent.click();
    await expect(page.locator("#post-title")).toHaveValue(recoveryPostTitle);
    await expect(page.locator("#post-seo-title")).toHaveValue(
      originalPostSeoTitle,
    );
    await undoPostContent.click();
    await expect(page.locator("#post-title")).toHaveValue(title);
    await expect(pristineDraftStatus).toBeVisible();
    await expect(undoPostContent).toBeDisabled();
    await expect(redoPostContent).toBeEnabled();
    await redoPostContent.click();
    await expect(page.locator("#post-title")).toHaveValue(recoveryPostTitle);
    await redoPostContent.click();
    await expect(page.locator("#post-seo-title")).toHaveValue(
      recoveryPostSeoTitle,
    );
    await undoPostContent.click();
    await undoPostContent.click();
    await expect(page.locator("#post-title")).toHaveValue(title);
    await expect(page.locator("#post-seo-title")).toHaveValue(
      originalPostSeoTitle,
    );
    await expect(pristineDraftStatus).toBeVisible();

    const livePreviewFrame = page.frameLocator(
      'iframe[title="Xem trước bài viết Desktop"]',
    );
    await expect(page.locator("#post-live-preview")).toHaveAttribute(
      "data-cms-preview-connection",
      "connected",
      { timeout: 20_000 },
    );
    const postWorkspace = page.locator("[data-cms-post-workspace-mode]");
    const openPostFocusMode = page.getByRole("button", {
      name: "Mở chế độ tập trung bài viết",
    });
    await openPostFocusMode.click();
    await expect(postWorkspace).toHaveAttribute(
      "data-cms-post-workspace-mode",
      "focused",
    );
    await expect(postWorkspace).toHaveAttribute("role", "dialog");
    await expect(
      page.getByRole("button", { name: "Thoát chế độ tập trung bài viết" }),
    ).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Post focused visual workspace",
      { exclude: ["[data-sonner-toast]", "#post-live-preview iframe"] },
    );
    await page.keyboard.press("Escape");
    await expect(postWorkspace).toHaveAttribute(
      "data-cms-post-workspace-mode",
      "standard",
    );
    await expect(openPostFocusMode).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe("hidden");
    await expect(
      livePreviewFrame.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      livePreviewFrame.getByText("Bản đang soạn · riêng tư", { exact: true }),
    ).toBeVisible();

    await livePreviewFrame
      .getByRole("button", { name: "Chỉnh Tiêu đề", exact: true })
      .click();
    await expect(page.locator("#post-title")).toBeFocused();
    await expect(page.locator("#post-live-preview")).toHaveAttribute(
      "data-cms-selected-post-field",
      "title",
    );
    await expect(
      page.getByText("Từ canvas: Tiêu đề", { exact: true }),
    ).toBeVisible();

    const previewDescriptionField = livePreviewFrame.getByRole("button", {
      name: "Chỉnh Mô tả",
      exact: true,
    });
    await previewDescriptionField.hover();
    await expect(
      livePreviewFrame.locator('[data-cms-field-hint="true"]'),
    ).toHaveAttribute("data-cms-field-label", "Mô tả");
    await previewDescriptionField.click();
    await expect(page.locator("#post-description")).toBeFocused();

    const previewContentTrigger = livePreviewFrame.getByRole("button", {
      name: "Chỉnh nội dung bài viết",
      exact: true,
    });
    await previewContentTrigger.focus();
    await previewContentTrigger.press("Enter");
    await expect(
      page.getByLabel("Nội dung Đoạn văn 1, đoạn 1", { exact: true }),
    ).toBeFocused();
    await expect(page.locator("#post-live-preview")).toHaveAttribute(
      "data-cms-selected-post-field",
      "content",
    );

    const previewStructuredBlocks = livePreviewFrame.locator(
      '[data-cms-preview-field="true"][data-cms-post-block-index]',
    );
    await expect(previewStructuredBlocks).toHaveCount(2);
    const previewHeadingBlock = livePreviewFrame.locator(
      '[data-cms-preview-field="true"][data-cms-post-block-index="1"]',
    );
    const originalHeadingBlockId = await previewHeadingBlock.getAttribute(
      "data-cms-post-block-id",
    );
    expect(originalHeadingBlockId).not.toBeNull();
    expect(originalHeadingBlockId!).toMatch(/^rich-/);
    await previewHeadingBlock.focus();
    await previewHeadingBlock.press("Enter");
    await expect(page.locator("#post-content-block-1")).toBeFocused();

    const previewHeadingDragHandle = livePreviewFrame.getByRole("button", {
      name: "Kéo block 2",
      exact: true,
    });
    await previewHeadingDragHandle.focus();
    await previewHeadingDragHandle.dragTo(previewStructuredBlocks.first(), {
      targetPosition: { x: 24, y: 4 },
    });
    await expect(previewStructuredBlocks.first()).toContainText(headingMarker);
    await expect(
      page.getByLabel("Nội dung Tiêu đề 1, đoạn 1", { exact: true }),
    ).toHaveValue(headingMarker);

    await livePreviewFrame
      .getByRole("button", { name: "Thêm đoạn sau block 1", exact: true })
      .click();
    await expect(previewStructuredBlocks).toHaveCount(3);
    await livePreviewFrame
      .getByRole("button", { name: "Nhân bản block 1", exact: true })
      .click();
    await expect(previewStructuredBlocks).toHaveCount(4);
    const duplicatedSequenceIds = await previewStructuredBlocks.evaluateAll(
      (blocks) =>
        blocks.map((block) => block.getAttribute("data-cms-post-block-id")),
    );
    expect(duplicatedSequenceIds).toContain(originalHeadingBlockId);
    expect(new Set(duplicatedSequenceIds).size).toBe(4);
    await livePreviewFrame
      .getByRole("button", { name: "Xóa block 2", exact: true })
      .click();
    await expect(previewStructuredBlocks).toHaveCount(3);
    await livePreviewFrame
      .getByRole("button", { name: "Xóa block 2", exact: true })
      .click();
    await expect(previewStructuredBlocks).toHaveCount(2);
    await livePreviewFrame
      .getByRole("button", { name: "Đưa block 1 xuống", exact: true })
      .focus();
    await livePreviewFrame
      .getByRole("button", { name: "Đưa block 1 xuống", exact: true })
      .press("Enter");
    await expect(previewStructuredBlocks.first()).toContainText(bodyMarker);
    await expect(
      page.getByLabel("Nội dung Tiêu đề 2, đoạn 1", { exact: true }),
    ).toHaveValue(headingMarker);

    await expect(undoPostContent).toBeEnabled();
    await undoPostContent.click();
    await expect(previewStructuredBlocks.first()).toContainText(headingMarker);
    await expect(redoPostContent).toBeEnabled();
    await redoPostContent.focus();
    await page.keyboard.press("Control+Shift+Z");
    await expect(previewStructuredBlocks.first()).toContainText(bodyMarker);

    const historyHeadingMarker = `${headingMarker} lịch sử`;
    const postHeadingInput = page.getByLabel("Nội dung Tiêu đề 2, đoạn 1", {
      exact: true,
    });
    await postHeadingInput.fill(historyHeadingMarker);
    await expect(
      livePreviewFrame.getByText(historyHeadingMarker, { exact: true }),
    ).toBeVisible();
    await undoPostContent.click();
    await expect(postHeadingInput).toHaveValue(headingMarker);
    await redoPostContent.click();
    await expect(postHeadingInput).toHaveValue(historyHeadingMarker);
    await undoPostContent.click();
    await expect(postHeadingInput).toHaveValue(headingMarker);

    const livePreviewMarker = `Mô tả live preview ${suffix}`;
    await page.locator("#post-description").fill(livePreviewMarker);
    await expect(page.getByText(/Có thay đổi chưa lưu/)).toBeVisible();
    await expect(
      livePreviewFrame.getByText(livePreviewMarker, { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    await page
      .getByRole("button", { name: "Xem trước bài viết Mobile" })
      .click();
    await expect(
      page.locator('iframe[title="Xem trước bài viết Mobile"]'),
    ).toHaveCSS("width", "390px");
    await expect(
      page
        .frameLocator('iframe[title="Xem trước bài viết Mobile"]')
        .getByText(livePreviewMarker, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Xem trước bài viết Desktop" })
      .click();

    const autosaveMarker = `Mô tả autosave ${suffix}`;
    await page.locator("#post-description").fill(autosaveMarker);
    await expect(page.getByText(/Có thay đổi chưa lưu/)).toBeVisible();
    await expect(page.getByText(/Đã lưu v\d+ lúc/)).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(page.locator("#post-description")).toHaveValue(
      autosaveMarker,
      {
        timeout: 15_000,
      },
    );
    const reloadedHeadingBlock = livePreviewFrame
      .locator(
        '[data-cms-preview-field="true"][data-cms-post-block-index][data-cms-post-block-id]',
      )
      .filter({ hasText: headingMarker });
    await expect(reloadedHeadingBlock).toHaveCount(1);
    await expect(reloadedHeadingBlock).toHaveAttribute(
      "data-cms-post-block-id",
      originalHeadingBlockId!,
    );
    await expect(undoPostContent).toBeDisabled();
    await expect(redoPostContent).toBeDisabled();

    const navigationMarker = `Mô tả navigation flush ${suffix}`;
    await page.locator("#post-description").fill(navigationMarker);
    await expect(page.getByText(/Có thay đổi chưa lưu/)).toBeVisible();
    await page
      .getByRole("link", { name: "Trang nội dung", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/pages$/);
    await page.goto(`/admin/posts/${postId}/edit`);
    await expect(page.locator("#post-description")).toHaveValue(
      navigationMarker,
      { timeout: 15_000 },
    );

    const previewMarker = `Mô tả preview flush ${suffix}`;
    await page.locator("#post-description").fill(previewMarker);
    await expect(page.getByText(/Có thay đổi chưa lưu/)).toBeVisible();
    const dirtyPreviewPromise = context.waitForEvent("page");
    await page.getByRole("link", { name: "Xem trước", exact: true }).click();
    const dirtyPreview = await dirtyPreviewPromise;
    await dirtyPreview.waitForURL(
      new RegExp(`/admin/posts/${postId}/preview$`),
    );
    await expect(
      dirtyPreview.getByText(previewMarker, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await dirtyPreview.close();

    const stalePostPage = await context.newPage();
    await stalePostPage.goto(`/admin/posts/${postId}/edit`);
    await expect(stalePostPage.locator("#post-description")).toHaveValue(
      previewMarker,
    );

    const winnerDescription = `Mô tả winner ${suffix}`;
    await page.locator("#post-description").fill(winnerDescription);
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();

    await stalePostPage
      .locator("#post-description")
      .fill(`Mô tả stale ${suffix}`);
    await stalePostPage
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(
      stalePostPage.getByText("Xung đột phiên bản", { exact: true }),
    ).toBeVisible();
    await expect(
      stalePostPage.getByText("Có xung đột phiên bản", { exact: true }),
    ).toBeVisible();
    await stalePostPage
      .getByRole("button", {
        name: "Tải phiên bản từ máy chủ",
        exact: true,
      })
      .click();
    await expect(stalePostPage.locator("#post-description")).toHaveValue(
      winnerDescription,
    );
    await stalePostPage.close();

    const preview = await context.newPage();
    const previewResponse = await preview.goto(
      `/admin/posts/${postId}/preview`,
    );
    expect(previewResponse?.headers()["cache-control"]).toContain("no-store");
    expect(previewResponse?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(preview.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      preview.getByText(headingMarker, { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByRole("link", { name: bodyMarker, exact: true }),
    ).toHaveAttribute("href", "/lien-he");
    await expect(preview.locator("[data-cms-post-field]")).toHaveCount(0);
    await expectNoAutomatedAccessibilityViolations(
      preview,
      "Detached post draft preview",
    );
    await preview.close();

    const unpublished = await context.newPage();
    await unpublished.goto(oldPublicPath);
    await expect(
      unpublished.getByText(bodyMarker, { exact: true }),
    ).toHaveCount(0);
    await unpublished.close();

    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(page.getByText("Đã xuất bản.", { exact: true })).toBeVisible();

    const published = await context.newPage();
    await published.goto(oldPublicPath);
    await expect(
      published.getByRole("link", { name: bodyMarker, exact: true }),
    ).toHaveAttribute("href", "/lien-he");
    await published.close();

    await page.locator("#post-slug").fill(newSlug);
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu bản nháp.", { exact: true }),
    ).toBeVisible();

    const draftSlugPublic = await context.newPage();
    await draftSlugPublic.goto(oldPublicPath);
    await expect(
      draftSlugPublic.getByText(bodyMarker, { exact: true }),
    ).toBeVisible();
    await draftSlugPublic.close();

    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(page.getByText("Đã xuất bản.", { exact: true })).toBeVisible();

    await expect
      .poll(async () => {
        const response = await request.get(oldPublicPath, { maxRedirects: 0 });
        return {
          location: response.headers().location,
          status: response.status(),
        };
      })
      .toEqual({ location: newPublicPath, status: 301 });

    const movedPublic = await context.newPage();
    await movedPublic.goto(newPublicPath);
    await expect(
      movedPublic.getByText(bodyMarker, { exact: true }),
    ).toBeVisible();
    await movedPublic.close();

    const postRevisionCards = page.locator('[data-testid^="post-revision-v"]');
    await expect(postRevisionCards).toHaveCount(2);
    const originalPostRevision = postRevisionCards.last();
    await originalPostRevision
      .getByRole("button", { name: "So sánh", exact: true })
      .click();
    const postRevisionComparison = originalPostRevision.getByRole("region", {
      name: /Thay đổi của phiên bản v\d+/,
    });
    const postSlugComparison =
      postRevisionComparison.getByLabel("So sánh Đường dẫn");
    await expect(postSlugComparison).toContainText("Phiên bản");
    await expect(postSlugComparison).toContainText("Bản nháp");
    await expect(postSlugComparison).toContainText(`/${oldSlug}`);
    await expect(postSlugComparison).toContainText(`/${newSlug}`);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Expanded post revision comparison",
      { exclude: ["[data-sonner-toast]", "#post-live-preview iframe"] },
    );
    await originalPostRevision
      .getByRole("button", {
        name: "Khôi phục bản nháp",
        exact: true,
      })
      .click();
    await confirmAlertDialog(page, "Khôi phục bản nháp");
    await expect(
      page.getByText("Đã khôi phục vào bản nháp.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#post-slug")).toHaveValue(oldSlug);

    await page.goto("/admin/posts");
    postRow = page.getByRole("row").filter({ hasText: title });
    await postRow
      .getByRole("button", { name: `Xóa ${title}`, exact: true })
      .click();
    await confirmAlertDialog(page, "Xóa");
    await expect(
      page.getByText("Đã xóa bài viết.", { exact: true }),
    ).toBeVisible();
    await expect(postRow).toHaveCount(0);

    await page.goto("/admin/redirects");
    const redirectRow = page
      .getByRole("row")
      .filter({ hasText: `/bai-viet/${oldSlug}` });
    await expect(redirectRow).toBeVisible();
    await redirectRow
      .getByRole("button", { name: `Xóa /bai-viet/${oldSlug}` })
      .click();
    await confirmAlertDialog(page, "Xóa");
    await expect(redirectRow).toHaveCount(0);
  });

  test("deployed Cloudflare page API passes the neutral provider conformance suite", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The shared-state provider mutation suite runs once on desktop.",
    );

    const suffix = crypto.randomUUID().slice(0, 8);
    const baseUrl = new URL(page.url()).origin;
    const cookie = (await context.cookies(baseUrl))
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    expect(cookie).not.toBe("");

    const initial: StagingStandardPageContent = {
      title: `Provider conformance ${suffix}`,
      slug: `provider-conformance-${suffix}`,
      template: "standard",
      blocks: [
        {
          ...defaultRichTextBlock,
          id: `provider-rich-text-${suffix}`,
          data: { content: `Initial provider content ${suffix}` },
        },
      ],
      seo: {
        title: `Provider conformance ${suffix}`,
        description: "Initial provider description",
        canonicalUrl: "",
        ogImage: "",
        robotsIndex: true,
        robotsFollow: true,
      },
    };
    const changed: StagingStandardPageContent = {
      ...initial,
      title: `Provider changed ${suffix}`,
      slug: `${initial.slug}-changed`,
      blocks: [
        {
          ...defaultRichTextBlock,
          id: `provider-rich-text-${suffix}`,
          data: { content: `Changed provider content ${suffix}` },
        },
      ],
      seo: {
        ...initial.seo,
        title: `Provider changed ${suffix}`,
        description: "Changed provider description",
      },
    };
    const provider = createStagingPageProvider({ baseUrl, cookie });

    try {
      await expect(
        runPageProviderConformance({
          provider,
          initial,
          changed,
          actorId: "authenticated-staging-conformance",
          documentId: `provider-conformance-${suffix}`,
        }),
      ).resolves.toEqual({
        delete: true,
        draftIsolation: true,
        optimisticConflict: true,
        publish: true,
        revisionRestore: true,
        scheduling: true,
        unpublish: true,
      });
    } finally {
      await provider.cleanup();
    }
  });

  test("standard page draft and publish use immutable snapshots", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The standard-page mutation lifecycle runs once on desktop.",
    );
    await cleanupInterruptedStandardPageFixtures(page);
    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `Standard provider ${suffix}`;
    const slug = `standard-provider-${suffix}`;
    const movedSlug = `${slug}-moved`;
    const firstCta = `First CTA ${suffix}`;
    const secondCta = `Second CTA ${suffix}`;

    await page.goto("/admin/pages");
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector("#page-title") as
            (HTMLInputElement & { _valueTracker?: unknown }) | null
        )?._valueTracker,
      ),
    );
    await page.locator("#page-title").fill(title);
    await page.locator("#page-slug").fill(slug);
    const standardBlockSearch = page.getByRole("searchbox", {
      name: "Tìm loại khối",
    });
    await standardBlockSearch.fill("keu goi");
    await expect(
      page.getByRole("button", { name: "Thêm kêu gọi hành động" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Thêm văn bản" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Thêm kêu gọi hành động" }).click();
    await page.locator("#cta-title").fill(firstCta);
    const unsavedStandardCanvas = page.frameLocator(
      'iframe[title="Xem trước trang Desktop"]',
    );
    const standardPreviewFrame = page.locator(
      'iframe[title="Xem trước trang Desktop"]',
    );
    await expect(page.locator("#standard-page-preview")).toHaveAttribute(
      "data-cms-preview-connection",
      "connected",
      { timeout: 20_000 },
    );
    await expect(standardPreviewFrame).toHaveAttribute(
      "src",
      /\/admin\/pages\/new-standard-page-draft\/preview(?:\?|$)/,
    );
    await expect(
      unsavedStandardCanvas.getByText("Bản đang soạn · riêng tư", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      unsavedStandardCanvas.getByRole("heading", { name: firstCta }),
    ).toBeVisible();
    await unsavedStandardCanvas
      .getByRole("button", { name: "Chỉnh sửa tiêu đề CTA" })
      .click();
    await expect(page.locator("#cta-title")).toBeFocused();
    const unsavedObserver = await page.context().newPage();
    try {
      await unsavedObserver.goto("/admin/pages");
      await expect(
        unsavedObserver.getByRole("row").filter({ hasText: title }),
      ).toHaveCount(0);
      await unsavedObserver.waitForFunction(() =>
        Boolean(
          (
            document.querySelector("#page-title") as
              (HTMLInputElement & { _valueTracker?: unknown }) | null
          )?._valueTracker,
        ),
      );
      const recoveryTitle = `Unsaved recovery ${suffix}`;
      const recoveryTitleField = unsavedObserver.locator("#page-title");
      const recoveryUndo = unsavedObserver.getByRole("button", {
        name: "Hoàn tác thay đổi trang",
      });
      const recoveryRedo = unsavedObserver.getByRole("button", {
        name: "Làm lại thay đổi trang",
      });
      await recoveryTitleField.fill(recoveryTitle);
      await expect(
        unsavedObserver.getByText("Có thay đổi chưa lưu", { exact: true }),
      ).toBeVisible();
      await expect(recoveryUndo).toBeEnabled();
      await recoveryUndo.click();
      await expect(recoveryTitleField).toHaveValue("");
      await expect(
        unsavedObserver.getByText("Đã đồng bộ với máy chủ", { exact: true }),
      ).toBeVisible();
      await expect(recoveryUndo).toBeDisabled();
      await expect(recoveryRedo).toBeEnabled();
      await recoveryRedo.click();
      await expect(recoveryTitleField).toHaveValue(recoveryTitle);
      await expect(
        unsavedObserver.getByText("Có thay đổi chưa lưu", { exact: true }),
      ).toBeVisible();
      await recoveryUndo.click();
      await expect(recoveryTitleField).toHaveValue("");
      await unsavedObserver
        .getByRole("link", { name: "Bài viết", exact: true })
        .click();
      await expect(unsavedObserver).toHaveURL(/\/admin\/posts$/);
      await unsavedObserver.goto("/admin/pages");
      await expect(
        unsavedObserver.getByRole("row").filter({ hasText: recoveryTitle }),
      ).toHaveCount(0);
    } finally {
      await unsavedObserver.close();
      await page.bringToFront();
    }
    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(
      page.getByText("Đã xuất bản trang.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(standardPreviewFrame).toHaveAttribute(
      "src",
      /\/admin\/pages\/(?!new-standard-page-draft\/)[^/]+\/preview(?:\?|$)/,
    );
    await expect(page.locator("#standard-page-preview")).toHaveAttribute(
      "data-cms-preview-connection",
      "connected",
      { timeout: 20_000 },
    );

    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: firstCta })).toBeVisible();

    await page.goto("/admin/pages");
    const row = page.getByRole("row").filter({ hasText: title });
    await row.getByRole("button", { name: "Sửa" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?pageId=[^&]+$/);
    const pageId = new URL(page.url()).searchParams.get("pageId");
    expect(pageId).toBeTruthy();
    await page.reload();
    await expect(page.locator("#page-title")).toHaveValue(title);
    await page.getByRole("button", { name: "1. Văn bản" }).click();
    const originalNestedRichTextId = await page
      .locator("[data-cms-rich-text-block-id]")
      .first()
      .getAttribute("data-cms-rich-text-block-id");
    expect(originalNestedRichTextId).not.toBeNull();
    expect(originalNestedRichTextId!).toMatch(/^rich-/);
    const authoringCanvas = page.frameLocator(
      'iframe[title="Xem trước trang Desktop"]',
    );
    await expect(page.locator("#standard-page-preview")).toHaveAttribute(
      "data-cms-preview-connection",
      "connected",
      { timeout: 20_000 },
    );
    const standardWorkspace = page.locator(
      "[data-cms-standard-workspace-mode]",
    );
    const openStandardFocusMode = page.getByRole("button", {
      name: "Mở chế độ tập trung trang",
    });
    await openStandardFocusMode.click();
    await expect(standardWorkspace).toHaveAttribute(
      "data-cms-standard-workspace-mode",
      "focused",
    );
    await expect(standardWorkspace).toHaveAttribute("role", "dialog");
    await expect(
      page.getByRole("button", { name: "Thoát chế độ tập trung trang" }),
    ).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Standard-page focused visual workspace",
      { exclude: ["#standard-page-preview iframe"] },
    );
    await page.keyboard.press("Escape");
    await expect(standardWorkspace).toHaveAttribute(
      "data-cms-standard-workspace-mode",
      "standard",
    );
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe("hidden");
    await expect(openStandardFocusMode).toBeFocused();
    const undoStandardPage = page.getByRole("button", {
      name: "Hoàn tác thay đổi trang",
    });
    const redoStandardPage = page.getByRole("button", {
      name: "Làm lại thay đổi trang",
    });
    await expect(undoStandardPage).toBeDisabled();
    await expect(redoStandardPage).toBeDisabled();
    const firstCtaCanvasBlock = authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(1);
    const firstCtaBlockId = await firstCtaCanvasBlock.getAttribute(
      "data-cms-standard-block",
    );
    expect(firstCtaBlockId).toMatch(/^standard-cta-/);
    await firstCtaCanvasBlock
      .getByRole("button", { name: "Chỉnh sửa liên kết CTA" })
      .dispatchEvent("click");
    await expect(page.locator("[data-cms-canvas-last-intent]")).toHaveAttribute(
      "data-cms-canvas-last-intent",
      "select",
    );
    await expect(page.locator("[data-cms-canvas-field-path]")).toHaveAttribute(
      "data-cms-canvas-field-path",
      "data.href",
    );
    await expect(page.locator("#cta-href")).toBeFocused();
    await firstCtaCanvasBlock
      .getByRole("button", { name: "Chỉnh sửa tiêu đề CTA" })
      .press("Enter");
    await expect(page.locator("[data-cms-canvas-field-path]")).toHaveAttribute(
      "data-cms-canvas-field-path",
      "data.title",
    );
    await expect(page.locator("#cta-title")).toBeFocused();
    await authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(1)
      .getByRole("button", { name: "Sao chép khối" })
      .press("Enter");
    await expect(page.locator("[data-cms-canvas-last-intent]")).toHaveAttribute(
      "data-cms-canvas-last-intent",
      "duplicate",
    );
    await expect(
      page.getByRole("button", { name: "3. Kêu gọi hành động" }),
    ).toBeVisible();
    await expect(
      authoringCanvas.locator("[data-cms-standard-block]"),
    ).toHaveCount(3);
    const duplicatedCtaCanvasBlock = authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(2);
    await expect(duplicatedCtaCanvasBlock).not.toHaveAttribute(
      "data-cms-standard-block",
      firstCtaBlockId!,
    );
    await duplicatedCtaCanvasBlock
      .getByRole("button", { name: "Mở danh mục khối sau khối" })
      .dispatchEvent("click");
    const canvasBlockCatalog = duplicatedCtaCanvasBlock.getByRole("dialog", {
      name: "Danh mục khối sau Kêu gọi hành động",
    });
    await expect(canvasBlockCatalog).toBeVisible();
    await canvasBlockCatalog
      .getByRole("searchbox", { name: "Tìm loại khối" })
      .fill("van ban");
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Standard-page canvas block catalog",
      { exclude: ["[data-sonner-toast]"] },
    );
    const insertTextAfterDuplicate = canvasBlockCatalog.getByRole("button", {
      name: "Thêm văn bản sau khối",
    });
    await expect(insertTextAfterDuplicate).toBeVisible();
    await insertTextAfterDuplicate.press("Enter");
    await expect(page.locator("[data-cms-canvas-last-intent]")).toHaveAttribute(
      "data-cms-canvas-last-intent",
      "insert",
    );
    await expect(
      authoringCanvas.locator("[data-cms-standard-block]"),
    ).toHaveCount(4);
    await expect(page.getByRole("button", { name: "4. Văn bản" })).toBeVisible({
      timeout: 20_000,
    });
    await authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(3)
      .getByRole("button", { name: "Kéo khối để sắp xếp trên canvas" })
      .dragTo(authoringCanvas.locator("[data-cms-standard-block]").nth(2), {
        targetPosition: { x: 24, y: 4 },
      });
    await expect(page.locator("[data-cms-canvas-last-intent]")).toHaveAttribute(
      "data-cms-canvas-last-intent",
      "move",
    );
    await expect(
      page.getByRole("button", { name: "3. Văn bản" }),
    ).toBeVisible();
    await expect(undoStandardPage).toBeEnabled();
    await undoStandardPage.click();
    await expect(
      page.getByRole("button", { name: "4. Văn bản" }),
    ).toBeVisible();
    await expect(redoStandardPage).toBeEnabled();
    await page.keyboard.press("Control+Shift+Z");
    await expect(
      page.getByRole("button", { name: "3. Văn bản" }),
    ).toBeVisible();
    await authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(2)
      .getByRole("button", { name: "Xóa khối" })
      .press("Enter");
    await authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(2)
      .getByRole("button", { name: "Chỉnh sửa tiêu đề CTA" })
      .press("Enter");
    await authoringCanvas
      .locator("[data-cms-standard-block]")
      .nth(2)
      .getByRole("button", { name: "Xóa khối" })
      .press("Enter");
    await expect(
      page.getByRole("button", { name: "3. Kêu gọi hành động" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "2. Kêu gọi hành động" }).click();
    await page.locator("#cta-title").fill(secondCta);
    await undoStandardPage.click();
    await expect(page.locator("#cta-title")).toHaveValue(firstCta);
    await redoStandardPage.click();
    await expect(page.locator("#cta-title")).toHaveValue(secondCta);
    const livePreview = page.frameLocator(
      'iframe[title="Xem trước trang Desktop"]',
    );
    await expect(
      livePreview.getByRole("heading", { name: secondCta }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Xem trước Mobile" }).click();
    await expect(
      page.getByRole("button", { name: "Xem trước Mobile" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('iframe[title="Xem trước trang Mobile"]'),
    ).toHaveAttribute("style", /width: 390px/);
    await expect(page.getByText("Đã lưu lúc", { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await page.reload();
    const reloadedAuthoringCanvas = page.frameLocator(
      'iframe[title="Xem trước trang Desktop"]',
    );
    await expect(page.locator("#standard-page-preview")).toHaveAttribute(
      "data-cms-preview-connection",
      "connected",
      { timeout: 20_000 },
    );
    await expect(
      reloadedAuthoringCanvas.locator("[data-cms-standard-block]").nth(1),
    ).toHaveAttribute("data-cms-standard-block", firstCtaBlockId!);
    await page.getByRole("button", { name: "1. Văn bản" }).click();
    await expect(
      page.locator("[data-cms-rich-text-block-id]").first(),
    ).toHaveAttribute("data-cms-rich-text-block-id", originalNestedRichTextId!);
    await page.getByRole("button", { name: "2. Kêu gọi hành động" }).click();
    await expect(page.locator("#cta-title")).toHaveValue(secondCta);
    await expect(
      page.getByRole("button", { name: "Hoàn tác thay đổi trang" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Làm lại thay đổi trang" }),
    ).toBeDisabled();

    const secondEditorContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      storageState: await page.context().storageState(),
    });
    try {
      const secondEditor = await secondEditorContext.newPage();
      await secondEditor.goto(`/admin/pages?pageId=${pageId}`);
      await waitForAdminHydration(secondEditor);
      await expect(secondEditor.locator("#page-title")).toHaveValue(title);
      const secondTabSeo = `Second tab ${suffix}`;
      await secondEditor.locator("#page-seo-title").fill(secondTabSeo);
      await expect(
        secondEditor.getByText("Đã lưu lúc", { exact: false }),
      ).toBeVisible({ timeout: 20_000 });

      await page.locator("#page-seo-title").fill(`Stale tab ${suffix}`);
      await expect(
        page.getByText("Xung đột phiên bản", { exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: "Tải bản trên máy chủ" }).click();
      await expect(page.locator("#page-seo-title")).toHaveValue(secondTabSeo);
    } finally {
      await secondEditorContext.close();
    }

    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: firstCta })).toBeVisible();
    await expect(page.getByRole("heading", { name: secondCta })).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /^Chỉnh sửa (nội dung văn bản|lưới sản phẩm|tiêu đề CTA|liên kết CTA)$/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Kéo khối để sắp xếp trên canvas",
      }),
    ).toHaveCount(0);

    const previewUrl = `/admin/pages/${pageId}/preview`;
    const previewResponse = await page.goto(previewUrl);
    expect(previewResponse?.headers()["cache-control"]).toContain("private");
    expect(previewResponse?.headers()["cache-control"]).toContain("no-store");
    expect(previewResponse?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page.getByText("Bản nháp đã lưu · riêng tư", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: secondCta })).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /^Chỉnh sửa (nội dung văn bản|lưới sản phẩm|tiêu đề CTA|liên kết CTA)$/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Kéo khối để sắp xếp trên canvas",
      }),
    ).toHaveCount(0);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Private standard-page draft preview",
    );

    const anonymousContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    try {
      const anonymousPage = await anonymousContext.newPage();
      await anonymousPage.goto(previewUrl);
      await expect(anonymousPage).toHaveURL(/\/dang-nhap/);
      await expect(
        anonymousPage.getByText("Bản nháp đã lưu · riêng tư", { exact: true }),
      ).toHaveCount(0);
    } finally {
      await anonymousContext.close();
    }

    await page.goto("/admin/pages");
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "Sửa" })
      .click();
    const standardRevision = page
      .locator('[data-testid^="standard-page-revision-v"]')
      .first();
    await standardRevision
      .getByRole("button", { name: "So sánh", exact: true })
      .click();
    const standardRevisionComparison = standardRevision.getByRole("region", {
      name: /Thay đổi của phiên bản \d+/,
    });
    const standardBlockComparison = standardRevisionComparison.getByLabel(
      "So sánh Nội dung và cấu trúc block",
    );
    await expect(standardBlockComparison).toContainText("Phiên bản");
    await expect(standardBlockComparison).toContainText("Bản nháp");
    await expect(standardBlockComparison).toContainText(firstCta);
    await expect(standardBlockComparison).toContainText(secondCta);
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Expanded standard-page revision comparison",
      { exclude: ["[data-sonner-toast]", "#standard-page-preview iframe"] },
    );
    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(
      page.getByText("Đã xuất bản trang.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: secondCta })).toBeVisible();

    await page.goto("/admin/pages");
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "Sửa" })
      .click();
    await page.locator("#page-slug").fill(movedSlug);
    await expect(
      page.getByText(`Tạo chuyển hướng 301 từ /${slug}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await confirmAlertDialog(page, "Xuất bản");
    await expect(
      page.getByText("Đã xuất bản trang.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto(`/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/${movedSlug}$`));
    await expect(page.getByRole("heading", { name: secondCta })).toBeVisible();

    await page.goto("/admin/pages");
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "Sửa" })
      .click();
    await page.getByRole("button", { name: "Hủy xuất bản" }).click();
    await confirmAlertDialog(page, "Hủy xuất bản");
    await expect(
      page.getByText("Đã hủy xuất bản trang.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#standard-page-preview")).toHaveAttribute(
      "data-cms-preview-connection",
      "connected",
      { timeout: 20_000 },
    );
    await openStandardFocusMode.click();
    await expect(standardWorkspace).toHaveAttribute(
      "data-cms-standard-workspace-mode",
      "focused",
    );
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(standardWorkspace).toHaveAttribute(
      "data-cms-standard-workspace-mode",
      "standard",
    );
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe("hidden");
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`/${movedSlug}`);
    await expect(page.getByRole("heading", { name: secondCta })).toHaveCount(0);

    await page.goto("/admin/pages");
    const cleanupRow = page.getByRole("row").filter({ hasText: title });
    await cleanupRow.getByRole("button", { name: `Xóa ${title}` }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(cleanupRow).toHaveCount(0);
  });

  test("editorial review stays bound to one saved version and appears in the reviewer queue", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The review mutation lifecycle runs once; responsive admin coverage is separate.",
    );
    await cleanupInterruptedStandardPageFixtures(page);
    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `Standard provider ${suffix}`;
    const slug = `review-workflow-${suffix}`;

    await page.goto("/admin/pages");
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector("#page-title") as
            (HTMLInputElement & { _valueTracker?: unknown }) | null
        )?._valueTracker,
      ),
    );
    await page.locator("#page-title").fill(title);
    await page.locator("#page-slug").fill(slug);
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    await expect(
      page.getByText("Đã tạo trang.", { exact: true }),
    ).toBeVisible();

    const reviewPanel = page.getByTestId("editorial-review-panel");
    await expect(
      reviewPanel.getByRole("heading", { name: "Chưa gửi xét duyệt" }),
    ).toBeVisible();
    await reviewPanel
      .getByLabel("Ghi chú cho người duyệt")
      .fill(`Kiểm tra bản ${suffix}`);
    await reviewPanel.getByLabel("Hạn duyệt").fill("2099-01-01T10:00");
    await reviewPanel
      .getByRole("checkbox", { name: "Chủ sở hữu", exact: true })
      .check();
    await reviewPanel
      .getByRole("checkbox", { name: "Quản trị viên", exact: true })
      .check();
    await reviewPanel
      .getByLabel("Danh sách kiểm tra bắt buộc")
      .fill("Kiểm tra SEO\nXác nhận pháp lý");
    await reviewPanel
      .getByRole("button", { name: /Gửi duyệt bản v\d+/ })
      .click();
    await expect(
      reviewPanel.getByRole("heading", { name: /đang chờ duyệt/ }),
    ).toBeVisible();
    await expect(reviewPanel.getByText(/Hạn duyệt:/)).toBeVisible();
    const assignmentSummary = reviewPanel.getByText(/Phụ trách:/);
    await expect(assignmentSummary).toContainText("Chủ sở hữu");
    await expect(assignmentSummary).toContainText("Quản trị viên");

    const editorialComments = reviewPanel.getByTestId("editorial-comments");
    const commentBody = `Kiểm tra tuyên bố chiến dịch ${suffix}`;
    const replyBody = `Đã đối chiếu nguồn cho ${suffix}`;
    await editorialComments.getByLabel("Bình luận mới").fill(commentBody);
    await editorialComments.getByText("Nhắc người tham gia").click();
    await editorialComments.getByRole("checkbox").first().check();
    await editorialComments
      .getByRole("button", { name: "Tạo luồng bình luận" })
      .click();
    const commentThread = editorialComments.locator("article").filter({
      hasText: commentBody,
    });
    await expect(commentThread).toBeVisible();
    await expect(editorialComments.getByText("1 đang mở")).toBeVisible();
    await commentThread.getByLabel("Phản hồi").fill(replyBody);
    await commentThread.getByRole("button", { name: "Gửi phản hồi" }).click();
    await expect(commentThread.getByText(replyBody)).toBeVisible();
    await expect(commentThread.getByText(/· v2/)).toBeVisible();
    await commentThread
      .getByRole("button", { name: "Đánh dấu đã xử lý" })
      .click();
    await expect(
      commentThread.getByText("Đã xử lý", { exact: true }),
    ).toBeVisible();
    await expect(editorialComments.getByText("0 đang mở")).toBeVisible();

    await page.goto("/admin/dashboard");
    const reviewQueue = page.getByRole("region", {
      name: "Nội dung đang chuyển động",
    });
    await expect(
      reviewQueue.getByRole("heading", { name: "Lịch xét duyệt" }),
    ).toBeVisible();
    await reviewQueue.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?pageId=/);

    const decisionPanel = page.getByTestId("editorial-review-panel");
    const persistedThread = decisionPanel.locator("article").filter({
      hasText: commentBody,
    });
    await expect(persistedThread).toContainText(replyBody);
    await expect(
      persistedThread.getByText("Đã xử lý", { exact: true }),
    ).toBeVisible();
    await decisionPanel
      .getByLabel("Ghi chú xét duyệt")
      .fill("Bản xem trước và nội dung đã được kiểm tra.");
    const approveReview = decisionPanel.getByRole("button", {
      name: /Duyệt bản v\d+/,
    });
    await expect(approveReview).toBeDisabled();
    await decisionPanel.getByRole("checkbox", { name: /Kiểm tra SEO/ }).check();
    await decisionPanel
      .getByRole("checkbox", { name: /Xác nhận pháp lý/ })
      .check();
    await expect(approveReview).toBeEnabled();
    await approveReview.click();
    await expect(
      decisionPanel.getByRole("heading", { name: /đã được duyệt/ }),
    ).toBeVisible();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Version-bound editorial review",
      { exclude: ["iframe", "[data-sonner-toast]"] },
    );

    await page.goto("/admin/dashboard");
    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
    ).toHaveCount(0);
    await page.goto("/admin/pages");
    const cleanupRow = page.getByRole("row").filter({ hasText: title });
    await cleanupRow.getByRole("button", { name: `Xóa ${title}` }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(cleanupRow).toHaveCount(0);
  });

  test("media upload, alt, picker usage and protected delete work end-to-end", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The upload mutation runs once; mobile admin coverage is separate.",
    );
    await cleanupInterruptedMediaFixtures(page);
    await page.goto("/admin/media");
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector('[aria-label="Tìm trong thư viện media"]') as
            (HTMLInputElement & { _valueTracker?: unknown }) | null
        )?._valueTracker,
      ),
    );
    const fileName = `e2e-${crypto.randomUUID().slice(0, 8)}.png`;
    await page.getByLabel("Tải ảnh lên thư viện").setInputFiles({
      name: "khong-phai-anh.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(
      page.getByText("Chỉ hỗ trợ tệp ảnh AVIF, GIF, JPEG, PNG hoặc WEBP."),
    ).toBeVisible();
    await expect(page.getByLabel("Hàng đợi tải media")).toHaveCount(0);

    await page.getByTestId("media-upload-dropzone").evaluate(
      (dropzone, payload) => {
        const bytes = Uint8Array.from(atob(payload.base64), (character) =>
          character.charCodeAt(0),
        );
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([bytes], payload.fileName, {
            lastModified: Date.now(),
            type: "image/png",
          }),
        );
        dropzone.dispatchEvent(
          new DragEvent("dragenter", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
        dropzone.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
      },
      {
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlN5xkAAAAASUVORK5CYII=",
        fileName,
      },
    );
    const queuedFile = page.locator(`[data-upload-file="${fileName}"]`);
    await expect(queuedFile).toBeVisible();
    await expect(queuedFile).toContainText("image/png");
    await expect(
      page.getByRole("button", { name: `Bỏ ${fileName} khỏi hàng đợi` }),
    ).toBeVisible();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "Media drag-and-drop ingest queue",
    );
    await page.route("**/api/uploads/media", (route) => route.abort("failed"));
    await page
      .getByRole("button", { name: "Tải lên 1 ảnh", exact: true })
      .click();
    await expect(page.getByText("Mất kết nối khi tải media.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
    await page.unroute("**/api/uploads/media");
    const uploadResponse = page.waitForResponse((response) =>
      response.url().endsWith("/api/uploads/media"),
    );
    await page.getByRole("button", { name: "Thử lại" }).click();
    const uploadedResponse = await uploadResponse;
    expect(uploadedResponse.status()).toBe(201);
    const uploadedPayload = (await uploadedResponse.json()) as {
      data?: Array<{ key?: string }>;
    };
    const uploadedKey = uploadedPayload.data?.[0]?.key;
    expect(uploadedKey).toMatch(/^[0-9a-f-]+\.png$/);
    await expect(
      page.getByText(`Đã tải lại ${fileName}.`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Đã tải xong 1 ảnh", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(`Tiến độ tải ${fileName}`)).toHaveAttribute(
      "value",
      "100",
    );

    await expect(
      page.getByRole("button", { name: "Hiển thị dạng lưới" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Lọc ngày tải").selectOption("older");
    await expect(
      page.getByLabel(`Văn bản thay thế cho ${uploadedKey}`),
    ).toHaveCount(0);
    await page.getByLabel("Lọc ngày tải").selectOption("today");
    await page.getByLabel("Lọc MIME").selectOption("image/png");
    await expect(
      page.getByLabel(`Văn bản thay thế cho ${uploadedKey}`),
    ).toBeVisible();
    await page
      .getByLabel("Tìm trong thư viện media")
      .fill(uploadedKey!.slice(0, 12));
    await expect(
      page.getByLabel(`Văn bản thay thế cho ${uploadedKey}`),
    ).toBeVisible();
    await page.getByLabel("Tìm trong thư viện media").fill("");

    let mediaItem = page
      .getByLabel(`Văn bản thay thế cho ${uploadedKey}`)
      .locator("xpath=ancestor::*[@data-media-item][1]");
    await expect(mediaItem).toBeVisible();
    await mediaItem
      .getByRole("button", { name: `Sao chép URL ${uploadedKey}` })
      .click();
    await expect(
      page.getByText("Đã sao chép URL.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hiển thị dạng danh sách" }).click();
    await expect(
      page.getByRole("button", { name: "Hiển thị dạng danh sách" }),
    ).toHaveAttribute("aria-pressed", "true");
    mediaItem = page
      .getByLabel(`Văn bản thay thế cho ${uploadedKey}`)
      .locator("xpath=ancestor::*[@data-media-item][1]");
    await expect(mediaItem).toBeVisible();
    const alt = `Ảnh kiểm thử ${crypto.randomUUID().slice(0, 8)}`;
    await mediaItem.getByLabel(/Văn bản thay thế cho/).fill(alt);
    await mediaItem.getByRole("button", { name: "Lưu mô tả" }).click();
    await expect(
      page.getByText("Đã lưu văn bản thay thế.", { exact: true }),
    ).toBeVisible();

    const pageTitle = `Trang media E2E ${crypto.randomUUID().slice(0, 8)}`;
    const pageSlug = `media-e2e-${crypto.randomUUID().slice(0, 8)}`;
    await page.goto("/admin/pages");
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector("#page-title") as
            (HTMLInputElement & { _valueTracker?: unknown }) | null
        )?._valueTracker,
      ),
    );
    await page.locator("#page-title").fill(pageTitle);
    await page.locator("#page-slug").fill(pageSlug);
    const ogInput = page.locator("#page-og-image");
    const ogField = ogInput.locator("xpath=ancestor::*[@role='group'][1]");
    await expect(ogInput).not.toBeVisible();
    await ogField
      .getByRole("button", { name: "Chọn từ thư viện", exact: true })
      .click();
    const mediaPicker = page.getByRole("dialog", { name: "Chọn media" });
    await expect(mediaPicker).toBeVisible();
    await expectNoAutomatedAccessibilityViolations(
      page,
      "In-context media picker",
    );
    await mediaPicker
      .getByLabel("Tải ảnh cho Ảnh chia sẻ mạng xã hội")
      .setInputFiles({
        name: "picker-khong-phai-anh.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });
    await expect(
      mediaPicker.getByText(
        "Chỉ hỗ trợ tệp ảnh AVIF, GIF, JPEG, PNG hoặc WEBP.",
      ),
    ).toBeVisible();
    await mediaPicker
      .getByRole("searchbox", { name: "Tìm trong thư viện media" })
      .fill("anh kiem thu");
    await mediaPicker.getByRole("button", { name: `Chọn ${alt}` }).click();
    await expect(page.locator("#page-og-image")).not.toHaveValue("");
    await page.getByRole("button", { name: "Lưu bản nháp" }).click();
    await expect(
      page.getByText("Đã tạo trang.", { exact: true }),
    ).toBeVisible();

    await page.goto("/admin/posts/new");
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector("#post-title") as
            (HTMLInputElement & { _valueTracker?: unknown }) | null
        )?._valueTracker,
      ),
    );
    await page.getByText("Thêm block nội dung", { exact: true }).click();
    await page.getByRole("button", { name: "Thêm ảnh", exact: true }).click();
    const richImageBlock = page.getByRole("group", {
      name: "Block 2: Ảnh",
      exact: true,
    });
    const richImageAlt = richImageBlock.getByLabel("Alt ảnh (bắt buộc)");
    await richImageAlt.fill("Mô tả của ảnh trước");
    await richImageBlock
      .getByRole("button", { name: "Thay ảnh", exact: true })
      .click();
    const richImagePicker = page.getByRole("dialog", { name: "Chọn media" });
    await richImagePicker
      .getByRole("searchbox", { name: "Tìm trong thư viện media" })
      .fill("anh kiem thu");
    await richImagePicker.getByRole("button", { name: `Chọn ${alt}` }).click();
    await expect(richImageAlt).toHaveValue(alt);

    await page.goto("/admin/media");
    const referencedItem = page
      .getByLabel(`Văn bản thay thế cho ${uploadedKey}`)
      .locator("xpath=ancestor::*[@data-media-item][1]");
    await expect(referencedItem.getByText(/Đang dùng tại [1-9]/)).toBeVisible();
    if (authenticatedRole === "owner") {
      await referencedItem.getByRole("button", { name: /Xóa media/ }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(
        /Ảnh đang được dùng tại [1-9]\d* vị trí.*không thể hoàn tác/,
      );
      await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(referencedItem).toBeVisible();
    } else {
      const disabledDelete = referencedItem.getByRole("button", {
        name: /Không thể xóa media/,
      });
      await expect(disabledDelete).toBeDisabled();
      await expect(disabledDelete).toHaveAttribute(
        "title",
        /Ảnh đang được dùng tại [1-9]\d* vị trí\./,
      );
    }

    await page.goto("/admin/pages");
    const createdPageRow = page.getByRole("row").filter({ hasText: pageTitle });
    await createdPageRow
      .getByRole("button", { name: `Xóa ${pageTitle}` })
      .click();
    await confirmAlertDialog(page, "Xóa");
    await expect(
      page.getByText("Đã xóa trang.", { exact: true }),
    ).toBeVisible();

    await page.goto("/admin/media");
    const cleanupItem = page
      .getByLabel(`Văn bản thay thế cho ${uploadedKey}`)
      .locator("xpath=ancestor::*[@data-media-item][1]");
    await cleanupItem.getByRole("button", { name: /Xóa media/ }).click();
    await confirmAlertDialog(page, "Xóa");
    await expect(
      page.getByText("Đã xóa media.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel(`Văn bản thay thế cho ${uploadedKey}`),
    ).toHaveCount(0);
  });
});

test.describe("owner governance workflow", () => {
  test.skip(
    !ownerEmail || !ownerPassword || !managedEmail,
    "Set dedicated CMS_E2E_OWNER credentials",
  );

  test("owner creates, changes and revokes a staff role", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "The destructive governance lifecycle runs once on desktop.",
    );
    await login(page, ownerEmail!, ownerPassword!);
    await page.goto("/admin/staff");
    await expect(
      page.getByRole("heading", { name: "Nhân sự và phân quyền" }),
    ).toBeVisible();
    await page.waitForFunction(() =>
      Boolean(
        (
          document.querySelector("#staff-email") as HTMLInputElement & {
            _valueTracker?: unknown;
          }
        )?._valueTracker,
      ),
    );
    await page.locator("#staff-name").fill("Managed E2E Editor");
    await page.locator("#staff-email").fill(managedEmail!);
    await page.locator("#staff-password").fill("Managed-E2E-Password-123!");
    await page.locator("#staff-role").selectOption("editor");
    await page
      .getByRole("button", { name: "Tạo tài khoản", exact: true })
      .click();
    await expect(
      page.getByText("Đã tạo tài khoản nhân sự.", { exact: true }),
    ).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: managedEmail! });
    await expect(row).toBeVisible();
    await row.getByLabel(`Vai trò của ${managedEmail}`).selectOption("admin");
    await expect(
      page.getByText("Đã cập nhật quyền.", { exact: true }),
    ).toBeVisible();
    await expect(row.getByLabel(`Vai trò của ${managedEmail}`)).toHaveValue(
      "admin",
    );

    await row.getByRole("button", { name: `Thu hồi ${managedEmail}` }).click();
    await confirmAlertDialog(page, "Thu hồi quyền");
    await expect(
      page.getByText("Đã thu hồi quyền và đăng xuất các phiên đăng nhập.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      row.getByText("Không có quyền CMS", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("editor capability boundary", () => {
  test.skip(
    !editorEmail || !editorPassword,
    "Set dedicated CMS_E2E_EDITOR_EMAIL/PASSWORD",
  );

  test("editor cannot publish or restore", async ({ page }) => {
    await login(page, editorEmail!, editorPassword!);
    await page.goto("/admin/home");
    await waitForAdminHydration(page);
    await expect(
      page.getByRole("button", { name: "Xuất bản", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Khôi phục vào bản nháp" }),
    ).toHaveCount(0);
    const editorReviewPanel = page.getByTestId("editorial-review-panel");
    await expect(
      editorReviewPanel.getByRole("button", { name: /Gửi duyệt bản v\d+/ }),
    ).toBeVisible();
    await expect(
      editorReviewPanel.getByRole("button", { name: /Duyệt bản v\d+/ }),
    ).toHaveCount(0);
    await expect(
      editorReviewPanel.getByRole("button", { name: "Yêu cầu chỉnh sửa" }),
    ).toHaveCount(0);
    const postsLink = page.getByRole("link", {
      name: "Bài viết",
      exact: true,
    });
    if (!(await postsLink.isVisible())) {
      await revealAdminNavigation(page);
    }
    await expect(postsLink).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Thư viện media" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Khách hàng tiềm năng" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Chuyển hướng" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Cài đặt website" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Nhân sự và phân quyền" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Pilot bàn giao" }),
    ).toHaveCount(0);
    await page.keyboard.press("Control+K");
    const commandCenter = page.getByRole("dialog", {
      name: "Đi đến bất kỳ đâu",
    });
    await expect(commandCenter).toBeVisible();
    const editorCommandSearch = commandCenter.getByRole("searchbox", {
      name: "Tìm trong CMS",
    });
    await editorCommandSearch.fill("bao tri luoi");
    await expect(
      commandCenter.getByRole("link", {
        name: /Bảo trì lưới chống muỗi trong căn hộ/,
      }),
    ).toBeVisible();
    await editorCommandSearch.fill("nhan su");
    await expect(
      commandCenter.getByRole("link", { name: /Nhân sự và phân quyền/ }),
    ).toHaveCount(0);
    await expect(
      commandCenter.getByText("Không tìm thấy nội dung hoặc công cụ"),
    ).toBeVisible();
    await editorCommandSearch.fill("pilot ban giao");
    await expect(
      commandCenter.getByRole("link", { name: /Pilot bàn giao/ }),
    ).toHaveCount(0);
    // The server-side FORBIDDEN result is covered by the API authorization
    // suite. This browser scenario owns the user-visible capability boundary.
  });
});
