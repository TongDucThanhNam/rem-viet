const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
const deletedProductId = process.env.SMOKE_DELETED_PRODUCT_ID;
const strictMode = process.env.SMOKE_STRICT === "true";

type Product = {
  id?: string;
  _id?: string;
  name?: string;
  imageUrls?: string[];
  isActive?: boolean;
  isDeleted?: boolean;
};

type ProductsResponse = {
  data?: Product[];
};

const checks: Array<{ name: string; status: "pass" | "skip"; detail?: string }> =
  [];

function recordPass(name: string, detail?: string) {
  checks.push({ name, status: "pass", detail });
}

function recordSkip(name: string, detail: string) {
  checks.push({ name, status: "skip", detail });
}

async function assertResponse(
  name: string,
  input: string,
  expectedStatus: number,
  init?: RequestInit,
) {
  const response = await fetch(new URL(input, baseUrl), init);

  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(
      `${name}: expected ${expectedStatus}, received ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  recordPass(name, `${response.status}`);
  return response;
}

async function assertRedirect(
  name: string,
  input: string,
  expectedLocation: string,
) {
  const response = await assertResponse(name, input, 307, { redirect: "manual" });
  const location = response.headers.get("location");

  if (location !== expectedLocation) {
    throw new Error(
      `${name}: expected redirect ${expectedLocation}, received ${location}`,
    );
  }
}

async function assertJsonDataLength(
  name: string,
  input: string,
  expectedLength: number,
) {
  const response = await assertResponse(name, input, 200);
  const body = (await response.json()) as ProductsResponse;
  const length = body.data?.length ?? 0;

  if (length !== expectedLength) {
    throw new Error(
      `${name}: expected data length ${expectedLength}, received ${length}`,
    );
  }

  return body.data ?? [];
}

async function assertBodyIncludes(
  name: string,
  input: string,
  expected: string,
  init?: RequestInit,
) {
  const response = await fetch(new URL(input, baseUrl), init);
  const body = await response.text();

  if (!body.includes(expected)) {
    throw new Error(
      `${name}: response did not include ${JSON.stringify(expected)}: ${body.slice(0, 300)}`,
    );
  }

  recordPass(name, `${response.status}`);
  return response;
}

async function main() {
  const productsResponse = await assertResponse(
    "products legacy list",
    "/api/products",
    200,
  );
  const products = ((await productsResponse.json()) as ProductsResponse).data ?? [];
  const deletedProductsResponse = await assertResponse(
    "products deleted filter",
    "/api/products?isDeleted=true",
    200,
  );
  const inactiveProductsResponse = await assertResponse(
    "products inactive filter",
    "/api/products?isActive=false",
    200,
  );
  const deletedProducts =
    ((await deletedProductsResponse.json()) as ProductsResponse).data ?? [];
  const inactiveProducts =
    ((await inactiveProductsResponse.json()) as ProductsResponse).data ?? [];
  const leakedProducts = [...products, ...deletedProducts, ...inactiveProducts].filter(
    (product) => product.isActive === false || product.isDeleted === true,
  );

  if (leakedProducts.length) {
    throw new Error(
      `public /api/products leaked inactive/deleted products: ${leakedProducts
        .map((product) => product.id ?? product._id ?? product.name ?? "unknown")
        .join(", ")}`,
    );
  }

  recordPass("public product list hides inactive/deleted rows");

  await assertJsonDataLength(
    "public products query cannot opt into deleted rows",
    "/api/products?isDeleted=true&isActive=false",
    0,
  );
  await assertBodyIncludes(
    "home page includes migrated homepage sections",
    "/",
    "Lưới chống các loại côn trùng",
  );
  await assertBodyIncludes(
    "home page includes migrated FAQ section",
    "/",
    "Câu hỏi thường xuyên",
  );
  await assertBodyIncludes(
    "legacy /san-pham renders migrated product listing",
    "/san-pham",
    "Phổ biến",
  );
  await assertBodyIncludes(
    "signup page keeps disabled legacy form",
    "/dang-ky",
    "Tài khoản quản trị phải được tạo trước",
  );
  await assertBodyIncludes("robots endpoint includes sitemap", "/robots.txt", "Sitemap:");

  await assertResponse("admin product write requires auth", "/api/product", 401, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "unauthorized smoke", price: "1" }),
  });
  await assertResponse(
    "legacy admin add-product alias requires auth",
    "/api/add-product",
    401,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "unauthorized smoke", price: "1" }),
    },
  );
  await assertResponse(
    "legacy admin edit-product alias requires auth",
    "/api/edit-product/unauthorized-smoke",
    401,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "unauthorized smoke", price: "1" }),
    },
  );

  await assertResponse("admin logs list requires auth", "/api/logs", 401);
  await assertResponse("admin orders list requires auth", "/api/orders", 401);
  await assertResponse(
    "admin order detail requires auth",
    "/api/orders/unauthorized-smoke",
    401,
  );
  await assertResponse(
    "admin order status patch requires auth",
    "/api/orders/unauthorized-smoke",
    401,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    },
  );
  await assertResponse(
    "admin category create requires auth",
    "/api/categories",
    401,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "unauthorized smoke" }),
    },
  );
  await assertResponse(
    "admin category update requires auth",
    "/api/categories/unauthorized-smoke",
    401,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "unauthorized smoke" }),
    },
  );
  await assertResponse(
    "admin category delete requires auth",
    "/api/categories/unauthorized-smoke",
    401,
    { method: "DELETE" },
  );
  await assertResponse(
    "admin log detail requires auth",
    "/api/logs/unauthorized-smoke",
    401,
  );
  await assertResponse(
    "admin log update requires auth",
    "/api/logs/unauthorized-smoke",
    401,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "GET", url: "/unauthorized-smoke" }),
    },
  );
  await assertResponse(
    "admin log delete requires auth",
    "/api/logs/unauthorized-smoke",
    401,
    { method: "DELETE" },
  );
  await assertResponse(
    "admin product image upload requires auth",
    "/api/uploads/product-images",
    401,
    { method: "POST" },
  );
  await assertResponse(
    "missing product image returns 404",
    "/api/product-images/00000000-0000-4000-8000-000000000000.webp",
    404,
  );

  await assertRedirect(
    "legacy dashboard redirects to admin dashboard",
    "/dashboard",
    "/admin/dashboard",
  );
  await assertRedirect(
    "legacy products redirects to admin products",
    "/products",
    "/admin/products",
  );
  await assertRedirect(
    "legacy orders redirects to admin orders",
    "/orders",
    "/admin/orders",
  );
  await assertRedirect(
    "legacy add-order redirects to manual admin order",
    "/add-order",
    "/admin/orders/new",
  );
  await assertRedirect(
    "legacy inventory redirects to admin inventory",
    "/inventory",
    "/admin/inventory",
  );
  await assertRedirect(
    "legacy add-inventory redirects to admin inventory create",
    "/add-inventory",
    "/admin/inventory/new",
  );
  await assertRedirect(
    "legacy add-product redirects to admin product create",
    "/add-product",
    "/admin/products/new",
  );

  const firstProductId = products[0]?.id ?? products[0]?._id;

  if (firstProductId) {
    await assertRedirect(
      "legacy view-product redirects to admin product detail",
      `/view-product/${firstProductId}`,
      `/admin/products/${firstProductId}`,
    );
    await assertRedirect(
      "legacy edit-product redirects to admin product edit",
      `/edit-product/${firstProductId}`,
      `/admin/products/${firstProductId}/edit`,
    );
    await assertRedirect(
      "legacy admin view-product redirects to canonical admin product detail",
      `/admin/view-product/${firstProductId}`,
      `/admin/products/${firstProductId}`,
    );
    await assertRedirect(
      "legacy admin edit-product redirects to canonical admin product edit",
      `/admin/edit-product/${firstProductId}`,
      `/admin/products/${firstProductId}/edit`,
    );
    await assertResponse(
      "legacy admin edit-product API alias requires auth",
      `/api/edit-product/${firstProductId}`,
      401,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "unauthorized smoke", price: "1" }),
      },
    );
  } else {
    recordSkip(
      "legacy dynamic product redirects and edit alias",
      "No public product id available to verify dynamic product redirects/edit alias.",
    );
  }

  await assertResponse(
    "admin products redirects unauthenticated users",
    "/admin/products",
    307,
    { redirect: "manual" },
  );

  await assertResponse("newsletter validation is JSON 400", "/api/send-newsletter", 400, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  await assertResponse("orders validation is JSON 400", "/api/orders", 400, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  await assertResponse(
    "bookmark metadata validation is JSON 400",
    "/api/get-bookmark",
    400,
  );

  const deletedProduct =
    [...deletedProducts, ...inactiveProducts, ...products].find(
      (product) => product.id && (!product.isActive || product.isDeleted),
    ) ?? (deletedProductId ? { id: deletedProductId } : undefined);

  if (deletedProduct?.id) {
    await assertResponse(
      "deleted product is hidden from public REST detail",
      `/api/product/${deletedProduct.id}`,
      404,
    );
    await assertResponse(
      "deleted product with variants is hidden from public REST detail",
      `/api/product/${deletedProduct.id}/variant`,
      404,
    );
    await assertBodyIncludes(
      "deleted product is hidden from public detail",
      `/san-pham/${deletedProduct.id}`,
      "Không tìm thấy sản phẩm",
    );

    await assertResponse(
      "deleted product cannot create public order",
      "/api/send-product-order",
      400,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product: {
            id: deletedProduct.id,
            name: deletedProduct.name ?? "Deleted product",
            imageUrls: deletedProduct.imageUrls ?? [],
          },
          productPrice: 1,
          variantChosen: {},
          info: {
            firstName: "Smoke",
            lastName: "Test",
            phoneNumber: "0900000000",
            address: "RMIT",
            district: "Quan 7",
            city: "Ho Chi Minh",
          },
        }),
      },
    );
  } else {
    recordSkip(
      "deleted product public/order guards",
      "Set SMOKE_DELETED_PRODUCT_ID to cover deleted product detail/order guards.",
    );
  }

  if (strictMode) {
    const skipped = checks.filter((check) => check.status === "skip");

    if (skipped.length) {
      throw new Error(
        `SMOKE_STRICT=true does not allow skipped migration checks: ${skipped
          .map((check) => check.name)
          .join(", ")}`,
      );
    }
  }

  for (const check of checks) {
    const suffix = check.detail ? ` - ${check.detail}` : "";
    console.log(`${check.status.toUpperCase()} ${check.name}${suffix}`);
  }
}

main().catch((error) => {
  for (const check of checks) {
    const suffix = check.detail ? ` - ${check.detail}` : "";
    console.error(`${check.status.toUpperCase()} ${check.name}${suffix}`);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
