import {
  webVitalDeviceClassSchema,
  webVitalEvidenceWindowDays,
  webVitalMaxReportsPerMetricPerMinute,
  webVitalMinimumSamples,
  webVitalNameSchema,
  webVitalPathnameSchema,
  webVitalPrivatePathPrefixes,
  webVitalRetentionDays,
  webVitalTargets,
  type WebVitalName,
  type WebVitalReport,
} from "@rem-viet/cms";
import { createDb } from "@rem-viet/db";
import { webVitals } from "@rem-viet/db/schema/operational";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lt,
  ne,
  notLike,
  type SQL,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const webVitalSummaryInputSchema = z
  .object({
    days: z
      .number()
      .int()
      .min(1)
      .max(webVitalRetentionDays)
      .default(webVitalEvidenceWindowDays),
    path: webVitalPathnameSchema.optional(),
    deviceClass: webVitalDeviceClassSchema.optional(),
  })
  .default({ days: webVitalEvidenceWindowDays });

export function nearestRankPercentile(
  values: readonly number[],
  percentile: number,
) {
  if (!values.length) return null;
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) {
    throw new RangeError("Percentile must be greater than 0 and at most 1");
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1] ?? null;
}

export async function recordWebVital(report: WebVitalReport, now = new Date()) {
  const db = createDb();
  const [recent] = await db
    .select({ value: count() })
    .from(webVitals)
    .where(
      and(
        eq(webVitals.name, report.name),
        gte(webVitals.createdAt, new Date(now.getTime() - 60_000)),
      ),
    );
  if (Number(recent?.value ?? 0) >= webVitalMaxReportsPerMetricPerMinute) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Web Vitals ingestion is temporarily capped.",
    });
  }
  await db.insert(webVitals).values(report).onConflictDoNothing();
  return { accepted: true as const };
}

function displayValue(name: WebVitalName, value: number | null) {
  if (value === null) return null;
  return name === "CLS" ? Math.round(value * 1_000) / 1_000 : Math.round(value);
}

type WebVitalPeriodSnapshot = {
  p75: number | null;
  sampleCount: number;
};

export function compareWebVitalPeriods(
  name: WebVitalName,
  current: WebVitalPeriodSnapshot,
  previous: WebVitalPeriodSnapshot,
) {
  if (current.p75 === null || previous.p75 === null) {
    return {
      direction: "unavailable" as const,
      delta: null,
      deltaPercent: null,
    };
  }

  const rawDelta = current.p75 - previous.p75;
  return {
    direction:
      rawDelta < 0
        ? ("improved" as const)
        : rawDelta > 0
          ? ("regressed" as const)
          : ("stable" as const),
    delta: displayValue(name, rawDelta),
    deltaPercent:
      previous.p75 === 0
        ? null
        : Math.round((rawDelta / previous.p75) * 1_000) / 10,
  };
}

function summaryConditions(
  name: WebVitalName,
  from: Date,
  to: Date,
  input: z.infer<typeof webVitalSummaryInputSchema>,
) {
  const conditions: SQL[] = [
    eq(webVitals.name, name),
    gte(webVitals.createdAt, from),
    lt(webVitals.createdAt, to),
    ...evidencePathConditions(),
  ];
  if (input.path) conditions.push(eq(webVitals.path, input.path));
  if (input.deviceClass) {
    conditions.push(eq(webVitals.deviceClass, input.deviceClass));
  }
  return conditions;
}

async function metricSnapshot(
  db: ReturnType<typeof createDb>,
  name: WebVitalName,
  conditions: SQL[],
) {
  const [countRow] = await db
    .select({ sampleCount: count() })
    .from(webVitals)
    .where(and(...conditions));
  const sampleCount = Number(countRow?.sampleCount ?? 0);
  const rank = Math.max(0, Math.ceil(sampleCount * 0.75) - 1);
  const [percentileRow] = sampleCount
    ? await db
        .select({ value: webVitals.value })
        .from(webVitals)
        .where(and(...conditions))
        .orderBy(asc(webVitals.value))
        .limit(1)
        .offset(rank)
    : [];

  return {
    sampleCount,
    p75: displayValue(name, percentileRow?.value ?? null),
  };
}

function facetConditions(
  from: Date,
  to: Date,
  input: z.infer<typeof webVitalSummaryInputSchema>,
  omit: "path" | "deviceClass",
) {
  const conditions: SQL[] = [
    gte(webVitals.createdAt, from),
    lt(webVitals.createdAt, to),
    ...evidencePathConditions(),
  ];
  if (omit !== "path" && input.path) {
    conditions.push(eq(webVitals.path, input.path));
  }
  if (omit !== "deviceClass" && input.deviceClass) {
    conditions.push(eq(webVitals.deviceClass, input.deviceClass));
  }
  return conditions;
}

function evidencePathConditions() {
  return [
    ne(webVitals.path, "/__synthetic__"),
    notLike(webVitals.path, "/__synthetic__/%"),
    ...webVitalPrivatePathPrefixes.flatMap((prefix) => [
      ne(webVitals.path, prefix),
      notLike(webVitals.path, `${prefix}/%`),
    ]),
  ];
}

export async function getWebVitalSummary(
  rawInput: z.input<typeof webVitalSummaryInputSchema>,
  now = new Date(),
) {
  const input = webVitalSummaryInputSchema.parse(rawInput);
  const from = new Date(now.getTime() - input.days * 86_400_000);
  const previousFrom = new Date(from.getTime() - input.days * 86_400_000);
  const db = createDb();
  const metrics = [];

  for (const name of webVitalNameSchema.options) {
    const [current, previous] = await Promise.all([
      metricSnapshot(db, name, summaryConditions(name, from, now, input)),
      metricSnapshot(
        db,
        name,
        summaryConditions(name, previousFrom, from, input),
      ),
    ]);
    const target = webVitalTargets[name];
    const status: "insufficient" | "pass" | "fail" =
      current.sampleCount < webVitalMinimumSamples
        ? "insufficient"
        : current.p75 !== null && current.p75 <= target
          ? "pass"
          : "fail";

    metrics.push({
      name,
      sampleCount: current.sampleCount,
      p75: current.p75,
      target,
      status,
      comparison: {
        ...compareWebVitalPeriods(name, current, previous),
        sampleCount: previous.sampleCount,
        p75: previous.p75,
        window: {
          from: previousFrom.toISOString(),
          to: from.toISOString(),
        },
      },
    });
  }

  const [routeRows, deviceRows] = await Promise.all([
    db
      .select({ path: webVitals.path, sampleCount: count() })
      .from(webVitals)
      .where(and(...facetConditions(from, now, input, "path")))
      .groupBy(webVitals.path)
      .orderBy(desc(count()))
      .limit(6),
    db
      .select({ deviceClass: webVitals.deviceClass, sampleCount: count() })
      .from(webVitals)
      .where(and(...facetConditions(from, now, input, "deviceClass")))
      .groupBy(webVitals.deviceClass),
  ]);
  const deviceCounts = new Map(
    deviceRows.map((row) => [row.deviceClass, Number(row.sampleCount)]),
  );

  return {
    schemaVersion: 1 as const,
    generatedAt: now.toISOString(),
    window: {
      from: from.toISOString(),
      to: now.toISOString(),
      days: input.days,
    },
    filters: {
      path: input.path ?? null,
      deviceClass: input.deviceClass ?? null,
    },
    minimumSamples: webVitalMinimumSamples,
    metrics,
    facets: {
      routes: routeRows.map((row) => ({
        path: row.path,
        sampleCount: Number(row.sampleCount),
      })),
      devices: webVitalDeviceClassSchema.options.map((value) => ({
        value,
        sampleCount: deviceCounts.get(value) ?? 0,
      })),
    },
  };
}

export async function purgeExpiredWebVitals(now = new Date()) {
  const cutoff = new Date(now.getTime() - webVitalRetentionDays * 86_400_000);
  const db = createDb();
  const rows = await db
    .delete(webVitals)
    .where(lt(webVitals.createdAt, cutoff))
    .returning({ id: webVitals.id });
  return { deleted: rows.length, retentionDays: webVitalRetentionDays };
}
