import { createDb } from "@rem-viet/db";
import { logs } from "@rem-viet/db/schema/operational";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { booleanStringToBoolean } from "./parsing";

export const logIdInputSchema = z.object({
  logId: z.string().min(1),
});

export const listLogsInputSchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    userId: z.string().optional(),
    method: z.string().optional(),
    url: z.string().optional(),
    statusCode: z.coerce.number().int().optional(),
    ipAddress: z.string().optional(),
    deviceId: z.string().optional(),
    timeStamp: z.coerce.date().optional(),
    isActive: z.preprocess(booleanStringToBoolean, z.boolean().optional()),
    isDeleted: z.preprocess(booleanStringToBoolean, z.boolean().optional()),
  })
  .optional();

export const createLogInputSchema = z.object({
  userId: z.string().optional(),
  method: z.string().optional(),
  url: z.string().optional(),
  statusCode: z.coerce.number().int().optional(),
  ipAddress: z.string().optional(),
  deviceId: z.string().optional(),
  timeStamp: z.coerce.date().optional(),
});

export const updateLogInputSchema = createLogInputSchema.partial().extend({
  logId: z.string().min(1),
});

function toLegacyLog(row: typeof logs.$inferSelect) {
  return {
    ...row,
    _id: row.id,
    timeStamp: row.timeStamp?.toISOString() ?? null,
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

export async function listLogs(
  input: z.infer<typeof listLogsInputSchema> = {},
) {
  const db = createDb();
  const page = input?.page ?? 1;
  const limit = input?.limit ?? 10;
  const offset = (page - 1) * limit;
  const conditions = [];
  const isActive = input?.isActive ?? true;
  const isDeleted = input?.isDeleted ?? false;

  if (input?.userId !== undefined)
    conditions.push(eq(logs.userId, input.userId));
  if (input?.method !== undefined)
    conditions.push(eq(logs.method, input.method));
  if (input?.url !== undefined) conditions.push(eq(logs.url, input.url));
  if (input?.statusCode !== undefined)
    conditions.push(eq(logs.statusCode, input.statusCode));
  if (input?.ipAddress !== undefined)
    conditions.push(eq(logs.ipAddress, input.ipAddress));
  if (input?.deviceId !== undefined)
    conditions.push(eq(logs.deviceId, input.deviceId));
  if (input?.timeStamp !== undefined)
    conditions.push(eq(logs.timeStamp, input.timeStamp));
  conditions.push(eq(logs.isActive, isActive));
  conditions.push(eq(logs.isDeleted, isDeleted));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const totalQuery = db.select({ total: count() }).from(logs).$dynamic();
  const totalRows = await (whereClause
    ? totalQuery.where(whereClause)
    : totalQuery);
  const rowsQuery = db.select().from(logs).$dynamic();
  const rows = await (whereClause ? rowsQuery.where(whereClause) : rowsQuery)
    .orderBy(desc(logs.createdAt))
    .limit(limit)
    .offset(offset);
  const totalItems = totalRows[0]?.total ?? 0;

  return {
    currentPage: page,
    totalPage: Math.ceil(totalItems / limit),
    totalItems,
    perPage: limit,
    data: rows.map(toLegacyLog),
  };
}

export async function getLogById(input: z.infer<typeof logIdInputSchema>) {
  const db = createDb();
  const row = await db.query.logs.findFirst({
    where: and(
      eq(logs.id, input.logId),
      eq(logs.isActive, true),
      eq(logs.isDeleted, false),
    ),
  });

  if (!row) {
    return response("Log not found", 404, null);
  }

  return response("Find Log Success", 200, toLegacyLog(row));
}

export async function createLog(input: z.infer<typeof createLogInputSchema>) {
  const db = createDb();
  const now = new Date();
  const [createdLog] = await db
    .insert(logs)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId ?? null,
      method: input.method ?? null,
      url: input.url ?? null,
      statusCode: input.statusCode ?? null,
      ipAddress: input.ipAddress ?? null,
      deviceId: input.deviceId ?? null,
      timeStamp: input.timeStamp ?? now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!createdLog) {
    throw new Error("Failed to create log");
  }

  return response("Create Log Success", 201, toLegacyLog(createdLog));
}

export async function updateLog(input: z.infer<typeof updateLogInputSchema>) {
  const db = createDb();
  const [updatedLog] = await db
    .update(logs)
    .set({
      ...(input.userId !== undefined && { userId: input.userId }),
      ...(input.method !== undefined && { method: input.method }),
      ...(input.url !== undefined && { url: input.url }),
      ...(input.statusCode !== undefined && { statusCode: input.statusCode }),
      ...(input.ipAddress !== undefined && { ipAddress: input.ipAddress }),
      ...(input.deviceId !== undefined && { deviceId: input.deviceId }),
      ...(input.timeStamp !== undefined && { timeStamp: input.timeStamp }),
      updatedAt: new Date(),
    })
    .where(eq(logs.id, input.logId))
    .returning();

  if (!updatedLog) {
    return response("Log not found", 404, null);
  }

  return response("Update Log Success", 200, toLegacyLog(updatedLog));
}

export async function deleteLog(input: z.infer<typeof logIdInputSchema>) {
  const db = createDb();
  const [deletedLog] = await db
    .update(logs)
    .set({
      isActive: false,
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(logs.id, input.logId))
    .returning();

  if (!deletedLog) {
    return response("Log not found", 404, null);
  }

  return response("Delete Log Success", 200, toLegacyLog(deletedLog));
}
