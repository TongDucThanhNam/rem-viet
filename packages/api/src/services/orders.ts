import { createDb } from "@rem-viet/db";
import {
  newsletterSubscriptions,
  orders,
  type OrderItem,
} from "@rem-viet/db/schema/commerce";
import { products, variants } from "@rem-viet/db/schema/catalog";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { notifyTelegram } from "./telegram";
import { normalizeStringRecord, parsePriceNumber } from "./parsing";

const contactBaseSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(1),
  address: z.string().min(1),
  district: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().optional().default(""),
});
const contactSchema = contactBaseSchema.extend({
  specificAddress: z.string().min(1),
});
const productOrderContactSchema = contactBaseSchema.extend({
  specificAddress: z.string().optional().default(""),
});

type ContactInput = z.infer<typeof productOrderContactSchema>;

const orderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  name: z.string().min(1),
  price: z.preprocess(parsePriceNumber, z.number()),
  quantity: z.coerce.number().int().positive().default(1),
  imageUrl: z.string().optional(),
  variants: z
    .preprocess(normalizeStringRecord, z.record(z.string(), z.string()))
    .optional()
    .default({}),
});

export const createCartOrderInputSchema = contactSchema.extend({
  cart: z.array(orderItemSchema).min(1),
  total: z.preprocess(
    (value) => (value === undefined ? undefined : parsePriceNumber(value)),
    z.number().optional(),
  ),
  cartId: z.string().optional(),
});

export const createProductOrderInputSchema = z.object({
  product: z
    .object({
      _id: z.string().optional(),
      id: z.string().optional(),
      name: z.string().min(1),
      imageUrls: z.array(z.string()).optional(),
      imageUrl: z.string().optional(),
    })
    .passthrough(),
  variantChosen: z
    .preprocess(normalizeStringRecord, z.record(z.string(), z.string()))
    .optional()
    .default({}),
  productPrice: z.preprocess(parsePriceNumber, z.number()),
  info: productOrderContactSchema,
});

export const createNewsletterInputSchema = z
  .object({
    email: z.string().email().optional().or(z.literal("")),
    phoneNumber: z.string().optional(),
    source: z.string().optional().default("web"),
  })
  .refine((value) => value.email || value.phoneNumber, {
    message: "Email hoặc số điện thoại là bắt buộc.",
  });

export const orderIdInputSchema = z.object({
  orderId: z.string().min(1),
});

export const orderStatusSchema = z.enum([
  "new",
  "processing",
  "completed",
  "cancelled",
]);

export const updateOrderStatusInputSchema = orderIdInputSchema.extend({
  status: orderStatusSchema,
});

function orderItemsFromUnknown(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const product =
      record.product && typeof record.product === "object"
        ? (record.product as Record<string, unknown>)
        : record;
    const variants = normalizeStringRecord(record.variants);

    return {
      productId: String(
        record.productId ?? product._id ?? product.id ?? crypto.randomUUID(),
      ),
      name: String(record.name ?? product.name ?? "Sản phẩm"),
      price: parsePriceNumber(
        record.price ?? record.productPrice ?? product.price ?? 0,
      ),
      quantity: Number(record.quantity ?? 1),
      imageUrl: String(
        record.imageUrl ??
          (product.imageUrls as string[] | undefined)?.[0] ??
          "",
      ),
      variants,
    };
  });
}

function legacyOrder(row: typeof orders.$inferSelect) {
  const fallbackItems = orderItemsFromUnknown(row.products);

  return {
    ...row,
    _id: row.id,
    items: row.items.length ? row.items : fallbackItems,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function response<T>(message: string, statusCode: number, data: T) {
  return {
    message,
    statusCode,
    data,
  };
}

function normalizeCartItem(item: z.infer<typeof orderItemSchema>): OrderItem {
  return {
    productId: item.productId ?? item.id ?? crypto.randomUUID(),
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    imageUrl: item.imageUrl,
    variants: item.variants,
  };
}

function isSameVariantSelection(
  rowValues: Record<string, string>,
  selectedValues: Record<string, string>,
) {
  const rowEntries = Object.entries(rowValues);
  const selectedEntries = Object.entries(selectedValues);

  return (
    rowEntries.length === selectedEntries.length &&
    rowEntries.every(([key, value]) => selectedValues[key] === value)
  );
}

async function priceOrderItems(items: OrderItem[]) {
  const db = createDb();
  const pricedItems: OrderItem[] = [];

  for (const item of items) {
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, item.productId),
        eq(products.isActive, true),
        eq(products.isDeleted, false),
      ),
    });

    if (!product) {
      throw new Error(`Product ${item.productId} is not available`);
    }

    if (item.quantity > product.quantity) {
      throw new Error(
        `Product ${product.id} has only ${product.quantity} item(s) in stock`,
      );
    }

    const productVariants = await db.query.variants.findMany({
      where: and(
        eq(variants.productId, product.id),
        eq(variants.isActive, true),
        eq(variants.isDeleted, false),
      ),
      orderBy: asc(variants.key),
    });
    const selectedValues = item.variants ?? {};
    const selectedVariant = productVariants.find((variant) =>
      isSameVariantSelection(variant.values, selectedValues),
    );

    if (productVariants.length > 0 && !selectedVariant) {
      throw new Error(`Variant for product ${product.id} is not available`);
    }

    pricedItems.push({
      productId: product.id,
      name: product.name,
      price: selectedVariant?.variantPrice ?? parsePriceNumber(product.price),
      quantity: item.quantity,
      imageUrl: product.imageUrls?.[0] ?? item.imageUrl,
      variants: selectedVariant ? selectedValues : {},
    });
  }

  return pricedItems;
}

function calculateTotal(items: OrderItem[]) {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

function toLegacyProducts(items: OrderItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    imageUrl: item.imageUrl,
    variants: item.variants ?? {},
  }));
}

function toLegacyShipping(input: z.infer<typeof createCartOrderInputSchema>) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    address: input.address,
    specificAddress: input.specificAddress,
    district: input.district,
    city: input.city,
    postcode: input.postcode,
  };
}

function contactLines(input: ContactInput) {
  return [
    `+ Email: ${input.email || ""}`,
    `+ Tên: ${input.firstName}`,
    `+ Họ: ${input.lastName}`,
    `+ Số điện thoại: ${input.phoneNumber}`,
    `+ Địa chỉ: ${input.address}`,
    `+ Địa chỉ cụ thể: ${input.specificAddress || ""}`,
    `+ Quận/Huyện: ${input.district}`,
    `+ Thành phố: ${input.city}`,
    `+ Mã bưu điện: ${input.postcode}`,
  ].join("\n            ");
}

function cartOrderMessage(
  input: z.infer<typeof createCartOrderInputSchema>,
  items: OrderItem[],
  total: number,
) {
  const textCart = items
    .map(
      (item) =>
        `+ ${item.name} - ${JSON.stringify(item.variants ?? {})} x ${item.quantity}`,
    )
    .join("\n  ");

  return `
Đơn hàng mới:
- Tổng tiền: ${total}đ
- Thông tin liên hệ:
            ${contactLines(input)}
- Sản phẩm:
  ${textCart}
`.trim();
}

function productOrderMessage(
  input: z.infer<typeof createProductOrderInputSchema>,
  item: OrderItem,
  total: number,
) {
  return `
	Đơn hàng mới:
	- Sản phẩm: ${item.name}
	- Biến thể: ${JSON.stringify(item.variants ?? {})}
	- Giá: ${total}đ
	- Thông tin liên hệ:
	            ${contactLines(input.info)}
	`.trim();
}

export async function createCartOrder(
  input: z.infer<typeof createCartOrderInputSchema>,
) {
  const result = await createOrderFromCartInput(input, "cart");
  await notifyTelegram(
    cartOrderMessage(input, result.data.items, result.data.total),
  );

  return result;
}

async function createOrderFromCartInput(
  input: z.infer<typeof createCartOrderInputSchema>,
  type: "cart" | "product",
) {
  const db = createDb();
  const now = new Date();
  const items = await priceOrderItems(input.cart.map(normalizeCartItem));
  const total = calculateTotal(items);
  const [createdOrder] = await db
    .insert(orders)
    .values({
      id: crypto.randomUUID(),
      type,
      email: input.email || null,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      address: input.address,
      specificAddress: input.specificAddress,
      district: input.district,
      city: input.city,
      postcode: input.postcode,
      cartId: input.cartId,
      products: toLegacyProducts(items),
      shipping: toLegacyShipping(input),
      payment: {
        method: "cod",
        status: "pending",
        total,
      },
      total,
      items,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdOrder) {
    throw new Error("Failed to create order");
  }

  return {
    message: "Order created",
    statusCode: 201,
    data: legacyOrder(createdOrder),
  };
}

export async function createProductOrder(
  input: z.infer<typeof createProductOrderInputSchema>,
) {
  const productId =
    input.product._id ?? input.product.id ?? crypto.randomUUID();

  const result = await createOrderFromCartInput(
    {
      ...input.info,
      cart: [
        {
          productId,
          name: input.product.name,
          price: input.productPrice,
          quantity: 1,
          imageUrl: input.product.imageUrl ?? input.product.imageUrls?.[0],
          variants: input.variantChosen,
        },
      ],
      total: input.productPrice,
    },
    "product",
  );

  const [pricedItem] = result.data.items;

  if (!pricedItem) {
    throw new Error("Product order item was not created");
  }

  await notifyTelegram(productOrderMessage(input, pricedItem, result.data.total));

  return result;
}

export async function createNewsletterSubscription(
  input: z.infer<typeof createNewsletterInputSchema>,
) {
  const db = createDb();
  const now = new Date();
  const [createdSubscription] = await db
    .insert(newsletterSubscriptions)
    .values({
      id: crypto.randomUUID(),
      email: input.email || null,
      phoneNumber: input.phoneNumber || null,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdSubscription) {
    throw new Error("Failed to create newsletter subscription");
  }

  if (input.phoneNumber) {
    await notifyTelegram(
      `Khách hàng này muốn nhận thông tin tư vấn:\n${input.phoneNumber}`,
    );
  } else if (input.email) {
    await notifyTelegram(
      `Khách hàng này muốn nhận thông tin tư vấn:\n${input.email}`,
    );
  }

  return {
    message: "Newsletter subscription created",
    statusCode: 201,
    data: {
      ...createdSubscription,
      _id: createdSubscription.id,
      createdAt: createdSubscription.createdAt.toISOString(),
      updatedAt: createdSubscription.updatedAt.toISOString(),
    },
  };
}

export async function listOrders() {
  const db = createDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));

  return rows.map(legacyOrder);
}

export async function getOrderById(input: z.infer<typeof orderIdInputSchema>) {
  const db = createDb();
  const row = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!row) {
    return response("Order not found", 404, null);
  }

  return response("Order found", 200, legacyOrder(row));
}

export async function updateOrderStatus(
  input: z.infer<typeof updateOrderStatusInputSchema>,
) {
  const db = createDb();
  const [updatedOrder] = await db
    .update(orders)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, input.orderId))
    .returning();

  if (!updatedOrder) {
    return response("Order not found", 404, null);
  }

  return response("Order updated", 200, legacyOrder(updatedOrder));
}
