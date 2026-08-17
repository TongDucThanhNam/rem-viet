import {
  deploymentOriginSchema,
  webVitalEvidenceWindowDays,
  webVitalMinimumSamples,
  webVitalNameSchema,
  webVitalTargets,
  type WebVitalName,
} from "@rem-viet/cms";
import { z } from "zod";

export const cloudflareVitalsEvidenceSql = `
WITH metric_names(name, sort_order) AS (
  VALUES ('CLS', 1), ('LCP', 2), ('INP', 3)
),
filtered AS (
  SELECT name, value
  FROM web_vitals
  WHERE schema_version = 1
    AND created_at >= ?
    AND created_at < ?
    AND path != '/__synthetic__'
    AND path NOT LIKE '/__synthetic__/%'
    AND path != '/admin'
    AND path NOT LIKE '/admin/%'
    AND path != '/api'
    AND path NOT LIKE '/api/%'
    AND path != '/dang-nhap'
    AND path NOT LIKE '/dang-nhap/%'
    AND path != '/login'
    AND path NOT LIKE '/login/%'
    AND path != '/quen-mat-khau'
    AND path NOT LIKE '/quen-mat-khau/%'
    AND path != '/sanity-preview'
    AND path NOT LIKE '/sanity-preview/%'
    AND name IN ('CLS', 'LCP', 'INP')
),
ranked AS (
  SELECT
    name,
    value,
    row_number() OVER (PARTITION BY name ORDER BY value ASC) AS value_rank,
    count(*) OVER (PARTITION BY name) AS sample_count
  FROM filtered
),
percentiles AS (
  SELECT name, sample_count, value AS p75
  FROM ranked
  WHERE value_rank = CAST((3 * sample_count + 3) / 4 AS INTEGER)
)
SELECT
  metric_names.name,
  COALESCE(percentiles.sample_count, 0) AS sample_count,
  percentiles.p75
FROM metric_names
LEFT JOIN percentiles ON percentiles.name = metric_names.name
ORDER BY metric_names.sort_order
`.trim();

const metricRowSchema = z
  .object({
    name: webVitalNameSchema,
    sample_count: z.number().int().nonnegative(),
    p75: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export type CloudflareVitalsMetric = {
  samples: number;
  p75: number | null;
  target: number;
  unit: "score" | "ms";
  status: "insufficient" | "pass" | "fail";
};

export type CloudflareVitalsReleaseEvidence = {
  origin: string;
  windowDays: 28;
  automatedTrafficExcluded: true;
  exportedAt: string;
  metrics: Record<
    WebVitalName,
    {
      samples: number;
      p75: number;
      unit: "score" | "ms";
    }
  >;
};

export function cloudflareVitalsEvidenceWindow(now: Date) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Web Vitals audit time must be a valid date.");
  }
  const to = new Date(now);
  const from = new Date(
    to.getTime() - webVitalEvidenceWindowDays * 24 * 60 * 60 * 1_000,
  );
  return {
    days: webVitalEvidenceWindowDays,
    from,
    to,
    params: [from.getTime(), to.getTime()] as const,
  };
}

function displayValue(name: WebVitalName, value: number | null) {
  if (value === null) return null;
  return name === "CLS" ? Math.round(value * 1_000) / 1_000 : Math.round(value);
}

function metricStatus(name: WebVitalName, samples: number, p75: number | null) {
  if (samples < webVitalMinimumSamples) return "insufficient" as const;
  if (p75 === null || (name !== "CLS" && p75 <= 0)) return "fail" as const;
  return p75 <= webVitalTargets[name] ? ("pass" as const) : ("fail" as const);
}

export function buildCloudflareVitalsAuditReport(input: {
  origin: string;
  generatedAt: Date;
  rows: unknown;
}) {
  const origin = deploymentOriginSchema.parse(input.origin);
  const window = cloudflareVitalsEvidenceWindow(input.generatedAt);
  const rows = z.array(metricRowSchema).parse(input.rows);
  const byName = new Map(rows.map((row) => [row.name, row]));

  if (rows.length !== webVitalNameSchema.options.length || byName.size !== 3) {
    throw new Error(
      "Cloudflare Web Vitals query returned duplicate or missing metrics.",
    );
  }

  const metrics = Object.fromEntries(
    webVitalNameSchema.options.map((name) => {
      const row = byName.get(name);
      if (!row) {
        throw new Error(`Cloudflare Web Vitals query omitted ${name}.`);
      }
      if (
        (row.sample_count === 0 && row.p75 !== null) ||
        (row.sample_count > 0 && row.p75 === null)
      ) {
        throw new Error(
          `Cloudflare Web Vitals query returned inconsistent ${name} data.`,
        );
      }
      const p75 = displayValue(name, row.p75);
      return [
        name,
        {
          samples: row.sample_count,
          p75,
          target: webVitalTargets[name],
          unit: name === "CLS" ? ("score" as const) : ("ms" as const),
          status: metricStatus(name, row.sample_count, p75),
        },
      ];
    }),
  ) as Record<WebVitalName, CloudflareVitalsMetric>;

  const ready = webVitalNameSchema.options.every(
    (name) => metrics[name].status === "pass",
  );
  const releaseEvidence: CloudflareVitalsReleaseEvidence | null = ready
    ? {
        origin,
        windowDays: 28,
        automatedTrafficExcluded: true,
        exportedAt: window.to.toISOString(),
        metrics: Object.fromEntries(
          webVitalNameSchema.options.map((name) => {
            const metric = metrics[name];
            if (metric.p75 === null) {
              throw new Error(
                `Passing ${name} evidence cannot have a null p75.`,
              );
            }
            return [
              name,
              {
                samples: metric.samples,
                p75: metric.p75,
                unit: metric.unit,
              },
            ];
          }),
        ) as CloudflareVitalsReleaseEvidence["metrics"],
      }
    : null;

  return {
    schemaVersion: 1 as const,
    mode: "remote-read-only" as const,
    ready,
    origin,
    automatedTrafficExcluded: true as const,
    generatedAt: window.to.toISOString(),
    window: {
      days: window.days,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
    },
    minimumSamples: webVitalMinimumSamples,
    metrics,
    releaseEvidence,
  };
}
