import { z } from "zod";

const portableNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(128)
  .regex(/^[a-z][a-z0-9.-]*(?:\/[a-z][a-z0-9.-]*)*$/);

export const cmsQueueNameSchema = portableNameSchema;
export const cmsTaskNameSchema = portableNameSchema;
export const cmsWorkflowNameSchema = portableNameSchema;

export const cmsJobStatusSchema = z.enum([
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "dead_letter",
  "cancelled",
]);
export type CmsJobStatus = z.infer<typeof cmsJobStatusSchema>;

export const cmsRetryPolicySchema = z
  .object({
    maxAttempts: z.number().int().min(1).max(25).default(5),
    initialDelayMs: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60 * 1000)
      .default(1_000),
    multiplier: z.number().min(1).max(10).default(2),
    maxDelayMs: z
      .number()
      .int()
      .min(0)
      .max(7 * 24 * 60 * 60 * 1000)
      .default(60_000),
    jitter: z.number().min(0).max(1).default(0.2),
  })
  .refine((value) => value.maxDelayMs >= value.initialDelayMs, {
    message: "maxDelayMs must be greater than or equal to initialDelayMs",
  });
export type CmsRetryPolicy = z.infer<typeof cmsRetryPolicySchema>;

export const cmsTaskDefinitionSchema = z.object({
  name: cmsTaskNameSchema,
  queue: cmsQueueNameSchema,
  timeoutMs: z
    .number()
    .int()
    .min(100)
    .max(24 * 60 * 60 * 1000),
  retry: cmsRetryPolicySchema,
  retentionDays: z.number().int().min(1).max(3650).default(30),
});
export type CmsTaskDefinition = z.infer<typeof cmsTaskDefinitionSchema>;

export const cmsWorkflowStepDefinitionSchema = z.object({
  name: portableNameSchema,
  timeoutMs: z
    .number()
    .int()
    .min(100)
    .max(24 * 60 * 60 * 1000)
    .optional(),
});

export const cmsWorkflowDefinitionSchema = z
  .object({
    name: cmsWorkflowNameSchema,
    queue: cmsQueueNameSchema,
    steps: z.array(cmsWorkflowStepDefinitionSchema).min(1).max(100),
    retry: cmsRetryPolicySchema,
    timeoutMs: z
      .number()
      .int()
      .min(100)
      .max(7 * 24 * 60 * 60 * 1000),
    retentionDays: z.number().int().min(1).max(3650).default(30),
  })
  .superRefine((value, context) => {
    const names = value.steps.map((step) => step.name);
    const duplicate = names.find(
      (name, index) => names.indexOf(name) !== index,
    );
    if (duplicate) {
      context.addIssue({
        code: "custom",
        message: `Duplicate workflow step: ${duplicate}`,
        path: ["steps"],
      });
    }
  });
export type CmsWorkflowDefinition = z.infer<typeof cmsWorkflowDefinitionSchema>;

export const cmsJobEnvelopeSchema = z.object({
  id: z.string().min(1),
  taskName: cmsTaskNameSchema,
  queue: cmsQueueNameSchema,
  payload: z.unknown(),
  idempotencyKey: z.string().trim().min(1).max(256),
  status: cmsJobStatusSchema,
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CmsJobEnvelope = z.infer<typeof cmsJobEnvelopeSchema>;

export const cmsOutboxEventSchema = z.object({
  id: z.string().min(1),
  topic: portableNameSchema,
  aggregateType: portableNameSchema,
  aggregateId: z.string().min(1).max(256),
  aggregateVersion: z.number().int().nonnegative(),
  payload: z.unknown(),
  idempotencyKey: z.string().min(1).max(256),
  occurredAt: z.iso.datetime(),
});
export type CmsOutboxEvent = z.infer<typeof cmsOutboxEventSchema>;

export const cmsWebhookDeliveryStatusSchema = z.enum([
  "pending",
  "delivering",
  "delivered",
  "failed",
  "dead_letter",
  "cancelled",
]);
export type CmsWebhookDeliveryStatus = z.infer<
  typeof cmsWebhookDeliveryStatusSchema
>;

export const cmsReleaseStatusSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "rolling_back",
  "rolled_back",
  "failed",
  "cancelled",
]);
export type CmsReleaseStatus = z.infer<typeof cmsReleaseStatusSchema>;

export const cmsReleaseItemSchema = z.object({
  documentType: portableNameSchema,
  documentId: z.string().min(1).max(256),
  locale: z.string().trim().min(2).max(35).nullable().default(null),
  expectedVersion: z.number().int().nonnegative(),
});
export type CmsReleaseItem = z.infer<typeof cmsReleaseItemSchema>;

export const cmsReleaseDefinitionSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    items: z.array(cmsReleaseItemSchema).min(1).max(500),
    scheduledAt: z.iso.datetime().nullable().default(null),
  })
  .superRefine((value, context) => {
    const keys = value.items.map(
      (item) => `${item.documentType}:${item.documentId}:${item.locale ?? ""}`,
    );
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
    if (duplicate) {
      context.addIssue({
        code: "custom",
        message: `Duplicate release item: ${duplicate}`,
        path: ["items"],
      });
    }
  });
export type CmsReleaseDefinition = z.infer<typeof cmsReleaseDefinitionSchema>;
