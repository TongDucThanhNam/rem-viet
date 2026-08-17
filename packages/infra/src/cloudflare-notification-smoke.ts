import {
  deploymentProvenanceSchema,
  deploymentOriginSchema,
  formDefinitionSchema,
  isCleanDeploymentProvenance,
  type FormDefinition,
} from "@rem-viet/cms";
import { z } from "zod";

export const notificationSmokeRunIdSchema = z.string().uuid();

export const cloudflareNotificationDefinitionSql = `
SELECT key, name, fields, notification_settings, active, retention_days
FROM form_definitions
WHERE key = ?
`.trim();

export const cloudflareNotificationSubmissionSql = `
SELECT
  id,
  idempotency_key,
  notification_status,
  notification_results,
  notified_at
FROM form_submissions
WHERE idempotency_key = ?
ORDER BY created_at ASC
`.trim();

const formDefinitionRowSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    fields: z.unknown(),
    notification_settings: z.unknown(),
    active: z.union([z.boolean(), z.number().int()]),
    retention_days: z.number().int(),
  })
  .strict();

const notificationResultSchema = z
  .object({
    adapter: z.enum(["email", "telegram"]),
    status: z.enum(["sent", "skipped", "failed"]),
    providerId: z.string().min(1).optional(),
    error: z.string().optional(),
  })
  .strict();

const notificationStateSchema = z
  .object({
    adapters: z.array(notificationResultSchema),
    attemptCount: z.number().int().positive(),
    lastAttemptAt: z.string().optional(),
    nextRetryAt: z.string().optional(),
  })
  .passthrough();

const submissionRowSchema = z
  .object({
    id: z.string().min(1),
    idempotency_key: z.string().min(1),
    notification_status: z.enum(["pending", "sent", "failed", "skipped"]),
    notification_results: z.unknown(),
    notified_at: z.union([z.number(), z.string()]).nullable(),
  })
  .strict();

const submissionResponseSchema = z
  .object({
    accepted: z.literal(true),
    duplicate: z.boolean(),
    id: z.string().min(1),
  })
  .passthrough();

const notificationHealthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    deployment: deploymentProvenanceSchema.optional(),
    checks: z
      .object({
        notifications: z
          .object({
            configuration: z.enum(["ok", "degraded"]).optional(),
            missingProviders: z.array(z.enum(["email", "telegram"])).optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

function parseJsonColumn(value: unknown, label: string) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export function parseCloudflareNotificationDefinition(rows: unknown) {
  const parsedRows = z.array(formDefinitionRowSchema).parse(rows);
  if (parsedRows.length !== 1) {
    throw new Error(
      "Expected exactly one active notification form definition.",
    );
  }
  const [row] = parsedRows;
  if (!row) throw new Error("Notification form definition is missing.");

  const definition = formDefinitionSchema.parse({
    key: row.key,
    name: row.name,
    fields: parseJsonColumn(row.fields, "Form fields"),
    notificationSettings: parseJsonColumn(
      row.notification_settings,
      "Notification settings",
    ),
    active: row.active === true || row.active === 1,
    retentionDays: row.retention_days,
  });
  if (!definition.active) {
    throw new Error("Notification smoke form must be active.");
  }
  if (!definition.notificationSettings.email) {
    throw new Error("Notification smoke form must have email enabled.");
  }
  return definition;
}

export function notificationSmokeIdempotencyKey(runId: string) {
  return `agency-cms-notification-smoke/${notificationSmokeRunIdSchema.parse(runId)}`;
}

export function parseNotificationSmokeHealth(value: unknown) {
  const health = notificationHealthSchema.parse(value);
  const notifications = health.checks.notifications;
  const providerConfigurationExposed =
    notifications.configuration !== undefined &&
    notifications.missingProviders !== undefined;
  const emailRuntimeConfigured =
    providerConfigurationExposed &&
    notifications.configuration === "ok" &&
    !notifications.missingProviders?.includes("email");
  return {
    healthStatus: health.status,
    providerConfigurationExposed,
    emailRuntimeConfigured,
    deployment: health.deployment ?? null,
    cleanDeployment:
      health.deployment !== undefined &&
      isCleanDeploymentProvenance(health.deployment),
  };
}

export function buildNotificationSmokePayload(
  definition: FormDefinition,
  runId: string,
) {
  const validatedRunId = notificationSmokeRunIdSchema.parse(runId);
  const payload = Object.fromEntries(
    definition.fields.map((field) => {
      switch (field.type) {
        case "email":
          return [field.key, "notification-smoke@example.com"];
        case "tel":
          return [field.key, "0000000000"];
        case "checkbox":
          return [field.key, true];
        case "select": {
          const [firstOption] = field.options ?? [];
          if (field.required && !firstOption) {
            throw new Error(
              `Required select field ${field.key} has no smoke-safe option.`,
            );
          }
          return [field.key, firstOption ?? "Notification smoke"];
        }
        case "textarea":
          return [
            field.key,
            `Agency CMS exactly-once notification smoke ${validatedRunId}`,
          ];
        default:
          return [field.key, `Notification smoke ${validatedRunId}`];
      }
    }),
  );

  return {
    formKey: definition.key,
    payload,
    sourcePage: "/__synthetic__/notification-smoke",
    website: "",
    idempotencyKey: notificationSmokeIdempotencyKey(validatedRunId),
  };
}

type ParsedSubmission = {
  id: string;
  idempotencyKey: string;
  notificationStatus: "sent";
  notifiedAt: Date;
  providerMessageId: string;
  attemptCount: 1;
};

function parseSubmissionRows(rows: unknown, expectedKey: string) {
  const parsedRows = z.array(submissionRowSchema).parse(rows);
  if (parsedRows.length > 1) {
    throw new Error(
      "Notification smoke idempotency key matched multiple leads.",
    );
  }
  const [row] = parsedRows;
  if (!row) return null;
  if (row.idempotency_key !== expectedKey) {
    throw new Error(
      "Notification smoke query returned the wrong idempotency key.",
    );
  }
  if (row.notification_status !== "sent") {
    throw new Error(
      `Notification smoke is ${row.notification_status}, not provider-accepted.`,
    );
  }

  const state = notificationStateSchema.parse(
    parseJsonColumn(row.notification_results, "Notification results"),
  );
  if (state.attemptCount !== 1) {
    throw new Error(
      "Notification smoke must have exactly one provider attempt.",
    );
  }
  const emailResults = state.adapters.filter(
    (result) => result.adapter === "email",
  );
  const [email] = emailResults;
  if (
    emailResults.length !== 1 ||
    email?.status !== "sent" ||
    !email.providerId
  ) {
    throw new Error(
      "Notification smoke must contain one provider-accepted email with an ID.",
    );
  }

  const notifiedAt = new Date(row.notified_at ?? Number.NaN);
  if (!Number.isFinite(notifiedAt.getTime())) {
    throw new Error("Notification smoke has no valid notified timestamp.");
  }

  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    notificationStatus: "sent" as const,
    notifiedAt,
    providerMessageId: email.providerId,
    attemptCount: 1 as const,
  } satisfies ParsedSubmission;
}

function receiptTimestamp(
  rawValue: string | undefined,
  notifiedAt: Date,
  generatedAt: Date,
) {
  if (!rawValue) return null;
  const receipt = new Date(rawValue);
  if (!Number.isFinite(receipt.getTime())) {
    throw new Error("Receipt confirmation must be a valid ISO timestamp.");
  }
  if (receipt.getTime() < notifiedAt.getTime()) {
    throw new Error("Receipt confirmation cannot predate the notification.");
  }
  if (receipt.getTime() > generatedAt.getTime()) {
    throw new Error("Receipt confirmation cannot be in the future.");
  }
  return receipt;
}

export function buildCloudflareNotificationSmokeReport(input: {
  mode: "apply" | "verify";
  origin: string;
  runId: string;
  generatedAt: Date;
  beforeRows: unknown;
  afterRows: unknown;
  responses: unknown;
  receiptConfirmedAt?: string;
}) {
  const origin = deploymentOriginSchema.parse(input.origin);
  const runId = notificationSmokeRunIdSchema.parse(input.runId);
  if (!Number.isFinite(input.generatedAt.getTime())) {
    throw new Error("Notification smoke audit time must be valid.");
  }
  const expectedKey = notificationSmokeIdempotencyKey(runId);
  const before = parseSubmissionRows(input.beforeRows, expectedKey);
  const after = parseSubmissionRows(input.afterRows, expectedKey);
  if (!after) throw new Error("Notification smoke lead was not persisted.");

  const responses = z.array(submissionResponseSchema).parse(input.responses);
  if (input.mode === "apply") {
    if (before) {
      throw new Error("Apply requires a fresh notification smoke run ID.");
    }
    if (
      responses.length !== 2 ||
      responses[0]?.duplicate !== false ||
      responses[1]?.duplicate !== true
    ) {
      throw new Error(
        "Apply must create once and then receive one duplicate response.",
      );
    }
  } else {
    if (!before) {
      throw new Error("Verify requires an existing notification smoke lead.");
    }
    if (responses.length !== 1 || responses[0]?.duplicate !== true) {
      throw new Error("Verify must receive one duplicate response.");
    }
    if (
      before.id !== after.id ||
      before.providerMessageId !== after.providerMessageId ||
      before.attemptCount !== after.attemptCount
    ) {
      throw new Error("Duplicate replay changed stored notification state.");
    }
  }
  if (responses.some((response) => response.id !== after.id)) {
    throw new Error(
      "Notification smoke responses do not match the stored lead.",
    );
  }

  const confirmedAt = receiptTimestamp(
    input.receiptConfirmedAt,
    after.notifiedAt,
    input.generatedAt,
  );
  const ready = confirmedAt !== null;

  return {
    schemaVersion: 1 as const,
    mode: input.mode,
    ready,
    origin,
    runId,
    generatedAt: input.generatedAt.toISOString(),
    checks: {
      adminInboxCreated: true as const,
      persistedExactlyOnce: true as const,
      duplicateSuppressed: true as const,
      providerAcceptedExactlyOnce: true as const,
      recipientReceiptConfirmed: ready,
    },
    submission: {
      notificationStatus: after.notificationStatus,
      attemptCount: after.attemptCount,
      providerMessageRecorded: true as const,
      notifiedAt: after.notifiedAt.toISOString(),
    },
    releaseEvidence: confirmedAt
      ? {
          provider: "resend" as const,
          submissionId: after.id,
          adminInboxCreated: true as const,
          deliveredCount: 1 as const,
          providerMessageId: after.providerMessageId,
          verifiedAt: confirmedAt.toISOString(),
        }
      : null,
  };
}
