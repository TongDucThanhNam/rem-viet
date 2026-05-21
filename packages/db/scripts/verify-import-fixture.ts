import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { verifyImportSql } from "./verify-import-sql";

const timestamp = 1_700_000_000_000;

const mongoFixtureSql = `
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
INSERT OR REPLACE INTO categories (id, name, created_at, updated_at)
VALUES ('fixture-category-1', 'Danh mục fixture', ${timestamp}, ${timestamp});
INSERT OR REPLACE INTO products (
  id,
  slug,
  image_urls,
  name,
  description,
  size,
  price,
  sold_quantity,
  quantity,
  rating,
  reviews_count,
  category_id,
  is_deleted,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'fixture-product-1',
  'san-pham-fixture',
  '["/src/800x800.png"]',
  'Sản phẩm fixture',
  'Sản phẩm dùng để kiểm thử import D1.',
  '["M"]',
  '120000',
  2,
  10,
  5,
  1,
  'fixture-category-1',
  0,
  1,
  ${timestamp},
  ${timestamp}
);
INSERT OR REPLACE INTO variants (
  id,
  product_id,
  key,
  variant_price,
  "values",
  is_deleted,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'fixture-variant-1',
  'fixture-product-1',
  0,
  120000,
  '{"Kich thuoc":"M"}',
  0,
  1,
  ${timestamp},
  ${timestamp}
);
INSERT OR REPLACE INTO promotions (
  id,
  discount_type,
  discount_value,
  start_date,
  end_date,
  product_ids,
  is_deleted,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'fixture-promotion-1',
  'percentage',
  10,
  ${timestamp},
  ${timestamp + 86_400_000},
  '["fixture-product-1"]',
  0,
  1,
  ${timestamp},
  ${timestamp}
);
INSERT OR REPLACE INTO carts (id, user_id, products, created_at, updated_at)
VALUES (
  'fixture-cart-1',
  'fixture-user-1',
  '[{"productId":"fixture-product-1","name":"Sản phẩm fixture","price":120000,"quantity":1,"variants":{"Kich thuoc":"M"}}]',
  ${timestamp},
  ${timestamp}
);
INSERT OR REPLACE INTO orders (
  id,
  type,
  status,
  email,
  first_name,
  last_name,
  phone_number,
  address,
  specific_address,
  district,
  city,
  postcode,
  total,
  user_id,
  cart_id,
  products,
  shipping,
  payment,
  items,
  created_at,
  updated_at
)
VALUES (
  'fixture-order-1',
  'cart',
  'new',
  'fixture@example.com',
  'Fixture',
  'User',
  '0900000000',
  'Ha Noi',
  'So 1',
  'Hoan Kiem',
  'Ha Noi',
  '100000',
  120000,
  'fixture-user-1',
  'fixture-cart-1',
  '["fixture-product-1",{"product":{"_id":"fixture-product-1"},"quantity":1}]',
  '{"method":"standard"}',
  '{"method":"cod"}',
  '[{"productId":"fixture-product-1","name":"Sản phẩm fixture","price":120000,"quantity":1,"variants":{"Kich thuoc":"M"}}]',
  ${timestamp},
  ${timestamp}
);
INSERT OR REPLACE INTO logs (
  id,
  user_id,
  method,
  url,
  status_code,
  ip_address,
  device_id,
  time_stamp,
  is_deleted,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'fixture-log-1',
  'fixture-user-1',
  'POST',
  '/api/orders',
  201,
  '127.0.0.1',
  'fixture-device',
  ${timestamp},
  0,
  1,
  ${timestamp},
  ${timestamp}
);
COMMIT;
PRAGMA foreign_keys = ON;
`;

const notionFixtureSql = `
BEGIN TRANSACTION;
INSERT OR REPLACE INTO posts (
  id,
  slug,
  title,
  description,
  cover_image,
  tags,
  status,
  url,
  content,
  table_of_contents,
  publish_date,
  created_at,
  updated_at
)
VALUES (
  'fixture-post-1',
  'bai-viet-fixture',
  'Bài viết fixture',
  'Bài viết dùng để kiểm thử import Notion.',
  '',
  '["fixture"]',
  'published',
  'https://example.com/bai-viet-fixture',
  '<p>Nội dung fixture</p>',
  '[]',
  '2026-01-01',
  ${timestamp},
  ${timestamp}
);
COMMIT;
`;

const tempDir = await mkdtemp(join(tmpdir(), "rem-viet-d1-import-fixture-"));

try {
  const mongoPath = join(tempDir, "mongo-fixture.sql");
  const notionPath = join(tempDir, "notion-fixture.sql");

  await writeFile(mongoPath, mongoFixtureSql, "utf8");
  await writeFile(notionPath, notionFixtureSql, "utf8");

  await verifyImportSql({
    importSqlFiles: [
      { label: "Mongo fixture", path: mongoPath },
      { label: "Notion fixture", path: notionPath },
    ],
  });
} finally {
  await rm(tempDir, { force: true, recursive: true });
}
