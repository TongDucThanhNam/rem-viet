import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

const softDelete = {
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
};

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [index("categories_name_idx").on(table.name)],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug"),
    imageUrls: text("image_urls", { mode: "json" }).$type<string[]>().default([]),
    name: text("name").notNull(),
    description: text("description"),
    size: text("size", { mode: "json" }).$type<string[]>().default([]),
    price: text("price").default("0"),
    soldQuantity: integer("sold_quantity").default(0).notNull(),
    quantity: integer("quantity").default(0).notNull(),
    rating: real("rating").default(0).notNull(),
    reviewsCount: integer("reviews_count").default(0).notNull(),
    categoryId: text("category_id"),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    index("products_slug_idx").on(table.slug),
    index("products_active_deleted_idx").on(table.isActive, table.isDeleted),
  ],
);

export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: integer("key").notNull(),
    variantPrice: real("variant_price").notNull(),
    values: text("values", { mode: "json" }).$type<Record<string, string>>().notNull(),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    index("variants_product_id_idx").on(table.productId),
    index("variants_active_deleted_idx").on(table.isActive, table.isDeleted),
  ],
);

export const promotions = sqliteTable(
  "promotions",
  {
    id: text("id").primaryKey(),
    discountType: text("discount_type").notNull(),
    discountValue: real("discount_value").notNull(),
    startDate: integer("start_date", { mode: "timestamp_ms" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp_ms" }).notNull(),
    productIds: text("product_ids", { mode: "json" }).$type<string[]>().default([]).notNull(),
    ...softDelete,
    ...timestamps,
  },
  (table) => [
    index("promotions_active_deleted_idx").on(table.isActive, table.isDeleted),
    index("promotions_date_idx").on(table.startDate, table.endDate),
  ],
);

export const categoryRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productRelations = relations(products, ({ many, one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(variants),
}));

export const variantRelations = relations(variants, ({ one }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
}));
