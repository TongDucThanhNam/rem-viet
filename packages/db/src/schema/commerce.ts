import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { products } from "./catalog";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["cart", "product"] }).default("cart").notNull(),
    status: text("status", { enum: ["new", "processing", "completed", "cancelled"] })
      .default("new")
      .notNull(),
    email: text("email"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phoneNumber: text("phone_number").notNull(),
    address: text("address").notNull(),
    specificAddress: text("specific_address"),
    district: text("district").notNull(),
    city: text("city").notNull(),
    postcode: text("postcode"),
    total: real("total").default(0).notNull(),
    userId: text("user_id"),
    cartId: text("cart_id"),
    products: text("products", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
    shipping: text("shipping", { mode: "json" }).$type<Record<string, unknown> | null>(),
    payment: text("payment", { mode: "json" }).$type<Record<string, unknown> | null>(),
    items: text("items", { mode: "json" })
      .$type<
        Array<{
          productId: string;
          name: string;
          price: number;
          quantity: number;
          imageUrl?: string;
          variants?: Record<string, string>;
        }>
      >()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_user_id_idx").on(table.userId),
    index("orders_cart_id_idx").on(table.cartId),
  ],
);

export const carts = sqliteTable(
  "carts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    products: text("products", { mode: "json" }).$type<OrderItem[]>().default([]).notNull(),
    ...timestamps,
  },
  (table) => [index("carts_user_id_idx").on(table.userId)],
);

export const newsletterSubscriptions = sqliteTable(
  "newsletter_subscriptions",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    phoneNumber: text("phone_number"),
    source: text("source").default("web").notNull(),
    ...timestamps,
  },
  (table) => [
    index("newsletter_email_idx").on(table.email),
    index("newsletter_phone_number_idx").on(table.phoneNumber),
  ],
);

export const orderRelations = relations(orders, () => ({}));

export const cartRelations = relations(carts, () => ({}));

export type OrderItem = NonNullable<typeof orders.$inferSelect.items>[number];

function parseProductPrice(value?: string | number | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const firstPart = value.split(/[-–—]/)[0] ?? "";
  const numericPart = firstPart.match(/\d+/g)?.join("") ?? "";

  return Number(numericPart) || 0;
}

export function toOrderItemFromProduct(product: typeof products.$inferSelect): OrderItem {
  return {
    productId: product.id,
    name: product.name,
    price: parseProductPrice(product.price),
    quantity: 1,
    imageUrl: product.imageUrls?.[0],
    variants: {},
  };
}
