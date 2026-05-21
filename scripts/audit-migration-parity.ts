import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type CheckStatus = "PASS" | "FAIL";

type Check = {
  detail?: string;
  name: string;
  status: CheckStatus;
};

type FileCheck = {
  legacy?: string;
  name: string;
  web: string;
};

const root = process.cwd();
const checks: Check[] = [];

function pathFromRoot(path: string) {
  return join(root, path);
}

function exists(path: string) {
  return existsSync(pathFromRoot(path));
}

function record(status: CheckStatus, name: string, detail?: string) {
  checks.push({ detail, name, status });
}

function assertFile({ legacy, name, web }: FileCheck) {
  const webExists = exists(web);
  const legacyExists = legacy ? exists(legacy) : true;

  if (webExists && legacyExists) {
    record("PASS", name, legacy ? `${legacy} -> ${web}` : web);
    return;
  }

  const missing = [
    !legacyExists && legacy ? `missing legacy reference ${legacy}` : undefined,
    !webExists ? `missing web route ${web}` : undefined,
  ].filter(Boolean);

  record("FAIL", name, missing.join("; "));
}

function assertFileIncludes(path: string, text: string, name: string) {
  if (!exists(path)) {
    record("FAIL", name, `missing file ${path}`);
    return;
  }

  const contents = readFileSync(pathFromRoot(path), "utf8");
  if (contents.includes(text)) {
    record("PASS", name, `${path} includes ${JSON.stringify(text)}`);
    return;
  }

  record("FAIL", name, `${path} does not include ${JSON.stringify(text)}`);
}

function assertFileIncludesAll(path: string, texts: string[], name: string) {
  if (!exists(path)) {
    record("FAIL", name, `missing file ${path}`);
    return;
  }

  const contents = readFileSync(pathFromRoot(path), "utf8");
  const missing = texts.filter((text) => !contents.includes(text));

  if (missing.length === 0) {
    record("PASS", name, `${path} includes ${texts.length} required marker(s)`);
    return;
  }

  record(
    "FAIL",
    name,
    `${path} missing ${missing.map((text) => JSON.stringify(text)).join(", ")}`,
  );
}

function collectFiles(dir: string): string[] {
  const absoluteDir = pathFromRoot(dir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir).flatMap((entry) => {
    if (entry === "node_modules" || entry === ".turbo" || entry === "dist") {
      return [];
    }

    const absoluteEntry = join(absoluteDir, entry);
    const relativeEntry = relative(root, absoluteEntry);
    if (statSync(absoluteEntry).isDirectory()) {
      return collectFiles(relativeEntry);
    }
    return relativeEntry;
  });
}

function assertNoOldAppImports() {
  const sourceFiles = collectFiles("apps/web/src").filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
  const offenders = sourceFiles.filter((file) => {
    const contents = readFileSync(pathFromRoot(file), "utf8");
    return /from\s+["'](?:\.\.\/)*(?:apps\/)?(?:frontend|admin|home|backend)\b/.test(
      contents,
    );
  });

  if (offenders.length === 0) {
    record("PASS", "apps/web does not import legacy apps", `${sourceFiles.length} files scanned`);
    return;
  }

  record("FAIL", "apps/web does not import legacy apps", offenders.join(", "));
}

function assertNoMongoRuntimeReferences() {
  const scannedRoots = [
    "apps/web/src",
    "packages/api/src",
    "packages/auth/src",
    "packages/config/src",
    "packages/env/src",
    "packages/infra",
    "packages/ui/src",
  ];
  const files = scannedRoots
    .flatMap((dir) => collectFiles(dir))
    .filter((file) => /\.(ts|tsx)$/.test(file));
  const forbidden =
    /(from\s+["'](?:mongoose|mongodb)["']|require\(["'](?:mongoose|mongodb)["']\)|\bMONGODB_URI\b)/;
  const offenders = files.filter((file) =>
    forbidden.test(readFileSync(pathFromRoot(file), "utf8")),
  );

  if (offenders.length === 0) {
    record("PASS", "active runtime has no Mongo/Mongoose references", `${files.length} files scanned`);
    return;
  }

  record("FAIL", "active runtime has no Mongo/Mongoose references", offenders.join(", "));
}

function assertAdminApiAuthGuards() {
  const protectedApiFiles = [
    "apps/web/src/routes/api/add-product.ts",
    "apps/web/src/routes/api/edit-product/$productId.ts",
    "apps/web/src/routes/api/product.ts",
    "apps/web/src/routes/api/product/$productId.ts",
    "apps/web/src/routes/api/categories.ts",
    "apps/web/src/routes/api/categories/$categoryId.ts",
    "apps/web/src/routes/api/logs.ts",
    "apps/web/src/routes/api/logs/$logId.ts",
    "apps/web/src/routes/api/orders.ts",
    "apps/web/src/routes/api/orders/$orderId.ts",
    "apps/web/src/routes/api/uploads/product-images.ts",
  ];

  const missingGuard = protectedApiFiles.filter((file) => {
    if (!exists(file)) {
      return true;
    }
    return !readFileSync(pathFromRoot(file), "utf8").includes("requireApiSession");
  });

  if (missingGuard.length === 0) {
    record(
      "PASS",
      "admin REST API surfaces include auth guard",
      `${protectedApiFiles.length} files checked`,
    );
    return;
  }

  record("FAIL", "admin REST API surfaces include auth guard", missingGuard.join(", "));
}

function assertActiveWorkspaceOnly() {
  const packageJson = JSON.parse(readFileSync(pathFromRoot("package.json"), "utf8"));
  const workspaces = packageJson.workspaces?.packages ?? [];
  const inactiveApps = ["apps/admin", "apps/backend", "apps/frontend", "apps/home"];
  const activeAppOnly =
    workspaces.includes("apps/web") &&
    inactiveApps.every((workspace) => !workspaces.includes(workspace));

  if (activeAppOnly) {
    record("PASS", "root workspaces target migrated app only", workspaces.join(", "));
    return;
  }

  record("FAIL", "root workspaces target migrated app only", workspaces.join(", "));
}

const publicRoutes: FileCheck[] = [
  {
    legacy: "apps/frontend/src/app/page.tsx",
    name: "storefront home route",
    web: "apps/web/src/routes/index.tsx",
  },
  {
    legacy: "apps/home/src/pages/index.astro",
    name: "legacy home landing content route",
    web: "apps/web/src/routes/gioi-thieu.tsx",
  },
  {
    legacy: "apps/frontend/src/app/(ecommerce)/san-pham/layout.tsx",
    name: "product listing route",
    web: "apps/web/src/routes/danh-sach-san-pham.tsx",
  },
  {
    legacy: "apps/frontend/src/app/(ecommerce)/san-pham/layout.tsx",
    name: "legacy /san-pham listing route",
    web: "apps/web/src/routes/san-pham.tsx",
  },
  {
    legacy: "apps/frontend/src/app/(ecommerce)/san-pham/[productId]/page.tsx",
    name: "product detail route",
    web: "apps/web/src/routes/san-pham/$productId.tsx",
  },
  {
    legacy: "apps/frontend/src/app/(ecommerce)/gio-hang/page.tsx",
    name: "cart route",
    web: "apps/web/src/routes/gio-hang.tsx",
  },
  {
    legacy: "apps/frontend/src/app/(ecommerce)/bai-viet/page.tsx",
    name: "blog list route",
    web: "apps/web/src/routes/bai-viet.tsx",
  },
  {
    legacy: "apps/frontend/src/app/(ecommerce)/bai-viet/[slug]/page.tsx",
    name: "blog detail route",
    web: "apps/web/src/routes/bai-viet/$slug.tsx",
  },
  {
    legacy: "apps/admin/src/app/dang-nhap/page.tsx",
    name: "admin sign-in route",
    web: "apps/web/src/routes/dang-nhap.tsx",
  },
  {
    legacy: "apps/admin/src/app/dang-ky/page.tsx",
    name: "admin sign-up route shell",
    web: "apps/web/src/routes/dang-ky.tsx",
  },
  {
    name: "forgot password route",
    web: "apps/web/src/routes/quen-mat-khau.tsx",
  },
  {
    legacy: "apps/frontend/src/app/sitemap.ts",
    name: "sitemap route",
    web: "apps/web/src/routes/sitemap[.]xml.ts",
  },
  {
    legacy: "apps/frontend/src/app/robots.ts",
    name: "robots route",
    web: "apps/web/src/routes/robots[.]txt.ts",
  },
  {
    legacy: "apps/frontend/src/app/manifest.ts",
    name: "web manifest route",
    web: "apps/web/src/routes/manifest[.]webmanifest.ts",
  },
];

const adminRoutes: FileCheck[] = [
  {
    legacy: "apps/admin/src/app/(admin)/dashboard/page.tsx",
    name: "admin dashboard route",
    web: "apps/web/src/routes/admin/dashboard.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/products/page.tsx",
    name: "admin products route",
    web: "apps/web/src/routes/admin/products.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/add-product/page.tsx",
    name: "admin add product route",
    web: "apps/web/src/routes/admin/products/new.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/view-product/[productId]/page.tsx",
    name: "admin product detail route",
    web: "apps/web/src/routes/admin/products/$productId.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/edit-product/[productId]/page.tsx",
    name: "admin edit product route",
    web: "apps/web/src/routes/admin/products/$productId/edit.tsx",
  },
  {
    name: "admin orders route",
    web: "apps/web/src/routes/admin/orders.tsx",
  },
  {
    name: "admin new order route",
    web: "apps/web/src/routes/admin/orders/new.tsx",
  },
  {
    name: "admin inventory route",
    web: "apps/web/src/routes/admin/inventory.tsx",
  },
  {
    name: "admin new inventory route",
    web: "apps/web/src/routes/admin/inventory/new.tsx",
  },
  {
    name: "admin categories route",
    web: "apps/web/src/routes/admin/categories.tsx",
  },
  {
    name: "admin logs route",
    web: "apps/web/src/routes/admin/logs.tsx",
  },
];

const legacyRedirects: FileCheck[] = [
  { name: "legacy /dashboard redirect", web: "apps/web/src/routes/dashboard.tsx" },
  { name: "legacy /products redirect", web: "apps/web/src/routes/products.tsx" },
  { name: "legacy /orders redirect", web: "apps/web/src/routes/orders.tsx" },
  { name: "legacy /add-order redirect", web: "apps/web/src/routes/add-order.tsx" },
  { name: "legacy /inventory redirect", web: "apps/web/src/routes/inventory.tsx" },
  { name: "legacy /add-inventory redirect", web: "apps/web/src/routes/add-inventory.tsx" },
  {
    legacy: "apps/admin/src/app/(admin)/add-product/page.tsx",
    name: "legacy /add-product redirect",
    web: "apps/web/src/routes/add-product.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/view-product/[productId]/page.tsx",
    name: "legacy /view-product/:productId redirect",
    web: "apps/web/src/routes/view-product/$productId.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/edit-product/[productId]/page.tsx",
    name: "legacy /edit-product/:productId redirect",
    web: "apps/web/src/routes/edit-product/$productId.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/add-product/page.tsx",
    name: "legacy /admin/add-product redirect",
    web: "apps/web/src/routes/admin/add-product.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/view-product/[productId]/page.tsx",
    name: "legacy /admin/view-product/:productId redirect",
    web: "apps/web/src/routes/admin/view-product/$productId.tsx",
  },
  {
    legacy: "apps/admin/src/app/(admin)/edit-product/[productId]/page.tsx",
    name: "legacy /admin/edit-product/:productId redirect",
    web: "apps/web/src/routes/admin/edit-product/$productId.tsx",
  },
];

const apiRoutes: FileCheck[] = [
  {
    legacy: "apps/backend/Api/Routes/ProductRoutes.ts",
    name: "legacy GET /api/products route",
    web: "apps/web/src/routes/api/products.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/ProductRoutes.ts",
    name: "legacy GET /api/product/:productId route",
    web: "apps/web/src/routes/api/product/$productId.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/ProductRoutes.ts",
    name: "legacy GET /api/product/:productId/variant route",
    web: "apps/web/src/routes/api/product/$productId/variant.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/ProductRoutes.ts",
    name: "legacy POST /api/product route",
    web: "apps/web/src/routes/api/product.ts",
  },
  {
    legacy: "apps/frontend/src/app/api/products/[productId]/route.ts",
    name: "legacy frontend /api/products/:productId alias",
    web: "apps/web/src/routes/api/products/$productId.ts",
  },
  {
    legacy: "apps/admin/src/app/api/add-product/route.ts",
    name: "legacy admin /api/add-product alias",
    web: "apps/web/src/routes/api/add-product.ts",
  },
  {
    legacy: "apps/admin/src/app/api/edit-product/[productId]/route.ts",
    name: "legacy admin /api/edit-product/:productId alias",
    web: "apps/web/src/routes/api/edit-product/$productId.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/PostRoutes.ts",
    name: "legacy GET /api/posts route",
    web: "apps/web/src/routes/api/posts.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/PostRoutes.ts",
    name: "legacy GET /api/posts/:slug route",
    web: "apps/web/src/routes/api/posts/$slug.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/TelegramRoutes.ts",
    name: "legacy POST /api/send-newletter route",
    web: "apps/web/src/routes/api/send-newletter.ts",
  },
  {
    legacy: "apps/frontend/src/app/api/send-newsletter/route.ts",
    name: "legacy POST /api/send-newsletter route",
    web: "apps/web/src/routes/api/send-newsletter.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/TelegramRoutes.ts",
    name: "legacy POST /api/send-product-order route",
    web: "apps/web/src/routes/api/send-product-order.ts",
  },
  {
    legacy: "apps/backend/Api/Routes/TelegramRoutes.ts",
    name: "legacy POST /api/send-cart-order route",
    web: "apps/web/src/routes/api/send-cart-order.ts",
  },
  {
    legacy: "apps/frontend/src/app/api/get-bookmark/route.ts",
    name: "legacy /api/get-bookmark route",
    web: "apps/web/src/routes/api/get-bookmark.ts",
  },
  {
    name: "new D1 orders API route",
    web: "apps/web/src/routes/api/orders.ts",
  },
  {
    name: "new D1 order detail API route",
    web: "apps/web/src/routes/api/orders/$orderId.ts",
  },
  {
    name: "new D1 categories API route",
    web: "apps/web/src/routes/api/categories.ts",
  },
  {
    name: "new D1 category detail API route",
    web: "apps/web/src/routes/api/categories/$categoryId.ts",
  },
  {
    name: "new D1 logs API route",
    web: "apps/web/src/routes/api/logs.ts",
  },
  {
    name: "new D1 log detail API route",
    web: "apps/web/src/routes/api/logs/$logId.ts",
  },
  {
    name: "tRPC API route",
    web: "apps/web/src/routes/api/trpc/$.ts",
  },
  {
    name: "Better Auth API route",
    web: "apps/web/src/routes/api/auth/$.ts",
  },
];

for (const route of [...publicRoutes, ...adminRoutes, ...legacyRedirects, ...apiRoutes]) {
  assertFile(route);
}

assertFileIncludes(
  "apps/web/wrangler.jsonc",
  "rem-viet-local",
  "Cloudflare D1 binding is configured",
);
assertFileIncludes(
  "apps/web/wrangler.jsonc",
  "PRODUCT_IMAGES",
  "Cloudflare R2 product image binding is configured",
);
assertFileIncludes(
  "packages/db/src/schema/catalog.ts",
  "sqliteTable",
  "Drizzle SQLite/D1 schema is present",
);
assertFileIncludes(
  "packages/db/src/scripts/mongo-to-d1-sql.ts",
  "mongodb",
  "Mongo to D1 exporter remains offline tooling",
);
assertFileIncludes(
  "apps/web/src/functions/get-admin-user.ts",
  "ADMIN_EMAILS",
  "admin allowlist auth is configured",
);
assertFileIncludesAll(
  "packages/db/src/schema/catalog.ts",
  ["categories", "products", "variants", "promotions", "isDeleted", "isActive"],
  "catalog Mongoose entities have Drizzle/D1 tables and soft-delete flags",
);
assertFileIncludesAll(
  "packages/db/src/schema/commerce.ts",
  ["orders", "carts", "newsletter_subscriptions", "products", "shipping", "payment", "items"],
  "commerce Mongo/Telegram surfaces have Drizzle/D1 tables",
);
assertFileIncludesAll(
  "packages/db/src/schema/content.ts",
  ["posts", "slug", "content", "table_of_contents"],
  "Notion posts have Drizzle/D1 table",
);
assertFileIncludesAll(
  "packages/db/src/schema/operational.ts",
  ["logs", "method", "url", "status_code", "time_stamp"],
  "legacy log entity has Drizzle/D1 table",
);
assertFileIncludesAll(
  "packages/db/src/scripts/mongo-to-d1-sql.ts",
  [
    '"categories"',
    '"products"',
    '"variants"',
    '"promotions"',
    '"carts"',
    '"orders"',
    '"logs"',
    "assertNoUnmappedCollections",
    "requiredLegacyId",
    "directProductId",
  ],
  "Mongo exporter maps expected collections and guards unmapped data",
);
assertFileIncludesAll(
  "packages/db/scripts/verify-import-sql.ts",
  [
    "export async function verifyImportSql",
    "PRAGMA foreign_key_check",
    "product category references",
    "promotion product references",
    "order product references",
    "cart product references",
    "missingProductIds",
    "contains invalid JSON",
    "unsupported product reference",
  ],
  "D1 import verifier checks SQL and JSON reference integrity",
);
assertFileIncludesAll(
  "packages/db/scripts/verify-import-fixture.ts",
  [
    "verifyImportSql",
    "Mongo fixture",
    "Notion fixture",
    "fixture-product-1",
    "fixture-post-1",
  ],
  "D1 import verifier has executable Mongo/Notion fixture coverage",
);
assertFileIncludesAll(
  "package.json",
  ["db:migration:verify:fixture"],
  "root exposes D1 import fixture verification command",
);
assertFileIncludesAll(
  "packages/api/src/services/products.ts",
  [
    "includeInactive",
    "isActive",
    "isDeleted",
    "Object.hasOwn(input, \"variants\")",
    "db.transaction",
    "Category not found",
  ],
  "product service preserves public/admin split and safe D1 writes",
);
assertFileIncludesAll(
  "packages/api/src/services/orders.ts",
  [
    "priceOrderItems",
    "parsePriceNumber(product.price)",
    "item.quantity > product.quantity",
    "Variant for product",
    "createNewsletterSubscription",
  ],
  "order service reprices and validates availability against D1",
);
assertFileIncludesAll(
  "apps/web/src/routes/san-pham/$productId.tsx",
  [
    "5 lượt đánh giá",
    "open:border-border",
    "Thanh toán và trả hàng",
    "Hoá đơn và bảo hành",
    "isValidVariantSelection",
  ],
  "product detail keeps legacy visual shell and variant guards",
);
assertFileIncludesAll(
  "apps/web/src/routes/gio-hang.tsx",
  [
    "rounded-medium bg-content2",
    "{item.name} {item.name}",
    "Specific address",
    "Đặt hàng",
    "cart.summary.total",
  ],
  "cart checkout keeps legacy visual shell while writing D1 orders",
);
assertFileIncludesAll(
  "apps/web/src/components/post-content.tsx",
  [
    'image?.type === "file"',
    "image.file?.url",
    "cloudflareImageUrl(externalUrl)",
    "BookmarkCard",
    "notionColorClass",
  ],
  "post detail preserves legacy Notion file/external media and bookmark rendering",
);
assertFileIncludesAll(
  "packages/ui/src/styles/globals.css",
  ["--color-content2", "--color-default-100", "--radius-medium", "--radius-large"],
  "UI globals expose legacy NextUI token aliases used by migrated screens",
);
assertFileIncludesAll(
  "apps/web/src/routes/admin/products/$productId.tsx",
  [
    "rounded-large border bg-default-100",
    "rounded-full bg-primary/10",
    "Mô tả sản phẩm: ...",
    "Values",
    "Price",
  ],
  "admin product detail keeps legacy snippet and variant table treatment",
);
assertFileIncludesAll(
  "apps/web/src/routes/admin/dashboard.tsx",
  [
    "Phân tích sản phẩm",
    "Loại phân tích",
    "border-dashed",
    "hoveredItemName",
    "valueFormatter(hoveredItem[analysisType])",
  ],
  "admin dashboard chart keeps migrated data plus legacy chart affordances",
);
assertFileIncludesAll(
  "apps/web/src/components/admin-shell.tsx",
  [
    "open={isOpen}",
    "group/sidebar",
    "h-11",
    "bg-default-100",
    "-ml-72 -translate-x-72",
    "Nội dung",
  ],
  "admin shell keeps legacy sidebar chrome and nested navigation affordances",
);
assertFileIncludesAll(
  "apps/web/src/components/product-form.tsx",
  [
    "group/file",
    "[mask-image:radial-gradient(ellipse_at_center,white,transparent)]",
    "group-hover/file:-translate-y-5",
    "/api/uploads/product-images",
  ],
  "admin product form keeps legacy upload visual treatment with D1/R2 upload path",
);
assertFileIncludesAll(
  "apps/web/src/lib/site-config.ts",
  ['{ label: "Trang chủ", to: "/" }', '{ label: "Giới thiệu", to: "/gioi-thieu" }', '{ label: "Bài viết", to: "/bai-viet" }'],
  "storefront header keeps legacy nav item set inside TanStack Start",
);
assertFileIncludesAll(
  "apps/web/src/routes/san-pham.tsx",
  ["createFileRoute(\"/san-pham\")", "ProductListPage", "getProductListPageData"],
  "legacy /san-pham renders the migrated product list",
);
assertFileIncludesAll(
  "scripts/smoke-migration.ts",
  [
    "admin orders list requires auth",
    "admin category create requires auth",
    "admin log detail requires auth",
    "robots endpoint includes sitemap",
    "legacy /san-pham renders migrated product listing",
    "bookmark metadata validation is JSON 400",
    "public products query cannot opt into deleted rows",
  ],
  "smoke script covers migration-critical HTTP/auth/SEO behavior",
);

assertActiveWorkspaceOnly();
assertNoOldAppImports();
assertNoMongoRuntimeReferences();
assertAdminApiAuthGuards();

const failed = checks.filter((check) => check.status === "FAIL");

for (const check of checks) {
  const detail = check.detail ? ` - ${check.detail}` : "";
  console.log(`${check.status} ${check.name}${detail}`);
}

if (failed.length > 0) {
  console.error(`\nMigration parity audit failed: ${failed.length} failed check(s).`);
  process.exit(1);
}

console.log(`\nMigration parity audit passed: ${checks.length} checks.`);
