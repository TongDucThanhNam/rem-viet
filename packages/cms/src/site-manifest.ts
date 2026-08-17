import { z } from "zod";

import { safeHttpUrlSchema, safeMediaSourceSchema } from "./url";

const resourceNameSchema = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);

export const deploymentOriginSchema = safeHttpUrlSchema
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Deployment origin must use HTTPS.",
  })
  .refine(
    (value) => {
      const url = new URL(value);
      return (
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password
      );
    },
    {
      message: "Deployment origin must not include credentials, path or query.",
    },
  )
  .transform((value) => new URL(value).origin);

export function resolveDeploymentOrigin(input: {
  stage: string;
  siteUrl: string;
  explicitOrigin?: string;
}) {
  const stage = input.stage.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(stage)) {
    throw new Error("Stage must be a safe deployment slug.");
  }
  const siteOrigin = deploymentOriginSchema.parse(input.siteUrl);
  const production = stage === "production" || stage === "prod";

  if (!production && !input.explicitOrigin?.trim()) {
    throw new Error(
      "Non-production deploys require an explicit HTTPS origin. Pass --origin=<url>.",
    );
  }

  const origin = deploymentOriginSchema.parse(
    input.explicitOrigin?.trim() || siteOrigin,
  );
  if (production && origin !== siteOrigin) {
    throw new Error(
      `Production origin must match manifest siteUrl (${siteOrigin}).`,
    );
  }
  return origin;
}

export const siteManifestSchema = z.object({
  id: resourceNameSchema,
  name: z.string().trim().min(1).max(120),
  siteUrl: deploymentOriginSchema,
  description: z.string().trim().min(1).max(320),
  locale: z.literal("vi-VN"),
  preset: z.enum(["showcase", "catalog", "portfolio"]),
  brand: z.object({
    logo: safeMediaSourceSchema,
    colors: z.record(z.string(), z.string()).default({}),
    fonts: z.array(z.string().min(1)).min(1),
  }),
  contact: z.object({
    phone: z.string().default(""),
    email: z.string().email().or(z.literal("")).default(""),
    address: z.string().default(""),
    socials: z
      .record(z.string(), z.literal("").or(safeHttpUrlSchema))
      .default({}),
  }),
  features: z.object({
    blog: z.boolean(),
    catalog: z.boolean(),
    orders: z.boolean(),
    leads: z.boolean(),
  }),
  infrastructure: z.object({
    alchemyApp: resourceNameSchema,
    workerName: resourceNameSchema,
    d1Name: resourceNameSchema,
    r2BucketName: resourceNameSchema,
    backupBucketName: resourceNameSchema,
  }),
});
export type SiteManifest = z.infer<typeof siteManifestSchema>;
