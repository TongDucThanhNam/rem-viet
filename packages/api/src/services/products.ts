import { createDb } from "@rem-viet/db";
import { categories, products, variants } from "@rem-viet/db/schema/catalog";
import { and, asc, count, desc, eq, like } from "drizzle-orm";
import { z } from "zod";

import {
  blankToUndefined,
  booleanStringToBoolean,
  normalizeStringRecord,
} from "./parsing";

const productSortColumns = {
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  name: products.name,
  price: products.price,
  soldQuantity: products.soldQuantity,
} as const;

const variantInputSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  key: z.coerce.number().int(),
  variantPrice: z.coerce.number(),
  values: z.preprocess(normalizeStringRecord, z.record(z.string(), z.string())),
});

export const listProductsInputSchema = z
  .object({
    search: z.preprocess(blankToUndefined, z.string().optional()),
    sort: z.preprocess(
      blankToUndefined,
      z
        .enum(["createdAt", "updatedAt", "name", "price", "soldQuantity"])
        .optional(),
    ),
    order: z.preprocess(blankToUndefined, z.enum(["asc", "desc"]).optional()),
    page: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    limit: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    isActive: z.preprocess(booleanStringToBoolean, z.boolean().optional()),
    isDeleted: z.preprocess(booleanStringToBoolean, z.boolean().optional()),
  })
  .optional();

type ListProductsInput = z.infer<typeof listProductsInputSchema> & {
  includeInactive?: boolean;
};

export const productIdInputSchema = z.object({
  productId: z.string().min(1),
  includeInactive: z.boolean().optional(),
});

export const publicProductIdInputSchema = productIdInputSchema.omit({
  includeInactive: true,
});

export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  price: z.coerce.string().optional(),
  size: z.array(z.coerce.string()).optional().default([]),
  imageurls: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
  quantity: z.coerce.number().int().optional().default(0),
  categoryId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  variants: z.array(variantInputSchema).optional().default([]),
});

export const updateProductInputSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.coerce.string().optional(),
  size: z.array(z.coerce.string()).optional(),
  imageurls: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
  quantity: z.coerce.number().int().optional(),
  categoryId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  variants: z.array(variantInputSchema).optional(),
});

function slugifyProductName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toLegacyProduct(row: typeof products.$inferSelect) {
  return {
    ...row,
    _id: row.id,
    imageUrls: row.imageUrls ?? [],
    size: row.size ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLegacyVariant(row: typeof variants.$inferSelect) {
  return {
    ...row,
    _id: row.id,
    values: normalizeStringRecord(row.values),
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

function getPriceRange(input: z.infer<typeof createProductInputSchema>) {
  if (input.price && input.price !== "0") {
    return input.price;
  }

  if (!input.variants.length) {
    return input.price ?? "0";
  }

  const prices = input.variants.map((variant) => variant.variantPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return `${min} - ${max}`;
}

export async function listProducts(input: ListProductsInput = {}) {
  const db = createDb();
  const page = input?.page ?? 1;
  const limit = input?.limit;
  const offset = limit ? (page - 1) * limit : 0;
  const conditions = [];

  if (
    !input?.includeInactive &&
    ((input?.isActive !== undefined && input.isActive !== true) ||
      (input?.isDeleted !== undefined && input.isDeleted !== false))
  ) {
    return {
      currentPage: page,
      totalPage: 1,
      totalItems: 0,
      perPage: limit ?? 0,
      data: [],
    };
  }

  if (input?.search) {
    conditions.push(like(products.name, `%${input.search}%`));
  }
  if (input?.includeInactive) {
    if (input.isActive !== undefined) {
      conditions.push(eq(products.isActive, input.isActive));
    }
    if (input.isDeleted !== undefined) {
      conditions.push(eq(products.isDeleted, input.isDeleted));
    }
  } else {
    conditions.push(eq(products.isActive, true));
    conditions.push(eq(products.isDeleted, false));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const sortColumn = productSortColumns[input?.sort ?? "createdAt"];
  const orderBy = input?.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const totalQuery = db.select({ total: count() }).from(products).$dynamic();
  const totalRows = await (whereClause
    ? totalQuery.where(whereClause)
    : totalQuery);

  const rowsQuery = db.select().from(products).$dynamic();
  const orderedRowsQuery = (
    whereClause ? rowsQuery.where(whereClause) : rowsQuery
  ).orderBy(orderBy);
  const rows = await (limit
    ? orderedRowsQuery.limit(limit).offset(offset)
    : orderedRowsQuery);

  const totalItems = totalRows[0]?.total ?? 0;
  const perPage = limit ?? totalItems;

  return {
    currentPage: page,
    totalPage: limit ? Math.ceil(totalItems / limit) : 1,
    totalItems,
    perPage,
    data: rows.map(toLegacyProduct),
  };
}

export async function getProductById(
  input: z.infer<typeof productIdInputSchema>,
) {
  const db = createDb();
  const conditions = [eq(products.id, input.productId)];

  if (!input.includeInactive) {
    conditions.push(eq(products.isActive, true));
    conditions.push(eq(products.isDeleted, false));
  }

  const row = await db.query.products.findFirst({
    where: and(...conditions),
  });

  if (!row) {
    return response("Product not found", 404, null);
  }

  return response("Product found", 200, toLegacyProduct(row));
}

export async function getProductWithVariantsById(
  input: z.infer<typeof productIdInputSchema>,
) {
  const db = createDb();
  const productConditions = [eq(products.id, input.productId)];
  const variantConditions = [eq(variants.productId, input.productId)];

  if (!input.includeInactive) {
    productConditions.push(eq(products.isActive, true));
    productConditions.push(eq(products.isDeleted, false));
    variantConditions.push(eq(variants.isActive, true));
    variantConditions.push(eq(variants.isDeleted, false));
  }

  const product = await db.query.products.findFirst({
    where: and(...productConditions),
  });

  if (!product) {
    return response("Product not found", 404, null);
  }

  const productVariants = await db.query.variants.findMany({
    where: and(...variantConditions),
    orderBy: asc(variants.key),
  });

  return response("Product and variants found", 200, {
    product: toLegacyProduct(product),
    variants: productVariants.map(toLegacyVariant),
  });
}

export async function createProduct(
  input: z.infer<typeof createProductInputSchema>,
) {
  const db = createDb();
  const productId = crypto.randomUUID();
  const now = new Date();
  const imageUrls = input.imageurls ?? input.imageUrls ?? [];
  const price = getPriceRange(input);

  const createdProduct = await db.transaction(async (tx) => {
    if (input.categoryId) {
      const category = await tx.query.categories.findFirst({
        where: eq(categories.id, input.categoryId),
      });

      if (!category) {
        throw new Error("Category not found");
      }
    }

    const [product] = await tx
      .insert(products)
      .values({
        id: productId,
        slug: slugifyProductName(input.name),
        imageUrls,
        name: input.name,
        description: input.description,
        size: input.size,
        price,
        quantity: input.quantity,
        categoryId: input.categoryId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!product) {
      throw new Error("Failed to create product");
    }

    if (input.variants.length) {
      await tx.insert(variants).values(
        input.variants.map((variant) => ({
          id: crypto.randomUUID(),
          productId,
          key: variant.key,
          variantPrice: variant.variantPrice,
          values: variant.values,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    return product;
  });

  if (!createdProduct) {
    throw new Error("Failed to create product");
  }

  const createdVariants = await db.query.variants.findMany({
    where: eq(variants.productId, productId),
    orderBy: asc(variants.key),
  });

  return response("Product created", 201, {
    product: toLegacyProduct(createdProduct),
    variants: createdVariants.map(toLegacyVariant),
  });
}

export async function updateProduct(
  input: z.infer<typeof updateProductInputSchema>,
) {
  const db = createDb();
  const hasVariants = Object.hasOwn(input, "variants");
  const existing = await db.query.products.findFirst({
    where: eq(products.id, input.productId),
  });

  if (!existing) {
    return response("Product not found", 404, null);
  }

  const imageUrls = input.imageurls ?? input.imageUrls;
  const productUpdates = {
    ...(input.name !== undefined && {
      name: input.name,
      slug: slugifyProductName(input.name),
    }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.size !== undefined && { size: input.size }),
    ...(input.price !== undefined && { price: input.price }),
    ...(imageUrls !== undefined && { imageUrls }),
    ...(input.quantity !== undefined && { quantity: input.quantity }),
    ...(input.categoryId !== undefined && { categoryId: input.categoryId ?? null }),
    updatedAt: new Date(),
  };

  const updatedProduct = await db.transaction(async (tx) => {
    if (input.categoryId) {
      const category = await tx.query.categories.findFirst({
        where: eq(categories.id, input.categoryId),
      });

      if (!category) {
        throw new Error("Category not found");
      }
    }

    const [product] = await tx
      .update(products)
      .set(productUpdates)
      .where(eq(products.id, input.productId))
      .returning();

    if (!product) {
      return null;
    }

    if (hasVariants && input.variants?.length) {
      const now = new Date();
      await tx.delete(variants).where(eq(variants.productId, input.productId));
      await tx.insert(variants).values(
        input.variants.map((variant) => ({
          id: variant.id ?? variant._id ?? crypto.randomUUID(),
          productId: input.productId,
          key: variant.key,
          variantPrice: variant.variantPrice,
          values: variant.values,
          createdAt: now,
          updatedAt: now,
        })),
      );
    } else if (hasVariants && input.variants) {
      await tx.delete(variants).where(eq(variants.productId, input.productId));
    }

    return product;
  });

  if (!updatedProduct) {
    return response("Product not found", 404, null);
  }

  return response("Product updated", 200, toLegacyProduct(updatedProduct));
}

export async function deleteProduct(
  input: z.infer<typeof productIdInputSchema>,
) {
  const db = createDb();
  const [deletedProduct] = await db
    .update(products)
    .set({
      isDeleted: true,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.productId))
    .returning();

  if (!deletedProduct) {
    return response("Product not found", 404, null);
  }

  return response("Product deleted", 200, toLegacyProduct(deletedProduct));
}
