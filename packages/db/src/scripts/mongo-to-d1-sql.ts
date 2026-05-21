import { writeFile } from "node:fs/promises";

import { MongoClient } from "mongodb";

import "./load-env";

type SqlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Record<string, unknown>
  | unknown[];

const outputPath = process.env.D1_IMPORT_SQL_PATH ?? "mongo-d1-import.sql";
const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
const mongoDbName = process.env.MONGODB_DB_NAME ?? process.env.MONGO_DB_NAME;
const allowUnmappedCollections =
  process.env.D1_ALLOW_UNMAPPED_COLLECTIONS === "true";
const mappedCollections = [
  "categories",
  "products",
  "variants",
  "promotions",
  "carts",
  "orders",
  "logs",
] as const;

if (!mongoUri) {
  throw new Error("Missing MONGODB_URI or MONGO_URI.");
}

const resolvedMongoUri = mongoUri;

function objectId(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }

  return String(value);
}

function requiredLegacyId(value: unknown, label: string) {
  const id = objectId(value);
  if (!id) {
    throw new Error(`${label} is missing _id.`);
  }
  return id;
}

function slugifyProductName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function jsonValue(value: unknown) {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (
      nestedValue &&
      typeof nestedValue === "object" &&
      "_bsontype" in nestedValue
    ) {
      return String(nestedValue);
    }

    return nestedValue;
  });
}

function stringRecord(value: unknown) {
  const parsed = typeof value === "string" ? parseJsonObject(value) : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [
      key,
      String(item),
    ]),
  );
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function dateMs(value: unknown, fallback = new Date()) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return fallback.getTime();
}

function priceNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const firstPart = value.split(/[-–—]/)[0] ?? "";
  const numericPart = firstPart.match(/\d+/g)?.join("") ?? "";

  return Number(numericPart) || 0;
}

function sql(value: SqlValue) {
  if (value === undefined || value === null) {
    return "NULL";
  }

  if (value instanceof Date) {
    return String(value.getTime());
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (Array.isArray(value) || typeof value === "object") {
    return sql(jsonValue(value));
  }

  return `'${value.replaceAll("'", "''")}'`;
}

function insert(table: string, columns: string[], values: SqlValue[]) {
  return `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values.map(sql).join(", ")});`;
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function orderItemsFromUnknown(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const product =
      record.product && typeof record.product === "object"
        ? (record.product as Record<string, unknown>)
        : record;
    const directProductId =
      typeof item === "string" ||
      typeof item === "number" ||
      (item &&
        typeof item === "object" &&
        "_bsontype" in (item as Record<string, unknown>))
        ? item
        : undefined;
    const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls : [];

    return {
      productId:
        objectId(record.productId ?? product._id ?? product.id ?? directProductId) ??
        `legacy-unresolved-product-${index}`,
      name: String(record.name ?? product.name ?? "Sản phẩm"),
      price: priceNumber(record.price ?? record.productPrice ?? product.price),
      quantity: Number(record.quantity ?? 1),
      imageUrl: String(record.imageUrl ?? imageUrls[0] ?? ""),
      variants: stringRecord(record.variants),
    };
  });
}

function orderTotalFromUnknown(
  payment: unknown,
  items: ReturnType<typeof orderItemsFromUnknown>,
) {
  const paymentRecord =
    payment && typeof payment === "object"
      ? (payment as Record<string, unknown>)
      : {};
  const paymentTotal = priceNumber(paymentRecord.total ?? paymentRecord.amount);

  if (Number.isFinite(paymentTotal) && paymentTotal > 0) {
    return paymentTotal;
  }

  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

async function readCollection(
  db: ReturnType<MongoClient["db"]>,
  collectionName: string,
) {
  return db.collection(collectionName).find({}).toArray();
}

async function assertNoUnmappedCollections(db: ReturnType<MongoClient["db"]>) {
  const mapped = new Set<string>(mappedCollections);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const unmapped = collections
    .map((collection) => collection.name)
    .filter(
      (name) =>
        name &&
        !name.startsWith("system.") &&
        !mapped.has(name),
    );
  const nonEmpty = [];

  for (const name of unmapped) {
    const count = await db.collection(name).estimatedDocumentCount();
    if (count > 0) {
      nonEmpty.push({ name, count });
    }
  }

  if (!nonEmpty.length) {
    return;
  }

  const detail = nonEmpty
    .map((collection) => `${collection.name} (${collection.count})`)
    .join(", ");
  const message = `Mongo has non-empty collections without D1 mapping: ${detail}. Add a Drizzle/import mapping or set D1_ALLOW_UNMAPPED_COLLECTIONS=true to export only the mapped storefront/admin collections.`;

  if (!allowUnmappedCollections) {
    throw new Error(message);
  }

  console.warn(`WARN ${message}`);
}

async function main() {
  const client = new MongoClient(resolvedMongoUri);
  await client.connect();

  try {
    const db = mongoDbName ? client.db(mongoDbName) : client.db();
    await assertNoUnmappedCollections(db);

    const now = new Date();
    const statements: string[] = [
      "PRAGMA foreign_keys = OFF;",
      "BEGIN TRANSACTION;",
    ];
    const productIds = new Set<string>();

    for (const doc of await readCollection(db, "categories")) {
      const createdAt = dateMs(doc.createdAt, now);
      const categoryId = requiredLegacyId(
        doc._id,
        `Category ${String(doc.name ?? "<unnamed>")}`,
      );
      statements.push(
        insert(
          "categories",
          ["id", "name", "created_at", "updated_at"],
          [
            categoryId,
            String(doc.name ?? ""),
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    for (const doc of await readCollection(db, "products")) {
      const createdAt = dateMs(doc.createdAt, now);
      const productId = objectId(doc._id);
      const name = String(doc.name ?? "");
      if (!productId) {
        throw new Error(`Product ${name || "<unnamed>"} is missing _id.`);
      }
      productIds.add(productId);
      statements.push(
        insert(
          "products",
          [
            "id",
            "slug",
            "image_urls",
            "name",
            "description",
            "size",
            "price",
            "sold_quantity",
            "quantity",
            "rating",
            "reviews_count",
            "category_id",
            "is_deleted",
            "is_active",
            "created_at",
            "updated_at",
          ],
          [
            productId,
            doc.slug ?? slugifyProductName(name),
            doc.imageUrls ?? [],
            name,
            doc.description ?? "",
            doc.size ?? [],
            doc.price ?? "0",
            doc.soldQuantity ?? 0,
            doc.quantity ?? 0,
            doc.rating ?? 0,
            doc.reviewsCount ?? 0,
            objectId(doc.categoryId),
            doc.isDeleted ?? false,
            doc.isActive ?? true,
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    for (const doc of await readCollection(db, "variants")) {
      const createdAt = dateMs(doc.createdAt, now);
      const variantId = requiredLegacyId(doc._id, "Variant");
      const productId = objectId(doc.productId);
      if (!productId || !productIds.has(productId)) {
        throw new Error(
          `Variant ${variantId} references missing product ${productId ?? "<empty>"}.`,
        );
      }
      statements.push(
        insert(
          "variants",
          [
            "id",
            "product_id",
            "key",
            "variant_price",
            '"values"',
            "is_deleted",
            "is_active",
            "created_at",
            "updated_at",
          ],
          [
            variantId,
            productId,
            doc.key ?? 0,
            doc.variantPrice ?? 0,
            stringRecord(doc.values),
            doc.isDeleted ?? false,
            doc.isActive ?? true,
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    for (const doc of await readCollection(db, "promotions")) {
      const createdAt = dateMs(doc.createdAt, now);
      const promotionId = requiredLegacyId(doc._id, "Promotion");
      statements.push(
        insert(
          "promotions",
          [
            "id",
            "discount_type",
            "discount_value",
            "start_date",
            "end_date",
            "product_ids",
            "is_deleted",
            "is_active",
            "created_at",
            "updated_at",
          ],
          [
            promotionId,
            doc.discountType ?? "",
            doc.discountValue ?? 0,
            dateMs(doc.startDate, now),
            dateMs(doc.endDate, now),
            (doc.productIds ?? []).map(objectId),
            doc.isDeleted ?? false,
            doc.isActive ?? true,
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    for (const doc of await readCollection(db, "carts")) {
      const createdAt = dateMs(doc.createdAt, now);
      const cartId = requiredLegacyId(doc._id, "Cart");
      const userId = objectId(doc.userId) ?? `legacy-anonymous-${cartId}`;

      statements.push(
        insert(
          "carts",
          ["id", "user_id", "products", "created_at", "updated_at"],
          [
            cartId,
            userId,
            doc.products ?? [],
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    for (const doc of await readCollection(db, "orders")) {
      const createdAt = dateMs(doc.createdAt, now);
      const orderId = requiredLegacyId(doc._id, "Order");
      const legacyInfo = recordFromUnknown(doc.info);
      const legacyContact = recordFromUnknown(doc.contact);
      const legacyShipping = recordFromUnknown(doc.shipping);
      const shipping = {
        email: doc.email,
        firstName: doc.firstName ?? doc.first_name,
        lastName: doc.lastName ?? doc.last_name,
        phoneNumber: doc.phoneNumber ?? doc.phone_number ?? doc.phone,
        address: doc.address,
        specificAddress: doc.specificAddress ?? doc.specific_address,
        district: doc.district,
        city: doc.city,
        postcode: doc.postcode,
        ...legacyInfo,
        ...legacyContact,
        ...legacyShipping,
        legacyInfo: Object.keys(legacyInfo).length ? legacyInfo : null,
        legacyContact: Object.keys(legacyContact).length ? legacyContact : null,
        legacyShipping: Object.keys(legacyShipping).length
          ? legacyShipping
          : null,
      };
      const items = orderItemsFromUnknown(doc.items ?? doc.products);
      const total = orderTotalFromUnknown(doc.payment, items);
      statements.push(
        insert(
          "orders",
          [
            "id",
            "type",
            "status",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "address",
            "specific_address",
            "district",
            "city",
            "postcode",
            "total",
            "user_id",
            "cart_id",
            "products",
            "shipping",
            "payment",
            "items",
            "created_at",
            "updated_at",
          ],
          [
            orderId,
            doc.type ?? "cart",
            doc.status ?? "new",
            shipping.email ?? "",
            shipping.firstName ?? "Legacy",
            shipping.lastName ?? "Order",
            shipping.phoneNumber ?? "",
            shipping.address ?? "",
            shipping.specificAddress ?? "",
            shipping.district ?? "",
            shipping.city ?? "",
            shipping.postcode ?? "",
            total,
            objectId(doc.userId),
            objectId(doc.cartId),
            doc.products ?? [],
            Object.values(shipping).some((value) => value != null)
              ? shipping
              : null,
            doc.payment ?? null,
            items,
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    for (const doc of await readCollection(db, "logs")) {
      const createdAt = dateMs(doc.createdAt, now);
      const logId = requiredLegacyId(doc._id, "Log");
      statements.push(
        insert(
          "logs",
          [
            "id",
            "user_id",
            "method",
            "url",
            "status_code",
            "ip_address",
            "device_id",
            "time_stamp",
            "is_deleted",
            "is_active",
            "created_at",
            "updated_at",
          ],
          [
            logId,
            objectId(doc.userId),
            doc.method ?? null,
            doc.url ?? null,
            doc.statusCode ?? null,
            doc.ipAddress ?? null,
            doc.deviceId ?? null,
            doc.timeStamp == null ? null : dateMs(doc.timeStamp, now),
            doc.isDeleted ?? false,
            doc.isActive ?? true,
            createdAt,
            dateMs(doc.updatedAt, now),
          ],
        ),
      );
    }

    statements.push("COMMIT;", "PRAGMA foreign_keys = ON;");
    await writeFile(outputPath, `${statements.join("\n")}\n`);
    console.log(`Wrote ${statements.length} SQL statements to ${outputPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
