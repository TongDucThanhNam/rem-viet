import { z } from "zod";

export const schemaVersionSchema = z.number().int().positive();

export const cmsLocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
export type CmsLocale = z.infer<typeof cmsLocaleSchema>;

export const cmsCapabilitySchema = z.enum([
  "content.readDraft",
  "content.write",
  "content.review.request",
  "content.review.decide",
  "content.publish",
  "content.schedule",
  "content.restore",
  "content.delete",
  "media.manage",
  "media.delete",
  "settings.manage",
  "audit.read",
  "staff.manage",
  "redirects.manage",
  "leads.manage",
]);
export type CmsCapability = z.infer<typeof cmsCapabilitySchema>;

export const cmsErrorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "FORBIDDEN",
  "CAPABILITY_UNAVAILABLE",
  "MIGRATION_FAILED",
  "UNKNOWN_BLOCK",
]);
export type CmsErrorCode = z.infer<typeof cmsErrorCodeSchema>;

export const cmsErrorContractSchema = z.object({
  code: cmsErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type CmsErrorContract = z.infer<typeof cmsErrorContractSchema>;

export class CmsError extends Error implements CmsErrorContract {
  readonly code: CmsErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(contract: CmsErrorContract) {
    super(contract.message);
    this.name = "CmsError";
    this.code = contract.code;
    this.retryable = contract.retryable;
    this.details = contract.details;
  }
}
