import { createDb } from "@rem-viet/db";
import { categories, products } from "@rem-viet/db/schema/catalog";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";

export const categoryIdInputSchema = z.object({
  categoryId: z.string().min(1),
});

export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
});

export const updateCategoryInputSchema = createCategoryInputSchema
  .partial()
  .extend({
    categoryId: z.string().min(1),
  });

function toLegacyCategory(row: typeof categories.$inferSelect) {
  return {
    ...row,
    _id: row.id,
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

export async function listCategories() {
  const db = createDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.name));

  return rows.map(toLegacyCategory);
}

export async function createCategory(
  input: z.infer<typeof createCategoryInputSchema>,
) {
  const db = createDb();
  const now = new Date();
  const [createdCategory] = await db
    .insert(categories)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdCategory) {
    throw new Error("Failed to create category");
  }

  return response("Category created", 201, toLegacyCategory(createdCategory));
}

export async function updateCategory(
  input: z.infer<typeof updateCategoryInputSchema>,
) {
  const db = createDb();
  const [updatedCategory] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, input.categoryId))
    .returning();

  if (!updatedCategory) {
    return response("Category not found", 404, null);
  }

  return response("Category updated", 200, toLegacyCategory(updatedCategory));
}

export async function deleteCategory(
  input: z.infer<typeof categoryIdInputSchema>,
) {
  const db = createDb();
  const deletedCategory = await db.transaction(async (tx) => {
    const [usage] = await tx
      .select({ total: count() })
      .from(products)
      .where(eq(products.categoryId, input.categoryId));

    if ((usage?.total ?? 0) > 0) {
      return "in-use" as const;
    }

    const [category] = await tx
      .delete(categories)
      .where(eq(categories.id, input.categoryId))
      .returning();

    return category ?? null;
  });

  if (deletedCategory === "in-use") {
    return response("Category is in use", 409, null);
  }

  if (!deletedCategory) {
    return response("Category not found", 404, null);
  }

  return response("Category deleted", 200, toLegacyCategory(deletedCategory));
}
