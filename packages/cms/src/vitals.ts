import { z } from "zod";

export const webVitalNameSchema = z.enum(["CLS", "LCP", "INP"]);
export type WebVitalName = z.infer<typeof webVitalNameSchema>;

export const webVitalRatingSchema = z.enum([
  "good",
  "needs-improvement",
  "poor",
]);
export type WebVitalRating = z.infer<typeof webVitalRatingSchema>;

export const webVitalNavigationTypeSchema = z.enum([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
]);
export type WebVitalNavigationType = z.infer<
  typeof webVitalNavigationTypeSchema
>;

export const webVitalDeviceClassSchema = z.enum([
  "mobile",
  "tablet",
  "desktop",
]);
export type WebVitalDeviceClass = z.infer<typeof webVitalDeviceClassSchema>;

export const webVitalPathnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !/[\s\\?#]/u.test(value),
    "Expected an internal pathname without an origin, query, or fragment",
  );

export const webVitalPrivatePathPrefixes = [
  "/admin",
  "/api",
  "/dang-nhap",
  "/login",
  "/quen-mat-khau",
  "/sanity-preview",
] as const;

export function isSyntheticWebVitalPath(pathname: string) {
  return (
    pathname === "/__synthetic__" || pathname.startsWith("/__synthetic__/")
  );
}

export function isPublicWebVitalPath(pathname: string) {
  if (isSyntheticWebVitalPath(pathname)) return false;
  if (
    webVitalPrivatePathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }
  return webVitalPathnameSchema.safeParse(pathname).success;
}

export const webVitalReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z
      .string()
      .trim()
      .max(128)
      .regex(/^v\d+-\d{10,16}-\d{10,16}$/u),
    name: webVitalNameSchema,
    value: z.number().finite().nonnegative(),
    rating: webVitalRatingSchema,
    navigationType: webVitalNavigationTypeSchema,
    path: webVitalPathnameSchema,
    deviceClass: webVitalDeviceClassSchema,
  })
  .strict()
  .superRefine((report, context) => {
    if (
      !isPublicWebVitalPath(report.path) &&
      !isSyntheticWebVitalPath(report.path)
    ) {
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: "Expected a public pathname or an explicit synthetic probe",
      });
    }
    const maximum = report.name === "CLS" ? 10 : 600_000;
    if (report.value > maximum) {
      context.addIssue({
        code: "too_big",
        maximum,
        origin: "number",
        inclusive: true,
        path: ["value"],
        message: `Value is outside the accepted ${report.name} range`,
      });
    }
  });

export type WebVitalReport = z.infer<typeof webVitalReportSchema>;

export const webVitalTargets = {
  CLS: 0.1,
  LCP: 2_500,
  INP: 200,
} as const satisfies Record<WebVitalName, number>;

export const webVitalRetentionDays = 90;
export const webVitalEvidenceWindowDays = 28;
export const webVitalMinimumSamples = 75;
export const webVitalMaxReportsPerMetricPerMinute = 1_000;
