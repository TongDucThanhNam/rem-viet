import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { Database } from "bun:sqlite";

import "../src/scripts/load-env";

type ImportSqlFile = {
  allowMissing?: boolean;
  label: string;
  path: string;
};

type VerifyImportSqlOptions = {
  importSqlFiles?: ImportSqlFile[];
  migrationsDir?: string;
};

const defaultSqlFiles: ImportSqlFile[] = [
  {
    label: "Mongo",
    path: process.env.D1_IMPORT_SQL_PATH ?? "mongo-d1-import.sql",
    allowMissing: process.env.D1_ALLOW_MISSING_MONGO_SQL === "true",
  },
  {
    label: "Notion",
    path: process.env.D1_NOTION_IMPORT_SQL_PATH ?? "notion-d1-import.sql",
    allowMissing: process.env.D1_ALLOW_MISSING_NOTION_SQL === "true",
  },
];
const expectedTables = [
  "categories",
  "products",
  "variants",
  "promotions",
  "carts",
  "orders",
  "logs",
  "posts",
] as const;

type ForeignKeyFailure = {
  table: string;
  rowid: number;
  parent: string;
  fkid: number;
};

type ProductCategoryOrphan = {
  id: string;
  category_id: string;
};

type PromotionRow = {
  id: string;
  product_ids: string | null;
};

type JsonProductReferenceRow = {
  id: string;
  items?: string | null;
  products?: string | null;
};

async function readMigrationSql(migrationsDir: string) {
  const entries = await readdir(migrationsDir);
  const files = entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  if (!files.length) {
    throw new Error(`No migration SQL files found at ${migrationsDir}.`);
  }

  const chunks = [];
  for (const file of files) {
    chunks.push(await readFile(join(migrationsDir, file), "utf8"));
  }

  return chunks.join("\n");
}

async function readImportSql(sqlFiles: ImportSqlFile[]) {
  const chunks = [];

  for (const file of sqlFiles) {
    let sql: string;
    try {
      sql = await readFile(file.path, "utf8");
    } catch {
      if (!file.allowMissing) {
        throw new Error(`${file.label}: missing SQL file at ${file.path}`);
      }
      console.warn(`${file.label}: skipped missing SQL file at ${file.path}`);
      continue;
    }

    if (!sql.trim()) {
      if (!file.allowMissing) {
        throw new Error(`${file.label}: empty SQL file at ${file.path}`);
      }
      console.warn(`${file.label}: skipped empty SQL file at ${file.path}`);
      continue;
    }

    chunks.push(sql);
    console.log(`${file.label}: loaded ${file.path}`);
  }

  if (!chunks.length) {
    throw new Error("No migration SQL files found. Generate Mongo/Notion SQL first.");
  }

  return chunks.join("\n");
}

function parseStringArray(value: string | null) {
  if (!value) {
    return { failures: [], values: [] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return { failures: ["product_ids must be a JSON array"], values: [] };
    }

    return {
      failures: [],
      values: parsed.map(String).filter(Boolean),
    };
  } catch {
    return { failures: ["product_ids contains invalid JSON"], values: [] };
  }
}

function parseJsonArray(owner: string, column: string, value: string | null | undefined) {
  if (!value) {
    return { failures: [], value: [] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return { failures: [`${owner}.${column} must be a JSON array`], value: [] };
    }

    return { failures: [], value: parsed };
  } catch {
    return { failures: [`${owner}.${column} contains invalid JSON`], value: [] };
  }
}

function productIdsFromValue(owner: string, column: string, value: unknown) {
  if (!Array.isArray(value)) {
    return { failures: [`${owner}.${column} must be a JSON array`], productIds: [] };
  }

  const failures: string[] = [];
  const productIds = value
    .map((item, index) => {
      if (typeof item === "string" || typeof item === "number") {
        return String(item);
      }

      if (!item || typeof item !== "object") {
        failures.push(`${owner}.${column}[${index}] has unsupported product reference`);
        return null;
      }

      const record = item as Record<string, unknown>;
      const product =
        record.product && typeof record.product === "object"
          ? (record.product as Record<string, unknown>)
          : {};
      const productScalar =
        typeof record.product === "string" || typeof record.product === "number"
          ? record.product
          : undefined;
      const productId =
        record.productId ??
        record.id ??
        record._id ??
        product.id ??
        product._id ??
        productScalar;

      if (productId == null) {
        failures.push(`${owner}.${column}[${index}] has unsupported product reference`);
        return null;
      }

      return productId;
    })
    .map((productId) => (productId == null ? "" : String(productId)))
    .filter(Boolean);

  return { failures, productIds };
}

function quoteList(values: string[]) {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");
}

function missingProductIds(db: Database, productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  if (!uniqueIds.length) {
    return [];
  }

  const existing = db
    .query(`SELECT id FROM products WHERE id IN (${quoteList(uniqueIds)})`)
    .all() as Array<{ id: string }>;
  const existingIds = new Set(existing.map((row) => row.id));

  return uniqueIds.filter((productId) => !existingIds.has(productId));
}

function assertNoFailures(label: string, failures: string[]) {
  if (!failures.length) {
    console.log(`PASS ${label}`);
    return;
  }

  for (const failure of failures) {
    console.error(`FAIL ${label}: ${failure}`);
  }
  throw new Error(`${label} failed with ${failures.length} issue(s).`);
}

export async function verifyImportSql(options: VerifyImportSqlOptions = {}) {
  const migrationsDir =
    options.migrationsDir ?? process.env.D1_MIGRATIONS_DIR ?? join(process.cwd(), "src/migrations");
  const importSqlFiles = options.importSqlFiles ?? defaultSqlFiles;
  const db = new Database(":memory:");

  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(await readMigrationSql(migrationsDir));
    db.exec(await readImportSql(importSqlFiles));
    db.exec("PRAGMA foreign_keys = ON;");

    const foreignKeyFailures = db
      .query("PRAGMA foreign_key_check")
      .all() as ForeignKeyFailure[];
    assertNoFailures(
      "foreign key check",
      foreignKeyFailures.map(
        (failure) =>
          `${failure.table} row ${failure.rowid} references missing ${failure.parent} (fk ${failure.fkid})`,
      ),
    );

    const categoryOrphans = db
      .query(
        `SELECT products.id, products.category_id
         FROM products
         LEFT JOIN categories ON categories.id = products.category_id
         WHERE products.category_id IS NOT NULL AND categories.id IS NULL`,
      )
      .all() as ProductCategoryOrphan[];
    assertNoFailures(
      "product category references",
      categoryOrphans.map(
        (row) => `product ${row.id} references missing category ${row.category_id}`,
      ),
    );

    const promotionRows = db
      .query("SELECT id, product_ids FROM promotions")
      .all() as PromotionRow[];
    const promotionFailures: string[] = [];
    for (const promotion of promotionRows) {
      const { failures, values: productIds } = parseStringArray(promotion.product_ids);
      promotionFailures.push(
        ...failures.map((failure) => `promotion ${promotion.id}: ${failure}`),
      );
      if (!productIds.length) {
        continue;
      }

      const existing = db
        .query(`SELECT id FROM products WHERE id IN (${quoteList(productIds)})`)
        .all() as Array<{ id: string }>;
      const existingIds = new Set(existing.map((row) => row.id));
      const missingIds = productIds.filter((productId) => !existingIds.has(productId));

      if (missingIds.length) {
        promotionFailures.push(
          `promotion ${promotion.id} references missing products ${missingIds.join(", ")}`,
        );
      }
    }
    assertNoFailures("promotion product references", promotionFailures);

    const orderRows = db
      .query("SELECT id, items, products FROM orders")
      .all() as JsonProductReferenceRow[];
    const orderFailures = orderRows.flatMap((row) => {
      const parsedItems = parseJsonArray(`order ${row.id}`, "items", row.items);
      const parsedProducts = parseJsonArray(
        `order ${row.id}`,
        "products",
        row.products,
      );
      const itemReferences = productIdsFromValue(
        `order ${row.id}`,
        "items",
        parsedItems.value,
      );
      const productReferences = productIdsFromValue(
        `order ${row.id}`,
        "products",
        parsedProducts.value,
      );
      const productIds = [
        ...itemReferences.productIds,
        ...productReferences.productIds,
      ];
      const missingIds = missingProductIds(db, productIds);

      return [
        ...parsedItems.failures,
        ...parsedProducts.failures,
        ...itemReferences.failures,
        ...productReferences.failures,
        ...missingIds.map(
          (productId) => `order ${row.id} references missing product ${productId}`,
        ),
      ];
    });
    assertNoFailures("order product references", orderFailures);

    const cartRows = db
      .query("SELECT id, products FROM carts")
      .all() as JsonProductReferenceRow[];
    const cartFailures = cartRows.flatMap((row) => {
      const parsedProducts = parseJsonArray(
        `cart ${row.id}`,
        "products",
        row.products,
      );
      const productReferences = productIdsFromValue(
        `cart ${row.id}`,
        "products",
        parsedProducts.value,
      );
      const missingIds = missingProductIds(
        db,
        productReferences.productIds,
      );

      return [
        ...parsedProducts.failures,
        ...productReferences.failures,
        ...missingIds.map(
          (productId) => `cart ${row.id} references missing product ${productId}`,
        ),
      ];
    });
    assertNoFailures("cart product references", cartFailures);

    console.log("Imported row counts:");
    for (const tableName of expectedTables) {
      const row = db
        .query(`SELECT COUNT(*) AS total FROM ${tableName}`)
        .get() as { total: number };
      console.log(`  ${tableName}: ${row.total}`);
    }
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  verifyImportSql().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
